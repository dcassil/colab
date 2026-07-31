/**
 * colab-ui default transport adapters (I3 seam defaults).
 *
 * Concrete, framework-free implementations of the I2 {@link ColabTransport}
 * seam. The no-server in-memory / `BroadcastChannel` loopback transport ships
 * here (the deterministic default and test substrate); the default Socket.IO
 * transport is added by a later I3 task and lazy-loads its dependency so it
 * never enters the barrel's static import graph.
 *
 * The shared `runTransportContract` suite is intentionally NOT re-exported from
 * the public package barrel — it is a test-support utility consumed via the
 * relative module path by transport `.test.ts` files.
 */
export { createInMemoryTransport } from "./inMemoryTransport.js";
export type { InMemoryTransportOptions } from "./inMemoryTransport.js";
export { createHub, defaultHub } from "./hub.js";
export type { Hub, HubListener } from "./hub.js";
export { createSocketIoTransport } from "./socketIoTransport.js";
export type {
  SocketIoTransportOptions,
  SocketAuth,
} from "./socketIoTransport.js";
