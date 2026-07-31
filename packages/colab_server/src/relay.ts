import { COLAB_EVENTS, COLAB_SERVER_EVENTS, createMessage } from "colab-protocol";
import type { Participant } from "colab-protocol";
import type { Server, Socket } from "socket.io";

import { allowAll, type VerifyIdentity } from "./auth.js";
import { readJoinRequest, type JoinRequest } from "./handshake.js";
import { RoomRosterStore, toParticipant } from "./roster.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
} from "./socket-events.js";

export interface RelayOptions {
  verify?: VerifyIdentity;
}

interface SocketData {
  joinRequest?: JoinRequest;
}

type ColabSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type ColabIo = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface JoinedSocket {
  roomId: string;
  participant: Participant;
}

export function attachColabRelay(io: ColabIo, options: RelayOptions = {}): void {
  const verify = options.verify ?? allowAll;
  const roster = new RoomRosterStore();
  const joinedSockets = new Map<string, JoinedSocket>();

  io.use(async (socket, next) => {
    const joinRequest = readJoinRequest(socket.handshake.auth);

    if (joinRequest === undefined) {
      next(new Error("Invalid colab handshake"));
      return;
    }

    if (!(await verify(joinRequest.token, joinRequest.identity))) {
      next(new Error("Unauthorized colab identity"));
      return;
    }

    socket.data.joinRequest = joinRequest;
    next();
  });

  io.on("connection", (socket) => {
    joinSocket(socket, roster, joinedSockets);
    bindRelayHandlers(socket, roster, joinedSockets);
  });
}

function joinSocket(
  socket: ColabSocket,
  roster: RoomRosterStore,
  joinedSockets: Map<string, JoinedSocket>,
): void {
  const request = socket.data.joinRequest;

  if (request === undefined) {
    socket.disconnect(true);
    return;
  }

  const participant = toParticipant(request.identity);
  socket.join(request.roomId);
  joinedSockets.set(socket.id, { roomId: request.roomId, participant });

  const participants = roster.join(request.roomId, request.identity);
  socket.emit(
    COLAB_SERVER_EVENTS.ROSTER,
    createMessage(COLAB_SERVER_EVENTS.ROSTER, "server", { participants }),
  );
  socket.to(request.roomId).emit(
    COLAB_SERVER_EVENTS.PARTICIPANT_JOINED,
    createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_JOINED, participant.id, participant),
  );
}

function bindRelayHandlers(
  socket: ColabSocket,
  roster: RoomRosterStore,
  joinedSockets: Map<string, JoinedSocket>,
): void {
  socket.on(COLAB_EVENTS.POINTER, (message) => {
    const joined = joinedSockets.get(socket.id);

    if (joined?.participant.id !== message.from) {
      return;
    }

    socket.to(joined.roomId).emit(
      COLAB_SERVER_EVENTS.POINTER,
      createMessage(COLAB_SERVER_EVENTS.POINTER, message.from, message.payload),
    );
  });

  socket.on(COLAB_EVENTS.INTERACTION, (message) => {
    const joined = joinedSockets.get(socket.id);

    if (joined?.participant.id !== message.from) {
      return;
    }

    socket.to(joined.roomId).emit(
      COLAB_SERVER_EVENTS.INTERACTION,
      createMessage(COLAB_SERVER_EVENTS.INTERACTION, message.from, message.payload),
    );
  });

  socket.on(COLAB_EVENTS.UPDATE, (message) => {
    updateParticipant(socket, roster, joinedSockets, message.payload, message.from);
  });
  socket.on(COLAB_EVENTS.LEAVE, (message) => {
    leaveSocket(socket, roster, joinedSockets, message.payload.id, message.from);
  });
  socket.on("disconnect", () => {
    leaveSocket(socket, roster, joinedSockets);
  });
}

function updateParticipant(
  socket: ColabSocket,
  roster: RoomRosterStore,
  joinedSockets: Map<string, JoinedSocket>,
  participant: Participant,
  from: string,
): void {
  const joined = joinedSockets.get(socket.id);

  if (joined?.participant.id !== from || participant.id !== from) {
    return;
  }

  joinedSockets.set(socket.id, { ...joined, participant });
  roster.update(joined.roomId, participant);
  socket.to(joined.roomId).emit(
    COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED,
    createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED, from, participant),
  );
}

function leaveSocket(
  socket: ColabSocket,
  roster: RoomRosterStore,
  joinedSockets: Map<string, JoinedSocket>,
  participantId?: string,
  from?: string,
): void {
  const joined = joinedSockets.get(socket.id);

  if (joined === undefined) {
    return;
  }

  const leavingId = participantId ?? joined.participant.id;

  if (leavingId !== joined.participant.id || (from !== undefined && from !== leavingId)) {
    return;
  }

  joinedSockets.delete(socket.id);

  if (roster.leave(joined.roomId, leavingId)) {
    socket.to(joined.roomId).emit(
      COLAB_SERVER_EVENTS.PARTICIPANT_LEFT,
      createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_LEFT, leavingId, { id: leavingId }),
    );
  }
}
