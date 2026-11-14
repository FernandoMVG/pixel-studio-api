import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { canvasRoutes } from '../../features/canvas/routes.ts';
import type { CanvasService } from '../../features/canvas/service.ts';
import { exportRoutes } from '../../features/export/routes.ts';
import { NotFoundError, ValidationError } from '../../features/projects/model.ts';
import { projectsRoutes } from '../../features/projects/routes.ts';
import type { ProjectsService } from '../../features/projects/service.ts';
import { settingsRoutes } from '../../features/settings/routes.ts';
import type { SettingsService } from '../../features/settings/service.ts';
import { mcpRoutes } from '../mcp/route.ts';
import { LOCAL_ORIGIN } from './origin.ts';

export type AppDeps = {
  projects: ProjectsService;
  canvas: CanvasService;
  settings: SettingsService;
  mcp: () => McpServer | Promise<McpServer>;
};

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.use(cors({ origin: (origin) => (LOCAL_ORIGIN.test(origin) ? origin : null) }));
  // Exigir JSON en escrituras obliga al navegador a hacer preflight, así una web cualquiera no puede escribir en la API local (CSRF).
  app.use(async (c, next) => {
    const writes = c.req.method === 'POST' || c.req.method === 'PUT' || c.req.method === 'PATCH';
    if (writes && !c.req.header('content-type')?.startsWith('application/json'))
      return c.json({ errors: ['Envía el cuerpo como JSON con la cabecera content-type: application/json'] }, 415);
    await next();
  });
  app.route('/projects', projectsRoutes(deps.projects));
  app.route('/projects', canvasRoutes(deps.canvas));
  app.route('/projects', exportRoutes(deps.projects));
  app.route('/settings', settingsRoutes(deps.settings));
  app.route('/mcp', mcpRoutes(deps.mcp));

  app.onError((e, c) => {
    if (e instanceof ValidationError) return c.json({ errors: e.issues }, 400);
    if (e instanceof NotFoundError) return c.json({ errors: [e.message] }, 404);
    if (e instanceof SyntaxError) return c.json({ errors: ['El cuerpo de la petición no es JSON válido'] }, 400);
    console.error(e);
    return c.json({ errors: ['Error interno del servidor'] }, 500);
  });
  app.notFound((c) => c.json({ errors: [`Ruta ${c.req.method} ${c.req.path} no existe`] }, 404));
  return app;
}
