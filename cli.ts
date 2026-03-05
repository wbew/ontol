#!/usr/bin/env bun

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const command = process.argv[2];

if (command === "viz") {
  const args = process.argv.slice(3);
  const timeline = args.includes("--timeline");
  const pathArg = args.find(a => !a.startsWith("--"));
  process.env.ONTOL_REPO_PATH = resolve(pathArg || process.cwd());
  process.env.ONTOL_TIMELINE = timeline ? "1" : "";
  await import(resolve(__dir, "viz/server.ts"));
} else {
  console.log("Usage: ontol <command>\n");
  console.log("Commands:");
  console.log("  viz [path] [--timeline]  Visualize a git repository (defaults to current directory)");
  process.exit(1);
}
