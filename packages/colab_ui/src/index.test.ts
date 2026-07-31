import { describe, expect, it } from "vitest";

import { COLAB_EVENTS } from "colab-protocol";

import { COLAB_UI_PACKAGE, PROTOCOL_LINK } from "./index.js";

describe("colab-ui skeleton", () => {
  it("exposes its package marker", () => {
    expect(COLAB_UI_PACKAGE).toBe("colab-ui");
  });

  it("resolves the colab-protocol workspace import (ESM)", () => {
    expect(PROTOCOL_LINK).toBe(COLAB_EVENTS.JOIN);
  });
});
