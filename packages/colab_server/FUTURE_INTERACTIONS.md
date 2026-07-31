# Future Server-Side Interaction Seam

`colab-server` v1 is intentionally a dumb relay. It authenticates the socket,
tracks room presence, and forwards protocol envelopes to peers. Pointer and
interaction payloads are opaque to the server and remain advisory.

An authoritative interaction layer can plug in at the relay boundary later:

- `src/relay.ts` receives `COLAB_EVENTS.INTERACTION` after auth and room join.
- Before broadcasting, a future interaction engine could validate the message
  against server-owned state for the target scope.
- Accepted interactions would emit `COLAB_SERVER_EVENTS.INTERACTION` as they do
  today; rejected interactions could be dropped or answered with a future
  protocol-level rejection event.

That future engine should live behind a package-local interface and consume only
`colab-protocol` types. It must not import `colab-ui`, know about host DOM
geometry, or interpret app-specific interaction names unless the embedding app
registers that policy explicitly.
