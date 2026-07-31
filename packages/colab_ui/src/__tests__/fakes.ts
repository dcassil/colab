import type { ColabMessage } from "colab-protocol";

import type { ColabStore } from "../contracts/store.js";
import type { ColabTransport } from "../contracts/transport.js";

/** A hand-written fake {@link ColabTransport} standing in for I3/I6. */
export interface FakeTransport extends ColabTransport {
  /** Messages passed to `send`, in order. */
  readonly sent: ColabMessage[];
  /** Number of times `connect` / `disconnect` were called. */
  readonly connectCalls: () => number;
  readonly disconnectCalls: () => number;
  /** Whether an inbound handler is currently subscribed. */
  readonly hasSubscriber: () => boolean;
  /** Simulate the remote emitting a message to the subscribed handler. */
  emit(message: ColabMessage): void;
}

/** Build a {@link FakeTransport} with observable call bookkeeping. */
export function createFakeTransport(): FakeTransport {
  const sent: ColabMessage[] = [];
  let handler: ((message: ColabMessage) => void) | undefined;
  let connects = 0;
  let disconnects = 0;

  return {
    sent,
    connectCalls: () => connects,
    disconnectCalls: () => disconnects,
    hasSubscriber: () => handler !== undefined,
    connect: () => void connects++,
    disconnect: () => void disconnects++,
    send: (message) => void sent.push(message),
    subscribe: (h) => {
      handler = h;
      return () => {
        handler = undefined;
      };
    },
    emit: (message) => handler?.(message),
  };
}

/** A minimal in-memory fake {@link ColabStore}. */
export function createFakeStore(): ColabStore {
  const backing = new Map<string, unknown>();
  const listeners = new Map<string, Set<() => void>>();
  return {
    get: (key) => backing.get(key),
    set: (key, value) => {
      backing.set(key, value);
      for (const listener of listeners.get(key) ?? []) listener();
    },
    subscribe: (key, listener) => {
      const set = listeners.get(key) ?? new Set<() => void>();
      set.add(listener);
      listeners.set(key, set);
      return () => {
        set.delete(listener);
      };
    },
  };
}
