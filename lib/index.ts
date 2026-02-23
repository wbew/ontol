// A repository is a codebase. A codebase is files/folders on disk.
// A repository is tracked over time/based on git commits. Each snapshot represents the entire repository at a given commit.
type Repository = {
  snapshots: Snapshot[];
  path: string;
};

type Snapshot = {
  id: string;
  src: Folder;
  timestamp: Date;
};

// A folder contains folders and files.
type Folder = {
  path: string;
  entries: (Folder | File)[];
};

// A file is some data, labelled, with a file extension.
type File = {
  path: string;
  extension: string;
  size: number;
};

export class GitRepository {
  private rootPath: string;

  constructor(path?: string) {
    if (!path) {
      path = process.cwd();
    }

    this.rootPath = path;

    // check if git repository
    const { stdout: isInsideWorkTree } = Bun.spawn([
      "git",
      "rev-parse",
      "--is-inside-work-tree",
    ]);
    if (isInsideWorkTree.toString().trim() !== "true") {
      throw new Error("Not a git repository");
    }
  }

  load(numSnapshots: number, path?: string): Repository {
    // check if git repository
    const { stdout: isInsideWorkTree } = Bun.spawn([
      "git",
      "rev-parse",
      "--is-inside-work-tree",
    ]);
    if (isInsideWorkTree.toString().trim() !== "true") {
      throw new Error("Not a git repository");
    }

    if (!path) {
      path = process.cwd();
    }

    // load commits
    const { stdout: commitHashes } = Bun.spawn([
      "git",
      "log",
      "--pretty=format:%H",
      `--max-count=${numSnapshots}`,
    ]);
    const commitHashesArray = commitHashes.toString().trim().split("\n");

    // for each commit, load a snapshot
    const snapshots: Snapshot[] = [];
    for (const commitHash of commitHashesArray) {
      const { stdout: tree } = Bun.spawn([
        "git",
        "ls-tree",
        "-r",
        commitHash,
        path,
      ]);
      const treeLines = tree.toString().trim().split("\n");
      // Example line:
      // 100644 blob 990da77bd57ad798d5346de676354ed0ea88c207     352    viz/index.html
      const files = treeLines.map((line) => {
        const [mode, type, hash, size, path] = line.split(" ");
        return {
          path: path || "",
          size: size ? parseInt(size) : 0,
        };
      });

      const folder = parseGitFlatFiles(files);
      snapshots.push({
        id: commitHash,
        src: folder,
        timestamp: new Date(commitHash),
      });
    }

    return {
      snapshots,
      path,
    };
  }
}

export function parseGitFlatFiles(
  files: { path: string; size: number }[],
): Folder {
  const folder: Folder = {
    path: "",
    entries: [],
  };

  for (const file of files) {
    const path = file.path;
    const size = file.size;
    if (path.endsWith("/")) {
      const folder = parseGitFlatFiles(
        files.filter((f) => f.path.startsWith(path)),
      );
      folder.entries.push(folder);
    } else {
      folder.entries.push({
        path,
        size,
        extension: path.split(".").pop() || "",
      });
    }
  }

  return folder;
}
