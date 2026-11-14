import type { Project } from '../../features/projects/model.ts';

export interface ProjectStore {
  get(id: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  list(): Promise<Project[]>;
}
