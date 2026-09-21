/**
 * Минимальный парсер WOFF2 -> таблица cmap -> множество покрытых кодовых точек.
 * Нужен, чтобы на этапе сборки убедиться: в шрифте есть ғ ӣ қ ӯ ҳ ҷ.
 * Без внешних зависимостей: brotli берём из встроенного zlib.
 */
import { brotliDecompressSync } from 'node:zlib';

const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post',
  'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT',
  'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
  'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
  'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
  'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
  'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

class Reader {
  constructor(buf) {
    this.buf = buf;
    this.pos = 0;
  }
  u8() { return this.buf.readUInt8(this.pos++); }
  u16() { const v = this.buf.readUInt16BE(this.pos); this.pos += 2; return v; }
  u32() { const v = this.buf.readUInt32BE(this.pos); this.pos += 4; return v; }
  tag() { const v = this.buf.toString('latin1', this.pos, this.pos + 4); this.pos += 4; return v; }
  /** UIntBase128: 7 бит на байт, старший бит — признак продолжения. */
  base128() {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = this.u8();
      if (i === 0 && byte === 0x80) throw new Error('UIntBase128: недопустимый ведущий ноль');
      if (value & 0xfe000000) throw new Error('UIntBase128: переполнение');
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) return value >>> 0;
    }
    throw new Error('UIntBase128: слишком длинное число');
  }
}

/** Достаёт распакованную таблицу по тегу из woff2-буфера. */
export function extractTable(woff2Buffer, wantedTag) {
  const r = new Reader(woff2Buffer);
  if (r.tag() !== 'wOF2') throw new Error('не woff2');
  const flavor = r.tag();
  r.u32(); // length
  const numTables = r.u16();
  r.u16(); // reserved
  r.u32(); // totalSfntSize
  const totalCompressedSize = r.u32();
  r.u16(); r.u16(); // version
  r.u32(); r.u32(); r.u32(); // meta
  r.u32(); r.u32(); // priv

  const entries = [];
  for (let i = 0; i < numTables; i++) {
    const flags = r.u8();
    const idx = flags & 0x3f;
    const xform = (flags >> 6) & 0x03;
    const tag = idx === 63 ? r.tag() : KNOWN_TAGS[idx];
    const origLength = r.base128();
    // Для glyf/loca версия 3 означает «без преобразования», для остальных — версия 0.
    const transformed = tag === 'glyf' || tag === 'loca' ? xform !== 3 : xform !== 0;
    const streamLength = transformed ? r.base128() : origLength;
    entries.push({ tag, streamLength });
  }

  if (flavor === 'ttcf') throw new Error('коллекции шрифтов не поддерживаются');

  const compressed = woff2Buffer.subarray(r.pos, r.pos + totalCompressedSize);
  const stream = brotliDecompressSync(compressed);

  let offset = 0;
  for (const e of entries) {
    if (e.tag === wantedTag) return stream.subarray(offset, offset + e.streamLength);
    offset += e.streamLength;
  }
  return null;
}

/** Разбирает cmap и возвращает Set покрытых кодовых точек. */
export function cmapCodepoints(cmap) {
  const r = new Reader(cmap);
  r.u16(); // version
  const numTables = r.u16();
  const subtables = [];
  for (let i = 0; i < numTables; i++) {
    const platformID = r.u16();
    const encodingID = r.u16();
    const offset = r.u32();
    subtables.push({ platformID, encodingID, offset });
  }
  // Приоритет: (3,10) UCS-4 > (3,1) BMP > (0,*) Unicode
  const pick =
    subtables.find((s) => s.platformID === 3 && s.encodingID === 10) ??
    subtables.find((s) => s.platformID === 3 && s.encodingID === 1) ??
    subtables.find((s) => s.platformID === 0);
  if (!pick) throw new Error('в cmap нет пригодной подтаблицы');

  const out = new Set();
  const sub = new Reader(cmap);
  sub.pos = pick.offset;
  const format = sub.u16();

  if (format === 4) {
    sub.u16(); // length
    sub.u16(); // language
    const segCount = sub.u16() / 2;
    sub.u16(); sub.u16(); sub.u16(); // searchRange, entrySelector, rangeShift
    const endCode = [], startCode = [], idDelta = [], idRangeOffset = [], idRangeOffsetPos = [];
    for (let i = 0; i < segCount; i++) endCode.push(sub.u16());
    sub.u16(); // reservedPad
    for (let i = 0; i < segCount; i++) startCode.push(sub.u16());
    for (let i = 0; i < segCount; i++) idDelta.push(sub.buf.readInt16BE((sub.pos += 2) - 2));
    for (let i = 0; i < segCount; i++) { idRangeOffsetPos.push(sub.pos); idRangeOffset.push(sub.u16()); }
    for (let i = 0; i < segCount; i++) {
      if (startCode[i] === 0xffff) continue;
      for (let c = startCode[i]; c <= endCode[i] && c !== 0x10000; c++) {
        let glyph;
        if (idRangeOffset[i] === 0) {
          glyph = (c + idDelta[i]) & 0xffff;
        } else {
          const gpos = idRangeOffsetPos[i] + idRangeOffset[i] + (c - startCode[i]) * 2;
          if (gpos + 1 >= cmap.length) continue;
          glyph = cmap.readUInt16BE(gpos);
          if (glyph !== 0) glyph = (glyph + idDelta[i]) & 0xffff;
        }
        if (glyph !== 0) out.add(c);
      }
    }
  } else if (format === 12) {
    sub.u16(); // reserved
    sub.u32(); // length
    sub.u32(); // language
    const nGroups = sub.u32();
    for (let i = 0; i < nGroups; i++) {
      const start = sub.u32();
      const end = sub.u32();
      const startGlyph = sub.u32();
      if (startGlyph === 0 && start === 0) continue;
      for (let c = start; c <= end; c++) out.add(c);
    }
  } else if (format === 6) {
    sub.u16(); sub.u16(); // length, language
    const first = sub.u16();
    const count = sub.u16();
    for (let i = 0; i < count; i++) {
      const glyph = sub.u16();
      if (glyph !== 0) out.add(first + i);
    }
  } else {
    throw new Error(`формат cmap ${format} не поддерживается`);
  }
  return out;
}
