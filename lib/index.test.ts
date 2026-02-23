import { test, expect } from "bun:test";
import { parseGitFlatFiles } from "./index";

test("parseGitFlatFiles builds folder from flat file list", () => {
  const files = [{ path: "a/b.txt", size: 10 }];

  const folder = parseGitFlatFiles(files);
  expect(folder.path).toBe("");
  expect(folder.entries).toHaveLength(1);
});
