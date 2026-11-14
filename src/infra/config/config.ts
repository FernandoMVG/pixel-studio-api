import { homedir } from 'node:os';
import { join } from 'node:path';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): { port: number; projectsDir: string } {
  const raw = env.PIXEL_PORT ?? '4317';
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1024 || port > 65535) throw new Error('PIXEL_PORT debe ser un entero entre 1024 y 65535');
  return { port, projectsDir: env.PIXEL_PROJECTS_DIR || join(homedir(), 'PixelStudio', 'proyectos') };
}
