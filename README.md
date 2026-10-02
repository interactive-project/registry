# Interactive Project Registry

Independent engine and host renderer registrations with immutable serializable manifests and captured live ports.

- [Registration and resolution contract](docs/registration-v1.md)
- [Version negotiation and lazy loading](docs/resolution-v1.md)
- [Manifest schema](schemas/plugin-manifest.v1.schema.json)

The pure registry has no UI/framework dependency and accepts trusted manifest validators. The optional Node validation entry resolves Protocol generation schemas offline. Lookup never calls factories. Run npm ci --ignore-scripts and npm test.

Exact/range capability-aware lookup and bounded shared lazy loading are optional entries; generation export belongs to #3. No engine/framework/npm release is claimed.
