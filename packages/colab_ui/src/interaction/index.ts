/**
 * colab-ui interaction substrate (framework-free).
 *
 * The `defineInteraction` factory + `InteractionDescriptor` type: the pure
 * descriptor shape every I5 interaction (Cursor, EditLock, …) composes on, and
 * the registry integration that makes a descriptor routable. The lifecycle that
 * DRIVES a descriptor lives in I4's `useInteraction`, specified by CONTRACT.md.
 */
export { defineInteraction } from "./defineInteraction.js";
export type {
  InteractionDescriptor,
  InteractionSelectors,
} from "./descriptor.js";
