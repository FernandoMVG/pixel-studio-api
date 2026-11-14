import { Hono } from 'hono';
import type { ActivityLog } from './activity.ts';

export function agentRoutes(activity: ActivityLog): Hono {
  const app = new Hono();
  app.get('/activity', (c) => c.json(activity.list()));
  return app;
}
