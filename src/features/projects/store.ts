import type { Project } from './model.ts';

/** Puerto de almacenamiento. Implementaciones en `src/infra/storage/`. */
export interface ProjectStore {
  get(id: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  list(): Promise<Project[]>;
  /** Devuelve false si no existía. */
  remove(id: string): Promise<boolean>;
}
