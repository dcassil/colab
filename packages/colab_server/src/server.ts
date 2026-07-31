import {
  createServer as createHttpServer,
  type Server as HttpServer,
} from "node:http";
import { Server as SocketServer, type ServerOptions } from "socket.io";

import { attachColabRelay, type RelayOptions } from "./relay.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./socket-events.js";

export interface CorsConfig {
  origin: string | string[];
}

export interface CreateColabServerOptions extends RelayOptions {
  cors?: CorsConfig;
  demoAllowAnyOrigin?: boolean;
  host?: string;
  httpServer?: HttpServer;
  port?: number;
  socketOptions?: Partial<Omit<ServerOptions, "cors">>;
}

export type ColabSocketServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export interface ColabServer {
  httpServer: HttpServer;
  io: ColabSocketServer;
  close: () => Promise<void>;
  listen: (port?: number, host?: string) => Promise<number>;
}

type ResolvedCors = NonNullable<ServerOptions["cors"]>;

export function createColabServer(options: CreateColabServerOptions): ColabServer {
  const httpServer = options.httpServer ?? createHttpServer();
  const io = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    ...options.socketOptions,
    cors: resolveCors(options),
  });

  attachColabRelay(io, options);

  return {
    httpServer,
    io,
    close: () => closeServer(io, httpServer),
    listen: (port = options.port ?? 0, host = options.host) =>
      listen(httpServer, port, host),
  };
}

function resolveCors(options: CreateColabServerOptions): ResolvedCors {
  if (options.demoAllowAnyOrigin === true) {
    return { origin: "*" };
  }

  if (options.cors === undefined) {
    throw new Error("Colab server requires explicit CORS origins");
  }

  return { origin: options.cors.origin };
}

async function listen(
  httpServer: HttpServer,
  port: number,
  host: string | undefined,
): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      reject(error);
    };

    httpServer.once("error", onError);
    const onListening = (): void => {
      httpServer.off("error", onError);
      resolve();
    };

    if (host === undefined) {
      httpServer.listen(port, onListening);
      return;
    }

    httpServer.listen(port, host, onListening);
  });

  return readPort(httpServer);
}

async function closeServer(
  io: ColabSocketServer,
  httpServer: HttpServer,
): Promise<void> {
  await new Promise<void>((resolve) => {
    void io.close(() => {
      resolve();
    });
  });

  if (!httpServer.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }

      reject(error);
    });
  });
}

function readPort(httpServer: HttpServer): number {
  const address = httpServer.address();

  if (typeof address === "object" && address !== null) {
    return address.port;
  }

  throw new Error("Colab server did not bind to a TCP port");
}
