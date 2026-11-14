import { Hono } from 'hono';
import type { SettingsService } from './service.ts';

export function settingsRoutes(settings: SettingsService): Hono {
  const app = new Hono();
  app.get('/', async (c) => c.json(await settings.get()));
  app.put('/agent', async (c) => c.json(await settings.updateAgent(await c.req.json())));
  return app;
}
