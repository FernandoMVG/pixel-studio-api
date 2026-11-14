import { createProject, NotFoundError, ValidationError, type Project } from './model.ts';
import type { ProjectStore } from './store.ts';

export class ProjectsService {
  readonly #store: ProjectStore;

  constructor(store: ProjectStore) {
    this.#store = store;
  }

  list(): Promise<Project[]> {
    return this.#store.list();
  }

  async get(id: string): Promise<Project> {
    const p = await this.#store.get(id);
    if (!p) throw new NotFoundError(`Proyecto '${id}' no existe`);
    return p;
  }

  async create(input: Parameters<typeof createProject>[0]): Promise<Project> {
    const p = createProject(input);
    if (await this.#store.get(p.id)) throw new ValidationError([`Ya existe un proyecto con el id '${p.id}'. Usa otro nombre.`]);
    await this.#store.save(p);
    return p;
  }

  async remove(id: string): Promise<void> {
    if (!(await this.#store.remove(id))) throw new NotFoundError(`Proyecto '${id}' no existe`);
  }
}
