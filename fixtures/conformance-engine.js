const engineId = 'fixtures/conformance-quiz';

export function createConformanceEngine(activity, context) {
  let answer = null;
  let revision = 0;
  let completed = false;
  let disposed = false;

  function publish(type, payload, causationActionId) {
    const emit = context.services?.emitEvent;
    if (typeof emit !== 'function') return;
    const receipt = emit({ type, payload, ...(causationActionId ? { causationActionId } : {}) });
    if (!receipt || receipt.accepted !== true) throw new Error('The host event adapter rejected a committed observation.');
  }

  if (context.services?.restoring !== true) publish('interactive-project/activity.started', { revision });

  return {
    dispatch(action) {
      if (disposed) return { status: 'rejected', actionId: action?.id ?? '00000000-0000-4000-8000-000000000000', code: 'action.disposed', path: '', message: 'The fixture session is disposed.' };
      if (action?.activityId !== activity.id || action?.sessionId !== context.sessionId) return { status: 'rejected', actionId: action?.id ?? '00000000-0000-4000-8000-000000000000', code: 'action.identity', path: '', message: 'The action identity does not match this fixture session.' };
      if (action.type !== 'interactive-project/answer.select' || typeof action.payload?.answer !== 'string') return { status: 'rejected', actionId: action.id, code: 'action.invalid', path: '/payload', message: 'The fixture action is invalid.' };
      answer = action.payload.answer;
      revision++;
      completed = false;
      publish('interactive-project/activity.interacted', { actionId: action.id, actionType: action.type, revision }, action.id);
      publish('interactive-project/answer.submitted', { answerId: 'fixture/question-1', revision }, action.id);
      return { status: 'accepted', actionId: action.id, revision };
    },
    evaluate() {
      if (disposed) return { protocolVersion: '1.0.0', resultVersion: '1.0.0', activityId: activity.id, sessionId: context.sessionId, ...(context.attemptId ? { attemptId: context.attemptId } : {}), revision, evidence: [], status: 'failed', failure: { code: 'evaluation.cancelled', message: 'The fixture session is disposed.' } };
      if (answer === null) return { protocolVersion: '1.0.0', resultVersion: '1.0.0', activityId: activity.id, sessionId: context.sessionId, ...(context.attemptId ? { attemptId: context.attemptId } : {}), revision, evidence: [], status: 'unevaluable', reason: 'not-ready' };
      const result = { protocolVersion: '1.0.0', resultVersion: '1.0.0', activityId: activity.id, sessionId: context.sessionId, ...(context.attemptId ? { attemptId: context.attemptId } : {}), revision, evidence: [], status: 'completed', score: { value: answer === activity.config.expectedAnswer ? 1 : 0, scale: 'normalized' } };
      if (!completed) {
        completed = true;
        publish('interactive-project/activity.completed', { result });
      }
      return result;
    },
    serialize() {
      if (disposed) throw new Error('The fixture session is disposed.');
      return {
        protocolVersion: '1.0.0', snapshotVersion: '1.0.0',
        activity: { id: activity.id, type: activity.type, activitySchemaVersion: activity.activitySchemaVersion, contentDigest: context.services.contentDigest },
        engine: { id: engineId, stateVersion: '1.0.0' },
        session: { id: context.sessionId, ...(context.attemptId ? { attemptId: context.attemptId } : {}), revision },
        state: { answer, completed, revision }
      };
    },
    restore(snapshot) {
      if (disposed || snapshot.activity.id !== activity.id || snapshot.activity.contentDigest !== context.services.contentDigest
        || snapshot.engine.id !== engineId || snapshot.engine.stateVersion !== '1.0.0' || snapshot.session.id !== context.sessionId) throw new Error('The fixture snapshot is incompatible.');
      answer = snapshot.state.answer;
      completed = snapshot.state.completed;
      revision = snapshot.state.revision;
      publish('interactive-project/activity.resumed', { revision, snapshotVersion: snapshot.snapshotVersion });
    },
    dispose() { disposed = true; }
  };
}

export const evaluate = session => session.evaluate();
