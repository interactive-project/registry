import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRegistry } from '../index.js';
import { validateEngineManifest, validateRendererManifest } from '../validation/index.js';
import { createPluginLoader } from '../loader/index.js';
import { createGenerationCatalog, getGenerationSchema } from '../catalog/index.js';
import { validateGenerationCatalog } from '@interactive-project/protocol/generation';
import { createConformanceEngine, evaluate } from '../fixtures/conformance-engine.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const engineManifest = read('../fixtures/engine.json');
const validators = { validateEngineManifest, validateRendererManifest };
const registry = createRegistry(validators);
const empty = createGenerationCatalog(registry);
assert(empty.valid);
assert(validateGenerationCatalog(empty.catalog).valid);
assert.equal(empty.catalog.entries.length, 0);

const base = structuredClone(engineManifest.entries[0]);
base.capabilities.aiGeneratable = { supported: true, requiredDrivers: ['fixtures/ai-driver'] };
const networkEntry = structuredClone(base);
networkEntry.activitySchemaVersion = '0.0.2';
networkEntry.schemaId = 'urn:fixtures:quiz-config:0.0.2';
networkEntry.requiredPermissions = ['network'];
networkEntry.capabilities.offline = { supported: false };
const collaborationEntry = structuredClone(base);
collaborationEntry.activitySchemaVersion = '0.0.3';
collaborationEntry.schemaId = 'urn:fixtures:quiz-config:0.0.3';
collaborationEntry.capabilities.collaborative = { supported: true };
collaborationEntry.requiredCapabilities.push('collaborative');
const manifest = { ...engineManifest, entries: [networkEntry, collaborationEntry, base] };
const createEngineWithCredential = Object.assign(createConformanceEngine, { apiKey: 'credential-not-exported' });
assert(registry.registerEngine(manifest, { createEngine: createEngineWithCredential, evaluate }).registered);
const credentialSchemaManifest = structuredClone(engineManifest);
credentialSchemaManifest.id = 'fixtures/credential-schema-id';
credentialSchemaManifest.type = 'interactive-project/code';
credentialSchemaManifest.entries[0].type = credentialSchemaManifest.type;
credentialSchemaManifest.entries[0].schemaId = 'https://user:password@example.test/config.json?access_token=secret';
assert(registry.registerEngine(credentialSchemaManifest, { createEngine: createConformanceEngine, evaluate }).registered);

const defaults = createGenerationCatalog(registry);
assert(defaults.valid);
const validatedDefaults = validateGenerationCatalog(defaults.catalog);
assert(validatedDefaults.valid);
assert.deepEqual(JSON.parse(JSON.stringify(validatedDefaults.catalog)), JSON.parse(JSON.stringify(defaults.catalog)));
assert.deepEqual(defaults.catalog.entries.map(entry => entry.activitySchemaVersion), ['0.0.1', '0.0.3']);
assert.deepEqual(JSON.parse(JSON.stringify(defaults.catalog.entries[0].capabilities.aiGeneratable)), { supported: false }, 'unavailable drivers are hidden with their driver IDs');
assert.equal(defaults.catalog.entries[0].capabilities.aiGeneratable.requiredDrivers, undefined);
assert.equal(JSON.stringify(defaults.catalog).includes('credential-not-exported'), false);
assert.equal(JSON.stringify(defaults.catalog).includes('password'), false, 'credential-bearing schema IDs are omitted');
assert.equal(JSON.stringify(defaults.catalog).includes('fixtures/conformance-quiz'), false, 'plugin IDs and executable ports are not exported');
assert.equal(createGenerationCatalog(registry).cacheKey, defaults.cacheKey);
assert(Object.isFrozen(defaults.catalog.entries[0].capabilities));
assert.equal(JSON.stringify(JSON.parse(JSON.stringify(defaults.catalog))), JSON.stringify(defaults.catalog));
const reversedRegistry = createRegistry(validators);
assert(reversedRegistry.registerEngine({ ...manifest, entries: [...manifest.entries].reverse() }, { createEngine: createConformanceEngine, evaluate }).registered);
assert.equal(createGenerationCatalog(reversedRegistry).cacheKey, defaults.cacheKey, 'manifest entry order does not change the cache identity');
reversedRegistry.dispose();

