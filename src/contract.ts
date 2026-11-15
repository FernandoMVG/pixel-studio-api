/**
 * Contrato con pixel-web: solo tipos, inferidos de los esquemas Zod y de los comandos.
 * La web los importa con `import type` (se borran al compilar), así que nunca se desincronizan.
 * No exportar valores aquí: la web no debe empaquetar código de la API.
 */
import type { CanvasEvent } from './features/canvas/publisher.ts';
import type { ProjectsEvent } from './features/projects/publisher.ts';
import type { COMMANDS } from './features/canvas/commands.ts';

export type { Animation, Frame, Palette, Project } from './features/projects/model.ts';
export type { Change, Patch, PixelPatch } from './features/canvas/commands.ts';
export type { AnimationPatch } from './features/animations/commands.ts';
export type { PalettePatch } from './features/palette/commands.ts';
export type { AgentPermissions, Settings } from './features/settings/model.ts';
export type { ActivityEntry } from './features/agent/activity.ts';
export type { CanvasEvent };
export type { ProjectsEvent };

type Commands = typeof COMMANDS;
/** Un comando de un lote `POST /projects/:id/commands`, p. ej. `{ type: 'fill', animation, frame, x, y, color }`. */
export type Command = { [K in keyof Commands]: { type: K } & Parameters<Commands[K]>[1] }[keyof Commands];

/** Mensaje que llega por `ws://…/ws?project=<id>`. */
/** `?project=<id>` solo recibe `patches` de ese proyecto; `?project=*` recibe los de todos y además `projects`. */
export type WsMessage = ({ type: 'patches' } & CanvasEvent) | ({ type: 'projects' } & ProjectsEvent);

/** Cuerpo de cualquier respuesta de error (400, 403, 404, 415, 500). */
export type ApiError = { errors: string[] };
