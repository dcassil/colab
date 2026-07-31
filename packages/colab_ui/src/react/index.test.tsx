import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Identity } from "colab-protocol";

import * as reactEntry from "./index.js";
import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import {
  AvatarStack,
  ColabStage,
  ColabStageContext,
  ColabProvider,
  identity as identityTransform,
  useColab,
  useColabStage,
  useInteraction,
  usePresence,
} from "./index.js";
import type {
  AvatarStackProps,
  ColabProviderProps,
  ColabStore,
  ColabTransport,
  Interaction,
  Participant,
  Point,
  Session,
  StageBox,
  Transform,
} from "./index.js";

describe("React entry public surface (TC-001)", () => {
  it("exports exactly the intended runtime symbols and no internals", () => {
    const keys = Object.keys(reactEntry).sort();
    expect(keys).toEqual(
      [
        "AvatarStack",
        "ColabStage",
        "ColabStageContext",
        "ColabProvider",
        "ColabProviderMissingError",
        "identity",
        "useColab",
        "useColabStage",
        "useInteraction",
        "usePresence",
      ].sort(),
    );
    // Internal modules must NOT leak through the public entry.
    for (const internal of [
      "ColabContext",
      "useColabStore",
      "useColabContextValue",
      "resolveSessionConfig",
      "startSession",
      "ROSTER_KEY",
    ]) {
      expect(keys).not.toContain(internal);
    }
  });
});

describe("React entry happy path (TC-002)", () => {
  it("supports the one-line happy path importing only from the entry", () => {
    // Type-level assertions: the public types compose the documented surface.
    const identity: Identity = { id: "me", name: "Me", color: "#fff" };
    const props: ColabProviderProps = {
      serverUrl: "https://relay.example",
      room: "r",
      identity,
      transport: createFakeTransport() satisfies ColabTransport,
      store: createFakeStore() satisfies ColabStore,
    };
    const stackProps: AvatarStackProps = { max: 3 };

    function Roster(): null {
      const session: Session = useColab();
      const remotes: readonly Participant[] = usePresence();
      void session;
      void remotes;
      return null;
    }
    const lock: Interaction<{ locked: boolean }> = {
      type: "editLock",
      reduce: (s) => s,
      toMessage: () => ({
        type: "interaction",
        from: "me",
        payload: { name: "editLock", scopeId: "s" as never },
      }),
    };
    function Lock(): null {
      const { state, send } = useInteraction(lock);
      void state;
      void send;
      return null;
    }

    const view = render(
      <ColabProvider {...props} interactions={[lock]}>
        <Roster />
        <Lock />
      </ColabProvider>,
    );
    view.unmount();
    const point: Point = { x: 0.5, y: 0.25 };
    const box: StageBox = { left: 0, top: 0, width: 100, height: 50 };
    const transform: Transform = identityTransform;
    void ColabStage;
    void ColabStageContext;
    void AvatarStack;
    void useColabStage;
    void box;
    void stackProps;
    expect(transform(point)).toBe(point);
    expect(true).toBe(true);
  });
});
