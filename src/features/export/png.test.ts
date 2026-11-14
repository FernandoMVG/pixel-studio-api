import { inflateSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { setRows } from '../canvas/commands.ts';
import { createProject } from '../projects/model.ts';
import { exportSpriteSheetPng } from './png.ts';

it('dibuja un personaje y lo exporta a PNG', () => {
  let project = createProject({
    name: 'Bruma',
    palette: {
      K: { color: '#24203F', name: 'Contorno' },
      P: { color: '#8C7CF2', name: 'Cuerpo' },
      W: { color: '#FFFFFF', name: 'Ojos' },
      R: { color: '#FF7A9A', name: 'Mejillas' },
    },
  });
  project = setRows(project, {
    animation: 'reposo',
    frame: 0,
    startRow: 1,
    rows: [
      '.....KKKKKK.....',
      '...KKPPPPPPKK...',
      '..KPPPPPPPPPPK..',
      '..KPPWKPPWKPPK..',
      '..KPPPPPPPPPPK..',
      '..KRPPPPPPPPRK..',
      '..KPPPPPPPPPPK..',
      '..KKK.KKK.KKK...',
    ],
  }).project;

  const png = Buffer.from(exportSpriteSheetPng(project, { animation: 'reposo', scale: 2 }));
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBe(32);
  expect(png.readUInt32BE(20)).toBe(32);

  const idatLength = png.readUInt32BE(33);
  const raw = inflateSync(png.subarray(41, 41 + idatLength));
  const pixel = (x: number, y: number) => [...raw.subarray(y * (32 * 4 + 1) + 1 + x * 4, y * (32 * 4 + 1) + 1 + x * 4 + 4)];
  expect(pixel(0, 0)[3]).toBe(0);
  expect(pixel(10, 2)).toEqual([0x24, 0x20, 0x3f, 255]);
});
