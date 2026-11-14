# pixel-api

Dominio, HTTP/WebSocket y MCP de Pixel Studio. Reglas generales en `../CLAUDE.md`; modelo y roadmap en `../docs/CONTEXTO.md`.

## Comandos
| Comando | Uso |
|---|---|
| `npm test -- src/features/<funcionalidad>` | Pruebas de una funcionalidad (lo normal mientras se desarrolla) |
| `npm test -- --changed` | Tras tocar `src/infra/` |
| `npm test` | Suite completa, solo al cerrar una fase |
| `npm run typecheck` | Tipos de TypeScript |
| `npm run dev` | Levanta la API con recarga automática |

## Estructura
- `src/features/<funcionalidad>/`: modelo Zod + tipos inferidos, comandos o servicio, y solo las pruebas imprescindibles (`*.test.ts` al lado del código).
- `src/infra/`: lo transversal (storage, y más adelante http, ws y config).
- Las funcionalidades no importan nada de `src/infra/` ni de `node:fs`, `node:http` o `node:net`.

## Convenciones
- TypeScript se ejecuta con Node nativo (sin compilar): los imports relativos llevan extensión `.ts` y no se permiten enums ni parameter properties (`erasableSyntaxOnly`).
- Mensajes de error para el usuario y el agente en español; identificadores en inglés.
- Coordenadas, filas, columnas e índices de cuadro empiezan en 0.
- **Windows:** ejecuta Vitest desde una ruta con la unidad en mayúscula (`C:\...`). Si la terminal abre en `c:\...` (pasa en VS Code), Vitest carga sus módulos dos veces y falla con "failed to find the current suite" o "reading 'config'". En PowerShell: `Set-Location 'C:\Users\fmval\Music\pixel-studio\pixel-api'`.
