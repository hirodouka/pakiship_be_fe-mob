import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

type HttpApp = (req: IncomingMessage, res: ServerResponse) => void;
const nativeFetch = globalThis.fetch.bind(globalThis);

interface AppRequest {
  method?: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface AppResponse<T = unknown> {
  status: number;
  body: T;
}

export async function requestApp<T = unknown>(
  app: HttpApp,
  { method = 'GET', path, body, headers }: AppRequest,
): Promise<AppResponse<T>> {
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = server.address() as AddressInfo;
    const response = await nativeFetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const parsedBody = text ? parseBody(text) : null;

    return {
      status: response.status,
      body: parsedBody as T,
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
