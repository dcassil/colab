import { createServer as createHttpServer } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import {
  COLAB_EVENTS,
  COLAB_SERVER_EVENTS,
  asScopeId,
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
const charlie: Identity = { id: "charlie", name: "Charlie", color: "#0c0" };

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

  it("syncs edit-lock state on join and reconciles it on disconnect", async () => {
    server = createColabServer({ cors: { origin: "http://localhost" } });
    const url = `http://127.0.0.1:${String(await server.listen(0, "127.0.0.1"))}`;

    // Alice joins FIRST and sets a lock before anyone else is present.
    const first = connectClient(url, "room-b", alice);
    await waitForConnect(first);
    first.emit(
      COLAB_EVENTS.INTERACTION,
      createMessage(COLAB_EVENTS.INTERACTION, alice.id, {
        name: "edit-lock",
        scopeId: asScopeId("cell-1"),
        data: { action: "lock" },
      }),
    );
    // Ensure the server has processed the lock before Bob joins.
    await delay(30);

    // (a) Bob joins AFTER the lock was set → receives it in his snapshot.
    const second = connectClient(url, "room-b", bob);
    const snapshotLock = waitForInteraction(second);
    await waitForConnect(second);
    expect(await snapshotLock).toMatchObject({
      from: alice.id,
      payload: { name: "edit-lock", scopeId: "cell-1", data: { action: "lock" } },
    });

    // (b) A lock set by the LATE joiner reaches the earlier client.
    const aliceSeesBobLock = waitForInteraction(first);
    second.emit(
      COLAB_EVENTS.INTERACTION,
      createMessage(COLAB_EVENTS.INTERACTION, bob.id, {
        name: "edit-lock",
        scopeId: asScopeId("cell-2"),
        data: { action: "lock" },
      }),
    );
    expect(await aliceSeesBobLock).toMatchObject({
      from: bob.id,
      payload: { name: "edit-lock", scopeId: "cell-2", data: { action: "lock" } },
    });

    // (c) On disconnect, the departed participant's locks are cleared for peers.
    const aliceSeesClear = waitForInteraction(first);
    second.disconnect();
    expect(await aliceSeesClear).toMatchObject({
      from: bob.id,
      payload: { name: "edit-lock", scopeId: "cell-2", data: { action: "clear" } },
    });
  });

  it("enforces first-holder-wins edit locks at the relay", async () => {
    server = createColabServer({ cors: { origin: "http://localhost" } });
    const url = `http://127.0.0.1:${String(await server.listen(0, "127.0.0.1"))}`;
    const scopeId = asScopeId("cell-race");

    const first = connectClient(url, "room-c", alice);
    await waitForConnect(first);
    const second = connectClient(url, "room-c", bob);
    await waitForConnect(second);

    const bobSeesAliceLock = waitForInteraction(second);
    first.emit(
      COLAB_EVENTS.INTERACTION,
      createMessage(COLAB_EVENTS.INTERACTION, alice.id, {
        name: "edit-lock",
        scopeId,
        data: { action: "lock" },
      }),
    );
    expect(await bobSeesAliceLock).toMatchObject({
      from: alice.id,
      payload: { name: "edit-lock", scopeId, data: { action: "lock" } },
    });

    second.emit(
      COLAB_EVENTS.INTERACTION,
      createMessage(COLAB_EVENTS.INTERACTION, bob.id, {
        name: "edit-lock",
        scopeId,
        data: { action: "lock" },
      }),
    );
    await expectNoInteraction(first);

    const third = connectClient(url, "room-c", charlie);
    const charlieSnapshot = waitForInteraction(third);
    await waitForConnect(third);
    expect(await charlieSnapshot).toMatchObject({
      from: alice.id,
      payload: { name: "edit-lock", scopeId, data: { action: "lock" } },
    });

    const bobSeesAliceClear = waitForInteraction(second);
    first.emit(
      COLAB_EVENTS.INTERACTION,
      createMessage(COLAB_EVENTS.INTERACTION, alice.id, {
        name: "edit-lock",
        scopeId,
        data: { action: "clear" },
      }),
    );
    expect(await bobSeesAliceClear).toMatchObject({
      from: alice.id,
      payload: { name: "edit-lock", scopeId, data: { action: "clear" } },
    });

    const aliceSeesBobLock = waitForInteraction(first);
    second.emit(
      COLAB_EVENTS.INTERACTION,
      createMessage(COLAB_EVENTS.INTERACTION, bob.id, {
        name: "edit-lock",
        scopeId,
        data: { action: "lock" },
      }),
    );
    expect(await aliceSeesBobLock).toMatchObject({
      from: bob.id,
      payload: { name: "edit-lock", scopeId, data: { action: "lock" } },
    });

    const aliceSeesBobClear = waitForInteraction(first);
    second.disconnect();
    expect(await aliceSeesBobClear).toMatchObject({
      from: bob.id,
      payload: { name: "edit-lock", scopeId, data: { action: "clear" } },
    });
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

function waitForInteraction(
  client: TestClient,
): Promise<ColabMessage<typeof COLAB_SERVER_EVENTS.INTERACTION>> {
  return new Promise((resolve) => {
    client.once(COLAB_SERVER_EVENTS.INTERACTION, (message) => {
      resolve(message);
    });
  });
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function expectNoInteraction(
  client: TestClient,
  milliseconds = 50,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(COLAB_SERVER_EVENTS.INTERACTION, onInteraction);
      resolve();
    }, milliseconds);
    const onInteraction = (
      message: ColabMessage<typeof COLAB_SERVER_EVENTS.INTERACTION>,
    ): void => {
      clearTimeout(timer);
      reject(
        new Error(
          `unexpected interaction from ${message.from}: ${JSON.stringify(
            message.payload,
          )}`,
        ),
      );
    };
    client.once(COLAB_SERVER_EVENTS.INTERACTION, onInteraction);
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
