#!/usr/bin/env node
import { createColabServer, type CreateColabServerOptions } from "./server.js";

const DEFAULT_PORT = 3001;

try {
  const options = readOptions();
  const server = createColabServer(options);
  const port = await server.listen(options.port, options.host);
  process.stdout.write(`colab-server listening on ${listenUrl(options.host, port)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  process.stderr.write(`colab-server failed to start: ${message}\n`);
  process.exitCode = 1;
}

function readOptions(): CreateColabServerOptions {
  const host = process.env.COLAB_SERVER_HOST;
  const port = readPort(process.env.COLAB_SERVER_PORT);

  if (process.env.COLAB_SERVER_DEMO_ALLOW_ANY_ORIGIN === "true") {
    return withHost({ demoAllowAnyOrigin: true, port }, host);
  }

  const origin = readOrigin(process.env.COLAB_SERVER_CORS_ORIGINS);

  if (origin === undefined) {
    return withHost({ port }, host);
  }

  return withHost({ cors: { origin }, port }, host);
}

function readPort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("COLAB_SERVER_PORT must be a TCP port number");
  }

  return port;
}

function readOrigin(value: string | undefined): string | string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    return undefined;
  }

  const first = origins[0];
  return origins.length === 1 && first !== undefined ? first : origins;
}

function withHost(
  options: CreateColabServerOptions,
  host: string | undefined,
): CreateColabServerOptions {
  return host === undefined || host.length === 0 ? options : { ...options, host };
}

function listenUrl(host: string | undefined, port: number): string {
  return `http://${host ?? "0.0.0.0"}:${String(port)}`;
}
