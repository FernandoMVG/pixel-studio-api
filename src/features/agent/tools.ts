import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Patch } from '../canvas/commands.ts';
import type { CanvasService } from '../canvas/service.ts';
import { exportFramePng } from '../export/png.ts';
import { findFrame, NotFoundError, TRANSPARENT, ValidationError, type Project } from '../projects/model.ts';
import type { ProjectsService } from '../projects/service.ts';
import type { AgentPermissions } from '../settings/model.ts';

/** Por defecto: todo menos borrar. */
export const DEFAULT_PERMISSIONS: AgentPermissions = { create: true, delete: false };

/** Sesión de historial del agente. ponytail: una sola para todos los agentes conectados; basta en uso local con un agente. */
export const AGENT_SESSION = 'agente';

type Deps = { projects: ProjectsService; canvas: CanvasService };

const text = (t: string): CallToolResult => ({ content: [{ type: 'text', text: t }] });

/** Los errores de validación vuelven como resultado para que el agente los lea y se corrija. */
async function guard(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ValidationError) return { isError: true, content: [{ type: 'text', text: e.issues.join('\n') }] };
    if (e instanceof NotFoundError) return { isError: true, content: [{ type: 'text', text: e.message }] };
    throw e;
  }
}

const legend = (p: Project) =>
  [`${TRANSPARENT} transparente`, ...Object.entries(p.palette).map(([k, v]) => `${k} ${v.name} ${v.color}`)].join(' | ');

/** Lo que "ve" el agente de un cuadro: cabecera, paleta y filas numeradas. */
export function frameText(p: Project, animation: string, frame: number): string {
  const { a, rows } = findFrame(p, animation, frame);
  const pad = String(p.height - 1).length;
  return [
    `${p.name}: animación '${animation}', cuadro ${frame} (hay ${p.animations[a]!.frames.length}, del 0 al ${p.animations[a]!.frames.length - 1}), lienzo ${p.width} × ${p.height}`,
    `Paleta: ${legend(p)}`,
    ...rows.map((r, y) => `${String(y).padStart(pad, '0')} ${r}`),
  ].join('\n');
}

function summary(p: Project): string {
  const anims = p.animations.map((a) => `'${a.name}' (${a.frames.length} ${a.frames.length === 1 ? 'cuadro' : 'cuadros'}, ${a.fps} fps)`).join(', ');
  return `${p.id}: ${p.name}, ${p.width} × ${p.height}. Animaciones: ${anims}. Paleta: ${legend(p)}`;
}

function describe(patches: Patch[]): string {
  if (!patches.length) return 'Sin cambios.';
  const pixels = patches.reduce((n, p) => n + (p.kind === 'pixels' ? p.changes.length : 0), 0);
  const structure = patches.filter((p) => p.kind !== 'pixels').length;
  return [pixels && `${pixels} píxeles cambiados`, structure && `${structure} cambios de estructura`].filter(Boolean).join(', ') + '.';
}

const project = z.string().describe("Id del proyecto, p. ej. 'bruma'");
const animation = z.string().describe("Nombre de la animación, p. ej. 'reposo'");
const frame = z.number().int().describe('Índice del cuadro, empieza en 0');
const color = z.string().describe("Una letra de la paleta, o '.' para transparente");

