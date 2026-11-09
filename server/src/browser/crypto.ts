// In-browser demo stand-in for Node's `crypto`: only sign-in, bank connections, receipts and
// stored files use it, which the demo refuses. Without it the dev server hands the worker Vite's
// externalized module, whose named imports throw as soon as a file importing them loads.
// Every name a server file imports from `crypto` must be exported here.
const notInDemo = (): never => {
  throw new Error("Node's crypto module isn't available in the in-browser demo");
};

export const createCipheriv = notInDemo;
export const createDecipheriv = notInDemo;
export const createHash = notInDemo;
export const createHmac = notInDemo;
export const createPrivateKey = notInDemo;
export const generateKeyPairSync = notInDemo;
export const randomBytes = notInDemo;
export const randomInt = notInDemo;
export const scrypt = notInDemo;
export const sign = notInDemo;
export const timingSafeEqual = notInDemo;
export const verify = notInDemo;
