import { expect, test } from 'vitest';
import { createAgentServer } from '../../features/agent/tools.ts';
import { memorySettings } from '../../features/settings/testing.ts';
import { CanvasService } from '../../features/canvas/service.ts';
import { ProjectsService } from '../../features/projects/service.ts';
import { MemoryStore } from '../storage/memory-store.ts';
import { createApp } from './app.ts';

const store = new MemoryStore();
const projects = new ProjectsService(store);
const canvas = new CanvasService(store, { publish() {} });
const app = createApp({ projects, canvas, settings: memorySettings(), mcp: () => createAgentServer({ projects, canvas }) });
const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const cmd = (command: object) => json({ sessionId: 'web', commands: [{ animation: 'reposo', frame: 0, ...command }] });

test('flujo HTTP: crear, errores, parches, exportar', async () => {
  const palette = {
    K: { color: '#000000', name: 'Tinta' },
    P: { color: '#CC7755', name: 'Piel' },
    W: { color: '#FFFFFF', name: 'Blanco' },
    R: { color: '#FF0000', name: 'Rojo' },
  };
  expect((await app.request('/projects', json({ name: 'Bruma', palette }))).status).toBe(201);

  const bad = await app.request('/projects/bruma/commands', cmd({ type: 'fill', x: 0, y: 0, color: 'X' }));
  expect(bad.status).toBe(400);
  expect(((await bad.json()) as { errors: string[] }).errors[0]).toContain("Color 'X' no existe en la paleta");

  const ok = await app.request('/projects/bruma/commands', cmd({ type: 'setPixels', pixels: [{ x: 1, y: 1, color: 'K' }] }));
  expect(ok.status).toBe(200);
  expect(((await ok.json()) as { patches: unknown[] }).patches).toHaveLength(1);

  const png = await app.request('/projects/bruma/export/sheet.png?animation=reposo&scale=2');
  expect(png.status).toBe(200);
  expect(png.headers.get('content-type')).toBe('image/png');
  expect([...new Uint8Array(await png.arrayBuffer()).slice(0, 4)]).toEqual([137, 80, 78, 71]);

  expect((await app.request('/projects/nada')).status).toBe(404);

  const syntax = await app.request('/projects/bruma/commands', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{mal' });
  expect(syntax.status).toBe(400);
  expect(((await syntax.json()) as { errors: string[] }).errors[0]).toBe('El cuerpo de la petición no es JSON válido');

  // CSRF: un formulario o fetch "simple" (text/plain) desde otra web no puede escribir.
  const csrf = await app.request('/projects/bruma/commands', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
  expect(csrf.status).toBe(415);

  // Permisos del agente editables desde la app.
  const put = (body: unknown) => app.request('/settings/agent', { ...json(body), method: 'PUT' });
  const updated = await put({ delete: true });
  expect(((await updated.json()) as { agent: { create: boolean; delete: boolean } }).agent).toEqual({ create: true, delete: true });
  expect((await put({ borrar: true })).status).toBe(400);
});
