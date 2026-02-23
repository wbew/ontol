import { test, expect } from "bun:test";
import { parseGitFlatFiles, type Folder, type FileEntry } from "./index";

function isFolder(e: Folder | FileEntry): e is Folder {
  return "entries" in e;
}

test("single nested file creates intermediate folder", () => {
  const root = parseGitFlatFiles([{ path: "a/b.txt", size: 10 }]);

  expect(root.path).toBe("");
  expect(root.entries).toHaveLength(1);

  const a = root.entries[0]!;
  expect(isFolder(a)).toBe(true);
  if (!isFolder(a)) return;
  expect(a.path).toBe("a");
  expect(a.entries).toHaveLength(1);
  expect(a.entries[0]).toEqual({ path: "a/b.txt", size: 10, extension: "txt" });
});

test("multiple files build correct hierarchy", () => {
  const root = parseGitFlatFiles([
    { path: "src/a.ts", size: 100 },
    { path: "src/lib/b.ts", size: 200 },
    { path: "README.md", size: 50 },
  ]);

  // root has src/ folder and README.md
  expect(root.entries).toHaveLength(2);

  const src = root.entries.find((e) => isFolder(e) && e.path === "src") as Folder;
  expect(src).toBeDefined();
  // src has a.ts and lib/
  expect(src.entries).toHaveLength(2);

  const lib = src.entries.find((e) => isFolder(e) && e.path === "src/lib") as Folder;
  expect(lib).toBeDefined();
  expect(lib.entries).toHaveLength(1);
  expect((lib.entries[0] as FileEntry).path).toBe("src/lib/b.ts");

  const readme = root.entries.find((e) => !isFolder(e)) as FileEntry;
  expect(readme.path).toBe("README.md");
  expect(readme.size).toBe(50);
});

test("empty input returns empty root", () => {
  const root = parseGitFlatFiles([]);
  expect(root.path).toBe("");
  expect(root.entries).toHaveLength(0);
});
