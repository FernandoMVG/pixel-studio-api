import { crc32, deflateSync } from 'node:zlib';
import { z } from 'zod';
import { findAnimation, findFrame, parse, TRANSPARENT, type Frame, type Project } from '../projects/model.js';

const Scale = z
  .number('La escala debe ser un entero entre 1 y 16')
  .int('La escala debe ser un entero entre 1 y 16')
  .min(1, 'La escala debe ser un entero entre 1 y 16')
  .max(16, 'La escala debe ser un entero entre 1 y 16')
  .default(1);
const Animation = z.string().min(1, 'Indica el nombre de la animación');

const FrameInput = z.object({ animation: Animation, frame: z.number().int().min(0, 'El cuadro empieza en 0'), scale: Scale });
const SheetInput = z.object({ animation: Animation, scale: Scale });

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** PNG RGBA de 8 bits, un solo IDAT, sin filtro. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  return new Uint8Array(
    Buffer.concat([Buffer.from(SIGNATURE), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]),
  );
}

/** Dibuja `rows` en `rgba` (`stride` = ancho total en píxeles de salida) desde la columna `offsetX`, con bloques de scale × scale. */
function rasterize(project: Project, rows: Frame, scale: number, rgba: Uint8Array, stride: number, offsetX: number): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]!;
      const hex = c === TRANSPARENT ? null : project.palette[c]!.color;
      const px = hex ? [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255] : [0, 0, 0, 0];
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) rgba.set(px, ((y * scale + dy) * stride + (offsetX + x) * scale + dx) * 4);
    }
  });
}

export function exportFramePng(project: Project, input: { animation: string; frame: number; scale?: number }): Uint8Array {
  const { animation, frame, scale } = parse(FrameInput, input);
  const { rows } = findFrame(project, animation, frame);
  const w = project.width * scale;
  const h = project.height * scale;
  const rgba = new Uint8Array(w * h * 4);
  rasterize(project, rows, scale, rgba, w, 0);
  return encodePng(w, h, rgba);
}

export function exportSpriteSheetPng(project: Project, input: { animation: string; scale?: number }): Uint8Array {
  const { animation, scale } = parse(SheetInput, input);
  const { frames } = project.animations[findAnimation(project, animation)]!;
  const w = project.width * scale * frames.length;
  const h = project.height * scale;
  const rgba = new Uint8Array(w * h * 4);
  frames.forEach((rows, i) => rasterize(project, rows, scale, rgba, w, i * project.width));
  return encodePng(w, h, rgba);
}
