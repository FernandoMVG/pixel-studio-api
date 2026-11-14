import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { createAgentServer } from './features/agent/tools.ts';
import { CanvasService } from './features/canvas/service.ts';
import { ProjectsService } from './features/projects/service.ts';
import { loadConfig } from './infra/config/config.ts';
import { createApp } from './infra/http/app.ts';
import { FileStore } from './infra/storage/file-store.ts';
import { WsHub } from './infra/ws/hub.ts';

const { port, projectsDir, agent } = loadConfig();
const store = new FileStore(projectsDir);
const hub = new WsHub();
const projects = new ProjectsService(store);
const canvas = new CanvasService(store, hub);
const app = createApp({ projects, canvas, mcp: () => createAgentServer({ projects, canvas }, agent) });

const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }) as Server;
hub.attach(server);
console.log(`Pixel Studio API en http://127.0.0.1:${port} y ws://127.0.0.1:${port}/ws, MCP en http://127.0.0.1:${port}/mcp (proyectos en ${projectsDir})`);
