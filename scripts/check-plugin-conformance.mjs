import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRegistry } from '../index.js';
import { validateEngineManifest, validateRendererManifest } from '../validation/index.js';
import { createConformanceEngine, evaluate } from '../fixtures/conformance-engine.js';
import { activityDigest } from '@interactive-project/protocol/interoperability';
import { validateAction, validateDispatchResult, validateResult, validateSnapshot } from '@interactive-project/protocol/validation/interoperability';
import { createEventBus } from '@interactive-project/events/bus';
import { validateEvent } from '@interactive-project/events/validation';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const manifest = read('../fixtures/conformance-engine.json');
const activity = { protocolVersion: '1.0.0', id: '00000000-0000-4000-8000-000000000002', type: manifest.type, activitySchemaVersion: '0.0.1', metadata: { title: 'Fixture quiz' }, config: { expectedAnswer: 'private-answer-for-snapshot-only' } };
const sessionId = '00000000-0000-4000-8000-000000000003';
const attemptId = '00000000-0000-4000-8000-000000000006';
const contentDigest = await activityDigest(activity);
let idCounter = 700;

function eventHost(sourceId) {
  const bus = createEventBus({ activityId: activity.id, sessionId, sourceId, validate: validateEvent });
  const received = [];
  bus.subscribe(event => received.push(event));
  function emitEvent(draft) {
    const sequence = bus.stats().nextSequence;
    const event = {
      protocolVersion: '1.0.0', eventVersion: '1.0.0',
      id: `00000000-0000-4000-8000-${String(idCounter++).padStart(12, '0')}`,
      activityId: activity.id, activityType: activity.type, sessionId, attemptId, sourceId,
      sequence, timestamp: 1790910000000 + sequence,
      ...draft
    };
    return bus.publish(event);
  }
  return { bus, received, emitEvent };
}

const host = eventHost('00000000-0000-4000-8000-000000000004');
const registry = createRegistry({ validateEngineManifest, validateRendererManifest });
const registered = registry.registerEngine(manifest, { createEngine: createConformanceEngine, evaluate });
assert(registered.registered, JSON.stringify(registered));
const resolution = registry.lookupEngine({ type: activity.type, protocolVersion: activity.protocolVersion, activitySchemaVersion: activity.activitySchemaVersion });
assert(resolution.found);
const session = resolution.registration.createEngine(activity, { sessionId, attemptId, services: { contentDigest, emitEvent: host.emitEvent } });
assert.deepEqual(host.received.map(event => event.type), ['interactive-project/activity.started']);
const unreadyResult = await resolution.registration.evaluate(session);
assert.equal(unreadyResult.status, 'unevaluable');
assert(validateResult(unreadyResult, { activityId: activity.id, sessionId, attemptId }).valid);
assert.equal(host.received.length, 1, 'unevaluable checks do not claim a committed completion event');

const invalid = {
  protocolVersion: '1.0.0', actionVersion: '1.0.0', id: '00000000-0000-4000-8000-000000000010',
  activityId: '00000000-0000-4000-8000-000000000099', sessionId, attemptId, type: 'interactive-project/answer.select', sequence: 0,
  payload: { answer: 'private-answer-for-snapshot-only' }
};
assert(!validateAction(invalid, { activityId: activity.id, sessionId, attemptId }).valid);
const invalidReceipt = await session.dispatch(invalid);
assert.equal(invalidReceipt.status, 'rejected');
assert(validateDispatchResult(invalidReceipt, { actionId: invalid.id }).valid);
assert.equal(host.received.length, 1, 'rejected actions emit no committed events');

const action = { ...invalid, id: '00000000-0000-4000-8000-000000000011', activityId: activity.id, type: 'interactive-project/answer.select' };
assert(validateAction(action, { activityId: activity.id, sessionId, attemptId }).valid);
const dispatch = await session.dispatch(action);
assert.equal(dispatch.status, 'accepted');
assert(validateDispatchResult(dispatch, { actionId: action.id }).valid);
assert.equal(dispatch.revision, 1);
const result = await resolution.registration.evaluate(session);
assert.equal(result.status, 'completed');
assert(validateResult(result, { activityId: activity.id, sessionId, attemptId }).valid);
assert.deepEqual(host.received.map(event => event.type), [
  'interactive-project/activity.started',
  'interactive-project/activity.interacted',
  'interactive-project/answer.submitted',
  'interactive-project/activity.completed'
]);
assert(host.received.every(event => validateEvent(event).valid));
assert.equal(host.received[2].causationActionId, action.id);
assert.equal(JSON.stringify(host.received).includes('private-answer-for-snapshot-only'), false);
assert.equal(new Set(host.received.map(event => event.id)).size, host.received.length);

const snapshot = await session.serialize();
assert(validateSnapshot(snapshot, {
  activityId: activity.id, activityType: activity.type, activitySchemaVersion: activity.activitySchemaVersion,
  contentDigest, engineId: manifest.id, engineStateVersion: '1.0.0', sessionId, attemptId
}).valid);
const saved = structuredClone(snapshot);
const restoredHost = eventHost('00000000-0000-4000-8000-000000000005');
const restored = resolution.registration.createEngine(activity, { sessionId, attemptId, services: { contentDigest, emitEvent: restoredHost.emitEvent, restoring: true } });
await restored.restore(saved);
const restoredResult = await resolution.registration.evaluate(restored);
assert(validateResult(restoredResult, { activityId: activity.id, sessionId, attemptId }).valid);
assert.deepEqual(restoredResult, result, 'snapshot restore preserves state and result');
assert.deepEqual(restoredHost.received.map(event => event.type), ['interactive-project/activity.resumed']);
assert(restoredHost.received.every(event => validateEvent(event).valid));
assert.equal(restoredHost.received[0].payload.snapshotVersion, snapshot.snapshotVersion);
const mismatchedSnapshot = structuredClone(saved);
mismatchedSnapshot.activity.contentDigest = '0'.repeat(64);
assert(!validateSnapshot(mismatchedSnapshot, { contentDigest }).valid);
assert.throws(() => restored.restore(mismatchedSnapshot), /incompatible/);

await session.dispose();
await session.dispose();
const postDispose = await session.dispatch(action);
assert.equal(postDispose.status, 'rejected');
assert.equal(postDispose.code, 'action.disposed');
assert(validateDispatchResult(postDispose, { actionId: action.id }).valid);
assert(validateResult(await session.evaluate(), { activityId: activity.id, sessionId, attemptId }).valid);
assert.equal(host.received.length, 4, 'disposing does not synthesize committed activity events');
assert.equal(JSON.stringify(restoredHost.received).includes('private-answer-for-snapshot-only'), false);
await restored.dispose();
registered.unregister();
host.bus.dispose(); restoredHost.bus.dispose(); registry.dispose();

console.log('Plugin conformance: lifecycle/disposal, committed Events v1 trace, Protocol actions/results, resumable snapshot round-trip and identity checks passed.');
