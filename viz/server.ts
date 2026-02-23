import { GitRepository, toD3 } from "../lib/index.ts";

const repo = new GitRepository();
const { snapshots } = repo.load(1);
const tree = toD3(snapshots[0]!.src);

const server = Bun.serve({
  port: 0,
  routes: {
    "/": new Response(await Bun.file(import.meta.dir + "/index.html").text(), {
      headers: { "Content-Type": "text/html" },
    }),
    "/api/tree": Response.json(tree),
  },
});

console.log(`Ontol viz → http://localhost:${server.port}`);
