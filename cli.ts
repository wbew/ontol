#!/usr/bin/env bun

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const command = process.argv[2];

if (command === "viz") {
  process.env.ONTOL_REPO_PATH = resolve(process.argv[3] || process.cwd());
  await import(resolve(__dir, "viz/server.ts"));
} else {
  console.log("Usage: ontol <command>\n");
  console.log("Commands:");
  console.log("  viz [path]  Visualize a git repository (defaults to current directory)");
  process.exit(1);
}
