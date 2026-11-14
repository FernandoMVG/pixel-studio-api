import { z } from 'zod';
import { ANIMATION_COMMANDS, applyAnimationPatch, invertAnimationPatch, type AnimationPatch } from '../animations/commands.ts';
import { applyPalettePatch, invertPalettePatch, setPalette, type PalettePatch } from '../palette/commands.ts';
import { available, findFrame as locate, parse, rowErrors, TRANSPARENT, ValidationError, type Frame, type Project } from '../projects/model.ts';

export type Change = { x: number; y: number; before: string; after: string };
export type PixelPatch = { kind: 'pixels'; animation: string; frame: number; changes: Change[] };
/** Cualquier parche que guarda el historial y reciben los clientes. */
export type Patch = PixelPatch | AnimationPatch | PalettePatch;
export type CommandResult = { project: Project; patch: PixelPatch };

const Target = {
  animation: z.string().min(1, 'Indica el nombre de la animación'),
  frame: z.number().int().min(0, 'El cuadro empieza en 0'),
};
const Pos = { x: z.number().int(), y: z.number().int() };
const Color = z.string().length(1, 'El color es una sola letra de la paleta, o . para transparente');

const colorError = (p: Project, c: string) =>
  c === TRANSPARENT || c in p.palette ? null : `Color '${c}' no existe en la paleta. Disponibles: ${available(p.palette)}`;
const outsideError = (p: Project, x: number, y: number) =>
  x >= 0 && y >= 0 && x < p.width && y < p.height ? null : `Píxel (${x}, ${y}) fuera del lienzo de ${p.width} × ${p.height}`;

const setChar = (row: string, x: number, c: string) => row.slice(0, x) + c + row.slice(x + 1);

/** Sustituye el cuadro por `next` y devuelve el proyecto nuevo con el parche de lo que cambió. */
function commit(project: Project, animation: string, frame: number, next: Frame): CommandResult {
  const { a, rows } = locate(project, animation, frame);
  const changes: Change[] = [];
  next.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== rows[y]![x]) changes.push({ x, y, before: rows[y]![x]!, after: row[x]! });
  });
  const out = structuredClone(project);
  out.animations[a]!.frames[frame] = next;
  return { project: out, patch: { kind: 'pixels', animation, frame, changes } };
}

const SetPixelsInput = z.object({
  ...Target,
  pixels: z.array(z.object({ ...Pos, color: Color })).min(1, 'Indica al menos un píxel'),
});

/** Pinta píxeles sueltos. Reporta todos los errores a la vez para que el agente los corrija en un intento. */
export function setPixels(project: Project, input: z.input<typeof SetPixelsInput>): CommandResult {
  const { animation, frame, pixels } = parse(SetPixelsInput, input);
  const next = [...locate(project, animation, frame).rows];
  const errors = pixels.flatMap(({ x, y, color }) => [outsideError(project, x, y), colorError(project, color)].filter((e) => e !== null));
  if (errors.length) throw new ValidationError([...new Set(errors)]);
  for (const { x, y, color } of pixels) next[y] = setChar(next[y]!, x, color);
  return commit(project, animation, frame, next);
}

const SetRowsInput = z.object({
  ...Target,
  startRow: z.number().int().min(0, 'La fila inicial empieza en 0').default(0),
  rows: z.array(z.string()).min(1, 'Indica al menos una fila'),
});

/** Reemplaza filas completas desde `startRow`. Es la forma natural de dibujar para el agente. */
export function setRows(project: Project, input: z.input<typeof SetRowsInput>): CommandResult {
  const { animation, frame, startRow, rows } = parse(SetRowsInput, input);
  const next = [...locate(project, animation, frame).rows];
  const end = startRow + rows.length - 1;
  if (end >= project.height)
    throw new ValidationError([`Las filas ${startRow} a ${end} se salen del lienzo: tiene ${project.height} filas (0 a ${project.height - 1})`]);
  next.splice(startRow, rows.length, ...rows);
  const errors = rowErrors(next, project.width, project.height, project.palette);
  if (errors.length) throw new ValidationError(errors);
  return commit(project, animation, frame, next);
}

const FillInput = z.object({ ...Target, ...Pos, color: Color });

/** Relleno por contigüidad (4 vecinos) desde (x, y). */
export function fill(project: Project, input: z.input<typeof FillInput>): CommandResult {
  const { animation, frame, x, y, color } = parse(FillInput, input);
  const next = [...locate(project, animation, frame).rows];
  const errors = [outsideError(project, x, y), colorError(project, color)].filter((e) => e !== null);
  if (errors.length) throw new ValidationError(errors);
  const from = next[y]![x]!;
  if (from === color) return commit(project, animation, frame, next);
  const stack: [number, number][] = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (next[cy]?.[cx] !== from) continue;
    next[cy] = setChar(next[cy]!, cx, color);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return commit(project, animation, frame, next);
}

/** Aplica un parche (lado `after`). Es lo mismo que hacen los clientes al recibirlo. */
export function applyPatch(project: Project, patch: Patch): Project {
  if (patch.kind === 'animation') return applyAnimationPatch(project, patch);
  if (patch.kind === 'palette') return applyPalettePatch(project, patch);
  const next = [...locate(project, patch.animation, patch.frame).rows];
  for (const c of patch.changes) next[c.y] = setChar(next[c.y]!, c.x, c.after);
  return commit(project, patch.animation, patch.frame, next).project;
}

/** El parche que deshace a `patch`: intercambia antes y después, en orden inverso. */
export function invert(patch: Patch): Patch {
  if (patch.kind === 'animation') return invertAnimationPatch(patch);
  if (patch.kind === 'palette') return invertPalettePatch(patch);
  return { ...patch, changes: [...patch.changes].reverse().map((c) => ({ ...c, before: c.after, after: c.before })) };
}

export const undo = (project: Project, patch: Patch) => applyPatch(project, invert(patch));
export const redo = applyPatch;

/** Todos los comandos que escriben el proyecto, por nombre, para lotes que llegan por HTTP o MCP. */
export const COMMANDS = { setPixels, setRows, fill, setPalette, ...ANIMATION_COMMANDS } as const;
export type CommandName = keyof typeof COMMANDS;
