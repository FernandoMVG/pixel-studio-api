# pixel-api

Dominio, HTTP/WebSocket y MCP de Pixel Studio. Reglas generales en `../CLAUDE.md`; modelo y roadmap en `../docs/CONTEXTO.md`.

## Comandos
| Comando | Uso |
|---|---|
| `npm test -- src/features/<funcionalidad>` | Pruebas de una funcionalidad (lo normal mientras se desarrolla) |
| `npm test -- --changed` | Tras tocar `src/infra/` |
| `npm test` | Suite completa, solo al cerrar una fase |
| `npm run typecheck` | Tipos de TypeScript |

## Estructura
- `src/features/<funcionalidad>/`: modelo Zod + tipos inferidos, comandos o servicio, y solo las pruebas imprescindibles (`*.test.ts` al lado del código).
- `src/infra/`: lo transversal (storage, y más adelante http, ws y config).
- Las funcionalidades no importan nada de `src/infra/` ni de `node:fs`, `node:http` o `node:net`.

## Convenciones
- ESM con `"module": "NodeNext"`: los imports relativos llevan extensión `.js` aunque el archivo sea `.ts`.
- Mensajes de error para el usuario y el agente en español; identificadores en inglés.
- Coordenadas, filas, columnas e índices de cuadro empiezan en 0.
