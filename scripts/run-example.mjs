#!/usr/bin/env node
/**
 * One-command demo bring-up (PROJ-T-0049 / REQ-005).
 *
 * `pnpm example` starts the DEFAULT `colab-server` relay and the example Vite
 * dev server together, waits for the server to report it is listening, prints
 * the app URL, and tears BOTH down cleanly on a single Ctrl-C (no orphaned
 * server). A dependency-free spawner (rather than `concurrently`) is used so the
 * repo needs no extra root dependency and so we can gate app startup on the
 * server's readiness line and guarantee paired teardown.
 *
 * PORT SINGLE-SOURCE: the relay bind port and the app's `serverUrl` are both
 * derived from `example/src/shared/ports.mjs`, so they can never drift.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  APP_URL,
  COLAB_SERVER_PORT,
  COLAB_SERVER_URL,
} from "../example/src/shared/ports.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverBin = resolve(root, "packages/colab_server/dist/bin.js");

const RESET = "[0m";
const SERVER_COLOR = "[36m"; // cyan
const APP_COLOR = "[35m"; // magenta

/** Prefix every line of a child's output with a colored, padded label. */
function pipeLabeled(stream, label, color) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      process.stdout.write(`${color}[${label}]${RESET} ${line}\n`);
    }
  });
}

const children = [];
let shuttingDown = false;

/** Kill every spawned child once, then exit with `code`. */
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
  }
  // Give children a moment to exit, then force-exit the wrapper.
  setTimeout(() => process.exit(code), 300).unref();
}

function spawnLabeled(command, args, label, color, env) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  pipeLabeled(child.stdout, label, color);
  pipeLabeled(child.stderr, label, color);
  child.on("exit", (exitCode) => {
    // Any process exiting tears the whole command down (fail-fast for CI/e2e).
    if (!shuttingDown) {
      process.stdout.write(`\n[${label}] exited (${String(exitCode)})\n`);
      shutdown(exitCode ?? 1);
    }
  });
  return child;
}

async function main() {
  if (!existsSync(serverBin)) {
    process.stdout.write(
      "[setup] colab-server is not built yet — run `pnpm build` first " +
        "(or `pnpm --filter colab-server build`).\n",
    );
    process.exit(1);
  }

  // 1) Start the relay. `demoAllowAnyOrigin` opens CORS for the local demo.
  const server = spawnLabeled("node", [serverBin], "server", SERVER_COLOR, {
    COLAB_SERVER_PORT: String(COLAB_SERVER_PORT),
    COLAB_SERVER_DEMO_ALLOW_ANY_ORIGIN: "true",
  });

  // 2) Wait for the server's "listening" line before starting the app so the
  //    first client connection never races the bind.
  await waitForListening(server);
  process.stdout.write(
    `${SERVER_COLOR}[server]${RESET} relay ready at ${COLAB_SERVER_URL}\n`,
  );

  // 3) Start the Vite dev server for the example app.
  spawnLabeled("pnpm", ["--filter", "example", "dev"], "app", APP_COLOR, {});

  process.stdout.write(
    `\n${APP_COLOR}▶ open the demo in TWO tabs:${RESET} ${APP_URL}\n\n`,
  );
}

/** Resolve once the server prints its listening line (or reject on early exit). */
function waitForListening(server) {
  return new Promise((resolvePromise, reject) => {
    const onData = (chunk) => {
      if (String(chunk).includes("listening on")) {
        server.stdout.off("data", onData);
        resolvePromise();
      }
    };
    server.stdout.on("data", onData);
    server.once("exit", (code) => {
      reject(new Error(`colab-server exited before listening (${String(code)})`));
    });
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  process.stderr.write(`[setup] ${error instanceof Error ? error.message : String(error)}\n`);
  shutdown(1);
});
