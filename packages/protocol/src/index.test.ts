import { describe, expect, it } from "vitest";

import {
  COLAB_EVENTS,
  COLAB_SERVER_EVENTS,
  CURSOR_GONE_ACTION,
  asScopeId,
  composeScopeId,
  createMessage,
  isScopeId,
} from "./index.js";
import type {
  ColabMessage,
  Identity,
  Participant,
  PointerPosition,
  ScopeId,
} from "./index.js";

describe("ScopeId brand helpers (TC-001)", () => {
  it("asScopeId returns the raw value for a non-empty string", () => {
    const id: ScopeId = asScopeId("block-1");
    expect(id).toBe("block-1");
  });

  it("asScopeId throws on the empty string", () => {
    expect(() => asScopeId("")).toThrow(TypeError);
  });

  it("isScopeId narrows correctly", () => {
    expect(isScopeId("x")).toBe(true);
    expect(isScopeId(5)).toBe(false);
    expect(isScopeId("")).toBe(false);
  });

  it("composeScopeId creates a non-colliding opaque id from multiple parts", () => {
    const id: ScopeId = composeScopeId("target", "content");
    expect(id).toBe("6:target|7:content");
    expect(composeScopeId("a", "bc")).not.toBe(composeScopeId("ab", "c"));
  });

  it("composeScopeId requires at least one part", () => {
    expect(() => composeScopeId()).toThrow(TypeError);
  });
});

describe("Envelope + event constant typing (TC-002)", () => {
  it("builds a pointer message with a PointerPosition payload", () => {
    const payload: PointerPosition = { x: 0.5, y: 0.25, scopeId: asScopeId("s") };
    const msg: ColabMessage<typeof COLAB_EVENTS.POINTER> = createMessage(
      COLAB_EVENTS.POINTER,
      "user-1",
      payload,
    );
    expect(msg.type).toBe("pointer");
    expect(msg.from).toBe("user-1");
    expect(msg.payload.x).toBe(0.5);
  });

  it("exposes literal-typed client and server event constants", () => {
    expect(COLAB_EVENTS.JOIN).toBe("join");
    expect(COLAB_EVENTS.LEAVE).toBe("leave");
    expect(COLAB_SERVER_EVENTS.ROSTER).toBe("roster");
    expect(COLAB_SERVER_EVENTS.PARTICIPANT_LEFT).toBe("participant_left");
  });

  it("keeps `from` a bare id string on a join message", () => {
    const identity: Identity = { id: "user-2", name: "Ada", color: "#f0f" };
    const msg = createMessage(COLAB_EVENTS.JOIN, identity.id, identity);
    expect(typeof msg.from).toBe("string");
    expect(msg.payload.name).toBe("Ada");
  });

  it("types a roster server message with Participant entries", () => {
    const p: Participant = { id: "user-3", name: "Grace", color: "#0ff" };
    const msg = createMessage(COLAB_SERVER_EVENTS.ROSTER, "server", {
      participants: [p],
    });
    expect(msg.payload.participants).toHaveLength(1);
  });

  it("exports the cursor-gone wire action literal", () => {
    expect(CURSOR_GONE_ACTION).toBe("gone");
  });
});
