import { z } from 'zod';
import { parse, PaletteSchema, ValidationError, type Palette, type Project } from '../projects/model.ts';

/** Cambio de paleta completo, antes y después. Los cuadros no cambian. */
export type PalettePatch = { kind: 'palette'; before: Palette; after: Palette };

const SetPaletteInput = z.object({ palette: PaletteSchema });

/**
 * Reemplaza la paleta. Cambiar color o nombre, o añadir letras, es libre.
 * Quitar una letra solo se permite si ningún cuadro la usa (si no, los píxeles quedarían sin color).
 */
export function setPalette(project: Project, input: z.input<typeof SetPaletteInput>): { project: Project; patch: PalettePatch } {
  const { palette } = parse(SetPaletteInput, input);
  const removed = Object.keys(project.palette).filter((k) => !(k in palette));
  const errors = removed.flatMap((k) => {
    const used = project.animations.reduce((n, a) => n + a.frames.reduce((m, f) => m + f.join('').split(k).length - 1, 0), 0);
    return used ? [`La letra '${k}' se usa en ${used} píxeles; píntalos con otro color antes de quitarla de la paleta`] : [];
  });
  if (errors.length) throw new ValidationError(errors);
  const patch: PalettePatch = { kind: 'palette', before: project.palette, after: palette };
  return { project: applyPalettePatch(project, patch), patch };
}

export const applyPalettePatch = (project: Project, patch: PalettePatch): Project => ({ ...structuredClone(project), palette: structuredClone(patch.after) });
export const invertPalettePatch = (p: PalettePatch): PalettePatch => ({ ...p, before: p.after, after: p.before });
