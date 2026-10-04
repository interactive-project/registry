# Host-specific generation catalogs v1

Import `createGenerationCatalog` from the optional `@interactive-project/registry/catalog` entry. Each call takes a fresh snapshot of currently registered engines; it never runs factories, imports modules, or exposes live ports. A catalog contains only the Protocol `GenerationCatalog` v1 fields: exact activity type/schema version, schema ID, capability declarations, required capabilities and required permissions. Plugin IDs/versions, renderer registrations, functions, services and credentials are not copied.

## Stable identity and host filtering

Entries sort by activity type, numeric three-part schema version, then schema ID. The returned `cacheKey` is a deterministic 64-bit FNV-1a identifier over the stable JSON projection. It is for cache invalidation, not authentication or integrity; validate catalog/schema data at the consuming boundary. Identical projections yield the same key regardless of registration order. Registration, unregistration, lazy-load completion or policy changes are visible on the next call; an existing result remains an immutable snapshot. Entries whose schema ID contains URI user-info or credential-like query parameters are omitted rather than leaked.

Permissions omitted from `policy` are denied. An entry requiring a denied permission is omitted. `allowedCapabilities` can further restrict what a host advertises; any capability not in that allow-list is marked unsupported. A capability with an unavailable `requiredDriver` is also marked unsupported and its driver list is omitted. If a required capability becomes unsupported, the whole entry is omitted. Hosts should pass explicit permission, capability and driver policy for each catalog they expose. These declarations do not grant permission or load drivers.

## Trusted schema retrieval and budgets

Catalogs carry schema IDs, not schema documents. `getGenerationSchema` only calls the host's synchronous trusted resolver after confirming that the exact ID appears in the catalog. It never fetches a URL. The host resolver should be backed by a pre-registered local schema map; consumers must validate the returned schema as Draft 2020-12 before structured generation. Remote `$ref` and `$dynamicRef` values are rejected; local fragment references are allowed.

The schema copy defaults to 256 KiB and may be tightened or raised up to a 1 MiB hard ceiling. Inspection is additionally bounded to depth 32, 10,000 collection items, 16,000 code points per string and 50,000 visited values. Catalog copies default to 1 MiB with an 8 MiB hard ceiling. Size errors fail closed with stable `registry.*` codes. The catalog is structurally checked against Protocol generation-catalog v1 in the conformance suite; consumers should validate host-provided schema and catalog data again at their trust boundary. Registry does not treat schema IDs or capability claims as executable authority.

No schema or catalog migration is required for existing manifests. Adding new protocol/catalog versions requires an explicit compatibility decision.
