/**
 * A minimal ZIP writer (stored entries, no compression) to export several
 * models at once.
 *
 * Reiventing the wheel? yes, but I wanted no library deps and it to work
 * in browsers clientside.
 *
 * @author Roberto Metere
 * @license MIT
 */
class ZipWriter {
  /**
   * The CRC-32 table.
   *
   * @type {*}
   */
  static CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[n] = c >>> 0;
    }
    return t;
  })();

  /**
   * Computes the CRC-32 of bytes.
   *
   * @param {Array} bytes A Uint8Array.
   * @return {Object} The checksum.
   */
  static crc32(bytes: any[]) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      c = ZipWriter.CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  /**
   * Encodes a date the way ZIP does.
   *
   * @param {Object} d The date.
   * @return {Object} {time, date}.
   */
  static dosDateTime(d: any) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
  }

  /**
   * Builds an archive.
   *
   * @param {Array} files [{name, text}] (text may also be a Uint8Array).
   * @param {Object} now The date of the entries.
   * @return {Object} The archive as a Uint8Array.
   */
  static make(files: any[], now: any = new Date()) {
    const enc = new TextEncoder();
    const { time, date } = ZipWriter.dosDateTime(now);
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.text === "string" ? enc.encode(f.text) : f.text;
      const crc = ZipWriter.crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      locals.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
      ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      centrals.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const centralSize = centrals.reduce((s, a) => s + a.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
    const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
    const out = new Uint8Array(parts.reduce((s, a) => s + a.length, 0));
    let p = 0;
    for (const a of parts) {
      out.set(a, p);
      p += a.length;
    }
    return out;
  }
}
// ----------------------------------------------------------------
