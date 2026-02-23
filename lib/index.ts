// A repository is a codebase. A codebase is files/folders on disk.
// A repository is tracked over time/based on git commits. Each snapshot represents the entire repository at a given commit.
type Repository = {
  snapshots: {
    Folder
    Timestamp
  }[]
  path: string
}

// A folder contains folders and files.
type Folder = {
 path: string
 entries: []Folder | File
 size: int
}

// A file is some data, labelled, with a file extension.
type File = {
  path: string
  extension: string
  size: int
}

// numSnapshots - how many commits to snapshot
// im making an assumption that, given git metadata, we can piece together the Repository data structure. i don't know exactly how that'll work yet
function loadRepository(numSnapshots) -> Repository

// Given a rootPath, recursively traverse to generate a complete Folder structure
function parseFolder(rootPath) -> Folder

