import { describe, expect, it } from "vitest";

import type { Identity, Participant } from "colab-protocol";

import { RoomRosterStore, toParticipant } from "./roster.js";

const ada: Identity = { id: "ada", name: "Ada", color: "#111111" };
const grace: Identity = {
  id: "grace",
  name: "Grace",
  color: "#222222",
  extra: { role: "reviewer" },
};

describe("RoomRosterStore", () => {
  it("maintains independent room rosters", () => {
    const store = new RoomRosterStore();

    expect(store.join("room-a", ada)).toEqual([toParticipant(ada)]);
    expect(store.join("room-b", grace)).toEqual([toParticipant(grace)]);
    expect(store.list("room-a")).toEqual([toParticipant(ada)]);
  });

  it("updates and removes participants", () => {
    const store = new RoomRosterStore();
    const updated: Participant = { ...toParticipant(ada), color: "#333333" };

    store.join("room-a", ada);
    expect(store.update("room-a", updated)).toEqual([updated]);
    expect(store.leave("room-a", ada.id)).toBe(true);
    expect(store.list("room-a")).toEqual([]);
  });
});
