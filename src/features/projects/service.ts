import { createProject, NotFoundError, ValidationError, type Project } from './model.ts';
import type { ProjectsPublisher } from './publisher.ts';
import type { ProjectStore } from './store.ts';

export class ProjectsService {
  readonly #store: ProjectStore;
  readonly #publisher?: ProjectsPublisher;

  constructor(store: ProjectStore, publisher?: ProjectsPublisher) {
    this.#store = store;
    this.#publisher = publisher;
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
    this.#publisher?.publishProjects({ projectId: p.id, change: 'created' });
    return p;
  }

  async remove(id: string): Promise<void> {
    if (!(await this.#store.remove(id))) throw new NotFoundError(`Proyecto '${id}' no existe`);
    this.#publisher?.publishProjects({ projectId: id, change: 'removed' });
  }
}
