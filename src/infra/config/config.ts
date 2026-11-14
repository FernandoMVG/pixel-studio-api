import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentPermissions } from '../../features/settings/model.ts';

function flag(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const v = env[name] ?? String(fallback);
  if (v !== 'true' && v !== 'false') throw new Error(`${name} debe ser true o false`);
  return v === 'true';
}

export type Config = { port: number; projectsDir: string; settingsFile: string; agent: AgentPermissions };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const raw = env.PIXEL_PORT ?? '4317';
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1024 || port > 65535) throw new Error('PIXEL_PORT debe ser un entero entre 1024 y 65535');
  const agent = { create: flag(env, 'PIXEL_AGENT_CAN_CREATE', true), delete: flag(env, 'PIXEL_AGENT_CAN_DELETE', false) };
  const base = join(homedir(), 'PixelStudio');
  return {
    port,
    projectsDir: env.PIXEL_PROJECTS_DIR || join(base, 'proyectos'),
    settingsFile: env.PIXEL_SETTINGS_FILE || join(base, 'ajustes.json'),
    agent, // valores iniciales hasta que el usuario guarde ajustes desde la app
  };
}
