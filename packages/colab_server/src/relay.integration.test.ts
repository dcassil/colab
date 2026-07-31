import { createServer as createHttpServer } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import {
  COLAB_EVENTS,
  COLAB_SERVER_EVENTS,
  createMessage,
  type ColabMessage,
  type Identity,
} from "colab-protocol";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";

import { createColabServer, type ColabServer } from "./server.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./socket-events.js";

type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const alice: Identity = { id: "alice", name: "Alice", color: "#c00" };
const bob: Identity = { id: "bob", name: "Bob", color: "#00c" };

let server: ColabServer | undefined;
const clients: TestClient[] = [];
const describeWhenListeningWorks = (await canListenOnLoopback())
  ? describe
  : describe.skip;

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }

  await server?.close();
  server = undefined;
});

describeWhenListeningWorks("Socket.IO relay integration", () => {
  it("fans out to peers, sends roster, and emits leave on disconnect", async () => {
    server = createColabServer({ cors: { origin: "http://localhost" } });
    const url = `http://127.0.0.1:${String(await server.listen(0, "127.0.0.1"))}`;

    const first = connectClient(url, "room-a", alice);
    const firstRoster = waitForRoster(first);
    await waitForConnect(first);
    expect(await firstRoster).toMatchObject({
      payload: { participants: [alice] },
    });

    const joined = waitForParticipantJoined(first);
    const second = connectClient(url, "room-a", bob);
    const secondRoster = waitForRoster(second);
    await waitForConnect(second);
    expect(await joined).toMatchObject({ payload: bob });
    expect((await secondRoster).payload.participants).toHaveLength(2);

    const echoes: ColabMessage<typeof COLAB_SERVER_EVENTS.POINTER>[] = [];
    first.on(COLAB_SERVER_EVENTS.POINTER, (message) => echoes.push(message));

    const relayed = waitForPointer(second);
    first.emit(
      COLAB_EVENTS.POINTER,
      createMessage(COLAB_EVENTS.POINTER, alice.id, { x: 0.25, y: 0.75 }),
    );

    expect(await relayed).toMatchObject({
      from: alice.id,
      payload: { x: 0.25, y: 0.75 },
    });
    await delay(30);
    expect(echoes).toEqual([]);

    const left = waitForParticipantLeft(first);
    second.disconnect();
    expect(await left).toMatchObject({ payload: { id: bob.id } });
  });
});

function connectClient(
  url: string,
  roomId: string,
  identity: Identity,
): TestClient {
  const client = connect(url, {
    auth: { identity, roomId },
    transports: ["websocket"],
  });
  clients.push(client);
  return client;
}

async function waitForConnect(client: TestClient | undefined): Promise<void> {
  if (client === undefined) {
    throw new Error("Expected test client to exist");
  }

  if (client.connected) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
  });
}

function waitForRoster(
  client: TestClient,
): Promise<ColabMessage<typeof COLAB_SERVER_EVENTS.ROSTER>> {
  return new Promise((resolve) => {
    client.once(COLAB_SERVER_EVENTS.ROSTER, (message) => {
      resolve(message);
    });
  });
}

function waitForParticipantJoined(
  client: TestClient,
): Promise<ColabMessage<typeof COLAB_SERVER_EVENTS.PARTICIPANT_JOINED>> {
  return new Promise((resolve) => {
    client.once(COLAB_SERVER_EVENTS.PARTICIPANT_JOINED, (message) => {
      resolve(message);
    });
  });
}

function waitForPointer(
  client: TestClient,
): Promise<ColabMessage<typeof COLAB_SERVER_EVENTS.POINTER>> {
  return new Promise((resolve) => {
    client.once(COLAB_SERVER_EVENTS.POINTER, (message) => {
      resolve(message);
    });
  });
}

function waitForParticipantLeft(
  client: TestClient,
): Promise<ColabMessage<typeof COLAB_SERVER_EVENTS.PARTICIPANT_LEFT>> {
  return new Promise((resolve) => {
    client.once(COLAB_SERVER_EVENTS.PARTICIPANT_LEFT, (message) => {
      resolve(message);
    });
  });
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function canListenOnLoopback(): Promise<boolean> {
  const probe = createHttpServer();

  return await new Promise<boolean>((resolve) => {
    probe.once("error", () => {
      resolve(false);
    });
    probe.listen(0, "127.0.0.1", () => {
      probe.close(() => {
        resolve(true);
      });
    });
  });
}
