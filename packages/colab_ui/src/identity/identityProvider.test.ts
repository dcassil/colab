import type { Identity } from "colab-protocol";
import { describe, expect, it, vi } from "vitest";

import {
  createIdentityProvider,
  InvalidIdentityError,
  resolveIdentity,
} from "./identityProvider.js";

const id: Identity = { id: "u1", name: "Alice", color: "#f0f" };

describe("resolveIdentity", () => {
  // TC-001: static token normalization.
  it("carries a static token and normalized identity", async () => {
    const creds = await resolveIdentity({ identity: id, token: "jwt-abc" });
    expect(creds).toEqual({ identity: id, token: "jwt-abc" });
  });

  // TC-002: async token-getter awaited.
  it("awaits an async token-getter", async () => {
    const creds = await resolveIdentity({
      identity: id,
      getToken: () => Promise.resolve("jwt-async"),
    });
    expect(creds.token).toBe("jwt-async");
  });

  it("supports a synchronous token-getter", async () => {
    const creds = await resolveIdentity({
      identity: id,
      getToken: () => "jwt-sync",
    });
    expect(creds.token).toBe("jwt-sync");
  });

  // Precedence: getToken wins over a static token.
  it("prefers getToken over a static token when both are supplied", async () => {
    const creds = await resolveIdentity({
      identity: id,
      token: "static",
      getToken: () => "fresh",
    });
    expect(creds.token).toBe("fresh");
  });

  // TC-003: no token (loopback).
  it("yields token-free credentials when no token is supplied", async () => {
    const creds = await resolveIdentity({ identity: id });
    expect(creds).toEqual({ identity: id });
    expect("token" in creds).toBe(false);
  });

  it("normalizes identity, dropping unexpected top-level fields", async () => {
    const creds = await resolveIdentity({
      identity: { ...id, extra: { role: "admin" } },
    });
    expect(creds.identity).toEqual({ ...id, extra: { role: "admin" } });
  });

  // TC-003: invalid identity produces a clear typed error.
  it("throws InvalidIdentityError for a malformed identity", async () => {
    await expect(
      resolveIdentity({ identity: {} as unknown as Identity }),
    ).rejects.toBeInstanceOf(InvalidIdentityError);
  });

  it("rejects a non-string id", async () => {
    await expect(
      resolveIdentity({
        identity: { id: 1, name: "x", color: "#000" } as unknown as Identity,
      }),
    ).rejects.toThrow(/id/);
  });
});

describe("createIdentityProvider", () => {
  it("re-resolves a fresh token on every resolve() call", async () => {
    let n = 0;
    const getToken = vi.fn(() => `t${String(++n)}`);
    const provider = createIdentityProvider({ identity: id, getToken });

    expect((await provider.resolve()).token).toBe("t1");
    expect((await provider.resolve()).token).toBe("t2");
    expect(getToken).toHaveBeenCalledTimes(2);
  });

  it("validates identity once at construction", () => {
    expect(() =>
      createIdentityProvider({ identity: {} as unknown as Identity }),
    ).toThrow(InvalidIdentityError);
  });
});
