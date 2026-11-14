import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { serve } from '@hono/node-server';
import { expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { createAgentServer } from '../../features/agent/tools.ts';
import { memorySettings } from '../../features/settings/testing.ts';
import { CanvasService } from '../../features/canvas/service.ts';
import { ProjectsService } from '../../features/projects/service.ts';
import { createApp } from '../http/app.ts';
import { MemoryStore } from '../storage/memory-store.ts';
import { WsHub } from '../ws/hub.ts';

const within = <T>(promise: Promise<T>, what: string) =>
  Promise.race([promise, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout: ${what}`)), 3000))]);

const CAT = [
  '................',
  '..KK........KK..',
  '..KNK......KNK..',
  '.KNNNKKKKKKNNNK.',
  '.KNNNNNNNNNNNNK.',
  '.KNNWWNNNNWWNNK.',
  '.KNNWKNNNNWKNNK.',
  '.KNNNNNNNNNNNNK.',
  '.KNNNNNRRNNNNNK.',
  '.KNNNNNKKNNNNNK.',
  '.KNNNNNNNNNNNNK.',
  '..KNNNNNNNNNNK..',
  '...KKNNNNNNKK...',
  '....KKKKKKKK....',
  '................',
  '................',
];

test('un agente MCP dibuja un sprite completo y se autocorrige ante un error de validación', async () => {
  const store = new MemoryStore();
  const hub = new WsHub();
  const projects = new ProjectsService(store);
  const canvas = new CanvasService(store, hub);
  const app = createApp({ projects, canvas, settings: memorySettings(), mcp: () => createAgentServer({ projects, canvas }) });
  const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
  let client: Client | undefined;
  let ws: WebSocket | undefined;
  try {
    if (!server.listening) await within(new Promise((r) => server.once('listening', r)), 'listening');
    hub.attach(server as never);
    const port = (server.address() as AddressInfo).port;

    client = new Client({ name: 'test', version: '0.0.0' });
    await within(client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`))), 'connect');
    const call = (name: string, args: Record<string, unknown>) =>
      within(client!.callTool({ name, arguments: args }), name) as Promise<{ isError?: boolean; content: { type: string; text?: string; mimeType?: string }[] }>;

    const created = await call('create_project', {
      name: 'Gato',
      palette: { K: { color: '#222222', name: 'Contorno' }, N: { color: '#F2A65A', name: 'Pelo' }, W: { color: '#FFFFFF', name: 'Blanco' }, R: { color: '#FF7A9A', name: 'Nariz' } },
    });
    expect(created.isError).toBeFalsy();

    ws = new WebSocket(`ws://127.0.0.1:${port}/ws?project=gato`, { headers: { origin: 'http://localhost:5173' } });
    const received = new Promise<{ type: string; sessionId: string }>((r) => ws!.once('message', (d) => r(JSON.parse(d.toString()))));
    await within(new Promise((r) => ws!.once('open', r)), 'open');

    const bad = await call('set_rows', { project: 'gato', animation: 'reposo', frame: 0, startRow: 0, rows: CAT.map((r, i) => (i === 4 ? r.slice(1) : r)) });
    expect(bad.isError).toBe(true);
    expect(bad.content[0]?.text).toContain('tiene 15 caracteres, se esperaban 16');

    const good = await call('set_rows', { project: 'gato', animation: 'reposo', frame: 0, startRow: 0, rows: CAT });
    expect(good.isError).toBeFalsy();
    expect(good.content[0]?.text).toContain(CAT[1]!);

    const msg = await within(received, 'mensaje');
    expect(msg.type).toBe('patches');
    expect(msg.sessionId).toBe('agente');

    const png = await call('export_png', { project: 'gato', animation: 'reposo', frame: 0 });
    expect(png.content[0]).toMatchObject({ type: 'image', mimeType: 'image/png' });

    const status = await within(
      new Promise<number>((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: { host: 'evil.example', 'content-type': 'application/json' } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on('error', reject);
        req.end('{}');
      }),
      'host malicioso',
    );
    expect(status).toBe(403);
  } finally {
    ws?.terminate();
    await client?.close().catch(() => {});
    await hub.close();
    await new Promise((r) => server.close(r));
  }
});
