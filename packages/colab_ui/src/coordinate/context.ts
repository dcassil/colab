import { createContext, useContext } from "react";

import type { ColabStageContextValue } from "./types.js";

export const ColabStageContext =
  createContext<ColabStageContextValue | null>(null);

ColabStageContext.displayName = "ColabStageContext";

export function useColabStage(): ColabStageContextValue {
  const context = useContext(ColabStageContext);
  if (context === null) {
    throw new Error("useColabStage must be used within <ColabStage>.");
  }
  return context;
}
