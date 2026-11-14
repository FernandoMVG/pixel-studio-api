import { expect, it } from 'vitest';
import { addFrame } from '../animations/commands.ts';
import { setRows } from '../canvas/commands.ts';
import { createProject } from '../projects/model.ts';
import { exportGif } from './gif.ts';
import { exportText } from './text.ts';

/** Decodificador LZW de GIF mínimo, independiente del codificador. */
function lzwDecode(data: number[], minBits: number, count: number): number[] {
  const clear = 1 << minBits;
  let table: number[][] = [];
  const reset = () => {
    table = Array.from({ length: clear + 2 }, (_, i) => [i]);
  };
  reset();
  let size = minBits + 1;
  let pos = 0;
  let prev: number[] | null = null;
  const out: number[] = [];
  while (out.length < count) {
    let code = 0;
    for (let b = 0; b < size; b++, pos++) code |= ((data[pos >> 3]! >> (pos & 7)) & 1) << b;
    if (code === clear) {
      reset();
      size = minBits + 1;
      prev = null;
      continue;
    }
    if (code === clear + 1) break;
    const entry: number[] = table[code] ?? [...prev!, prev![0]!];
    out.push(...entry);
    if (prev) table.push([...prev, entry[0]!]);
    prev = entry;
    if (table.length === 1 << size && size < 12) size++;
  }
  return out;
}

function decodeGif(b: Uint8Array) {
  const sig = Buffer.from(b.subarray(0, 6)).toString('ascii');
  const width = b[6]! | (b[7]! << 8);
  const height = b[8]! | (b[9]! << 8);
  let p = 13 + (b[10]! & 0x80 ? 3 << ((b[10]! & 7) + 1) : 0);
  const frames: { delay: number; pixels: number[] }[] = [];
  let delay = 0;
  const readBlocks = () => {
    const data: number[] = [];
    for (let n = b[p++]!; n > 0; n = b[p++]!) {
      data.push(...b.subarray(p, p + n));
      p += n;
    }
    return data;
  };
  while (b[p] !== 0x3b) {
    if (b[p] === 0x21) {
      const label = b[p + 1]!;
      p += 2;
      const data = readBlocks();
      if (label === 0xf9) delay = data[1]! | (data[2]! << 8);
    } else {
      expect(b[p]).toBe(0x2c);
      expect(b[p + 9]! & 0x80).toBe(0); // sin tabla local
      p += 10;
      const minBits = b[p++]!;
      frames.push({ delay, pixels: lzwDecode(readBlocks(), minBits, width * height) });
    }
  }
  return { sig, width, height, frames };
}

it('exporta un GIF animado que se decodifica y un texto con cabecera', () => {
  let project = createProject({
    name: 'Bruma',
    palette: {
      K: { color: '#24203F', name: 'Contorno' },
      P: { color: '#8C7CF2', name: 'Cuerpo' },
      W: { color: '#FFFFFF', name: 'Ojos' },
      R: { color: '#FF7A9A', name: 'Mejillas' },
    },
  });
  project = setRows(project, { animation: 'reposo', frame: 0, startRow: 1, rows: ['.....KKKKKK.....', '...KKPPPPPPKK...'] }).project;
  project = addFrame(project, { animation: 'reposo', copyOf: 0 }).project;
  project = setRows(project, { animation: 'reposo', frame: 1, startRow: 1, rows: ['.....PPPPPP.....'] }).project;
  project.animations[0]!.fps = 4;

  const gif = decodeGif(exportGif(project, { animation: 'reposo', scale: 2 }));
  expect(gif.sig).toBe('GIF89a');
  expect([gif.width, gif.height]).toEqual([32, 32]);
  expect(gif.frames).toHaveLength(2);
  expect(gif.frames[0]!.delay).toBe(25);
  const at = (f: number, x: number, y: number) => gif.frames[f]!.pixels[y * 32 + x];
  expect(at(0, 0, 0)).toBe(0);
  expect(at(0, 12, 2)).toBe(1); // K
  expect(at(1, 12, 2)).toBe(2); // P
  expect(at(0, 8, 4)).toBe(1); // K en fila 2
  expect(at(0, 12, 4)).toBe(2); // P en fila 2

  const text = exportText(project, { animation: 'reposo' });
  expect(text.split('\n')[0]).toBe("# Bruma · animación 'reposo' · 2 cuadros · 4 fps · 16×16");
  expect(text).toContain('# Cuadro 1');
});
