import { describe, expect, it } from "vitest";

import { COLAB_EVENTS } from "colab-protocol";

import { COLAB_SERVER_PACKAGE, PROTOCOL_LINK } from "./index.js";

describe("colab-server skeleton", () => {
  it("exposes its package marker", () => {
    expect(COLAB_SERVER_PACKAGE).toBe("colab-server");
  });

  it("resolves the colab-protocol workspace import (ESM)", () => {
    expect(PROTOCOL_LINK).toBe(COLAB_EVENTS.JOIN);
  });
});
