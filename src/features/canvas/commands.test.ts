import { describe, expect, it } from 'vitest';
import { createProject, ValidationError } from '../projects/model.ts';
import { fill, redo, setPixels, setRows, undo } from './commands.ts';

const project = createProject({
  name: 'Bruma',
  palette: {
    K: { color: '#24203F', name: 'Contorno' },
    P: { color: '#8C7CF2', name: 'Cuerpo' },
    W: { color: '#FFFFFF', name: 'Ojos' },
    R: { color: '#FF7A9A', name: 'Mejillas' },
  },
});
const at = { animation: 'reposo', frame: 0 };

describe('canvas', () => {
  it('deshace y rehace una secuencia de comandos sin tocar el proyecto original', () => {
    const a = setRows(project, { ...at, startRow: 1, rows: ['.....KKKKKK.....', '...KKPPPPPPKK...'] });
    const b = fill(a.project, { ...at, x: 7, y: 2, color: 'R' });
    const c = setPixels(b.project, { ...at, pixels: [{ x: 7, y: 2, color: 'W' }] });

    expect(b.patch.changes).toHaveLength(6);
    expect(c.patch.changes).toEqual([{ x: 7, y: 2, before: 'R', after: 'W' }]);

    const back = undo(undo(undo(c.project, c.patch), b.patch), a.patch);
    expect(back).toEqual(project);
    expect(redo(redo(back, a.patch), b.patch)).toEqual(b.project);
    expect(project.animations[0]!.frames[0]!.every((r) => r === '.'.repeat(16))).toBe(true);
  });

  it('reporta todos los errores de un lote juntos', () => {
    const err = (() => {
      try {
        setPixels(project, { ...at, pixels: [{ x: 17, y: 2, color: 'P' }, { x: 1, y: 1, color: 'X' }] });
      } catch (e) {
        return e as ValidationError;
      }
    })();
    expect(err?.issues).toEqual([
      'Píxel (17, 2) fuera del lienzo de 16 × 16',
      "Color 'X' no existe en la paleta. Disponibles: . K P W R",
    ]);
  });
});
