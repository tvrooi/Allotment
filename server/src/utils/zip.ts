// A minimal ZIP writer: files stored uncompressed (receipts are already-compressed photos and
// PDFs), with CRC-32 and UTF-8 names, which every unzip tool and operating system opens.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, which ZIP stores (local time, two-second resolution) */
function dosTime(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day =
    ((Math.max(1980, date.getFullYear()) - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, day };
}

export function zip(files: { name: string; data: Uint8Array }[], when = new Date()): Buffer {
  const { time, day } = dosTime(when);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const crc = crc32(file.data);
    const size = file.data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, Buffer.from(file.data));

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // made by
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + size;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  if (offset > 0xffffffff || files.length > 0xffff)
    throw new RangeError('Too much for one archive');
  return Buffer.concat([...locals, directory, end]);
}

/**
 * The same archive written as it is made, for archives too large to hold in memory (every file
 * in Files): entries go out one by one, and the directory at the end. Files on disk are read
 * twice (once for the CRC, once to send), so nothing large is ever held in memory.
 */
export class ZipWriter {
  private centrals: Buffer[] = [];
  private offset = 0;
  private count = 0;
  private readonly time: number;
  private readonly day: number;

  constructor(
    private readonly write: (chunk: Buffer) => Promise<void>,
    when = new Date(),
  ) {
    ({ time: this.time, day: this.day } = dosTime(when));
  }

  private headers(name: Buffer, crc: number, size: number) {
    if (this.offset + 30 + name.length + size > 0xffffffff || this.count >= 0xffff)
      throw new RangeError('Too much for one archive');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(this.time, 10);
    local.writeUInt16LE(this.day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(this.time, 12);
    central.writeUInt16LE(this.day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(this.offset, 42);
    this.centrals.push(central, name);
    this.offset += 30 + name.length + size;
    this.count++;
    return Buffer.concat([local, name]);
  }

  async add(fileName: string, data: Uint8Array) {
    const name = Buffer.from(fileName, 'utf8');
    await this.write(this.headers(name, crc32(data), data.length));
    await this.write(Buffer.from(data));
  }

  /**
   * A file read in chunks, twice: `read` opens it afresh each time (fs.createReadStream). No Node
   * module here, so the in-browser demo can bundle this file too.
   */
  async addStream(fileName: string, read: () => AsyncIterable<Uint8Array>) {
    let crc = 0xffffffff;
    let size = 0;
    for await (const chunk of read()) {
      for (let i = 0; i < chunk.length; i++) crc = CRC_TABLE[(crc ^ chunk[i]) & 0xff] ^ (crc >>> 8);
      size += chunk.length;
    }
    const name = Buffer.from(fileName, 'utf8');
    await this.write(this.headers(name, (crc ^ 0xffffffff) >>> 0, size));
    for await (const chunk of read()) await this.write(Buffer.from(chunk));
  }

  async finish() {
    const directory = Buffer.concat(this.centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.count, 8);
    end.writeUInt16LE(this.count, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(this.offset, 16);
    await this.write(Buffer.concat([directory, end]));
  }
}
