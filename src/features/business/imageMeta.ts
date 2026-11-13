/**
 * Read width/height from the first bytes of an image file. Supports PNG, GIF,
 * JPEG, WebP (VP8, VP8L, VP8X) and AVIF/HEIF (ispe box). Returns null when the
 * header is not recognised or not complete in the bytes provided.
 */
export interface ImageMeta {
  format: 'png' | 'gif' | 'jpeg' | 'webp' | 'avif' | 'svg';
  width: number;
  height: number;
}

export function readImageMeta(b: Buffer): ImageMeta | null {
  if (b.length < 16) return null;

  // PNG
  if (b.readUInt32BE(0) === 0x89504e47 && b.toString('ascii', 12, 16) === 'IHDR') {
    return { format: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  // GIF
  if (b.toString('ascii', 0, 3) === 'GIF') {
    return { format: 'gif', width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  }
  // JPEG: walk segments until a SOFn marker.
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = b.readUInt16BE(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { format: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return null;
  }
  // WebP
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ' && b.length >= 30) return { format: 'webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L' && b.length >= 25) {
      const bits = b.readUInt32LE(21);
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X' && b.length >= 30) {
      return { format: 'webp', width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    }
    return null;
  }
  // AVIF / HEIF: find the 'ispe' property box.
  if (b.toString('ascii', 4, 8) === 'ftyp' && /avif|avis|heic|heix|mif1/.test(b.toString('ascii', 8, 32))) {
    const at = b.indexOf('ispe');
    if (at > 0 && at + 16 <= b.length) return { format: 'avif', width: b.readUInt32BE(at + 8), height: b.readUInt32BE(at + 12) };
    return null;
  }
  // SVG: read the viewBox or width/height attributes.
  const head = b.toString('utf8', 0, Math.min(b.length, 4096));
  if (/<svg[\s>]/i.test(head)) {
    const vb = /viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(head);
    if (vb) return { format: 'svg', width: Math.round(Number(vb[1])), height: Math.round(Number(vb[2])) };
    const w = /\bwidth=["']([\d.]+)/i.exec(head);
    const h = /\bheight=["']([\d.]+)/i.exec(head);
    if (w && h) return { format: 'svg', width: Math.round(Number(w[1])), height: Math.round(Number(h[1])) };
  }
  return null;
}
