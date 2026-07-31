import {
  ColabProvider,
  useColab,
  useInteraction,
  usePresence,
} from "../index.js";
import type { Identity, Interaction } from "../index.js";

const url = "https://relay.example";
const me: Identity = { id: "me", name: "Me", color: "#4f46e5" };

interface SelectionState {
  selectedId: string | null;
}

const selectionInteraction: Interaction<SelectionState> = {
  type: "selection",
  reduce: (state, message) => {
    const payload = message.payload as { data?: { selectedId?: string | null } };
    return { selectedId: payload.data?.selectedId ?? state.selectedId };
  },
  toMessage: (input) => ({
    type: "interaction",
    from: me.id,
    payload: {
      name: "selection",
      scopeId: "board-42" as never,
      data: input as { selectedId: string | null },
    },
  }),
};

export function UsageSample(): React.ReactElement {
  return (
    <ColabProvider serverUrl={url} room="board-42" identity={me}>
      <BoardSelection />
    </ColabProvider>
  );
}

function BoardSelection(): React.ReactElement {
  const participants = usePresence();
  const session = useColab();
  const selection = useInteraction(selectionInteraction);
  const firstParticipant = session.roster.getParticipants()[0];

  return (
    <button
      type="button"
      onClick={() => {
        selection.send({ selectedId: firstParticipant?.id ?? null });
      }}
    >
      {participants.length}:{selection.state?.selectedId ?? "none"}
    </button>
  );
}
