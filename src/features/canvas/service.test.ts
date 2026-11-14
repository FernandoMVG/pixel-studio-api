import { expect, it } from 'vitest';
import { MemoryStore } from '../../infra/storage/memory-store.ts';
import { ValidationError } from '../projects/model.ts';
import { ProjectsService } from '../projects/service.ts';
import type { CanvasEvent } from './publisher.ts';
import { CanvasService } from './service.ts';

it('aplica lotes atómicos, deshace por sesión (píxeles y estructura) y publica cada cambio', async () => {
  const store = new MemoryStore();
  const events: CanvasEvent[] = [];
  const canvas = new CanvasService(store, { publish: (e) => events.push(e) });
  const projects = new ProjectsService(store);
  await projects.create({
    name: 'Bruma',
    palette: { K: { color: '#24203F', name: 'Contorno' }, P: { color: '#8C7CF2', name: 'Cuerpo' }, W: { color: '#FFFFFF', name: 'Ojos' }, R: { color: '#FF7A9A', name: 'Mejillas' } },
  });
  const at = { animation: 'reposo', frame: 0 };
  const pixel = async (x: number, y: number) => (await projects.get('bruma')).animations[0]!.frames[0]![y]![x];

  await canvas.apply('bruma', { sessionId: 'web', commands: [{ type: 'setPixels', ...at, pixels: [{ x: 0, y: 0, color: 'K' }] }] });
  await canvas.apply('bruma', { sessionId: 'agente', commands: [{ type: 'fill', ...at, x: 5, y: 5, color: 'P' }] });

  // Lote con un comando inválido: no se guarda nada.
  await expect(
    canvas.apply('bruma', { sessionId: 'web', commands: [{ type: 'setPixels', ...at, pixels: [{ x: 1, y: 0, color: 'R' }] }, { type: 'fill', ...at, x: 0, y: 0, color: 'X' }] }),
  ).rejects.toThrow(ValidationError);
  expect(await pixel(1, 0)).toBe('P');

  // Deshacer de "web" solo revierte lo de "web".
  await canvas.undo('bruma', { sessionId: 'web' });
  expect(await pixel(0, 0)).toBe('.');
  expect(await pixel(5, 5)).toBe('P');
  await canvas.redo('bruma', { sessionId: 'web' });
  expect(await pixel(0, 0)).toBe('K');

  const after = (e: CanvasEvent) => { const p = e.patches[0]!; return p.kind === 'pixels' ? p.changes[0]!.after : `+${p.after?.frames.length}`; };
  expect(events.map((e) => `${e.sessionId}:${after(e)}`)).toEqual(['web:K', 'agente:P', 'web:.', 'web:K']);

  // Estructura y píxeles en el mismo lote: se deshacen juntos.
  await canvas.apply('bruma', { sessionId: 'web', commands: [{ type: 'addFrame', animation: 'reposo', copyOf: 0 }, { type: 'setPixels', animation: 'reposo', frame: 1, pixels: [{ x: 3, y: 3, color: 'W' }] }] });
  expect((await projects.get('bruma')).animations[0]!.frames).toHaveLength(2);
  await canvas.undo('bruma', { sessionId: 'web' });
  expect((await projects.get('bruma')).animations[0]!.frames).toHaveLength(1);
  await canvas.redo('bruma', { sessionId: 'web' });
  expect((await projects.get('bruma')).animations[0]!.frames[1]![3]![3]).toBe('W');
});
