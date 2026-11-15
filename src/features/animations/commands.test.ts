import { expect, it } from 'vitest';
import { exportGif } from '../export/gif.ts';
import { createProject, parseProject, ValidationError } from '../projects/model.ts';
import { addFrame, deleteFrame, setHold } from './commands.ts';

it('duración por cuadro: proyectos antiguos valen, duplicar la copia y el GIF la respeta', () => {
  const palette = { K: { color: '#000000', name: 'K' }, O: { color: '#D97757', name: 'O' }, S: { color: '#CCCCCC', name: 'S' }, Y: { color: '#FFCC00', name: 'Y' } };
  // Un proyecto guardado antes de existir `holds` se lee con 1 tic por cuadro.
  const { holds: _, ...old } = createProject({ name: 'Viejo', width: 8, height: 8, palette }).animations[0]!;
  let p = parseProject({ ...createProject({ name: 'Viejo', width: 8, height: 8, palette }), animations: [old] });
  expect(p.animations[0]!.holds).toEqual([1]);

  p = setHold(p, { animation: 'reposo', frame: 0, hold: 4 }).project;
  p = addFrame(p, { animation: 'reposo', copyOf: 0 }).project;
  p = addFrame(p, { animation: 'reposo' }).project;
  expect(p.animations[0]!.holds).toEqual([4, 4, 1]);
  p = deleteFrame(p, { animation: 'reposo', frame: 1 }).project;
  expect(p.animations[0]!.holds).toEqual([4, 1]);

  expect(() => setHold(p, { animation: 'reposo', frame: 0, hold: 0 })).toThrow(new ValidationError(['hold: La duración de un cuadro va de 1 a 60 tics']));

  // GIF a 6 fps: 4 tics = 67 centésimas, 1 tic = 17. El retardo va en el bloque GCE (21 F9 04 flags lo hi).
  const gif = exportGif(p, { animation: 'reposo' });
  const delays = [...gif.keys()].filter((i) => gif[i] === 0x21 && gif[i + 1] === 0xf9).map((i) => gif[i + 4]! | (gif[i + 5]! << 8));
  expect(delays).toEqual([67, 17]);
});
