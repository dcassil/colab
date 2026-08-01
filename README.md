# colab

Universal, drop-in real-time collaboration/presence for any web app.

- **colab_ui** — framework-agnostic core + React binding (live cursors, roster, advisory edit-locks). Batteries-included (Socket.IO + React state) with swappable seams.
- **colab_server** — generic, interaction-agnostic relay.

Status: early development. Vision + initiatives planned in Metis (`.metis/`).

## Versioning

`colab-protocol`, `colab-ui`, and `colab-server` ship in lockstep under the
same `0.x` version. Internal package dependencies use the exact shared version
so the client, server, and wire protocol cannot skew in a published install.
