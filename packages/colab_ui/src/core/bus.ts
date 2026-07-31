import type { ColabMessage, ColabMessageType } from "colab-protocol";

/**
 * A handler for a single message `type`, receiving the fully-narrowed message.
 */
export type MessageHandler<T extends ColabMessageType> = (
  message: ColabMessage<T>,
) => void;

/**
 * `MessageBus` — the core typed publish/subscribe primitive.
 *
 * Dispatches each {@link ColabMessage} only to handlers registered for that
 * message's `type`, inferring the handler's payload from `type` via the
 * protocol `MessageMap`. Backend- and framework-free; the session (T6) relays
 * outbound publishes to the transport and routes inbound non-lifecycle
 * messages back in, and interactions (I5) publish/subscribe through it.
 */
export interface MessageBus {
  /** Dispatch `message` to every handler registered for its `type`, in order. */
  publish(message: ColabMessage): void;
  /**
   * Register `handler` for messages of `type`. Multiple handlers may register
   * for the same type; all fire on publish in registration order.
   *
   * @returns an unsubscribe closure removing exactly this handler.
   */
  subscribe<T extends ColabMessageType>(
    type: T,
    handler: MessageHandler<T>,
  ): () => void;
  /** Remove all handlers of every type (used by session teardown). */
  clear(): void;
}

/** An internally-stored handler, type-erased across the heterogeneous map. */
type AnyHandler = (message: ColabMessage) => void;

/**
 * Reports an error thrown by a subscriber during dispatch. Injectable so the
 * framework-free core needs no ambient `console` / DOM / node lib; the default
 * (see {@link createMessageBus}) logs to the host `console` if one exists.
 */
export type BusErrorReporter = (
  error: unknown,
  message: ColabMessage,
) => void;

/** Minimal shape of a host `console.error`, probed without a DOM/node lib. */
interface ConsoleLike {
  error(...args: unknown[]): void;
}

/** Default reporter: log to the host console if the runtime provides one. */
function defaultReporter(error: unknown, message: ColabMessage): void {
  const host = (globalThis as { console?: ConsoleLike }).console;
  host?.error(`colab MessageBus: handler for "${message.type}" threw`, error);
}

/**
 * Create a {@link MessageBus}.
 *
 * Implemented as a factory closing over a `Map<type, Set<handler>>` — no
 * classes, no `this`. Lookup and dispatch are O(handlers-for-that-type):
 * handlers of other types are never iterated.
 *
 * ERROR ISOLATION: each handler runs inside its own try/catch, so one handler
 * throwing never prevents the remaining handlers for the same type from
 * running. Thrown errors are routed to `onError` (default: host `console.error`
 * when available) and otherwise swallowed, keeping the fan-out resilient.
 *
 * @param onError optional reporter for handler exceptions.
 */
export function createMessageBus(
  onError: BusErrorReporter = defaultReporter,
): MessageBus {
  const handlers = new Map<string, Set<AnyHandler>>();

  function publish(message: ColabMessage): void {
    const set = handlers.get(message.type);
    if (set === undefined) return;
    // Snapshot so (un)subscribes during dispatch don't disturb this fan-out.
    for (const handler of [...set]) {
      try {
        handler(message);
      } catch (error) {
        onError(error, message);
      }
    }
  }

  function subscribe<T extends ColabMessageType>(
    type: T,
    handler: MessageHandler<T>,
  ): () => void {
    let set = handlers.get(type);
    if (set === undefined) {
      set = new Set<AnyHandler>();
      handlers.set(type, set);
    }
    const erased = handler as AnyHandler;
    set.add(erased);
    return () => {
      const current = handlers.get(type);
      if (current === undefined) return;
      current.delete(erased);
      if (current.size === 0) handlers.delete(type);
    };
  }

  function clear(): void {
    handlers.clear();
  }

  return { publish, subscribe, clear };
}
