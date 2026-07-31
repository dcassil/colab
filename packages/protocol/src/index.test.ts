import { describe, expect, it } from "vitest";

import { PROTOCOL_PACKAGE } from "./index.js";

describe("@colab/protocol skeleton", () => {
  it("exposes its package marker", () => {
    expect(PROTOCOL_PACKAGE).toBe("@colab/protocol");
  });
});
