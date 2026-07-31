import { useContext } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ColabContext } from "./context.js";

describe("ColabContext default (TC — outside-provider detection)", () => {
  it("defaults to null so hooks can detect a missing provider", () => {
    let observed: unknown = "unset";
    function Probe(): null {
      observed = useContext(ColabContext);
      return null;
    }
    render(<Probe />);
    expect(observed).toBeNull();
  });

  it("exposes a stable displayName for devtools", () => {
    expect(ColabContext.displayName).toBe("ColabContext");
  });
});
