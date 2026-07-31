# Interaction Lifecycle Contract (I5 factory ↔ I4 `useInteraction`)

`defineInteraction` produces an `InteractionDescriptor` of PURE functions and
registers it. It does NOT drive the interaction. Driving — instantiation,
inbound routing, outbound throttling, and selector surfacing — is the
responsibility of I4's `useInteraction`. This document is the executable
specification I4 must satisfy; the conformance tests in
`conformance.test.ts` assert it against a minimal harness that ANY correct
`useInteraction` implementation would also pass.

The descriptor shape:

```ts
interface InteractionDescriptor<State, LocalEvent> {
  type: string;
  initialState: State;
  reduce(state: State, message: ColabMessage): State; // pure, returns NEW state
  toMessage(localEvent: LocalEvent): ColabMessage;     // pure
  throttle?: number;                                   // ms; trailing-edge
  selectors?: Record<string, (state: State) => unknown>; // may return a function
}
```

`ColabMessage` is imported from I2's public surface (`colab-protocol`) and never
redefined. An interaction's `type` corresponds to the interaction KIND, matched
against an inbound message's `payload.name` (I2's `InteractionPayload.name`).

## The four responsibilities `useInteraction` MUST honor

1. **Fresh state per instance.** On activation, instantiate the interaction's
   state seeded from `descriptor.initialState`. Each active interaction instance
   gets its own copy; instances never share mutable state. The seed itself must
   not be mutated in place — `reduce` returns new state.

2. **Route inbound by `type`, never throttle inbound.** For every inbound
   `ColabMessage` whose interaction kind matches `descriptor.type`, apply
   `descriptor.reduce(currentState, message)` and adopt the returned state.
   Messages that do NOT match are NOT routed to `reduce`. Inbound folding is
   applied to every matching message — inbound is never throttled or coalesced.

3. **Coalesce outbound trailing-edge, ≤ 1 per `throttle` ms.** For each local
   event the consumer sends, compute `descriptor.toMessage(localEvent)` and
   publish it. When `descriptor.throttle` is set to `N` ms, publishes are
   coalesced on the TRAILING edge: at most one publish per `N` ms window, and
   the last event within a window wins. When `throttle` is unset, every send
   publishes immediately (no coalescing).

4. **Surface selectors.** Expose the output of `descriptor.selectors` to
   consumers, computed against the current state. Parameterized selectors —
   selectors that return a function, e.g.
   `isLocked: (state) => (scopeId) => boolean` — are supported: the returned
   function is surfaced as-is so consumers can invoke it with a parameter.

## What the factory does NOT do

The factory performs no side effects beyond registration. It does not subscribe
to a bus, publish, throttle, instantiate state, or touch the DOM/transport.
Attempting to fold lifecycle into the factory is a contract violation; that
logic belongs to I4 and is validated by the conformance suite.
