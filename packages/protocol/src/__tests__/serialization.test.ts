import { describe, expect, expectTypeOf, it } from "vitest";

import { COLAB_EVENTS } from "../events.js";
import type { ColabMessage, ColabMessageType } from "../envelope.js";
import type { Identity, Participant } from "../identity.js";
import type { PointerPosition } from "../pointer.js";
import { asScopeId, isScopeId } from "../scope.js";
import type { ScopeId } from "../scope.js";
import {
  allMessages,
  identity,
  participant,
  pointerWithScope,
  pointerWithoutScope,
} from "./fixtures.js";

/**
 * `CloneSafe<T>` — resolves to `T` when every leaf is structured-clone-safe,
 * and to `never` when it encounters a function, `Map`, or `Set`. Used purely
 * at compile time to prove wire shapes carry no un-clonable members.
 */
type CloneSafe<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends (...args: never[]) => unknown
    ? never
    : T extends Map<unknown, unknown> | Set<unknown>
      ? never
      : T extends readonly (infer E)[]
        ? readonly CloneSafe<E>[]
        : T extends object
          ? { [K in keyof T]: CloneSafe<T[K]> }
          : T;

// `structuredClone` is a runtime global not present in the ES2022 lib types;
// bind it locally with an explicit, `any`-free signature.
const clone = (globalThis as unknown as {
  structuredClone: <T>(value: T) => T;
}).structuredClone;

describe("every wire shape survives structuredClone (TC-001)", () => {
  const shapes: Record<string, unknown> = {
    identity,
    participant,
    pointerWithScope,
    pointerWithoutScope,
    ...Object.fromEntries(allMessages.map((m, i) => [`msg-${String(i)}-${m.type}`, m])),
  };

  for (const [name, value] of Object.entries(shapes)) {
    it(`round-trips ${name} with deep equality and a fresh reference`, () => {
      const copy = clone(value);
      expect(copy).toStrictEqual(value);
      if (typeof value === "object" && value !== null) {
        expect(copy).not.toBe(value);
      }
    });
  }

  it("covers all 11 fixture messages", () => {
    expect(allMessages).toHaveLength(11);
  });
});

describe("CloneSafe rejects un-clonable shapes (AC)", () => {
  it("keeps clone-safe wire types intact and collapses un-clonable ones", () => {
    // Clone-safe wire types survive: no member collapses to `never`, and the
    // primitive-preserving branch keeps `x`/`y` as `number`.
    expectTypeOf<CloneSafe<PointerPosition>>().not.toBeNever();
    expectTypeOf<CloneSafe<PointerPosition>["x"]>().toEqualTypeOf<number>();
    expectTypeOf<CloneSafe<Identity>>().not.toBeNever();
    expectTypeOf<CloneSafe<Identity>["id"]>().toEqualTypeOf<string>();

    // Un-clonable members collapse to `never`.
    expectTypeOf<CloneSafe<{ fn: () => void }>["fn"]>().toBeNever();
    expectTypeOf<CloneSafe<{ m: Map<string, number> }>["m"]>().toBeNever();
    expectTypeOf<CloneSafe<{ s: Set<number> }>["s"]>().toBeNever();
  });
});

describe("MessageMap inference and exhaustiveness (TC-002)", () => {
  it("narrows payloads to the exact type per event", () => {
    expectTypeOf<
      ColabMessage<typeof COLAB_EVENTS.POINTER>["payload"]
    >().toEqualTypeOf<PointerPosition>();
    expectTypeOf<
      ColabMessage<typeof COLAB_EVENTS.JOIN>["payload"]
    >().toEqualTypeOf<Identity>();
    expectTypeOf<
      ColabMessage<typeof COLAB_EVENTS.UPDATE>["payload"]
    >().toEqualTypeOf<Participant>();
  });

  it("enforces exhaustiveness via a never-guarded switch", () => {
    const assertNever = (x: never): never => {
      throw new Error(`unhandled: ${String(x)}`);
    };
    const handle = (type: ColabMessageType): string => {
      switch (type) {
        case "pointer":
        case "interaction":
        case "join":
        case "update":
        case "leave":
        case "roster":
        case "participant_joined":
        case "participant_updated":
        case "participant_left":
        case "server_pointer":
        case "server_interaction":
          return type;
        default:
          // Compiles ONLY because every case above is handled; removing one
          // makes `type` a non-`never` here and this line fails to compile.
          return assertNever(type);
      }
    };
    expect(handle("pointer")).toBe("pointer");
  });
});

describe("ScopeId helpers at runtime and type level (AC)", () => {
  it("validates at runtime", () => {
    expect(asScopeId("x")).toBe("x");
    expect(() => asScopeId("")).toThrow();
    expect(isScopeId("x")).toBe(true);
    expect(isScopeId(1)).toBe(false);
  });

  it("ScopeId is not assignable from a bare string without the helper", () => {
    expectTypeOf<string>().not.toExtend<ScopeId>();
    expectTypeOf(asScopeId("x")).toEqualTypeOf<ScopeId>();
  });
});
