import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createProject, ValidationError } from '../../features/projects/model.js';
import { FileStore } from './file-store.js';

it('guarda, lee y lista proyectos de forma atómica y segura', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pixel-store-'));
  try {
    const store = new FileStore(dir);
    const project = createProject({
      name: 'Bruma',
      palette: {
        K: { color: '#111111', name: 'Tinta' },
        P: { color: '#ff88aa', name: 'Rosa' },
        W: { color: '#ffffff', name: 'Blanco' },
        R: { color: '#cc3333', name: 'Rojo' },
      },
    });
    await store.save(project);

    expect(await store.get('bruma')).toEqual(project);
    expect(await store.list()).toContainEqual(project);
    expect(await store.get('nada')).toBeNull();
    await expect(store.get('../x')).rejects.toBeInstanceOf(ValidationError);
    expect((await readdir(dir)).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
