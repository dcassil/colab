import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Identity } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";

import { ColabProvider } from "./ColabProvider.js";
import { ColabProviderMissingError } from "./useColabContext.js";
import { useIdentity } from "./useIdentity.js";

const me: Identity = { id: "me", name: "Me", color: "#0af" };

function wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <ColabProvider
      serverUrl="https://relay.example"
      room="r"
      identity={me}
      transport={createFakeTransport()}
      store={createFakeStore()}
    >
      {children}
    </ColabProvider>
  );
}

describe("useIdentity", () => {
  it("returns the local identity from the provider", () => {
    const { result } = renderHook(() => useIdentity(), { wrapper });
    expect(result.current).toEqual(me);
  });

  it("throws the shared missing-provider error outside a provider", () => {
    expect(() => renderHook(() => useIdentity())).toThrow(
      ColabProviderMissingError,
    );
  });
});
