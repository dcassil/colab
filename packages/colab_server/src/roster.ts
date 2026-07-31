import type { Identity, Participant } from "colab-protocol";

export class RoomRosterStore {
  private readonly rooms = new Map<string, Map<string, Participant>>();

  join(roomId: string, identity: Identity): Participant[] {
    const room = this.getOrCreateRoom(roomId);
    room.set(identity.id, toParticipant(identity));
    return this.list(roomId);
  }

  update(roomId: string, participant: Participant): Participant[] {
    const room = this.getOrCreateRoom(roomId);
    room.set(participant.id, participant);
    return this.list(roomId);
  }

  leave(roomId: string, participantId: string): boolean {
    const room = this.rooms.get(roomId);

    if (room === undefined) {
      return false;
    }

    const removed = room.delete(participantId);

    if (room.size === 0) {
      this.rooms.delete(roomId);
    }

    return removed;
  }

  list(roomId: string): Participant[] {
    return Array.from(this.rooms.get(roomId)?.values() ?? []);
  }

  private getOrCreateRoom(roomId: string): Map<string, Participant> {
    const existing = this.rooms.get(roomId);

    if (existing !== undefined) {
      return existing;
    }

    const room = new Map<string, Participant>();
    this.rooms.set(roomId, room);
    return room;
  }
}

export function toParticipant(identity: Identity): Participant {
  return identity.extra === undefined
    ? { id: identity.id, name: identity.name, color: identity.color }
    : {
        id: identity.id,
        name: identity.name,
        color: identity.color,
        extra: identity.extra,
      };
}
