// Writes an 8-bit indexed PNG (palette index 0 transparent): the format of the game's pixel-art sprites.

import zlib from 'node:zlib';

export type Rgb = readonly [number, number, number];

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([head, body, crc]);
}

/** `pixels` holds one palette index per pixel, row by row; `colours[0]` is drawn transparent. */
export function indexedPng(width: number, height: number, pixels: Uint8Array, colours: readonly Rgb[]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 3, 0, 0, 0], 8);
  const raw = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y++) raw.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', Buffer.from(colours.flat())),
    chunk('tRNS', Buffer.from([0])),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
