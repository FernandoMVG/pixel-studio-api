import { SETTINGS_VERSION, type Settings } from './model.ts';
import { SettingsService } from './service.ts';

/** Ajustes en memoria con los valores por defecto, para pruebas. */
export function memorySettings(): SettingsService {
  let saved: Settings | null = null;
  return new SettingsService(
    { get: async () => saved, save: async (s) => void (saved = s) },
    { version: SETTINGS_VERSION, agent: { create: true, delete: false } },
  );
}
