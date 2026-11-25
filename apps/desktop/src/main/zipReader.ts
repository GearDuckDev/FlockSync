import { crc32, inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  path: string;
  data: Buffer;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_ENTRIES = 2_000;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

const corrupt = (detail: string): Error => new Error(`Invalid ZIP archive: ${detail}.`);

const findEndOfCentralDirectory = (zip: Buffer): number => {
  const floor = Math.max(0, zip.length - 22 - 0xffff);
  for (let offset = zip.length - 22; offset >= floor; offset--) {
    if (zip.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw corrupt('end of central directory not found');
};

/** Reads a stored/deflated ZIP fully in memory, verifying sizes and CRCs. ZIP64 and encryption are rejected. */
export const readZipEntries = (zip: Buffer): ZipEntry[] => {
  if (zip.length < 22) throw corrupt('file too small');
  const eocd = findEndOfCentralDirectory(zip);
  const count = zip.readUInt16LE(eocd + 10);
  const directoryOffset = zip.readUInt32LE(eocd + 16);
  if (count === 0xffff || directoryOffset === 0xffffffff) throw corrupt('ZIP64 is not supported');
  if (count > MAX_ENTRIES) throw corrupt('too many entries');
  const entries: ZipEntry[] = [];
  let cursor = directoryOffset;
  let totalBytes = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > zip.length || zip.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw corrupt('bad central directory entry');
    }
    const flags = zip.readUInt16LE(cursor + 8);
    const method = zip.readUInt16LE(cursor + 10);
    const expectedCrc = zip.readUInt32LE(cursor + 16);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const size = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const path = zip.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    if ((flags & 0x1) !== 0) throw corrupt(`${path} is encrypted`);
    totalBytes += size;
    if (totalBytes > MAX_TOTAL_BYTES) throw corrupt('uncompressed size limit exceeded');
    if (localOffset + 30 > zip.length || zip.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
      throw corrupt(`bad local header for ${path}`);
    }
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    if (dataStart + compressedSize > zip.length) throw corrupt(`${path} is truncated`);
    const raw = zip.subarray(dataStart, dataStart + compressedSize);
    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = inflateRawSync(raw, { maxOutputLength: Math.max(1, size) });
    else throw corrupt(`${path} uses unsupported compression method ${method}`);
    if (data.length !== size || crc32(data) !== expectedCrc) throw corrupt(`${path} failed its integrity check`);
    entries.push({ path, data });
  }
  return entries;
};
