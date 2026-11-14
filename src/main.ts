import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { createAgentServer } from './features/agent/tools.ts';
import { CanvasService } from './features/canvas/service.ts';
import { ProjectsService } from './features/projects/service.ts';
import { SETTINGS_VERSION } from './features/settings/model.ts';
import { SettingsService } from './features/settings/service.ts';
import { loadConfig } from './infra/config/config.ts';
import { createApp } from './infra/http/app.ts';
import { FileStore } from './infra/storage/file-store.ts';
import { SettingsFileStore } from './infra/storage/settings-file-store.ts';
import { WsHub } from './infra/ws/hub.ts';

const { port, projectsDir, settingsFile, agent } = loadConfig();
const store = new FileStore(projectsDir);
const hub = new WsHub();
const projects = new ProjectsService(store);
const canvas = new CanvasService(store, hub);
const settings = new SettingsService(new SettingsFileStore(settingsFile), { version: SETTINGS_VERSION, agent });
const app = createApp({
  projects,
  canvas,
  settings,
  mcp: async () => createAgentServer({ projects, canvas }, (await settings.get()).agent),
});

const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }) as Server;
hub.attach(server);
console.log(`Pixel Studio API en http://127.0.0.1:${port} y ws://127.0.0.1:${port}/ws, MCP en http://127.0.0.1:${port}/mcp (proyectos en ${projectsDir})`);
