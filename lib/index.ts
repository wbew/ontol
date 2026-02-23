// A repository is a codebase. A codebase is files/folders on disk.
// A repository is tracked over time/based on git commits. Each snapshot represents the entire repository at a given commit.
export type Repository = {
  snapshots: Snapshot[];
  path: string;
};

export type Snapshot = {
  id: string;
  src: Folder;
  timestamp: Date;
};

// A folder contains folders and files.
export type Folder = {
  path: string;
  entries: (Folder | FileEntry)[];
};

// A file is some data, labelled, with a file extension.
export type FileEntry = {
  path: string;
  extension: string;
  size: number;
};

export class GitRepository {
  private rootPath: string;

  constructor(path?: string) {
    this.rootPath = path ?? process.cwd();

    const result = Bun.spawnSync([
      "git",
      "rev-parse",
      "--is-inside-work-tree",
    ], { cwd: this.rootPath });
    if (result.stdout.toString().trim() !== "true") {
      throw new Error("Not a git repository");
    }
  }

  load(numSnapshots: number): Repository {
    // load commits with timestamps
    const logResult = Bun.spawnSync([
      "git",
      "log",
      "--pretty=format:%H|%aI",
      `--max-count=${numSnapshots}`,
    ], { cwd: this.rootPath });
    const logLines = logResult.stdout.toString().trim().split("\n");

    const snapshots: Snapshot[] = [];
    for (const line of logLines) {
      const [commitHash, dateStr] = line.split("|");
      if (!commitHash) continue;

      // git ls-tree -r --long uses tab between metadata and path,
      // and variable spaces between the other columns
      const treeResult = Bun.spawnSync([
        "git",
        "ls-tree",
        "-r",
        "--long",
        commitHash,
      ], { cwd: this.rootPath });
      const treeLines = treeResult.stdout.toString().trim().split("\n");

      const files: { path: string; size: number }[] = [];
      for (const treeLine of treeLines) {
        if (!treeLine) continue;
        // format: "<mode> <type> <hash> <size>\t<path>"
        const tabIdx = treeLine.indexOf("\t");
        if (tabIdx === -1) continue;
        const meta = treeLine.slice(0, tabIdx).trim();
        const filePath = treeLine.slice(tabIdx + 1);
        const size = parseInt(meta.split(/\s+/)[3] ?? "0", 10);
        files.push({ path: filePath, size });
      }

      snapshots.push({
        id: commitHash,
        src: parseGitFlatFiles(files),
        timestamp: new Date(dateStr ?? commitHash),
      });
    }

    return {
      snapshots,
      path: this.rootPath,
    };
  }
}

export function parseGitFlatFiles(
  files: { path: string; size: number }[],
): Folder {
  const root: Folder = { path: "", entries: [] };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    // walk/create intermediate folders
    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join("/");
      let existing = current.entries.find(
        (e): e is Folder => "entries" in e && e.path === folderPath,
      );
      if (!existing) {
        existing = { path: folderPath, entries: [] };
        current.entries.push(existing);
      }
      current = existing;
    }

    // insert leaf file
    current.entries.push({
      path: file.path,
      size: file.size,
      extension: file.path.split(".").pop() || "",
    });
  }

  return root;
}
