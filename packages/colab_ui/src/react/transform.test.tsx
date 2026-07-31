import { useContext } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Identity } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import type { Point, Transform } from "../coordinate/index.js";
import { ColabProvider } from "./ColabProvider.js";
import { ColabContext } from "./context.js";

const identity: Identity = { id: "me", name: "Me", color: "#fff" };

function readProviderTransform(point: Point, transform?: Transform): Point | null {
  let transformed: Point | null = null;

  function Probe(): null {
    const context = useContext(ColabContext);
    transformed = context?.transform(point) ?? null;
    return null;
  }

  const view = render(
    <ColabProvider
      serverUrl="https://relay.example"
      room="r"
      identity={identity}
      transport={createFakeTransport()}
      store={createFakeStore()}
      {...(transform === undefined ? {} : { transform })}
    >
      <Probe />
    </ColabProvider>,
  );
  view.unmount();
  return transformed;
}

describe("ColabProvider transform seam", () => {
  it("defaults to identity", () => {
    expect(readProviderTransform({ x: 0.4, y: 0.6 })).toEqual({
      x: 0.4,
      y: 0.6,
    });
  });

  it("threads a supplied transform without mutating canonical points", () => {
    const input: Point = { x: 0.4, y: 0.6 };
    const half: Transform = (point) => ({
      x: point.x * 0.5,
      y: point.y * 0.5,
    });

    expect(readProviderTransform(input, half)).toEqual({ x: 0.2, y: 0.3 });
    expect(input).toEqual({ x: 0.4, y: 0.6 });
  });
});
