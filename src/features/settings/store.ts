import type { Settings } from './model.ts';

/** Puerto de ajustes del usuario. Implementación en `src/infra/storage/`. */
export interface SettingsStore {
  /** null si todavía no se guardó nada. */
  get(): Promise<Settings | null>;
  save(settings: Settings): Promise<void>;
}
