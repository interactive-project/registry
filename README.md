# Interactive Project Registry

Independent engine and host renderer registrations with immutable serializable manifests and captured live ports.

- [Registration and resolution contract](docs/registration-v1.md)
- [Version negotiation and lazy loading](docs/resolution-v1.md)
- [Host-specific generation catalogs and schema retrieval](docs/catalog-v1.md)
- [Plugin conformance checklist](docs/plugin-conformance-v1.md)
- [Manifest schema](schemas/plugin-manifest.v1.schema.json)

The pure registry has no UI/framework dependency and accepts trusted manifest validators. The optional Node validation entry resolves Protocol generation schemas offline. Lookup never calls factories. Run npm ci --ignore-scripts and npm test.

Exact/range capability-aware lookup, bounded shared lazy loading, and host-filtered generation catalog/schema helpers are optional entries. The fixture conformance suite is not a production engine certification. No engine/framework/npm release is claimed.
