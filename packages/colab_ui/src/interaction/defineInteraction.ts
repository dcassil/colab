/**
 * `defineInteraction` — the extensibility heart of colab.
 *
 * Turns an authored {@link InteractionDescriptor} of PURE functions into a
 * registrable interaction and registers it into an I2
 * {@link InteractionRegistry} under `descriptor.type`, guarding against
 * duplicate types at registration time. The factory is deliberately THIN:
 * registration + shape guarantee + generic preservation ONLY. It performs NO
 * lifecycle side effects — it does not subscribe, publish, throttle, or touch
 * the DOM/transport. Those responsibilities live in I4's `useInteraction`,
 * specified by {@link file://./CONTRACT.md} and asserted by the conformance
 * tests co-located here.
 *
 * The returned value is the SAME descriptor (identity preserved), typed to keep
 * `State`/`LocalEvent` generics intact for downstream inference at the call
 * site. Because the heterogeneous registry erases state to I2's `Interaction`
 * (state `unknown`, `toMessage(input: unknown)`), registration widens the
 * descriptor to that neutral seam; the concrete types are recovered by the
 * descriptor's own closures, exactly as I2 intends.
 */
import type { Interaction } from "../contracts/interaction.js";
import type { InteractionRegistry } from "../core/registry.js";
import { createInteractionRegistry } from "../core/registry.js";
import type {
  InteractionDescriptor,
  InteractionSelectors,
} from "./descriptor.js";

/**
 * The process-wide default registry. `defineInteraction` registers here when no
 * explicit registry is supplied, so authoring an interaction at module scope
 * gets a duplicate-type dev guard even before a session exists. Sessions build
 * their own registry from the descriptors passed to the provider; passing an
 * explicit registry targets that one instead.
 */
const defaultRegistry: InteractionRegistry = createInteractionRegistry();

/** Widen a typed descriptor to I2's neutral, state-erased `Interaction` seam. */
function toInteractionSeam(descriptor: {
  type: string;
  reduce: (state: never, message: Parameters<Interaction["reduce"]>[1]) => unknown;
  toMessage: (localEvent: never) => ReturnType<Interaction["toMessage"]>;
}): Interaction {
  return {
    type: descriptor.type,
    reduce: (state, message) =>
      descriptor.reduce(state as never, message),
    toMessage: (input) => descriptor.toMessage(input as never),
  };
}

/**
 * Define and register an interaction.
 *
 * @param descriptor The authored, pure interaction descriptor.
 * @param registry   Registry to register into; defaults to the process-wide
 *                   default registry.
 * @returns The same descriptor, generics preserved for downstream inference.
 * @throws {Error} naming the colliding `type` if one is already registered.
 */
export function defineInteraction<
  State,
  LocalEvent,
  Selectors extends InteractionSelectors<State> = InteractionSelectors<State>,
>(
  descriptor: InteractionDescriptor<State, LocalEvent, Selectors>,
  registry: InteractionRegistry = defaultRegistry,
): InteractionDescriptor<State, LocalEvent, Selectors> {
  registry.register(toInteractionSeam(descriptor));
  return descriptor;
}
