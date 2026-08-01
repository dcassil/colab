/**
 * colab-ui — framework-agnostic collaboration core (public entry).
 *
 * Exposes the seam CONTRACTS the core depends on ({@link ColabTransport},
 * {@link ColabStore}, {@link Interaction}). Concrete implementations of these
 * seams are supplied by downstream initiatives (I3 transport/store, I5
 * interactions), never by this package. Core primitives (MessageBus, Roster,
 * InteractionRegistry, Session) are added by later I2 tasks.
 *
 * I3 also ships the DEFAULT seam implementations from here: the in-memory
 * {@link createInMemoryStore} (and, in later I3 tasks, the default transports
 * and identity helpers). The barrel must stay dependency-light — defaults that
 * carry heavy optional deps (e.g. socket.io-client) are lazily imported and
 * never pulled in at barrel load.
 *
 * May import `colab-protocol`; must never import `colab-server`.
 */
export type {
  ColabTransport,
  ColabStore,
  Interaction,
} from "./contracts/index.js";

// ── Protocol symbols a `defineInteraction` author must name at the boundary ──
// Re-exported from the shared wire contract so consumers can type the message
// envelope, mint a `ScopeId`, and reference the client event constants without
// depending on `colab-protocol` directly.
export {
  asScopeId,
  isScopeId,
  createMessage,
  COLAB_EVENTS,
  COLAB_SERVER_EVENTS,
} from "colab-protocol";
export type {
  ScopeId,
  ColabMessage,
  ColabMessageType,
  MessageMap,
  InteractionPayload,
  Identity,
  Participant,
  PointerPosition,
  ColabEvent,
  ColabServerEvent,
} from "colab-protocol";

export { createMessageBus } from "./core/index.js";
export type {
  MessageBus,
  MessageHandler,
  BusErrorReporter,
} from "./core/index.js";
export { createRoster } from "./core/index.js";
export type { Roster } from "./core/index.js";
export { createInteractionRegistry } from "./core/index.js";
export type { InteractionRegistry } from "./core/index.js";
export { createSession } from "./core/index.js";
export type { Session, SessionDeps } from "./core/index.js";

export { defineInteraction } from "./interaction/index.js";
export type {
  InteractionDescriptor,
  InteractionSelectors,
} from "./interaction/index.js";
export { EditLock, EDIT_LOCK_TYPE, reconcileEditLocks } from "./interactions/edit-lock/index.js";
export type {
  EditLockAction,
  EditLockEvent,
  EditLockSelectors,
  EditLockState,
  ParticipantId,
} from "./interactions/edit-lock/index.js";

export { createInMemoryStore } from "./store/index.js";

export {
  createInMemoryTransport,
  createHub,
  defaultHub,
  createSocketIoTransport,
} from "./transport/index.js";
export type {
  InMemoryTransportOptions,
  Hub,
  HubListener,
  SocketIoTransportOptions,
  SocketAuth,
} from "./transport/index.js";

export {
  resolveIdentity,
  createIdentityProvider,
  InvalidIdentityError,
} from "./identity/index.js";
export type {
  ColabCredentials,
  IdentityInput,
  IdentityProvider,
} from "./identity/index.js";

export {
  ColabStage,
  ColabStageContext,
  identity,
  useColabStage,
} from "./coordinate/index.js";
export type {
  ColabStageContextValue,
  Point,
  PointerSampleListener,
  PointerSampleSource,
  StageBox,
  Transform,
} from "./coordinate/index.js";

// ── I5 reference interactions (pure descriptors; geometry/DOM-free) ───────────
// Additive: the parallel EditLock/AvatarStack exports reconcile alongside these.
export { Cursor, createCursorInteraction, CURSOR_TYPE } from "./interactions/cursor/index.js";
export type {
  CursorPoint,
  CursorState,
  RemoteCursorEntry,
} from "./interactions/cursor/index.js";
