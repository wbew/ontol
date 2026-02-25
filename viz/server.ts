import { GitRepository, toD3 } from "../lib/index.ts";

const repoPath = process.env.ONTOL_REPO_PATH || process.cwd();

function getLiveTree() {
  const repo = new GitRepository(repoPath);
  const { snapshots } = repo.load(1);
  return toD3(snapshots[0]!.src);
}

function getSnapshots() {
  const repo = new GitRepository(repoPath);
  const { snapshots } = repo.load(100);
  return snapshots.map(s => ({
    id: s.id,
    timestamp: s.timestamp.toISOString(),
    tree: toD3(s.src),
  }));
}

const server = Bun.serve({
  port: 0,
  routes: {
    "/": new Response(await Bun.file(import.meta.dir + "/index.html").text(), {
      headers: { "Content-Type": "text/html" },
    }),
  },
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/tree") return Response.json(getLiveTree());
    if (url.pathname === "/api/snapshots") return Response.json(getSnapshots());
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Ontol viz → http://localhost:${server.port}`);
