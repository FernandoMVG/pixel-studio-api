import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { createAgentServer } from '../../features/agent/tools.ts';
import { memorySettings } from '../../features/settings/testing.ts';
import { CanvasService } from '../../features/canvas/service.ts';
import { ProjectsService } from '../../features/projects/service.ts';
import { createApp } from '../http/app.ts';
import { MemoryStore } from '../storage/memory-store.ts';
import { WsHub } from './hub.ts';

const within = <T>(promise: Promise<T>, what: string) =>
  Promise.race([promise, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout: ${what}`)), 2000))]);
const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('un cliente aplica un lote por HTTP y otro conectado por WebSocket recibe el parche', async () => {
  const store = new MemoryStore();
  const hub = new WsHub();
  const projects = new ProjectsService(store);
  const canvas = new CanvasService(store, hub);
  const app = createApp({ projects, canvas, settings: memorySettings(), mcp: () => createAgentServer({ projects, canvas }) });
  const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
  const sockets: WebSocket[] = [];
  try {
    if (!server.listening) await within(new Promise((r) => server.once('listening', r)), 'listening');
    hub.attach(server as never);
    const base = `127.0.0.1:${(server.address() as AddressInfo).port}`;

    const palette = {
      K: { color: '#000000', name: 'Tinta' },
      P: { color: '#CC7755', name: 'Piel' },
      W: { color: '#FFFFFF', name: 'Blanco' },
      R: { color: '#FF0000', name: 'Rojo' },
    };
    expect((await fetch(`http://${base}/projects`, json({ name: 'Bruma', palette }))).status).toBe(201);

    const b = new WebSocket(`ws://${base}/ws?project=bruma`, { headers: { origin: 'http://localhost:5173' } });
    sockets.push(b);
    const received = new Promise<string>((r) => b.once('message', (d) => r(d.toString())));
    await within(new Promise((r) => b.once('open', r)), 'open');

    const res = await fetch(
      `http://${base}/projects/bruma/commands`,
      json({ sessionId: 'a', commands: [{ type: 'setPixels', animation: 'reposo', frame: 0, pixels: [{ x: 2, y: 3, color: 'K' }] }] }),
    );
    expect(res.status).toBe(200);
    const msg = JSON.parse(await within(received, 'mensaje')) as { type: string; sessionId: string; patches: { changes: unknown[] }[] };
    expect(msg.type).toBe('patches');
    expect(msg.sessionId).toBe('a');
    expect(msg.patches[0]?.changes[0]).toEqual({ x: 2, y: 3, before: '.', after: 'K' });

    const evil = new WebSocket(`ws://${base}/ws?project=bruma`, { headers: { origin: 'https://evil.example' } });
    sockets.push(evil);
    const code = await within(new Promise<number>((r) => evil.once('close', r)), 'cierre evil');
    expect(code).toBe(1008);
  } finally {
    for (const s of sockets) s.terminate();
    await hub.close();
    await new Promise((r) => server.close(r));
  }
});
