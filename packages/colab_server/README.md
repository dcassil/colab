# colab-server

Socket.IO relay server for colab collaboration sessions.

## Install

```sh
pnpm add colab-server
```

## Usage

```ts
import { createColabServer } from "colab-server";

const server = createColabServer({
  cors: { origin: "http://localhost:5173" },
  port: 3001,
});

const port = await server.listen();
console.log(`colab-server listening on ${port}`);

process.on("SIGTERM", () => {
  void server.close();
});
```

`colab-server` depends on `socket.io` at runtime and on `colab-protocol` for the
shared wire contract. Pair it with `colab-ui` on the client; the client package
keeps `socket.io-client` optional and lazily loaded.

Repository: https://github.com/dcassil/colab
