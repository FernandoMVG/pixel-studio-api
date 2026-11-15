/** Alta o baja de un proyecto, para quien vigila la lista (la galería). */
export type ProjectsEvent = { projectId: string; change: 'created' | 'removed' };

/** Puerto: a dónde se avisa de los cambios en la lista de proyectos. */
export interface ProjectsPublisher {
  publishProjects(event: ProjectsEvent): void;
}
