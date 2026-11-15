import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { CanvasEvent, PatchPublisher } from '../../features/canvas/publisher.ts';
import type { ProjectsEvent, ProjectsPublisher } from '../../features/projects/publisher.ts';
import { LOCAL_ORIGIN } from '../http/origin.ts';

// Los WebSocket no tienen CORS: se valida el origen a mano (misma regla que la API HTTP).
// `?project=<id>` recibe los parches de ese proyecto; `?project=*` recibe los de todos y las altas y bajas.

const ALL = '*';

export class WsHub implements PatchPublisher, ProjectsPublisher {
  #wss?: WebSocketServer;
  #subs = new Map<string, Set<WebSocket>>();

  attach(server: Server): void {
    this.#wss = new WebSocketServer({ server, path: '/ws' });
    this.#wss.on('connection', (socket, req) => {
      const origin = req.headers.origin;
      if (origin !== undefined && !LOCAL_ORIGIN.test(origin)) return socket.close(1008, 'Origen no permitido');
      const projectId = new URL(req.url ?? '', 'http://localhost').searchParams.get('project');
      if (!projectId) return socket.close(1008, 'Falta el parámetro project');
      let set = this.#subs.get(projectId);
      if (!set) this.#subs.set(projectId, (set = new Set()));
      set.add(socket);
      socket.on('close', () => {
        set.delete(socket);
        if (set.size === 0 && this.#subs.get(projectId) === set) this.#subs.delete(projectId);
      });
    });
  }

  publish(event: CanvasEvent): void {
    this.#send([event.projectId, ALL], { type: 'patches', ...event });
  }

  publishProjects(event: ProjectsEvent): void {
    this.#send([ALL], { type: 'projects', ...event });
  }

  #send(channels: string[], data: object): void {
    const message = JSON.stringify(data);
    for (const channel of channels) {
      for (const socket of this.#subs.get(channel) ?? []) {
        if (socket.readyState === WebSocket.OPEN) socket.send(message);
      }
    }
  }

  close(): Promise<void> {
    const wss = this.#wss;
    if (!wss) return Promise.resolve();
    for (const client of wss.clients) client.terminate();
    return new Promise((resolve, reject) => wss.close((err) => (err ? reject(err) : resolve())));
  }
}
