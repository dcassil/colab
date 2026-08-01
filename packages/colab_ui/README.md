# colab-ui

Framework-free collaboration core plus the React binding for colab.

## Install

```sh
pnpm add colab-ui colab-protocol react react-dom
```

Add `socket.io-client` when using the default Socket.IO transport:

```sh
pnpm add socket.io-client
```

## Usage

```tsx
import { COLAB_EVENTS, asScopeId, createMessage } from "colab-protocol";
import { defineInteraction } from "colab-ui";
import { ColabProvider, useInteraction, usePresence } from "colab-ui/react";

type SelectionState = { selectedId: string | null };

const scopeId = asScopeId("document-1");

const selection = defineInteraction({
  type: "selection",
  initialState: { selectedId: null },
  reduce: (state: SelectionState, message) => {
    if (
      message.type !== COLAB_EVENTS.INTERACTION ||
      message.payload.name !== "selection"
    ) {
      return state;
    }

    return typeof message.payload.data === "string"
      ? { selectedId: message.payload.data }
      : state;
  },
  toMessage: (selectedId: string) =>
    createMessage(COLAB_EVENTS.INTERACTION, "local", {
      name: "selection",
      scopeId,
      data: selectedId,
    }),
  selectors: {
    selectedId: (state: SelectionState) => state.selectedId,
  },
});

function SelectionButton({ id }: { id: string }) {
  const participants = usePresence();
  const interaction = useInteraction(selection);

  return (
    <button type="button" onClick={() => interaction.send(id)}>
      {interaction.selectors.selectedId === id ? "Selected" : "Select"}
      {" - "}
      {participants.length} remote users
    </button>
  );
}

export function App() {
  return (
    <ColabProvider
      serverUrl="http://localhost:3001"
      room="document-1"
      identity={{ id: "u1", name: "Ada", color: "#2563eb" }}
      interactions={[selection]}
    >
      <SelectionButton id="block-a" />
    </ColabProvider>
  );
}
```

The `colab-ui` root entry is framework-free. The React binding is available at
`colab-ui/react`; `react` and `react-dom` are peer dependencies for that subpath.
`socket.io-client` is an optional peer used only by the default transport and is
loaded lazily, so custom transports can avoid it.

Repository: https://github.com/dcassil/colab
