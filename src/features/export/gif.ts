import { z } from 'zod';
import { findAnimation, parse, TRANSPARENT, type Project } from '../projects/model.ts';

const GifInput = z.object({
  animation: z.string().min(1, 'Indica el nombre de la animación'),
  scale: z
    .number('La escala debe ser un entero entre 1 y 16')
    .int('La escala debe ser un entero entre 1 y 16')
    .min(1, 'La escala debe ser un entero entre 1 y 16')
    .max(16, 'La escala debe ser un entero entre 1 y 16')
    .default(1),
});

/** LZW de GIF: códigos de `minBits + 1` a 12 bits, con clear al llenar la tabla. Devuelve los bytes sin sub-bloques. */
export function lzwEncode(pixels: Uint8Array, minBits: number): Uint8Array {
  const clear = 1 << minBits;
  const end = clear + 1;
  const out: number[] = [];
  let acc = 0;
  let nbits = 0;
  let size = minBits + 1;
  const emit = (code: number) => {
    acc |= code << nbits;
    nbits += size;
    while (nbits >= 8) {
      out.push(acc & 255);
      acc >>>= 8;
      nbits -= 8;
    }
  };

  let dict = new Map<number, number>();
  let next = end + 1;
  emit(clear);
  let prefix = pixels[0]!;
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i]!;
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next === 1 << size && size < 12) size++;
    dict.set(key, next++);
    if (next === 4096) {
      emit(clear);
      dict = new Map();
      next = end + 1;
      size = minBits + 1;
    }
    prefix = k;
  }
  emit(prefix);
  if (next === 1 << size && size < 12) size++;
  emit(end);
  if (nbits > 0) out.push(acc & 255);
  return Uint8Array.from(out);
}

const word = (n: number) => [n & 255, n >> 8];

function subBlocks(data: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < data.length; i += 255) {
    const part = data.subarray(i, i + 255);
    out.push(part.length, ...part);
  }
  out.push(0);
  return out;
}

/** GIF89a animado en bucle infinito. Índice 0 de la tabla = transparente; 1..n = paleta en orden. */
export function exportGif(project: Project, input: { animation: string; scale?: number }): Uint8Array {
  const { animation, scale } = parse(GifInput, input);
  const { fps, frames } = project.animations[findAnimation(project, animation)]!;
  const keys = Object.keys(project.palette);
  const tableBits = Math.max(2, Math.ceil(Math.log2(keys.length + 1)));
  const minBits = tableBits;
  const w = project.width * scale;
  const h = project.height * scale;

  const table = new Uint8Array(3 << tableBits);
  keys.forEach((k, i) => {
    const hex = project.palette[k]!.color;
    for (let c = 0; c < 3; c++) table[(i + 1) * 3 + c] = parseInt(hex.slice(1 + c * 2, 3 + c * 2), 16);
  });

  const bytes: number[] = [
    ...Buffer.from('GIF89a', 'ascii'),
    ...word(w),
    ...word(h),
    0x80 | ((tableBits - 1) << 4) | (tableBits - 1), // tabla global, profundidad, tamaño
    0, // fondo
    0, // aspecto
    ...table,
    0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0', 'ascii'), 3, 1, 0, 0, 0, // bucle infinito
  ];

  const delay = Math.round(100 / fps);
  for (const rows of frames) {
    const pixels = new Uint8Array(w * h);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = row[x]!;
        const idx = c === TRANSPARENT ? 0 : keys.indexOf(c) + 1;
        for (let dy = 0; dy < scale; dy++) pixels.fill(idx, (y * scale + dy) * w + x * scale, (y * scale + dy) * w + (x + 1) * scale);
      }
    });
    bytes.push(0x21, 0xf9, 4, (2 << 2) | 1, ...word(delay), 0, 0); // GCE: disposal 2, transparencia
    bytes.push(0x2c, 0, 0, 0, 0, ...word(w), ...word(h), 0, minBits);
    for (const b of subBlocks(lzwEncode(pixels, minBits))) bytes.push(b);
  }
  bytes.push(0x3b);
  return Uint8Array.from(bytes);
}
