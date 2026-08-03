import { COLAB_EVENTS, COLAB_SERVER_EVENTS, createMessage } from "colab-protocol";
import type { InteractionPayload, Participant } from "colab-protocol";
import type { Server, Socket } from "socket.io";

import { allowAll, type VerifyIdentity } from "./auth.js";
import { readJoinRequest } from "./handshake.js";
import {
  RoomInteractionStore,
  toClearPayload,
  toLockPayload,
} from "./interaction-state.js";
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
  interactions: RoomInteractionStore;
}

export function attachColabRelay(io: ColabIo, options: RelayOptions = {}): void {
  const verify = options.verify ?? allowAll;
  const context: RelayContext = {
    joinedSockets: new Map<string, JoinedSocket>(),
    roster: new RoomRosterStore(),
    interactions: new RoomInteractionStore(),
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

  // STATE SNAPSHOT: replay the room's current state-bearing interactions
  // (active locks) to the NEWLY-JOINED socket only. Each active lock is
  // re-expressed as a normal `server_interaction` carrying the SAME neutral
  // payload the holder originally sent (name/scopeId + action:"lock"), keyed by
  // the holder's id in `from`. The client's existing interaction fold folds it
  // verbatim, so the joiner immediately reflects existing locks — no new
  // protocol surface needed.
  for (const active of context.interactions.list(request.roomId)) {
    socket.emit(
      COLAB_SERVER_EVENTS.INTERACTION,
      createMessage(
        COLAB_SERVER_EVENTS.INTERACTION,
        active.holder,
        toLockPayload(active),
      ),
    );
  }

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

    // Update authoritative per-room interaction state so late joiners can be
    // caught up on join (no-op for non-state-bearing interactions).
    if (!context.interactions.accepts(joined.roomId, message.from, message.payload)) {
      return;
    }
    context.interactions.apply(joined.roomId, message.from, message.payload);

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

  // RECONCILE: drop every lock held by the departing participant and broadcast
  // a matching `clear` for each, so stale locks from a gone participant never
  // linger for the remaining peers (server-driven equivalent of the client's
  // `reconcileEditLocks`).
  for (const dropped of context.interactions.dropParticipant(joined.roomId, leavingId)) {
    const clearPayload: InteractionPayload = toClearPayload(dropped);
    socket.to(joined.roomId).emit(
      COLAB_SERVER_EVENTS.INTERACTION,
      createMessage(COLAB_SERVER_EVENTS.INTERACTION, leavingId, clearPayload),
    );
  }

  if (context.roster.leave(joined.roomId, leavingId)) {
    socket.to(joined.roomId).emit(
      COLAB_SERVER_EVENTS.PARTICIPANT_LEFT,
      createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_LEFT, leavingId, { id: leavingId }),
    );
  }
}
