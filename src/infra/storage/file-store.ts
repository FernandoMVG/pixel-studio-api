import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseProject, ValidationError, type Project } from '../../features/projects/model.ts';
import type { ProjectStore } from '../../features/projects/store.ts';

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class FileStore implements ProjectStore {
  private readonly dir: string;
  constructor(dir: string) {
    this.dir = dir;
  }

  private path(id: string): string {
    if (!ID.test(id)) throw new ValidationError([`Id de proyecto no válido: '${id}'`]);
    return join(this.dir, `${id}.json`);
  }

  async save(project: Project): Promise<void> {
    const valid = parseProject(project);
    const file = this.path(valid.id);
    await mkdir(this.dir, { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, `${JSON.stringify(valid, null, 2)}\n`, 'utf8');
    await rename(tmp, file);
  }

  async get(id: string): Promise<Project | null> {
    const file = this.path(id);
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
    const name = `${id}.json`;
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new ValidationError([`${name}: JSON mal formado`]);
    }
    try {
      return parseProject(data);
    } catch (e) {
      if (e instanceof ValidationError) throw new ValidationError(e.issues.map((m) => `${name}: ${m}`));
      throw e;
    }
  }

  async remove(id: string): Promise<boolean> {
    const file = this.path(id);
    try {
      await rm(file);
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw e;
    }
  }

  async list(): Promise<Project[]> {
    let files: string[];
    try {
      files = await readdir(this.dir);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
    const projects: Project[] = [];
    for (const f of files.filter((f) => f.endsWith('.json')).sort()) {
      const p = await this.get(f.slice(0, -'.json'.length));
      if (p) projects.push(p);
    }
    return projects.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
}
