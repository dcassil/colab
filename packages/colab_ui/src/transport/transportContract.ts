/**
 * Shared, parameterized {@link ColabTransport} contract suite.
 *
 * `runTransportContract` registers a `describe` block asserting the interface
 * behaviors that EVERY `ColabTransport` must uphold, parameterized purely over
 * a `makeTransport` factory — no in-memory-only assumptions. T3 (socket.io)
 * reuses this exact suite against a mocked socket; T5 cites "in-memory passes
 * the same suite as socket.io" as swappability evidence.
 *
 * This module is NOT a test file itself: it exports a function that a thin
 * `.test.ts` wrapper invokes with a concrete factory. It imports vitest's
 * primitives explicitly so it composes into any test file.
 *
 * ENCODED CONTRACT CHOICES:
 *  - NO SELF-ECHO: a peer never receives an envelope it sent.
 *  - Peers sharing a room exchange envelopes; different rooms are isolated.
 *  - `subscribe` returns an idempotent unsubscribe.
 *  - `disconnect` stops all delivery.
 */
import { createMessage } from "colab-protocol";
import type { ColabMessage } from "colab-protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ColabTransport } from "../contracts/transport.js";

/** A factory producing a transport bound to `room` (and identified by `peerId`). */
export type MakeTransport = (room: string, peerId: string) => ColabTransport;

/** Options describing how the factory's transports share a substrate. */
export interface TransportContractOptions {
  /** Human label for the `describe` block (e.g. "in-memory"). */
  label: string;
  /**
   * Optional per-suite reset (e.g. isolate the hub between cases). Runs before
   * each contract test.
   */
  beforeEachHook?: () => void;
}

/** A minimal, wire-valid envelope for delivery assertions. */
const sampleEnvelope = (from: string): ColabMessage =>
  createMessage("pointer", from, { x: 1, y: 2 });

async function connectAll(...transports: ColabTransport[]): Promise<void> {
  for (const t of transports) await t.connect();
}

/**
 * Register the shared contract suite for a transport implementation.
 *
 * @param makeTransport factory building a transport for a `(room, peerId)`.
 * @param options suite label and optional per-test reset hook.
 */
export function runTransportContract(
  makeTransport: MakeTransport,
  options: TransportContractOptions,
): void {
  describe(`ColabTransport contract: ${options.label}`, () => {
    const { beforeEachHook } = options;
    if (beforeEachHook) beforeEach(beforeEachHook);

    // TC-001: inbound delivery after connect.
    it("delivers a peer's envelope to a subscribed peer after connect", async () => {
      const a = makeTransport("r", "a");
      const b = makeTransport("r", "b");
      await connectAll(a, b);
      const spy = vi.fn();
      a.subscribe(spy);

      b.send(sampleEnvelope("b"));

      expect(spy).toHaveBeenCalledTimes(1);
      expect((spy.mock.calls[0]?.[0] as ColabMessage).from).toBe("b");
    });

    // NO SELF-ECHO.
    it("does not echo an envelope back to its sender", async () => {
      const a = makeTransport("r", "a");
      await connectAll(a);
      const spy = vi.fn();
      a.subscribe(spy);

      a.send(sampleEnvelope("a"));

      expect(spy).not.toHaveBeenCalled();
    });

    // TC-002: room isolation.
    it("isolates rooms: a different room's send is not received", async () => {
      const a = makeTransport("r1", "a");
      const c = makeTransport("r2", "c");
      await connectAll(a, c);
      const spy = vi.fn();
      a.subscribe(spy);

      c.send(sampleEnvelope("c"));

      expect(spy).not.toHaveBeenCalled();
    });

    it("returns an idempotent unsubscribe that stops delivery", async () => {
      const a = makeTransport("r", "a");
      const b = makeTransport("r", "b");
      await connectAll(a, b);
      const spy = vi.fn();
      const unsubscribe = a.subscribe(spy);

      unsubscribe();
      unsubscribe();
      b.send(sampleEnvelope("b"));

      expect(spy).not.toHaveBeenCalled();
    });

    // TC-003: disconnect stops delivery.
    it("stops delivery after disconnect", async () => {
      const a = makeTransport("r", "a");
      const b = makeTransport("r", "b");
      await connectAll(a, b);
      const spy = vi.fn();
      a.subscribe(spy);

      await a.disconnect();
      b.send(sampleEnvelope("b"));

      expect(spy).not.toHaveBeenCalled();
    });
  });
}
