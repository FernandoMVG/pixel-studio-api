import { describe, expect, it } from 'vitest';
import { createProject, parseProject, ValidationError } from './model.js';

const palette = {
  K: { color: '#24203F', name: 'Contorno' },
  P: { color: '#8C7CF2', name: 'Cuerpo' },
  W: { color: '#FFFFFF', name: 'Ojos' },
  R: { color: '#FF7A9A', name: 'Mejillas' },
};

function issues(fn: () => unknown): string[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof ValidationError) return e.issues;
    throw e;
  }
  throw new Error('Se esperaba ValidationError');
}

// Contrato con el agente: estos mensajes son los que le permiten autocorregirse.
describe('mensajes de validación', () => {
  it('explica filas mal medidas y colores fuera de la paleta', () => {
    const p = createProject({ name: 'Bruma', palette });
    const frame = p.animations[0]!.frames[0]!;
    frame[3] = '.'.repeat(15);
    frame[5] = '....X...........';

    expect(issues(() => parseProject(p))).toEqual([
      "Animación 'reposo', cuadro 0: Fila 3 tiene 15 caracteres, se esperaban 16",
      "Animación 'reposo', cuadro 0: Fila 5, columna 4: color 'X' no existe en la paleta. Disponibles: . K P W R",
    ]);
  });

  it('rechaza letras de paleta inválidas y paletas fuera de rango', () => {
    expect(issues(() => createProject({ name: 'Bruma', palette: { ...palette, ab: palette.K } }))).toEqual([
      "palette.ab: La letra 'ab' no es válida: usa una sola letra mayúscula de la A a la Z",
    ]);
    const { R, W, ...three } = palette;
    expect(issues(() => createProject({ name: 'Bruma', palette: three }))).toEqual([
      'palette: La paleta tiene 2 colores; debe tener entre 4 y 6',
    ]);
  });
});
