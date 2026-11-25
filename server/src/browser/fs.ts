// In-browser demo stand-in for Node's `fs`: only files kept on disk (videos, fileStore.ts) and the
// Files "Download all" archive (filesExport.ts) use it. The demo keeps every file in its in-memory
// database and refuses both, so anything reaching these is a bug.
const notInDemo = (): never => {
  throw new Error("Node's fs module isn't available in the in-browser demo");
};

export const createReadStream = notInDemo;
export const createWriteStream = notInDemo;
export const existsSync = notInDemo;
export const mkdirSync = notInDemo;
export const renameSync = notInDemo;
export const rmSync = notInDemo;
export const statSync = notInDemo;
