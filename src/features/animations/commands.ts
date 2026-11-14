import { z } from 'zod';
import { blankFrame, findAnimation, FPS, parse, ValidationError, type Animation, type Project } from '../projects/model.ts';

/** Cambio de estructura: la animación en `index` antes y después. `null` = no existe (alta o baja). */
export type AnimationPatch = { kind: 'animation'; index: number; before: Animation | null; after: Animation | null };
export type AnimationResult = { project: Project; patch: AnimationPatch };

const AnimationName = z.string().trim().min(1, 'Indica el nombre de la animación').max(40, 'El nombre puede tener como máximo 40 caracteres');
const Fps = z.number().int().min(FPS.min, `Los fps van de ${FPS.min} a ${FPS.max}`).max(FPS.max, `Los fps van de ${FPS.min} a ${FPS.max}`);
const FrameIndex = z.number().int().min(0, 'El cuadro empieza en 0');

/** Aplica el parche (lado `after`). */
export function applyAnimationPatch(project: Project, patch: AnimationPatch): Project {
  const out = structuredClone(project);
  const { index, before, after } = patch;
  if (before === null) out.animations.splice(index, 0, structuredClone(after!));
  else if (after === null) out.animations.splice(index, 1);
  else out.animations[index] = structuredClone(after);
  return out;
}

export const invertAnimationPatch = (p: AnimationPatch): AnimationPatch => ({ ...p, before: p.after, after: p.before });

function result(project: Project, index: number, before: Animation | null, after: Animation | null): AnimationResult {
  const patch: AnimationPatch = { kind: 'animation', index, before, after };
  return { project: applyAnimationPatch(project, patch), patch };
}

function nameTaken(project: Project, name: string) {
  if (project.animations.some((a) => a.name === name)) throw new ValidationError([`Ya existe una animación llamada '${name}'`]);
}

function editAnimation(project: Project, animation: string, edit: (a: Animation) => void): AnimationResult {
  const i = findAnimation(project, animation);
  const before = project.animations[i]!;
  const after = structuredClone(before);
  edit(after);
  return result(project, i, before, after);
}

const AddFrameInput = z.object({ animation: AnimationName, at: FrameIndex.optional(), copyOf: FrameIndex.optional() });

/** Añade un cuadro vacío, o una copia de `copyOf`, en la posición `at` (por defecto, al final). */
export function addFrame(project: Project, input: z.input<typeof AddFrameInput>): AnimationResult {
  const { animation, at, copyOf } = parse(AddFrameInput, input);
  return editAnimation(project, animation, (a) => {
    const n = a.frames.length;
    if (at !== undefined && at > n) throw new ValidationError([`Posición ${at} fuera de rango: '${animation}' tiene ${n} cuadros, usa de 0 a ${n}`]);
    if (copyOf !== undefined && copyOf >= n)
      throw new ValidationError([`Cuadro ${copyOf} no existe en '${animation}': tiene ${n} cuadros (0 a ${n - 1})`]);
    const frame = copyOf === undefined ? blankFrame(project.width, project.height) : [...a.frames[copyOf]!];
    a.frames.splice(at ?? n, 0, frame);
  });
}

const DeleteFrameInput = z.object({ animation: AnimationName, frame: FrameIndex });

export function deleteFrame(project: Project, input: z.input<typeof DeleteFrameInput>): AnimationResult {
  const { animation, frame } = parse(DeleteFrameInput, input);
  return editAnimation(project, animation, (a) => {
    if (frame >= a.frames.length) throw new ValidationError([`Cuadro ${frame} no existe en '${animation}': tiene ${a.frames.length} cuadros (0 a ${a.frames.length - 1})`]);
    if (a.frames.length === 1) throw new ValidationError([`No se puede borrar el único cuadro de '${animation}'`]);
    a.frames.splice(frame, 1);
  });
}

const SetFpsInput = z.object({ animation: AnimationName, fps: Fps });

export function setFps(project: Project, input: z.input<typeof SetFpsInput>): AnimationResult {
  const { animation, fps } = parse(SetFpsInput, input);
  return editAnimation(project, animation, (a) => {
    a.fps = fps;
  });
}

const AddAnimationInput = z.object({ name: AnimationName, fps: Fps.default(FPS.default) });

/** Nueva animación al final, con un cuadro vacío. */
export function addAnimation(project: Project, input: z.input<typeof AddAnimationInput>): AnimationResult {
  const { name, fps } = parse(AddAnimationInput, input);
  nameTaken(project, name);
  return result(project, project.animations.length, null, { name, fps, frames: [blankFrame(project.width, project.height)] });
}

const RenameAnimationInput = z.object({ animation: AnimationName, name: AnimationName });

export function renameAnimation(project: Project, input: z.input<typeof RenameAnimationInput>): AnimationResult {
  const { animation, name } = parse(RenameAnimationInput, input);
  if (name !== animation) nameTaken(project, name);
  return editAnimation(project, animation, (a) => {
    a.name = name;
  });
}

const DeleteAnimationInput = z.object({ animation: AnimationName });

export function deleteAnimation(project: Project, input: z.input<typeof DeleteAnimationInput>): AnimationResult {
  const { animation } = parse(DeleteAnimationInput, input);
  const i = findAnimation(project, animation);
  if (project.animations.length === 1) throw new ValidationError([`No se puede borrar '${animation}': el proyecto necesita al menos una animación`]);
  return result(project, i, project.animations[i]!, null);
}

export const ANIMATION_COMMANDS = { addFrame, deleteFrame, setFps, addAnimation, renameAnimation, deleteAnimation } as const;
