import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { CanvasService } from './features/canvas/service.ts';
import { ProjectsService } from './features/projects/service.ts';
import { loadConfig } from './infra/config/config.ts';
import { createApp } from './infra/http/app.ts';
import { FileStore } from './infra/storage/file-store.ts';
import { WsHub } from './infra/ws/hub.ts';

const { port, projectsDir } = loadConfig();
const store = new FileStore(projectsDir);
const hub = new WsHub();
const app = createApp({ projects: new ProjectsService(store), canvas: new CanvasService(store, hub) });

const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }) as Server;
hub.attach(server);
console.log(`Pixel Studio API en http://127.0.0.1:${port} y ws://127.0.0.1:${port}/ws (proyectos en ${projectsDir})`);
