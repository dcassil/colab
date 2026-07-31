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
type ServerEvent = keyof ServerToClientEvents;
type ServerMessage<T extends ServerEvent> = ServerToClientEvents[T] extends (
  message: infer Message,
) => void
  ? Message
  : never;

const alice: Identity = { id: "alice", name: "Alice", color: "#c00" };
const bob: Identity = { id: "bob", name: "Bob", color: "#00c" };

let server: ColabServer | undefined;
const clients: TestClient[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }

  await server?.close();
  server = undefined;
});

describe("Socket.IO relay integration", () => {
  it("fans out to peers, sends roster, and emits leave on disconnect", async () => {
    server = createColabServer({ cors: { origin: "http://localhost" } });
    const url = `http://localhost:${String(await server.listen())}`;

    const first = connectClient(url, "room-a", alice);
    const firstRoster = waitForEvent(first, COLAB_SERVER_EVENTS.ROSTER);
    await waitForConnect(first);
    expect(await firstRoster).toMatchObject({
      payload: { participants: [alice] },
    });

    const joined = waitForEvent(first, COLAB_SERVER_EVENTS.PARTICIPANT_JOINED);
    const second = connectClient(url, "room-a", bob);
    const secondRoster = waitForEvent(second, COLAB_SERVER_EVENTS.ROSTER);
    await waitForConnect(second);
    expect(await joined).toMatchObject({ payload: bob });
    expect((await secondRoster).payload.participants).toHaveLength(2);

    const echoes: ColabMessage<typeof COLAB_SERVER_EVENTS.POINTER>[] = [];
    first.on(COLAB_SERVER_EVENTS.POINTER, (message) => echoes.push(message));

    const relayed = waitForEvent(second, COLAB_SERVER_EVENTS.POINTER);
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

    const left = waitForEvent(first, COLAB_SERVER_EVENTS.PARTICIPANT_LEFT);
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

function waitForEvent<T extends ServerEvent>(
  client: TestClient,
  event: T,
): Promise<ServerMessage<T>> {
  return new Promise((resolve) => {
    client.once(event, (message) => {
      resolve(message);
    });
  });
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
