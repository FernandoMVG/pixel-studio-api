import { z } from 'zod';

z.config(z.locales.es());

export const SCHEMA_VERSION = 1;
export const TRANSPARENT = '.';
export const SIDE = { min: 8, max: 32, default: 16 } as const;
export const COLORS = { min: 4, max: 6 } as const;
export const FPS = { min: 1, max: 24, default: 6 } as const;
export const DEFAULT_ANIMATION = 'reposo';

/** Error de validación con mensajes listos para el usuario o el agente. */
export class ValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(issues.join('\n'));
    this.issues = issues;
    this.name = 'ValidationError';
  }
}

/** Lo pedido no existe (proyecto, por ahora). */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

function formatIssues(issues: z.core.$ZodIssue[]): string[] {
  return issues.map((i) => {
    // En las claves de un record, el mensaje útil viene anidado.
    const message = i.code === 'invalid_key' ? (i.issues[0]?.message ?? i.message) : i.message;
    return i.path.length ? `${i.path.join('.')}: ${message}` : message;
  });
}

/** Valida `input` con `schema` y lanza ValidationError con mensajes en español si falla. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(formatIssues(r.error.issues));
  return r.data;
}

const Name = z.string().trim().min(1, 'El nombre no puede estar vacío').max(40, 'El nombre puede tener como máximo 40 caracteres');
const Side = z
  .number()
  .int('El tamaño del lienzo debe ser un número entero')
  .min(SIDE.min, `El lienzo debe medir entre ${SIDE.min} y ${SIDE.max} píxeles por lado`)
  .max(SIDE.max, `El lienzo debe medir entre ${SIDE.min} y ${SIDE.max} píxeles por lado`);

export const PaletteKey = z
  .string()
  .regex(/^[A-Z]$/, { error: (i) => `La letra '${String(i.input)}' no es válida: usa una sola letra mayúscula de la A a la Z` });

const PaletteEntry = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, { error: (i) => `Color '${String(i.input)}' no es válido: usa el formato #RRGGBB` }),
  name: Name,
});

export const PaletteSchema = z.record(PaletteKey, PaletteEntry).superRefine((p, ctx) => {
  const n = Object.keys(p).length;
  if (n < COLORS.min || n > COLORS.max)
    ctx.addIssue({ code: 'custom', message: `La paleta tiene ${n} colores; debe tener entre ${COLORS.min} y ${COLORS.max}` });
});

const AnimationSchema = z.object({
  name: Name,
  fps: z.number().int().min(FPS.min).max(FPS.max),
  frames: z.array(z.array(z.string())).min(1, 'La animación necesita al menos un cuadro'),
});

export type Palette = z.infer<typeof PaletteSchema>;
export type Frame = string[];

/** `. K P L W R`: lo que se le muestra al agente cuando usa un color que no existe. */
export const available = (palette: Palette) => [TRANSPARENT, ...Object.keys(palette)].join(' ');

/** Errores de un cuadro: número de filas, largo de cada fila y colores fuera de la paleta. Una línea por fila como máximo. */
export function rowErrors(rows: string[], width: number, height: number, palette: Palette, where = ''): string[] {
  const errors: string[] = [];
  if (rows.length !== height) errors.push(`${where}El cuadro tiene ${rows.length} filas, se esperaban ${height}`);
  rows.forEach((row, y) => {
    if (row.length !== width) return errors.push(`${where}Fila ${y} tiene ${row.length} caracteres, se esperaban ${width}`);
    const x = [...row].findIndex((c) => c !== TRANSPARENT && !(c in palette));
    if (x >= 0) errors.push(`${where}Fila ${y}, columna ${x}: color '${row[x]}' no existe en la paleta. Disponibles: ${available(palette)}`);
  });
  return errors;
}

export const ProjectSchema = z
  .object({
    version: z.literal(SCHEMA_VERSION),
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'El id solo puede tener minúsculas, números y guiones'),
    name: Name,
    width: Side,
    height: Side,
    palette: PaletteSchema,
    animations: z.array(AnimationSchema).min(1, 'El proyecto necesita al menos una animación'),
  })
  .superRefine((p, ctx) => {
    const seen = new Set<string>();
    for (const a of p.animations) {
      if (seen.has(a.name)) ctx.addIssue({ code: 'custom', message: `Hay dos animaciones llamadas '${a.name}'` });
      seen.add(a.name);
      a.frames.forEach((f, i) =>
        rowErrors(f, p.width, p.height, p.palette, `Animación '${a.name}', cuadro ${i}: `).forEach((message) =>
          ctx.addIssue({ code: 'custom', message }),
        ),
      );
    }
  });

export type Project = z.infer<typeof ProjectSchema>;
export type Animation = Project['animations'][number];

/** Busca una animación por nombre; con `frame`, también el cuadro. Lanza ValidationError con las opciones válidas. */
export function findAnimation(project: Project, animation: string): number {
  const a = project.animations.findIndex((x) => x.name === animation);
  if (a < 0) {
    const names = project.animations.map((x) => x.name).join(', ');
    throw new ValidationError([`Animación '${animation}' no existe. Disponibles: ${names}`]);
  }
  return a;
}

export function findFrame(project: Project, animation: string, frame: number): { a: number; rows: Frame } {
  const a = findAnimation(project, animation);
  const frames = project.animations[a]!.frames;
  const rows = frames[frame];
  if (!rows) throw new ValidationError([`Cuadro ${frame} no existe en '${animation}': tiene ${frames.length} cuadros (0 a ${frames.length - 1})`]);
  return { a, rows };
}

export const blankFrame =(width: number, height: number): Frame => Array.from({ length: height }, () => TRANSPARENT.repeat(width));

export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'proyecto';
}

const CreateProjectInput = z.object({
  name: Name,
  width: Side.default(SIDE.default),
  height: Side.default(SIDE.default),
  palette: PaletteSchema,
});

/** Proyecto nuevo con una animación de un cuadro vacío. La unicidad del id la comprueba el almacenamiento. */
export function createProject(input: z.input<typeof CreateProjectInput>): Project {
  const { name, width, height, palette } = parse(CreateProjectInput, input);
  return {
    version: SCHEMA_VERSION,
    id: slugify(name),
    name,
    width,
    height,
    palette,
    animations: [{ name: DEFAULT_ANIMATION, fps: FPS.default, frames: [blankFrame(width, height)] }],
  };
}

/** Valida un proyecto que viene de fuera (archivo, red) y lanza ValidationError si no cumple el modelo. */
export const parseProject = (input: unknown): Project => parse(ProjectSchema, input);
