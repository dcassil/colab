# example (reserved)

Reserved workspace slot for the example application built in initiative I7.

Dependency intent (encoded by boundaries tasks T4/T5):

- `example` → `@colab/ui` (and `@colab/protocol` transitively)
- `example` must NEVER import `@colab/server` internals.

No source or build wiring exists yet — this is an intentional skeleton.
