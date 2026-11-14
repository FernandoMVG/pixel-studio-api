import { Hono } from 'hono';
import type { CanvasService } from './service.ts';

export function canvasRoutes(canvas: CanvasService): Hono {
  const app = new Hono();
  app.post('/:id/commands', async (c) => c.json({ patches: await canvas.apply(c.req.param('id'), await c.req.json()) }));
  app.post('/:id/undo', async (c) => c.json({ patches: await canvas.undo(c.req.param('id'), await c.req.json()) }));
  app.post('/:id/redo', async (c) => c.json({ patches: await canvas.redo(c.req.param('id'), await c.req.json()) }));
  return app;
}
