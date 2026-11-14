import { serve } from '@hono/node-server';
import { CanvasService } from './features/canvas/service.ts';
import { ProjectsService } from './features/projects/service.ts';
import { loadConfig } from './infra/config/config.ts';
import { createApp } from './infra/http/app.ts';
import { FileStore } from './infra/storage/file-store.ts';

const { port, projectsDir } = loadConfig();
const store = new FileStore(projectsDir);
const publisher = { publish() {} }; // Se reemplaza por el publicador WebSocket en la fase 2.5
const app = createApp({ projects: new ProjectsService(store), canvas: new CanvasService(store, publisher) });

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });
console.log(`Pixel Studio API en http://127.0.0.1:${port} (proyectos en ${projectsDir})`);
