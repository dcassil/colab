import { COLAB_EVENTS, COLAB_SERVER_EVENTS, createMessage } from "colab-protocol";
import type { Participant } from "colab-protocol";
import type { Server, Socket } from "socket.io";

import { allowAll, type VerifyIdentity } from "./auth.js";
import { readJoinRequest } from "./handshake.js";
import { RoomRosterStore, toParticipant } from "./roster.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./socket-events.js";

export interface RelayOptions {
  verify?: VerifyIdentity;
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

interface RelayContext {
  joinedSockets: Map<string, JoinedSocket>;
  roster: RoomRosterStore;
}

export function attachColabRelay(io: ColabIo, options: RelayOptions = {}): void {
  const verify = options.verify ?? allowAll;
  const context: RelayContext = {
    joinedSockets: new Map<string, JoinedSocket>(),
    roster: new RoomRosterStore(),
  };

  io.use((socket, next) => {
    authenticateSocket(socket, verify)
      .then(() => {
        next();
      })
      .catch((error: unknown) => {
        next(error instanceof Error ? error : new Error("Colab auth failed"));
      });
  });

  io.on("connection", (socket) => {
    joinSocket(socket, context);
    bindRelayHandlers(socket, context);
  });
}

async function authenticateSocket(
  socket: ColabSocket,
  verify: VerifyIdentity,
): Promise<void> {
  const joinRequest = readJoinRequest(socket.handshake.auth);

  if (joinRequest === undefined) {
    throw new Error("Invalid colab handshake");
  }

  if (!(await verify(joinRequest.token, joinRequest.identity))) {
    throw new Error("Unauthorized colab identity");
  }

  socket.data.joinRequest = joinRequest;
}

function joinSocket(socket: ColabSocket, context: RelayContext): void {
  const request = socket.data.joinRequest;

  if (request === undefined) {
    socket.disconnect(true);
    return;
  }

  const participant = toParticipant(request.identity);
  void socket.join(request.roomId);
  context.joinedSockets.set(socket.id, { roomId: request.roomId, participant });

  const participants = context.roster.join(request.roomId, request.identity);
  socket.emit(
    COLAB_SERVER_EVENTS.ROSTER,
    createMessage(COLAB_SERVER_EVENTS.ROSTER, "server", { participants }),
  );
  socket.to(request.roomId).emit(
    COLAB_SERVER_EVENTS.PARTICIPANT_JOINED,
    createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_JOINED, participant.id, participant),
  );
}

function bindRelayHandlers(socket: ColabSocket, context: RelayContext): void {
  socket.on(COLAB_EVENTS.POINTER, (message) => {
    const joined = context.joinedSockets.get(socket.id);

    if (joined?.participant.id !== message.from) {
      return;
    }

    socket.to(joined.roomId).emit(
      COLAB_SERVER_EVENTS.POINTER,
      createMessage(COLAB_SERVER_EVENTS.POINTER, message.from, message.payload),
    );
  });

  socket.on(COLAB_EVENTS.INTERACTION, (message) => {
    const joined = context.joinedSockets.get(socket.id);

    if (joined?.participant.id !== message.from) {
      return;
    }

    socket.to(joined.roomId).emit(
      COLAB_SERVER_EVENTS.INTERACTION,
      createMessage(COLAB_SERVER_EVENTS.INTERACTION, message.from, message.payload),
    );
  });

  socket.on(COLAB_EVENTS.UPDATE, (message) => {
    updateParticipant(socket, context, message.payload, message.from);
  });
  socket.on(COLAB_EVENTS.LEAVE, (message) => {
    leaveSocket(socket, context, message.payload.id, message.from);
  });
  socket.on("disconnect", () => {
    leaveSocket(socket, context);
  });
}

function updateParticipant(
  socket: ColabSocket,
  context: RelayContext,
  participant: Participant,
  from: string,
): void {
  const joined = context.joinedSockets.get(socket.id);

  if (joined?.participant.id !== from || participant.id !== from) {
    return;
  }

  context.joinedSockets.set(socket.id, { ...joined, participant });
  context.roster.update(joined.roomId, participant);
  socket.to(joined.roomId).emit(
    COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED,
    createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED, from, participant),
  );
}

function leaveSocket(
  socket: ColabSocket,
  context: RelayContext,
  participantId?: string,
  from?: string,
): void {
  const joined = context.joinedSockets.get(socket.id);

  if (joined === undefined) {
    return;
  }

  const leavingId = participantId ?? joined.participant.id;

  if (leavingId !== joined.participant.id || (from !== undefined && from !== leavingId)) {
    return;
  }

  context.joinedSockets.delete(socket.id);

  if (context.roster.leave(joined.roomId, leavingId)) {
    socket.to(joined.roomId).emit(
      COLAB_SERVER_EVENTS.PARTICIPANT_LEFT,
      createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_LEFT, leavingId, { id: leavingId }),
    );
  }
}
