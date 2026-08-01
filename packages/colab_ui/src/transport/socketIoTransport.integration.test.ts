/**
 * REAL end-to-end integration test: the ACTUAL default
 * {@link createSocketIoTransport} (colab-ui) against the ACTUAL default
 * {@link createColabServer} (colab-server) over a real loopback socket.
 *
 * This is the coverage that was MISSING when 0.1.0 shipped: every prior
 * transport test used a fake/mocked `socket.io-client`, so the wire-shape
 * mismatch (single `colab:msg` vs per-type channels), the missing handshake
 * `roomId`, and the connect/join ordering all went undetected. Here two DEFAULT
 * transports (two participants) connect to one room on a real ephemeral-port
 * server and we assert the full contract end to end:
 *
 *   1. Both join and see each other in the roster.
 *   2. A pointer/cursor message from A arrives at B (on the server channel).
 *   3. An interaction (lock) from A arrives at B.
 *   4. Leaving (disconnect) removes a participant for the remaining peer.
 *
 * If this sandbox cannot bind a loopback socket, the suite probe-skips
 * gracefully — exactly like `colab_server/src/relay.integration.test.ts`.
 */
import { createServer as createHttpServer } from "node:http";

import {
  COLAB_EVENTS,
  COLAB_SERVER_EVENTS,
  asScopeId,
  createMessage,
  type ColabMessage,
  type Identity,
  type Participant,
} from "colab-protocol";
import { createColabServer, type ColabServer } from "colab-server";
import { afterEach, describe, expect, it } from "vitest";

import type { ColabTransport } from "../contracts/index.js";

import { createSocketIoTransport } from "./socketIoTransport.js";

const alice: Identity = { id: "alice", name: "Alice", color: "#c00" };
const bob: Identity = { id: "bob", name: "Bob", color: "#00c" };

let server: ColabServer | undefined;
const transports: ColabTransport[] = [];

const describeWhenListeningWorks = (await canListenOnLoopback())
  ? describe
  : describe.skip;

afterEach(async () => {
  for (const transport of transports.splice(0)) {
    await transport.disconnect();
  }
  await server?.close();
  server = undefined;
});

describeWhenListeningWorks(
  "default socket.io transport ↔ default colab server",
  () => {
    it("joins both peers, relays pointer + interaction, and leaves on disconnect", async () => {
      server = createColabServer({ cors: { origin: "http://localhost" } });
      const port = await server.listen(0, "127.0.0.1");
      const url = `http://127.0.0.1:${String(port)}`;

      // ── A connects first ──────────────────────────────────────────────────
      const a = createSocketIoTransport({ url, room: "room-a", identity: alice });
      transports.push(a);
      const aInbox = new Inbox(a);
      await a.connect();

      // A's own join yields a roster listing itself.
      const aRoster = await aInbox.next(COLAB_SERVER_EVENTS.ROSTER);
      expect(rosterIds(aRoster)).toEqual(["alice"]);

      // ── B connects to the same room ───────────────────────────────────────
      const b = createSocketIoTransport({ url, room: "room-a", identity: bob });
      transports.push(b);
      const bInbox = new Inbox(b);

      // A must observe B joining; B's own roster must list both.
      const aSeesBJoin = aInbox.next(COLAB_SERVER_EVENTS.PARTICIPANT_JOINED);
      await b.connect();

      const bRoster = await bInbox.next(COLAB_SERVER_EVENTS.ROSTER);
      expect(rosterIds(bRoster)).toEqual(expect.arrayContaining(["alice", "bob"]));
      expect(rosterIds(bRoster)).toHaveLength(2);

      const joinEvent = await aSeesBJoin;
      expect(joinEvent.payload).toMatchObject({ id: "bob" });

      // ── (2) Pointer from A arrives at B ───────────────────────────────────
      const bSeesPointer = bInbox.next(COLAB_SERVER_EVENTS.POINTER);
      a.send(createMessage(COLAB_EVENTS.POINTER, alice.id, { x: 0.25, y: 0.75 }));
      const pointer = await bSeesPointer;
      expect(pointer).toMatchObject({
        from: alice.id,
        payload: { x: 0.25, y: 0.75 },
      });

      // ── (3) Interaction (lock) from A arrives at B ────────────────────────
      const bSeesInteraction = bInbox.next(COLAB_SERVER_EVENTS.INTERACTION);
      a.send(
        createMessage(COLAB_EVENTS.INTERACTION, alice.id, {
          name: "lock",
          scopeId: asScopeId("cell-1"),
          data: { held: true },
        }),
      );
      const interaction = await bSeesInteraction;
      expect(interaction).toMatchObject({
        from: alice.id,
        payload: { name: "lock", scopeId: "cell-1" },
      });

      // ── (4) Leave on disconnect removes B from A's view ───────────────────
      const aSeesBLeave = aInbox.next(COLAB_SERVER_EVENTS.PARTICIPANT_LEFT);
      await b.disconnect();
      const leave = await aSeesBLeave;
      expect(leave.payload).toMatchObject({ id: "bob" });
    });
  },
);

/**
 * Buffers inbound messages from a transport and hands them out by type, so a
 * test can `await inbox.next(type)` for an event that may arrive before or
 * after the await is registered.
 */
class Inbox {
  private readonly received: ColabMessage[] = [];
  private readonly waiters: {
    type: string;
    resolve: (message: ColabMessage) => void;
  }[] = [];

  constructor(transport: ColabTransport) {
    transport.subscribe((message) => {
      const waiterIndex = this.waiters.findIndex((w) => w.type === message.type);
      if (waiterIndex >= 0) {
        const [waiter] = this.waiters.splice(waiterIndex, 1);
        waiter?.resolve(message);
        return;
      }
      this.received.push(message);
    });
  }

  next<T extends ColabMessage["type"]>(type: T): Promise<ColabMessage<T>> {
    const index = this.received.findIndex((m) => m.type === type);
    if (index >= 0) {
      const [message] = this.received.splice(index, 1);
      return Promise.resolve(message as ColabMessage<T>);
    }
    return new Promise<ColabMessage<T>>((resolve) => {
      this.waiters.push({
        type,
        resolve: (message) => {
          resolve(message as ColabMessage<T>);
        },
      });
    });
  }
}

function rosterIds(
  message: ColabMessage<typeof COLAB_SERVER_EVENTS.ROSTER>,
): string[] {
  return message.payload.participants.map((p: Participant) => p.id);
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
