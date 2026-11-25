// In-browser demo stand-in for Node's `os`: only fileStore.ts's folder for files on disk uses it,
// which the demo never has (its files are in the in-memory database).
export const tmpdir = (): never => {
  throw new Error("Node's os module isn't available in the in-browser demo");
};
