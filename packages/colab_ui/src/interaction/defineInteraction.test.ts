import { describe, expect, expectTypeOf, it } from "vitest";

import { COLAB_EVENTS, asScopeId, createMessage } from "colab-protocol";
import type { ColabMessage } from "colab-protocol";

import { createInteractionRegistry } from "../core/registry.js";
import { defineInteraction } from "./defineInteraction.js";
import type { InteractionDescriptor } from "./descriptor.js";

interface LockState {
  lockedBy: Record<string, boolean>;
}

interface LockEvent {
  scopeId: string;
  locked: boolean;
}

/** A representative descriptor: folds `from` into per-sender lock state. */
function lockDescriptor(
  type = "editLock",
): InteractionDescriptor<LockState, LockEvent> {
  return {
    type,
    initialState: { lockedBy: {} },
    reduce: (state, message): LockState => {
      const payload = message.payload as { data?: { locked?: boolean } };
      return {
        lockedBy: { ...state.lockedBy, [message.from]: payload.data?.locked ?? false },
      };
    },
    toMessage: (event): ColabMessage =>
      createMessage(COLAB_EVENTS.INTERACTION, "me", {
        name: type,
        scopeId: asScopeId(event.scopeId),
        data: { locked: event.locked },
      }),
  };
}

describe("defineInteraction — registration (TC-001)", () => {
  it("registers the descriptor into the given registry, keyed by type", () => {
    const registry = createInteractionRegistry();
    defineInteraction(lockDescriptor("x"), registry);

    const entry = registry.get("x");
    expect(entry).toBeDefined();
    expect(entry?.type).toBe("x");
  });

  it("returns the SAME descriptor object (identity preserved)", () => {
    const registry = createInteractionRegistry();
    const descriptor = lockDescriptor("identity");
    const returned = defineInteraction(descriptor, registry);
    expect(returned).toBe(descriptor);
  });

  it("preserves State/LocalEvent generics on the return type", () => {
    const registry = createInteractionRegistry();
    const returned = defineInteraction(lockDescriptor("typed"), registry);
    expectTypeOf(returned).toEqualTypeOf<
      InteractionDescriptor<LockState, LockEvent>
    >();
    expectTypeOf(returned.initialState).toEqualTypeOf<LockState>();
    expectTypeOf<Parameters<typeof returned.toMessage>[0]>().toEqualTypeOf<
      LockEvent
    >();
  });
});

describe("defineInteraction — duplicate-type guard (TC-002)", () => {
  it("throws a developer error naming the colliding type", () => {
    const registry = createInteractionRegistry();
    defineInteraction(lockDescriptor("dup"), registry);
    expect(() => defineInteraction(lockDescriptor("dup"), registry)).toThrow(
      /dup/,
    );
  });

  it("leaves the existing registration intact after a collision", () => {
    const registry = createInteractionRegistry();
    const first = defineInteraction(lockDescriptor("dup2"), registry);
    try {
      defineInteraction(lockDescriptor("dup2"), registry);
    } catch {
      // expected
    }
    expect(registry.get("dup2")?.type).toBe(first.type);
    expect(registry.list()).toHaveLength(1);
  });
});

describe("defineInteraction — no lifecycle side effects", () => {
  it("does not invoke reduce/toMessage or throttle at registration time", () => {
    const registry = createInteractionRegistry();
    let reduceCalls = 0;
    let toMessageCalls = 0;
    const descriptor: InteractionDescriptor<LockState, LockEvent> = {
      type: "sideEffectFree",
      initialState: { lockedBy: {} },
      throttle: 50,
      reduce: (state) => {
        reduceCalls += 1;
        return state;
      },
      toMessage: (event): ColabMessage => {
        toMessageCalls += 1;
        return createMessage(COLAB_EVENTS.INTERACTION, "me", {
          name: "sideEffectFree",
          scopeId: asScopeId(event.scopeId),
        });
      },
    };
    defineInteraction(descriptor, registry);
    expect(reduceCalls).toBe(0);
    expect(toMessageCalls).toBe(0);
  });
});