const hostFiltered = createGenerationCatalog(registry, {
  policy: { network: true },
  allowedCapabilities: ['interactive', 'evaluable', 'offline', 'deterministic', 'resumable', 'aiGeneratable'],
  availableDrivers: ['fixtures/ai-driver']
});
assert(hostFiltered.valid);
assert(validateGenerationCatalog(hostFiltered.catalog).valid);
assert.deepEqual(hostFiltered.catalog.entries.map(entry => entry.activitySchemaVersion), ['0.0.1', '0.0.2']);
assert.deepEqual(JSON.parse(JSON.stringify(hostFiltered.catalog.entries[0].capabilities.aiGeneratable)), { supported: true, requiredDrivers: ['fixtures/ai-driver'] });
assert.notEqual(hostFiltered.cacheKey, defaults.cacheKey, 'host policy changes the cache identity');
const capabilityFiltered = createGenerationCatalog(registry, {
  policy: { network: true },
  allowedCapabilities: ['interactive', 'evaluable', 'offline', 'deterministic', 'resumable'],
  availableDrivers: ['fixtures/ai-driver']
});
assert(capabilityFiltered.valid);
assert.deepEqual(capabilityFiltered.catalog.entries.map(entry => entry.activitySchemaVersion), ['0.0.1', '0.0.2']);
assert.deepEqual(JSON.parse(JSON.stringify(capabilityFiltered.catalog.entries[0].capabilities.aiGeneratable)), { supported: false });
assert(!capabilityFiltered.catalog.entries.some(entry => entry.activitySchemaVersion === '0.0.3'), 'entry is hidden if a required capability is disallowed');
assert.notEqual(capabilityFiltered.cacheKey, hostFiltered.cacheKey);
assert.equal(createGenerationCatalog(registry, { maxBytes: 16 }).code, 'registry.catalogLimit');
assert.equal(createGenerationCatalog(registry, { policy: { execution: 'yes' } }).code, 'registry.catalogOptions');

const schemaId = defaults.catalog.entries[0].schemaId;
const schema = { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: { prompt: { type: 'string' } } };
let resolverCalls = 0;
const loadedSchema = getGenerationSchema(defaults.catalog, schemaId, id => { resolverCalls++; assert.equal(id, schemaId); return schema; });
assert(loadedSchema.valid);
assert(Object.isFrozen(loadedSchema.schema));
assert(loadedSchema.bytes > 0);
assert.equal(resolverCalls, 1);
assert.equal(getGenerationSchema(defaults.catalog, 'urn:unknown:schema', () => { resolverCalls++; return schema; }).code, 'registry.schemaNotFound');
assert.equal(resolverCalls, 1, 'unlisted schema IDs never reach the resolver');
assert.equal(getGenerationSchema(defaults.catalog, schemaId, () => schema, { maxBytes: 16 }).code, 'registry.schemaLimit');
assert.equal(getGenerationSchema(defaults.catalog, schemaId, () => ({ $ref: 'https://example.test/remote.json' })).code, 'registry.schemaReference');
assert.equal(getGenerationSchema(defaults.catalog, schemaId, () => Promise.reject(Error('private'))).code, 'registry.schemaResolver');

const lazyRegistry = createRegistry(validators);
const lazyManifest = structuredClone(engineManifest);
lazyManifest.id = 'fixtures/lazy-code';
lazyManifest.type = 'interactive-project/code';
lazyManifest.entries = lazyManifest.entries.map(entry => ({ ...entry, type: 'interactive-project/code', schemaId: 'urn:fixtures:lazy-code:0.0.1' }));
const beforeLazy = createGenerationCatalog(lazyRegistry);
assert(beforeLazy.valid && beforeLazy.catalog.entries.length === 0);
let lazyRegistration;
const loader = createPluginLoader([{
  id: 'fixtures/lazy-code', protocolVersions: ['1.0.0'], dependencies: [],
  async load() {
    lazyRegistration = lazyRegistry.registerEngine(lazyManifest, { createEngine: createConformanceEngine, evaluate });
    assert(lazyRegistration.registered);
    return lazyRegistration.registration;
  }
}]);
await loader.load('fixtures/lazy-code', { protocolVersion: '1.0.0' });
const afterLazy = createGenerationCatalog(lazyRegistry);
assert(afterLazy.valid);
assert.deepEqual(afterLazy.catalog.entries.map(entry => entry.type), ['interactive-project/code']);
assert.notEqual(afterLazy.cacheKey, beforeLazy.cacheKey);
lazyRegistration.unregister();
const afterUnregister = createGenerationCatalog(lazyRegistry);
assert(afterUnregister.valid);
assert.equal(afterUnregister.cacheKey, beforeLazy.cacheKey);
loader.dispose();
lazyRegistry.dispose();
registry.dispose();

console.log('Generation catalog: stable JSON/cache identity, lazy registration freshness, permission/capability/driver filtering, secret/port omission, trusted bounded schemas and Protocol schema validation passed.');
