import { test, expect } from "bun:test";
import { parseGitFlatFiles, toD3, type Folder, type FileEntry } from "./index";

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

test("toD3 converts folder tree to d3 hierarchy shape", () => {
  const folder = parseGitFlatFiles([
    { path: "src/a.ts", size: 100 },
    { path: "src/lib/b.ts", size: 200 },
    { path: "README.md", size: 50 },
  ]);

  const d3tree = toD3(folder);

  expect(d3tree.name).toBe("/");
  expect(d3tree.children).toHaveLength(2);

  const src = d3tree.children!.find((c) => c.name === "src")!;
  expect(src.children).toHaveLength(2);

  const lib = src.children!.find((c) => c.name === "lib")!;
  expect(lib.children).toHaveLength(1);
  expect(lib.children![0]).toEqual({ name: "b.ts", value: 200 });

  const readme = d3tree.children!.find((c) => c.name === "README.md")!;
  expect(readme.value).toBe(50);
  expect(readme.children).toBeUndefined();
});
