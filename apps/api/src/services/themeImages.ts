import type { Theme } from "@flocksync/shared-types";

const allowedDimensions = (width: number, height: number): boolean =>
  width > 0 && height > 0 && width <= 2048 && height <= 2048;

const jpegDimensionsValid = (bytes: Buffer): boolean => {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 255) return false;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 217 || marker === 218 || offset + 2 > bytes.length) return false;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return false;
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
      return length >= 8 && allowedDimensions(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3));
    }
    offset += length;
  }
  return false;
};

export const validThemeImage = (theme: Theme): boolean => {
  if (!theme.customImage) return true;
  const [header, base64] = theme.customImage.split(",");
  if (!base64) return false;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.toString("base64") !== base64) return false;
  if (header === "data:image/png;base64") {
    return bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      && bytes.toString("ascii", 12, 16) === "IHDR"
      && allowedDimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
  }
  return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216
    && bytes.at(-2) === 255 && bytes.at(-1) === 217 && jpegDimensionsValid(bytes);
};
