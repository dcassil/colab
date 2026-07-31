import { COLAB_SERVER_EVENTS } from "colab-protocol";
import type { ColabMessage, Participant } from "colab-protocol";

import type { Roster } from "./roster.js";

/**
 * The set of server lifecycle event names that mutate the {@link Roster}.
 * Any inbound message whose `type` is in this set is routed to the roster; all
 * other messages are published to the bus. The two destinations are mutually
 * exclusive and together exhaustive.
 */
const ROSTER_EVENTS: ReadonlySet<string> = new Set<string>([
  COLAB_SERVER_EVENTS.ROSTER,
  COLAB_SERVER_EVENTS.PARTICIPANT_JOINED,
  COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED,
  COLAB_SERVER_EVENTS.PARTICIPANT_LEFT,
]);

/** True when `message` is a roster-lifecycle event (→ roster, not bus). */
export function isRosterEvent(message: ColabMessage): boolean {
  return ROSTER_EVENTS.has(message.type);
}

/**
 * Apply a roster-lifecycle `message` to `roster`. Assumes
 * {@link isRosterEvent} returned true for it. Each branch narrows the payload
 * via the message `type` discriminant.
 */
export function routeToRoster(roster: Roster, message: ColabMessage): void {
  switch (message.type) {
    case COLAB_SERVER_EVENTS.ROSTER: {
      for (const participant of message.payload.participants) {
        roster.applyJoin(participant);
      }
      return;
    }
    case COLAB_SERVER_EVENTS.PARTICIPANT_JOINED: {
      roster.applyJoin(message.payload satisfies Participant);
      return;
    }
    case COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED: {
      roster.applyUpdate(message.payload satisfies Participant);
      return;
    }
    case COLAB_SERVER_EVENTS.PARTICIPANT_LEFT: {
      roster.applyLeave(message.payload.id);
      return;
    }
    default:
      // Not a roster event; caller must not route it here.
      return;
  }
}
