import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type ActivityEntry = {
  at: string;
  tool: string;
  /** Resumen corto de los argumentos (las filas, píxeles y paletas van como cantidades). */
  args: string;
  ok: boolean;
  /** Primera línea del resultado, o el error tal como lo leyó el agente. */
  message: string;
  /** Llamada correcta que sigue a un error de la misma herramienta: el agente se autocorrigió. */
  fixed: boolean;
};

const LIMIT = 200;

function summarize(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([k, v]) => (Array.isArray(v) ? `${k}: ${v.length}` : typeof v === 'object' && v ? `${k}: ${Object.keys(v).length}` : `${k}: ${String(v)}`))
    .join(', ');
}

/** Registro en memoria de lo que hizo el agente. ponytail: se pierde al reiniciar; basta para ver la sesión de trabajo actual. */
export class ActivityLog {
  readonly #items: ActivityEntry[] = [];

  record(tool: string, args: Record<string, unknown>, result: CallToolResult): void {
    const first = result.content[0];
    const message = first?.type === 'text' ? first.text.split('\n')[0]!.slice(0, 300) : first?.type === 'image' ? 'Imagen PNG' : '';
    const ok = !result.isError;
    const prev = this.#items.at(-1);
    this.#items.push({ at: new Date().toISOString(), tool, args: summarize(args), ok, message, fixed: ok && prev?.tool === tool && !prev.ok });
    if (this.#items.length > LIMIT) this.#items.shift();
  }

  /** Lo más reciente primero. */
  list(): { lastAt: string | null; entries: ActivityEntry[] } {
    return { lastAt: this.#items.at(-1)?.at ?? null, entries: [...this.#items].reverse() };
  }
}
