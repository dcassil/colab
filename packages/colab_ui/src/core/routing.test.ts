import { describe, expect, it } from "vitest";

import { COLAB_SERVER_EVENTS, createMessage } from "colab-protocol";
import type { Participant } from "colab-protocol";

import { createRoster } from "./roster.js";
import { isRosterEvent, routeToRoster } from "./routing.js";

const p = (id: string, name = id): Participant => ({ id, name, color: "#000" });

describe("routing classifies roster vs non-roster events", () => {
  it("recognizes all four roster lifecycle events and rejects others", () => {
    expect(
      isRosterEvent(
        createMessage(COLAB_SERVER_EVENTS.ROSTER, "s", { participants: [] }),
      ),
    ).toBe(true);
    expect(
      isRosterEvent(createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_JOINED, "s", p("a"))),
    ).toBe(true);
    expect(
      isRosterEvent(createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED, "s", p("a"))),
    ).toBe(true);
    expect(
      isRosterEvent(
        createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_LEFT, "s", { id: "a" }),
      ),
    ).toBe(true);
    expect(
      isRosterEvent(createMessage(COLAB_SERVER_EVENTS.POINTER, "s", { x: 0, y: 0 })),
    ).toBe(false);
  });
});

describe("routeToRoster applies every roster event", () => {
  it("replays a full ROSTER snapshot as joins", () => {
    const roster = createRoster();
    routeToRoster(
      roster,
      createMessage(COLAB_SERVER_EVENTS.ROSTER, "s", {
        participants: [p("a"), p("b")],
      }),
    );
    expect(roster.getParticipants().map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("applies JOINED, UPDATED, and LEFT", () => {
    const roster = createRoster();
    routeToRoster(
      roster,
      createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_JOINED, "s", p("a", "A")),
    );
    routeToRoster(
      roster,
      createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED, "s", p("a", "A2")),
    );
    expect(roster.getParticipants()[0]?.name).toBe("A2");

    routeToRoster(
      roster,
      createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_LEFT, "s", { id: "a" }),
    );
    expect(roster.getParticipants()).toHaveLength(0);
  });
});
