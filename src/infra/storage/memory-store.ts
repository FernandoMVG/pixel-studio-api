import type { Project } from '../../features/projects/model.ts';
import type { ProjectStore } from '../../features/projects/store.ts';

/** Almacenamiento en memoria para pruebas. Copia al entrar y al salir, como haría un archivo. */
export class MemoryStore implements ProjectStore {
  readonly #items = new Map<string, Project>();

  async get(id: string) {
    const p = this.#items.get(id);
    return p ? structuredClone(p) : null;
  }
  async save(project: Project) {
    this.#items.set(project.id, structuredClone(project));
  }
  async list() {
    return [...this.#items.values()].map((p) => structuredClone(p)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
  async remove(id: string) {
    return this.#items.delete(id);
  }
}
