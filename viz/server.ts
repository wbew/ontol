import { GitRepository, toD3, parseGitFlatFiles } from "../lib/index.ts";

const repoPath = process.env.ONTOL_REPO_PATH || process.cwd();

// --- Caches ---

let snapshotMetaCache: { headHash: string; meta: string } | null = null;
const snapshotTreeCache = new Map<string, string>(); // commitHash → JSON

function getHeadHash(): string {
  return Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: repoPath })
    .stdout.toString().trim();
}

function getSnapshotMeta(): string {
  const hash = getHeadHash();
  if (snapshotMetaCache && snapshotMetaCache.headHash === hash)
    return snapshotMetaCache.meta;
  const repo = new GitRepository(repoPath);
  const { snapshots } = repo.load(100);
  const meta = JSON.stringify(snapshots.map(s => ({
    id: s.id,
    timestamp: s.timestamp.toISOString(),
  })));
  // Pre-warm tree cache for latest snapshot
  const latest = snapshots[0];
  if (latest) {
    snapshotTreeCache.set(latest.id, JSON.stringify(toD3(latest.src)));
  }
  snapshotMetaCache = { headHash: hash, meta };
  return meta;
}

function getSnapshotTree(commitId: string): string | null {
  if (snapshotTreeCache.has(commitId)) return snapshotTreeCache.get(commitId)!;
  const result = Bun.spawnSync(
    ["git", "ls-tree", "-r", "--long", commitId],
    { cwd: repoPath },
  );
  const output = result.stdout.toString().trim();
  if (!output) return null;
  const files: { path: string; size: number }[] = [];
  for (const line of output.split("\n")) {
    if (!line) continue;
    const tabIdx = line.indexOf("\t");
    if (tabIdx === -1) continue;
    const meta = line.slice(0, tabIdx).trim();
    const filePath = line.slice(tabIdx + 1);
    const size = parseInt(meta.split(/\s+/)[3] ?? "0", 10);
    files.push({ path: filePath, size });
  }
  const json = JSON.stringify(toD3(parseGitFlatFiles(files)));
  snapshotTreeCache.set(commitId, json);
  return json;
}

// --- Server ---

const DEFAULT_PORT = 4747;

const indexHtml = new Response(await Bun.file(import.meta.dir + "/index.html").text(), {
  headers: { "Content-Type": "text/html" },
});

const serverOpts = {
  routes: { "/": indexHtml },
  fetch(req: Request) {
    const url = new URL(req.url);

    if (url.pathname === "/api/snapshots") {
      return new Response(getSnapshotMeta(), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const snapshotMatch = url.pathname.match(/^\/api\/snapshot\/([a-f0-9]+)$/);
    if (snapshotMatch) {
      const json = getSnapshotTree(snapshotMatch[1]);
      if (!json) return new Response("Not found", { status: 404 });
      return new Response(json, {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};

let server: ReturnType<typeof Bun.serve>;
try {
  server = Bun.serve({ port: DEFAULT_PORT, ...serverOpts });
} catch {
  server = Bun.serve({ port: 0, ...serverOpts });
  console.warn(`Port ${DEFAULT_PORT} is in use, falling back to ${server.port}`);
}

console.log(`Ontol viz → http://localhost:${server.port}`);
