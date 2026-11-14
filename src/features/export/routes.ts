import { Hono } from 'hono';
import type { ProjectsService } from '../projects/service.ts';
import { exportGif } from './gif.ts';
import { exportFramePng, exportSpriteSheetPng } from './png.ts';
import { exportText } from './text.ts';

const num = (v: string | undefined) => (v === undefined ? undefined : Number(v));
const png = (bytes: Uint8Array) => new Response(bytes as BodyInit, { headers: { 'content-type': 'image/png' } });

export function exportRoutes(projects: ProjectsService): Hono {
  const app = new Hono();
  app.get('/:id/export/frame.png', async (c) => {
    const { animation, frame, scale } = c.req.query();
    const project = await projects.get(c.req.param('id'));
    return png(exportFramePng(project, { animation: animation ?? '', frame: num(frame) as number, scale: num(scale) }));
  });
  app.get('/:id/export/sheet.png', async (c) => {
    const { animation, scale } = c.req.query();
    const project = await projects.get(c.req.param('id'));
    return png(exportSpriteSheetPng(project, { animation: animation ?? '', scale: num(scale) }));
  });
  app.get('/:id/export/animation.gif', async (c) => {
    const { animation, scale } = c.req.query();
    const project = await projects.get(c.req.param('id'));
    return new Response(exportGif(project, { animation: animation ?? '', scale: num(scale) }) as BodyInit, { headers: { 'content-type': 'image/gif' } });
  });
  app.get('/:id/export/animation.txt', async (c) => {
    const { animation } = c.req.query();
    const project = await projects.get(c.req.param('id'));
    return new Response(exportText(project, { animation: animation ?? '' }), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  });
  return app;
}