export function createAgentServer({ projects, canvas }: Deps, perms: AgentPermissions = DEFAULT_PERMISSIONS): McpServer {
  const server = new McpServer({ name: 'pixel-studio', version: '0.1.0' });

  /** Ejecuta un comando como lote de uno en la sesión del agente; responde con el resumen y el cuadro resultante. */
  const run = (id: string, type: string, args: Record<string, unknown>, show?: { animation: string; frame: number }) =>
    guard(async () => {
      const patches = await canvas.apply(id, { sessionId: AGENT_SESSION, commands: [{ type, ...args }] }).catch((e) => {
        // Una herramienta = un comando: el prefijo "Comando 0 (setRows): " solo confunde al agente.
        if (e instanceof ValidationError) throw new ValidationError(e.issues.map((m) => m.replace(/^Comando 0 \(\w+\): /, '')));
        throw e;
      });
      const after = show ? `\n\n${frameText(await projects.get(id), show.animation, show.frame)}` : '';
      return text(describe(patches) + after);
    });

  server.registerTool(
    'list_projects',
    { description: 'Lista los proyectos con su tamaño, animaciones y paleta.', annotations: { readOnlyHint: true } },
    () => guard(async () => text((await projects.list()).map(summary).join('\n') || 'No hay proyectos todavía.')),
  );

  server.registerTool(
    'get_project',
    { description: 'Tamaño, paleta (letra, nombre y color) y animaciones de un proyecto.', inputSchema: { project }, annotations: { readOnlyHint: true } },
    ({ project: id }) => guard(async () => text(summary(await projects.get(id)))),
  );

  server.registerTool(
    'get_frame',
    {
      description:
        'Devuelve un cuadro como texto: una fila por línea, cada carácter es un píxel. Los números de la izquierda son el índice de fila y NO forman parte de la fila. Léelo antes de dibujar.',
      inputSchema: { project, animation, frame },
      annotations: { readOnlyHint: true },
    },
    ({ project: id, animation: a, frame: f }) => guard(async () => text(frameText(await projects.get(id), a, f))),
  );

  server.registerTool(
    'set_rows',
    {
      description:
        'Reemplaza filas completas desde startRow. Cada fila debe medir exactamente el ancho del lienzo y usar solo letras de la paleta o ".". Es la forma más rápida de dibujar un sprite entero. Devuelve el cuadro resultante.',
      inputSchema: { project, animation, frame, startRow: z.number().int().default(0).describe('Primera fila a reemplazar (0 = arriba)'), rows: z.array(z.string()).describe('Filas de texto, sin números delante') },
    },
    ({ project: id, ...args }) => run(id, 'setRows', args, args),
  );

  server.registerTool(
    'set_pixels',
    {
      description: 'Pinta píxeles sueltos. x es la columna e y la fila, ambas desde 0. Devuelve el cuadro resultante.',
      inputSchema: { project, animation, frame, pixels: z.array(z.object({ x: z.number().int(), y: z.number().int(), color })) },
    },
    ({ project: id, ...args }) => run(id, 'setPixels', args, args),
  );

  server.registerTool(
    'fill',
    {
      description: 'Rellena desde (x, y) todos los píxeles contiguos del mismo color (4 vecinos), como el bote de pintura. Devuelve el cuadro resultante.',
      inputSchema: { project, animation, frame, x: z.number().int(), y: z.number().int(), color },
    },
    ({ project: id, ...args }) => run(id, 'fill', args, args),
  );

  server.registerTool(
    'add_frame',
    {
      description: 'Añade un cuadro vacío, o una copia de copyOf, en la posición at (por defecto al final). Para animar, copia el cuadro anterior y modifícalo.',
      inputSchema: { project, animation, at: z.number().int().optional(), copyOf: z.number().int().optional() },
    },
    ({ project: id, ...args }) => run(id, 'addFrame', args),
  );

  server.registerTool(
    'delete_frame',
    { description: 'Borra un cuadro. La animación debe conservar al menos uno. Se puede deshacer con undo.', inputSchema: { project, animation, frame } },
    ({ project: id, ...args }) => run(id, 'deleteFrame', args),
  );

  server.registerTool(
    'set_fps',
    { description: 'Cambia la velocidad de una animación, de 1 a 24 cuadros por segundo.', inputSchema: { project, animation, fps: z.number().int() } },
    ({ project: id, ...args }) => run(id, 'setFps', args),
  );

  server.registerTool(
    'add_animation',
    { description: "Crea una animación nueva con un cuadro vacío, p. ej. 'caminar'.", inputSchema: { project, name: z.string(), fps: z.number().int().optional() } },
    ({ project: id, ...args }) => run(id, 'addAnimation', args),
  );

  server.registerTool(
    'rename_animation',
    { description: 'Cambia el nombre de una animación.', inputSchema: { project, animation, name: z.string() } },
    ({ project: id, ...args }) => run(id, 'renameAnimation', args),
  );

  server.registerTool(
    'undo',
    { description: 'Deshace el último cambio hecho por el agente (no toca lo que dibujó la persona).', inputSchema: { project } },
    ({ project: id }) => guard(async () => text(describe(await canvas.undo(id, { sessionId: AGENT_SESSION })))),
  );

  server.registerTool(
    'redo',
    { description: 'Rehace el último cambio deshecho por el agente.', inputSchema: { project } },
    ({ project: id }) => guard(async () => text(describe(await canvas.redo(id, { sessionId: AGENT_SESSION })))),
  );

  server.registerTool(
    'export_png',
    {
      description: 'Devuelve la imagen PNG de un cuadro para que la veas y revises el dibujo. scale de 1 a 16 (por defecto 8).',
      inputSchema: { project, animation, frame, scale: z.number().int().optional() },
      annotations: { readOnlyHint: true },
    },
    ({ project: id, animation: a, frame: f, scale }) =>
      guard(async () => {
        const png = exportFramePng(await projects.get(id), { animation: a, frame: f, scale: scale ?? 8 });
        return { content: [{ type: 'image', data: Buffer.from(png).toString('base64'), mimeType: 'image/png' }] };
      }),
  );

  if (perms.create)
    server.registerTool(
      'create_project',
      {
        description:
          'Crea un proyecto con una animación \'reposo\' de un cuadro vacío. La paleta tiene de 4 a 6 colores; cada clave es una letra mayúscula A–Z y "." es siempre transparente.',
        inputSchema: {
          name: z.string(),
          width: z.number().int().optional().describe('De 8 a 32, por defecto 16'),
          height: z.number().int().optional().describe('De 8 a 32, por defecto 16'),
          palette: z.record(z.string(), z.object({ color: z.string().describe('#RRGGBB'), name: z.string() })),
        },
      },
      (input) => guard(async () => text(`Creado.\n${summary(await projects.create(input))}`)),
    );

  if (perms.delete) {
    server.registerTool(
      'delete_animation',
      { description: 'Borra una animación entera. Se puede deshacer con undo.', inputSchema: { project, animation }, annotations: { destructiveHint: true } },
      ({ project: id, ...args }) => run(id, 'deleteAnimation', args),
    );
    server.registerTool(
      'delete_project',
      { description: 'Borra un proyecto y su archivo. NO se puede deshacer.', inputSchema: { project }, annotations: { destructiveHint: true } },
      ({ project: id }) => guard(async () => (await projects.remove(id), text(`Proyecto '${id}' borrado.`))),
    );
  }

  return server;
}
