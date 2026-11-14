import type { Patch } from './commands.ts';

/** Cambios ya guardados. Los clientes aplican cada parche (lado `after`) en orden. */
export type CanvasEvent = { projectId: string; sessionId: string; patches: Patch[] };

/** Puerto para avisar de cambios a quien esté mirando el proyecto. Implementación en `src/infra/ws/`. */
export interface PatchPublisher {
  publish(event: CanvasEvent): void;
}
