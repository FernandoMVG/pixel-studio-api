import { Hono } from 'hono';
import type { ProjectsService } from './service.ts';

export function projectsRoutes(projects: ProjectsService): Hono {
  const app = new Hono();
  app.get('/', async (c) => c.json({ projects: await projects.list() }));
  app.post('/', async (c) => c.json(await projects.create(await c.req.json()), 201));
  app.get('/:id', async (c) => c.json(await projects.get(c.req.param('id'))));
  app.delete('/:id', async (c) => {
    await projects.remove(c.req.param('id'));
    return c.body(null, 204);
  });
  return app;
}
