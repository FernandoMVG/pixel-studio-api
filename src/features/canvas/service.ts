import { z } from 'zod';
import { NotFoundError, parse, ValidationError, type Project } from '../projects/model.ts';
import type { ProjectStore } from '../projects/store.ts';
import { applyPatch, COMMANDS, invert, type Patch } from './commands.ts';
import type { PatchPublisher } from './publisher.ts';

const HISTORY_LIMIT = 100;

const BatchInput = z.object({
  sessionId: z.string().min(1, 'Indica el id de sesión'),
  commands: z.array(z.looseObject({ type: z.string() })).min(1, 'El lote necesita al menos un comando'),
});
const SessionInput = z.object({ sessionId: z.string().min(1, 'Indica el id de sesión') });

type History = { undo: Patch[][]; redo: Patch[][] };

export class CanvasService {
  readonly #store: ProjectStore;
  readonly #publisher: PatchPublisher;
  readonly #history = new Map<string, History>();
  readonly #queues = new Map<string, Promise<unknown>>();

  constructor(store: ProjectStore, publisher: PatchPublisher) {
    this.#store = store;
    this.#publisher = publisher;
  }

  /** Aplica todos los comandos o ninguno. Un lote es un solo paso de deshacer. */
  apply(projectId: string, input: z.input<typeof BatchInput>): Promise<Patch[]> {
    const { sessionId, commands } = parse(BatchInput, input);
    return this.#write(projectId, sessionId, (project) => {
      const patches: Patch[] = [];
      commands.forEach(({ type, ...args }, i) => {
        const run = COMMANDS[type as keyof typeof COMMANDS] as ((p: Project, a: unknown) => { project: Project; patch: Patch }) | undefined;
        if (!run) throw new ValidationError([`Comando ${i} ('${type}') no existe. Disponibles: ${Object.keys(COMMANDS).join(', ')}`]);
        try {
          const r = run(project, args);
          project = r.project;
          if (r.patch.kind === 'animation' || r.patch.changes.length) patches.push(r.patch);
        } catch (e) {
          if (e instanceof ValidationError) throw new ValidationError(e.issues.map((m) => `Comando ${i} (${type}): ${m}`));
          throw e;
        }
      });
      return { project, patches, saved: () => this.#push(projectId, sessionId, 'undo', patches, true) };
    });
  }

  undo(projectId: string, input: z.input<typeof SessionInput>): Promise<Patch[]> {
    return this.#step(projectId, parse(SessionInput, input).sessionId, 'undo', 'redo');
  }

  redo(projectId: string, input: z.input<typeof SessionInput>): Promise<Patch[]> {
    return this.#step(projectId, parse(SessionInput, input).sessionId, 'redo', 'undo');
  }

  /** Deshacer/rehacer: aplica el lote guardado (invertido al deshacer) y lo pasa a la otra pila. Sin nada que hacer, devuelve []. */
  #step(projectId: string, sessionId: string, from: keyof History, to: keyof History): Promise<Patch[]> {
    return this.#write(projectId, sessionId, (project) => {
      const stack = this.#stack(projectId, sessionId);
      const entry = stack[from].at(-1);
      if (!entry) return { project, patches: [] };
      // ponytail: deshacer repone los valores `before` aunque otra sesión los haya cambiado después; basta para un solo usuario.
      const patches = from === 'undo' ? [...entry].reverse().map(invert) : entry;
      try {
        for (const p of patches) project = applyPatch(project, p);
      } catch (e) {
        // Otra sesión cambió la estructura (p. ej. borró el cuadro): esta entrada ya no se puede aplicar, se descarta.
        stack[from].pop();
        if (e instanceof ValidationError) throw new ValidationError(e.issues.map((m) => `No se pudo ${from === 'undo' ? 'deshacer' : 'rehacer'}: ${m}`));
        throw e;
      }
      return { project, patches, saved: () => (stack[from].pop(), this.#push(projectId, sessionId, to, entry, false)) };
    });
  }

  /** Lee, modifica, guarda, actualiza el historial y publica, de uno en uno por proyecto, para que dos clientes no se pisen. */
  #write(
    projectId: string,
    sessionId: string,
    fn: (p: Project) => { project: Project; patches: Patch[]; saved?: () => void },
  ): Promise<Patch[]> {
    const prev = this.#queues.get(projectId) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(async () => {
      const current = await this.#store.get(projectId);
      if (!current) throw new NotFoundError(`Proyecto '${projectId}' no existe`);
      const { project, patches, saved } = fn(current);
      if (!patches.length) return patches;
      await this.#store.save(project);
      saved?.(); // el historial solo cambia si se guardó
      this.#publisher.publish({ projectId, sessionId, patches });
      return patches;
    });
    this.#queues.set(projectId, next);
    return next;
  }

  #stack(projectId: string, sessionId: string): History {
    const key = `${projectId}\n${sessionId}`;
    let h = this.#history.get(key);
    if (!h) this.#history.set(key, (h = { undo: [], redo: [] }));
    return h;
  }

  #push(projectId: string, sessionId: string, to: keyof History, entry: Patch[], clearRedo: boolean) {
    const h = this.#stack(projectId, sessionId);
    h[to].push(entry);
    if (h[to].length > HISTORY_LIMIT) h[to].shift();
    if (clearRedo) h.redo = [];
  }
}
