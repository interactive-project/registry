# Interactive Project Registry

Independent engine and host renderer registrations with immutable serializable manifests and captured live ports.

- [Registration and resolution contract](docs/registration-v1.md)
- [Manifest schema](schemas/plugin-manifest.v1.schema.json)

The pure registry has no UI/framework dependency and accepts trusted manifest validators. The optional Node validation entry resolves Protocol generation schemas offline. Lookup never calls factories. Run npm ci --ignore-scripts and npm test.

Exact-version registration is implemented; negotiation/lazy loading belong to #2 and generation export to #3. No engine/framework/npm release is claimed.
