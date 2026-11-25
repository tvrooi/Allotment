// In-browser demo stand-in for Node's `zlib`: only finding the text inside Word, Excel and PDF files
// for search uses it (fileText.ts, utils/unzip.ts). The demo's sample files are photos and plain
// PDFs, and adding files is off, so nothing reaches these.
const notInDemo = (): never => {
  throw new Error("Node's zlib module isn't available in the in-browser demo");
};

export const inflateSync = notInDemo;
export const inflateRawSync = notInDemo;
