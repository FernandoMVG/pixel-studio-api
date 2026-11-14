import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parse, ValidationError } from '../../features/projects/model.ts';
import { SettingsSchema, type Settings } from '../../features/settings/model.ts';
import type { SettingsStore } from '../../features/settings/store.ts';
import { writeJsonAtomic } from './atomic.ts';

export class SettingsFileStore implements SettingsStore {
  readonly #file: string;

  constructor(file: string) {
    this.#file = file;
  }

  async get(): Promise<Settings | null> {
    let text: string;
    try {
      text = await readFile(this.#file, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
    const name = basename(this.#file);
    try {
      return parse(SettingsSchema, JSON.parse(text));
    } catch (e) {
      if (e instanceof SyntaxError) throw new ValidationError([`${name}: JSON mal formado`]);
      if (e instanceof ValidationError) throw new ValidationError(e.issues.map((m) => `${name}: ${m}`));
      throw e;
    }
  }

  save(settings: Settings): Promise<void> {
    return writeJsonAtomic(this.#file, parse(SettingsSchema, settings));
  }
}
