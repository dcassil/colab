import { act, render } from "@testing-library/react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { COLAB_EVENTS, COLAB_SERVER_EVENTS, asScopeId } from "colab-protocol";
import type { ColabMessage, Identity } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import type { FakeTransport } from "../__tests__/fakes.js";
import type { ColabStore } from "../contracts/store.js";
import type { Interaction } from "../contracts/interaction.js";
import { ColabProvider } from "./ColabProvider.js";
import { ColabProviderMissingError } from "./useColabContext.js";
import { useInteraction } from "./useInteraction.js";
import type { InteractionActions, UseInteractionResult } from "./useInteraction.js";

const identity: Identity = { id: "me", name: "Me", color: "#fff" };

interface LockState {
  locked: boolean;
}

/** A test interaction: folds interaction data `{ locked }` into LockState. */
function makeLock(): Interaction<LockState> {
  return {
    type: "editLock",
    reduce: (state, message): LockState => {
      const data = message.payload as { data?: { locked?: boolean } };
      const prevLocked = (state as LockState | undefined)?.locked ?? false;
      return { locked: data.data?.locked ?? prevLocked };
    },
    toMessage: (input): ColabMessage => ({
      type: COLAB_EVENTS.INTERACTION,
      from: "me",
      payload: {
        name: "editLock",
        scopeId: asScopeId("field-1"),
        data: input as Record<string, never>,
      },
    }),
  };
}

function mount(
  interactions: readonly Interaction[],
  transport: FakeTransport,
  store: ColabStore,
  descriptor: Interaction<LockState>,
): {
  result: () => UseInteractionResult<LockState>;
  renders: () => number;
  unmount: () => void;
  err: () => unknown;
} {
  let renders = 0;
  let result: UseInteractionResult<LockState> | undefined;
  let err: unknown;
  function Reader(): null {
    renders++;
    result = useInteraction(descriptor);
    return null;
  }
  function Boundary({ children }: { children: React.ReactNode }): React.ReactNode {
    return children;
  }
  const readResult = (): UseInteractionResult<LockState> => {
    if (result === undefined) throw new Error("useInteraction produced no result");
    return result;
  };
  try {
    const view = render(
      <ColabProvider
        serverUrl="https://relay.example"
        room="r"
        identity={identity}
        transport={transport}
        store={store}
        interactions={interactions}
      >
        <Boundary>
          <Reader />
        </Boundary>
      </ColabProvider>,
    );
    return {
      result: readResult,
      renders: () => renders,
      unmount: view.unmount,
      err: () => err,
    };
  } catch (e) {
    err = e;
    return {
      result: readResult,
      renders: () => renders,
      unmount: () => undefined,
      err: () => err,
    };
  }
}

describe("useInteraction typed state + send (TC-001)", () => {
  it("returns the reduced slice, updates on change, and dispatches sends", () => {
    const lock = makeLock();
    const transport = createFakeTransport();
    const view = mount([lock], transport, createFakeStore(), lock);

    // Drive a local action: it publishes toMessage(input) on the bus, the fold
    // reduces it into the slice, and the consumer re-renders with new state.
    act(() => {
      view.result().send({ locked: true });
    });
    expect(view.result().state).toEqual({ locked: true });
    // The local interaction was relayed to the transport.
    expect(transport.sent.some((m) => m.type === COLAB_EVENTS.INTERACTION)).toBe(
      true,
    );
    view.unmount();
  });

  it("infers state and send types from the descriptor", () => {
    const lock = makeLock();
    const result: UseInteractionResult<LockState> = {
      state: { locked: true },
      send: () => undefined,
      selectors: {},
    };
    const actions: InteractionActions = result;
    expectTypeOf(result.state).toEqualTypeOf<LockState | undefined>();
    expectTypeOf(useInteraction<LockState>).returns.toEqualTypeOf<
      UseInteractionResult<LockState>
    >();
    expectTypeOf(actions.send).toEqualTypeOf<(input: unknown) => void>();
    void lock;
  });
});

describe("useInteraction misuse errors (TC-002)", () => {
  it("throws the shared named provider error outside a provider", () => {
    function Bare(): null {
      useInteraction(makeLock());
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Bare />)).toThrow(ColabProviderMissingError);
    spy.mockRestore();
  });

  it("throws a named error when the interaction is not registered", () => {
    const lock = makeLock();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Provide NO interactions → registry lookup fails.
    const view = mount([], createFakeTransport(), createFakeStore(), lock);
    expect(view.err()).toBeInstanceOf(Error);
    expect((view.err() as Error).message).toContain("editLock");
    spy.mockRestore();
  });
});

describe("useInteraction selective re-render + stable send (TC-003)", () => {
  it("ignores unrelated slices and keeps send stable", () => {
    const lock = makeLock();
    const other: Interaction<LockState> = { ...lock, type: "other" };
    const transport = createFakeTransport();
    const store = createFakeStore();
    const view = mount([lock, other], transport, store, lock);
    const firstSend = view.result().send;
    const before = view.renders();

    // Update interaction B through the real mirror path: A does not re-render.
    act(() => {
      transport.emit({
        type: COLAB_SERVER_EVENTS.INTERACTION,
        from: "peer",
        payload: {
          name: "other",
          scopeId: asScopeId("field-2"),
          data: { locked: true },
        },
      });
    });
    expect(view.renders()).toBe(before);

    // A relevant change re-renders; send identity stays stable throughout.
    act(() => {
      view.result().send({ locked: true });
    });
    expect(view.result().send).toBe(firstSend);
    view.unmount();
  });
});
