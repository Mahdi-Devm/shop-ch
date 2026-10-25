import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { get } from 'node:http';
import type { AddressInfo } from 'node:net';

export type StatusEvent = { status: string; version: number };

export type OpenEventStream = {
  statusCode: number;
  events: StatusEvent[];
  ended: Promise<void>;
  close: () => void;
};

export function openEventStream(
  app: NestExpressApplication,
  path: string,
): Promise<OpenEventStream> {
  const { port } = (
    app.getHttpServer() as { address(): AddressInfo }
  ).address();

  return new Promise((resolve, reject) => {
    const events: StatusEvent[] = [];
    const clientRequest: ClientRequest = get(
      {
        host: '127.0.0.1',
        port,
        path,
        headers: { Accept: 'text/event-stream' },
      },
      (response: IncomingMessage) => {
        let buffer = '';
        const ended = new Promise<void>((resolveEnded) => {
          response.on('end', resolveEnded);
          response.on('close', resolveEnded);
        });

        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          buffer += chunk;
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const isHeartbeat = frame
              .split('\n')
              .some((line) => line === 'event: heartbeat');
            const dataLine = frame
              .split('\n')
              .find((line) => line.startsWith('data: '));
            if (dataLine && !isHeartbeat) {
              events.push(JSON.parse(dataLine.slice(6)) as StatusEvent);
            }
          }
        });

        resolve({
          statusCode: response.statusCode ?? 0,
          events,
          ended,
          close: () => clientRequest.destroy(),
        });
      },
    );
    clientRequest.on('error', reject);
  });
}
