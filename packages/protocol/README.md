# colab-protocol

Shared wire protocol and neutral collaboration types for colab.

## Install

```sh
pnpm add colab-protocol
```

## Usage

```ts
import { COLAB_EVENTS, asScopeId, createMessage } from "colab-protocol";

const message = createMessage(COLAB_EVENTS.INTERACTION, "u1", {
  name: "selection",
  scopeId: asScopeId("document-1"),
  data: "block-a",
});
```

This package is the shared, framework-free wire contract used by `colab-ui` and
`colab-server`.

Repository: https://github.com/dcassil/colab
