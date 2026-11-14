import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { LOCAL_ORIGIN } from '../http/origin.ts';

const LOCAL_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/;
const noSessions = { errors: ['Este servidor MCP no usa sesiones: solo acepta POST'] };

/** MCP sin sesión: cada POST crea su servidor y transporte. Protege contra DNS rebinding comprobando host y origen. */
export function mcpRoutes(createServer: () => McpServer): Hono {
  const app = new Hono();
  app.use(async (c, next) => {
    if (!LOCAL_HOST.test(c.req.header('host') ?? '')) return c.json({ errors: ['Host no permitido'] }, 403);
    const origin = c.req.header('origin');
    if (origin !== undefined && !LOCAL_ORIGIN.test(origin)) return c.json({ errors: ['Origen no permitido'] }, 403);
    await next();
  });
  app.post('/', async (c) => {
    const server = createServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });
  app.on(['GET', 'DELETE'], '/', (c) => c.json(noSessions, 405));
  return app;
}
