import { copyGeneratedJson } from '@interactive-project/protocol/generation/json';

const protocolVersion = '1.0.0';
const catalogVersion = '1.0.0';
const defaultCatalogBytes = 1048576;
const maxCatalogBytes = 8388608;
const defaultSchemaBytes = 262144;
const maxSchemaBytes = 1048576;
const capabilities = Object.freeze([
  'interactive', 'evaluable', 'collaborative', 'offline',
  'deterministic', 'resumable', 'aiGeneratable'
]);
const permissions = Object.freeze(['network', 'execution', 'media']);
const driverId = /^[a-z0-9][a-z0-9.-]*\/[a-z0-9][a-z0-9._-]*$/;
const uriUserInfo = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i;
const credentialQuery = /[?&](?:access[_-]?token|api[_-]?key|auth|client[_-]?secret|credential|password|secret|signature|token)=/i;

const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function compareVersions(left, right) {
  const a = left.split('.').map(BigInt);
  const b = right.split('.').map(BigInt);
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function utf8Hash(text) {
  const mask = (1n << 64n) - 1n;
  const prime = 1099511628211n;
  let hash = 14695981039346656037n;
  const add = byte => { hash = ((hash ^ BigInt(byte)) * prime) & mask; };
  for (const character of text) {
    const point = character.codePointAt(0);
    if (point < 0x80) add(point);
    else if (point < 0x800) {
      add(0xc0 | (point >> 6)); add(0x80 | (point & 0x3f));
    } else if (point < 0x10000) {
      add(0xe0 | (point >> 12)); add(0x80 | ((point >> 6) & 0x3f)); add(0x80 | (point & 0x3f));
    } else {
      add(0xf0 | (point >> 18)); add(0x80 | ((point >> 12) & 0x3f));
      add(0x80 | ((point >> 6) & 0x3f)); add(0x80 | (point & 0x3f));
    }
  }
  return `registry-catalog-v1-fnv64-${hash.toString(16).padStart(16, '0')}`;
}

function failure(code) { return Object.freeze({ valid: false, code }); }

function validOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return false;
  if (Object.keys(options).some(key => !['protocolVersion', 'policy', 'allowedCapabilities', 'availableDrivers', 'maxBytes'].includes(key))) return false;
  if (options.protocolVersion !== undefined && options.protocolVersion !== protocolVersion) return false;
  if (options.maxBytes !== undefined && (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1 || options.maxBytes > maxCatalogBytes)) return false;
  const policy = options.policy ?? {};
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return false;
  if (Object.entries(policy).some(([key, value]) => !permissions.includes(key) || typeof value !== 'boolean')) return false;
  if (options.allowedCapabilities !== undefined && (!Array.isArray(options.allowedCapabilities) || new Set(options.allowedCapabilities).size !== options.allowedCapabilities.length || options.allowedCapabilities.some(item => !capabilities.includes(item)))) return false;
  if (options.availableDrivers !== undefined && (!Array.isArray(options.availableDrivers) || new Set(options.availableDrivers).size !== options.availableDrivers.length || options.availableDrivers.some(item => typeof item !== 'string' || !driverId.test(item)))) return false;
  return true;
}

function exportEntry(entry, options) {
  if (uriUserInfo.test(entry.schemaId) || credentialQuery.test(entry.schemaId)) return null;
  if (entry.requiredPermissions.some(permission => options.policy?.[permission] !== true)) return null;
  const allowedCapabilities = new Set(options.allowedCapabilities ?? capabilities);
  const availableDrivers = new Set(options.availableDrivers ?? []);
  const projectedCapabilities = {};
  for (const capability of capabilities) {
    const declaration = entry.capabilities[capability];
    const requiredDrivers = declaration.requiredDrivers ?? [];
    const available = requiredDrivers.every(driver => availableDrivers.has(driver));
    const supported = declaration.supported && allowedCapabilities.has(capability) && available;
    projectedCapabilities[capability] = supported
      ? { supported: true, ...(requiredDrivers.length ? { requiredDrivers: [...requiredDrivers].sort(compareText) } : {}) }
      : { supported: false };
  }
  if (entry.requiredCapabilities.some(capability => !projectedCapabilities[capability].supported)) return null;
  return {
    type: entry.type,
    activitySchemaVersion: entry.activitySchemaVersion,
    schemaId: entry.schemaId,
    capabilities: projectedCapabilities,
    requiredCapabilities: [...entry.requiredCapabilities].sort(compareText),
    requiredPermissions: [...entry.requiredPermissions].sort(compareText)
  };
}

