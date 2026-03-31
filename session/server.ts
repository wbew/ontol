import { discoverSessions, parseSession } from "../lib/session.ts";

const projectPath = process.env.ONTOL_PROJECT_PATH || process.cwd();

// --- Caches ---

let sessionListCache: { key: string; data: string } | null = null;
const sessionDataCache = new Map<string, { mtime: number; data: string }>();

function getSessionListCacheKey(): string {
  // Simple: use current timestamp rounded to 5s so we re-scan periodically
  return String(Math.floor(Date.now() / 5000));
}

function getSessionList(): string {
  const key = getSessionListCacheKey();
  if (sessionListCache && sessionListCache.key === key) return sessionListCache.data;
  const data = JSON.stringify(discoverSessions(projectPath));
  sessionListCache = { key, data };
  return data;
}

function getSessionData(sessionId: string): string {
  // Validate session ID format (UUID)
  if (!/^[a-f0-9-]{36}$/.test(sessionId)) return "[]";

  const messages = parseSession(projectPath, sessionId);
  return JSON.stringify(messages);
}

// --- Server ---

const DEFAULT_PORT = 4748;

const indexHtml = new Response(
  await Bun.file(import.meta.dir + "/index.html").text(),
  { headers: { "Content-Type": "text/html" } },
);

const serverOpts = {
  routes: { "/": indexHtml },
  fetch(req: Request) {
    const url = new URL(req.url);

    if (url.pathname === "/api/sessions") {
      return new Response(getSessionList(), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const sessionMatch = url.pathname.match(
      /^\/api\/session\/([a-f0-9-]{36})$/,
    );
    if (sessionMatch) {
      return new Response(getSessionData(sessionMatch[1]), {
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
  console.warn(
    `Port ${DEFAULT_PORT} is in use, falling back to ${server.port}`,
  );
}

console.log(`Ontol session → http://localhost:${server.port}`);
