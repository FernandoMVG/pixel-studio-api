import { parse } from '../projects/model.ts';
import { AgentPermissionsSchema, type Settings } from './model.ts';
import type { SettingsStore } from './store.ts';

export class SettingsService {
  readonly #store: SettingsStore;
  readonly #defaults: Settings;

  /** `defaults` se usan hasta que el usuario guarda algo (vienen de las variables de entorno). */
  constructor(store: SettingsStore, defaults: Settings) {
    this.#store = store;
    this.#defaults = defaults;
  }

  async get(): Promise<Settings> {
    return (await this.#store.get()) ?? structuredClone(this.#defaults);
  }

  /** Cambia solo los permisos indicados. */
  async updateAgent(input: unknown): Promise<Settings> {
    const patch = parse(AgentPermissionsSchema.partial().strict(), input);
    const current = await this.get();
    const next = { ...current, agent: { ...current.agent, ...patch } };
    await this.#store.save(next);
    return next;
  }
}