/** Build a fresh, JSON-only Protocol GenerationCatalog from current engine registrations. */
export function createGenerationCatalog(registry, options = {}) {
  if (!registry || typeof registry.listEngines !== 'function' || !validOptions(options)) return failure('registry.catalogOptions');
  const projected = [];
  for (const registration of registry.listEngines()) {
    if (registration.kind !== 'engine' || !registration.manifest.protocolVersions.includes(protocolVersion)) continue;
    for (const entry of registration.manifest.entries) {
      const safe = exportEntry(entry, options);
      if (safe) projected.push(safe);
    }
  }
  projected.sort((left, right) => compareText(left.type, right.type)
    || compareVersions(left.activitySchemaVersion, right.activitySchemaVersion)
    || compareText(left.schemaId, right.schemaId));
  const copied = copyGeneratedJson({ protocolVersion, catalogVersion, entries: projected }, {
    maxBytes: options.maxBytes ?? defaultCatalogBytes,
    maxDepth: 32,
    maxCollectionSize: 1000,
    maxStringLength: 4000,
    maxNodes: 100000
  });
  if (!copied.valid) return failure('registry.catalogLimit');
  const canonical = JSON.stringify(copied.value);
  return Object.freeze({ valid: true, catalog: copied.value, cacheKey: utf8Hash(canonical) });
}

function hasRemoteReference(value) {
  if (!value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value)) {
    if ((key === '$ref' || key === '$dynamicRef') && (typeof child !== 'string' || !child.startsWith('#'))) return true;
    if (hasRemoteReference(child)) return true;
  }
  return false;
}

function utf8Length(value) {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0);
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Resolve only schemas named by the catalog, through a trusted host-owned synchronous resolver. */
export function getGenerationSchema(catalog, schemaId, resolveTrustedSchema, options = {}) {
  if (!catalog || catalog.protocolVersion !== protocolVersion || catalog.catalogVersion !== catalogVersion
    || typeof schemaId !== 'string' || typeof resolveTrustedSchema !== 'function'
    || !options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some(key => key !== 'maxBytes')) return failure('registry.schemaOptions');
  const maxBytes = options.maxBytes ?? defaultSchemaBytes;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > maxSchemaBytes) return failure('registry.schemaOptions');
  if (!catalog.entries.some(entry => entry.schemaId === schemaId)) return failure('registry.schemaNotFound');
  let input;
  try { input = resolveTrustedSchema(schemaId); }
  catch { return failure('registry.schemaResolver'); }
  if (input && typeof input.then === 'function') {
    Promise.resolve(input).catch(() => {});
    return failure('registry.schemaResolver');
  }
  const copied = copyGeneratedJson(input, {
    maxBytes,
    maxDepth: 32,
    maxCollectionSize: 10000,
    maxStringLength: 16000,
    maxNodes: 50000
  });
  if (!copied.valid) return failure(copied.diagnostics?.[0]?.code === 'generation.maxBytes' ? 'registry.schemaLimit' : 'registry.schemaInvalid');
  if (!copied.value || typeof copied.value !== 'object' || Array.isArray(copied.value)) return failure('registry.schemaInvalid');
  if (hasRemoteReference(copied.value)) return failure('registry.schemaReference');
  const bytes = utf8Length(JSON.stringify(copied.value));
  if (bytes > maxBytes) return failure('registry.schemaLimit');
  return Object.freeze({ valid: true, schema: copied.value, bytes });
}
