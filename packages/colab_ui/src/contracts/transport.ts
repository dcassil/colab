import type { ColabMessage } from "colab-protocol";

/**
 * `ColabTransport` — the seam between the core and the network.
 *
 * DECLARED CONTRACT ONLY. No concrete implementation ships from I2. The
 * default Socket.IO transport (and any alternative transport) is implemented
 * in I3; the core depends only on this interface, never on a concrete class,
 * so it stays backend-agnostic.
 *
 * A transport moves {@link ColabMessage} envelopes to and from some remote
 * peer/relay. It is deliberately minimal — the four handlers named in the
 * vision — and transport-neutral: methods may run synchronously or return a
 * promise, and carry no DOM, framework, or protocol-detail assumptions.
 */
export interface ColabTransport {
  /** Open the connection. May be synchronous or async. */
  connect(): Promise<void> | void;
  /** Close the connection. May be synchronous or async. */
  disconnect(): Promise<void> | void;
  /** Send one message to the remote peer/relay. */
  send(message: ColabMessage): void;
  /**
   * Register a handler for inbound messages.
   *
   * @returns an unsubscribe closure that detaches the handler.
   */
  subscribe(handler: (message: ColabMessage) => void): () => void;
}
