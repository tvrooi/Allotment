// In-browser demo stand-in for Node's global `Buffer`, set up before anything else in the worker
// (worker.ts imports this first). Stored files are BLOB columns that Drizzle reads back with
// `Buffer.from`, and the receipt and file code tells types apart with `toString('latin1')`, so
// the worker needs the part of Buffer those use: bytes as a Uint8Array with Node's helpers.
type Encoding = 'utf8' | 'utf-8' | 'latin1' | 'binary' | 'ascii' | 'base64' | 'hex';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function latin1(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return text;
}

export class DemoBuffer extends Uint8Array {
  toString(encoding: Encoding = 'utf8', start = 0, end = this.length): string {
    const bytes = this.subarray(start, end);
    switch (encoding) {
      case 'latin1':
      case 'binary':
        return latin1(bytes);
      case 'ascii':
        return latin1(bytes.map((b) => b & 0x7f));
      case 'base64':
        return btoa(latin1(bytes));
      case 'hex':
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      default:
        return decoder.decode(bytes);
    }
  }

  // Reading zip headers (utils/unzip.ts), which file-type checks do for any unrecognised file
  readUInt16LE(offset = 0): number {
    if (offset < 0 || offset + 2 > this.length) throw new RangeError('Attempt to read beyond end');
    return this[offset] | (this[offset + 1] << 8);
  }

  readUInt32LE(offset = 0): number {
    if (offset < 0 || offset + 4 > this.length) throw new RangeError('Attempt to read beyond end');
    return (
      (this[offset] | (this[offset + 1] << 8) | (this[offset + 2] << 16)) +
      this[offset + 3] * 0x1000000
    );
  }

  equals(other: Uint8Array): boolean {
    return this.length === other.length && this.every((b, i) => b === other[i]);
  }
}

/** Buffer's static helpers, over DemoBuffer */
const helpers = {
  isBuffer(value: unknown): value is DemoBuffer {
    return value instanceof DemoBuffer;
  },

  alloc(size: number): DemoBuffer {
    return new DemoBuffer(size);
  },

  from(
    value: string | ArrayBuffer | ArrayLike<number> | Uint8Array,
    encodingOrOffset?: Encoding | number,
    length?: number,
  ): DemoBuffer {
    if (typeof value === 'string') {
      const encoding = (encodingOrOffset as Encoding | undefined) ?? 'utf8';
      if (encoding === 'base64') {
        const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
        return helpers.from(Array.from(raw, (c) => c.charCodeAt(0)));
      }
      if (encoding === 'hex') {
        const out = new DemoBuffer(value.length >> 1);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
        return out;
      }
      if (encoding === 'latin1' || encoding === 'binary' || encoding === 'ascii')
        return helpers.from(Array.from(value, (c) => c.charCodeAt(0) & 0xff));
      const bytes = encoder.encode(value);
      return new DemoBuffer(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    if (value instanceof ArrayBuffer)
      return new DemoBuffer(value, (encodingOrOffset as number | undefined) ?? 0, length);
    // A copy, as Node's Buffer.from(array) makes
    const out = new DemoBuffer(value.length);
    out.set(value as ArrayLike<number>);
    return out;
  },

  concat(list: readonly Uint8Array[], totalLength?: number): DemoBuffer {
    const total = totalLength ?? list.reduce((n, b) => n + b.length, 0);
    const out = new DemoBuffer(total);
    let offset = 0;
    for (const bytes of list) {
      if (offset >= total) break;
      out.set(bytes.subarray(0, total - offset), offset);
      offset += bytes.length;
    }
    return out;
  },
};

/**
 * The global: DemoBuffer itself (Drizzle's sql.js driver checks `value instanceof Buffer`) with
 * Node's static helpers on it
 */
export const Buffer = Object.assign(DemoBuffer, helpers);

const scope = globalThis as unknown as { Buffer?: unknown };
scope.Buffer ??= Buffer;
