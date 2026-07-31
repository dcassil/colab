import { useState } from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Identity } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import { ColabProvider } from "./ColabProvider.js";
import { useColab } from "./useColab.js";
import type { Session } from "../core/session.js";

const identity: Identity = { id: "me", name: "Me", color: "#fff" };

describe("useColab outside provider (TC-001)", () => {
  it("throws an error naming <ColabProvider>", () => {
    function Bare(): null {
      useColab();
      return null;
    }
    // Silence React's error boundary logging for the expected throw.
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Bare />)).toThrow(/<ColabProvider>/);
    spy.mockRestore();
  });
});

describe("useColab handle + stable identity (TC-002)", () => {
  it("returns the session and keeps a stable identity across re-renders", () => {
    const sessions: Session[] = [];
    let bump: (() => void) | undefined;
    function Consumer(): null {
      const session = useColab();
      const [, setN] = useState(0);
      bump = () => {
        setN((n) => n + 1);
      };
      sessions.push(session);
      return null;
    }
    const view = render(
      <ColabProvider
        serverUrl="https://relay.example"
        room="r"
        identity={identity}
        transport={createFakeTransport()}
        store={createFakeStore()}
      >
        <Consumer />
      </ColabProvider>,
    );

    expect(sessions[0]).toBeDefined();
    expect(typeof sessions[0]?.connect).toBe("function");
    expect(typeof sessions[0]?.disconnect).toBe("function");

    // Force an unrelated re-render: the handle identity must not change, and
    // its bound methods stay identical.
    act(() => bump?.());

    expect(sessions).toHaveLength(2);
    // Same session reference ⇒ same bound-once methods; the handle identity is
    // stable across an unrelated re-render.
    expect(sessions[1]).toBe(sessions[0]);
    view.unmount();
  });
});
