import { z } from 'zod';

export const SETTINGS_VERSION = 1;

/** Lo que el agente puede hacer por MCP además de leer y dibujar. */
export const AgentPermissionsSchema = z.object({
  create: z.boolean({ error: 'create debe ser true o false' }),
  delete: z.boolean({ error: 'delete debe ser true o false' }),
});
export type AgentPermissions = z.infer<typeof AgentPermissionsSchema>;

export const SettingsSchema = z.object({ version: z.literal(SETTINGS_VERSION), agent: AgentPermissionsSchema });
export type Settings = z.infer<typeof SettingsSchema>;
