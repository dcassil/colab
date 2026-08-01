# colab

Universal, drop-in real-time collaboration/presence for any web app.

`colab` is a small monorepo for adding shared presence, interaction state, and
real-time collaboration primitives to web applications without coupling the core
protocol to a specific framework or host surface.

## Packages

- [`colab-ui`](./packages/colab_ui/README.md) - framework-free collaboration
  core plus the React binding at `colab-ui/react`.
- [`colab-server`](./packages/colab_server/README.md) - Socket.IO relay server
  for collaboration sessions.
- [`colab-protocol`](./packages/protocol/README.md) - shared, framework-free
  wire protocol used by the client and server packages.
- [`example`](./example/) - example app workspace.

Status: early development. Vision and initiatives are planned in Metis
(`.metis/`).

## Versioning

`colab-protocol`, `colab-ui`, and `colab-server` ship in lockstep under the
same `0.x` version. Internal package dependencies use the exact shared version
in the publishable manifests, and pnpm links those matching workspace packages
locally via `link-workspace-packages=true`. Keep the three package versions
aligned so the client, server, and wire protocol cannot skew in a published
install.
