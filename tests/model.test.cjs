const assert = require('node:assert/strict');
const { test } = require('node:test');
const model = require('../js/model.js');

function createStorage(initialValue = null) {
  const items = new Map();
  if (initialValue !== null) items.set(model.STORAGE_KEY, initialValue);
  return {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  };
}

function createSquatSession(state, date, weight, time = '12:00:00') {
  const squat = state.exerciseCatalog.find(exercise => exercise.name === 'スクワット');
  const day = state.plans['3'].days.find(item => item.exerciseIds.includes(squat.id));
  return {
    sessionId: model.createId('session'),
    planId: '3',
    planDayId: day.id,
    date,
    completedAt: `${date}T${time}Z`,
    dayName: day.name,
    parts: [...day.parts],
    exercises: [{ exerciseId: squat.id, name: squat.name, sets: [
      { weight, reps: 10, rir: 1 },
      { weight, reps: 8, rir: 1 },
    ] }],
  };
}

test('independent plans, custom items and unfinished sets survive a storage round-trip', () => {
  const storage = createStorage();
  const { state, error } = model.loadState(storage);
  assert.equal(error, null);
  assert.deepEqual(model.PLAN_IDS.map(id => state.plans[id].days.length), [3, 4, 5]);
  const originalPlan4 = structuredClone(state.plans['4']);

  const plan3 = state.plans['3'];
  plan3.days.reverse();
  plan3.days[0].name = '脚の日';
  const exercise = { id: model.createId('exercise'), name: 'ブルガリアンスクワット', parts: ['脚'] };
  const customDay = { id: model.createId('day'), name: '補助種目', parts: ['脚'], exerciseIds: [exercise.id] };
  plan3.days.push(customDay);
  state.exerciseCatalog.push(exercise);
  state.draftsByDayId[customDay.id] = {
    [exercise.id]: [{ id: model.createId('set'), weight: '60', reps: '', rir: '' }],
  };
  state.activePlanId = '4';
  model.saveState(storage, state);

  const reloaded = model.loadState(storage).state;
  assert.deepEqual(reloaded.plans['3'], plan3);
  assert.deepEqual(reloaded.plans['4'], originalPlan4);
  assert.deepEqual(reloaded.exerciseCatalog.at(-1), exercise);
  assert.deepEqual(reloaded.draftsByDayId, state.draftsByDayId);
  assert.equal(reloaded.activePlanId, '4');
  assert.deepEqual(reloaded.sessions, []);
  assert.deepEqual(model.getWeeklyStats(reloaded.sessions), { sessions: 0, sets: 0, volume: 0 });
});

test('sets accept zero and decimal weight and optional RIR, and reject invalid input', () => {
  const parsed = model.parseSet({ weight: '60', reps: '10', rir: '1' });
  assert.deepEqual(parsed, { set: { weight: 60, reps: 10, rir: 1 }, error: null });
  assert.deepEqual(model.parseSet({ weight: '0', reps: '8', rir: '' }).set, { weight: 0, reps: 8, rir: null });
  assert.deepEqual(model.parseSet({ weight: '2.5', reps: '1', rir: '0' }).set, { weight: 2.5, reps: 1, rir: 0 });

  const validRow = { weight: '60', reps: '10', rir: '1' };
  const invalidFields = [
    { weight: '' }, { weight: '-1' }, { weight: 'NaN' },
    { reps: '' }, { reps: '0' }, { reps: '1.5' },
    { rir: '-1' }, { rir: '11' }, { rir: '1.5' },
  ];
  for (const fields of invalidFields) {
    const result = model.parseSet({ ...validRow, ...fields });
    assert.equal(result.set, null);
    assert.ok(result.error);
  }
});

test('weekly totals include Monday through Sunday using local calendar dates', () => {
  const state = model.createInitialState();
  const sessions = [
    createSquatSession(state, '2026-12-27', 50),
    createSquatSession(state, '2026-12-28', 60),
    createSquatSession(state, '2027-01-03', 65),
    createSquatSession(state, '2027-01-04', 70),
  ];

  assert.deepEqual(model.getWeeklyStats(sessions, new Date(2026, 11, 28, 0, 1)), { sessions: 2, sets: 4, volume: 2250 });
  assert.deepEqual(model.getWeeklyStats(sessions, new Date(2027, 0, 3, 23, 59)), { sessions: 2, sets: 4, volume: 2250 });
  assert.deepEqual(model.getWeeklyStats(sessions, new Date(2027, 0, 4, 0, 1)), { sessions: 1, sets: 2, volume: 1260 });
  assert.equal(model.localDate(new Date(2027, 0, 4, 0, 1)), '2027-01-04');
  assert.equal(model.isLocalDate('2028-02-29'), true);
  assert.equal(model.isLocalDate('2027-02-29'), false);
});

test('history survives deleting a plan day and charts reflect edited and removed sessions', () => {
  const storage = createStorage();
  const state = model.createInitialState();
  const earlier = createSquatSession(state, '2026-11-12', 60);
  const later = createSquatSession(state, '2026-11-12', 65, '15:00:00');
  const { exerciseId } = earlier.exercises[0];
  const testDate = new Date(2026, 10, 12);
  assert.deepEqual(model.getWeeklyStats([earlier], testDate), { sessions: 1, sets: 2, volume: 1080 });
  state.sessions = [later, earlier];
  assert.equal(model.getLatestExercise(state.sessions, exerciseId).session, later);
  assert.equal(model.getLatestDaySession(state.sessions, earlier.planDayId), later);
  assert.deepEqual(model.getProgress(state.sessions, exerciseId), [
    { date: '2026-11-12', weight: 60 }, { date: '2026-11-12', weight: 65 },
  ]);

  state.plans['3'].days = state.plans['3'].days.filter(day => day.id !== earlier.planDayId);
  model.saveState(storage, state);
  const reloaded = model.loadState(storage).state;
  assert.deepEqual(reloaded.sessions, [later, earlier]);

  reloaded.sessions = reloaded.sessions.filter(session => session.sessionId !== later.sessionId);
  reloaded.sessions[0].exercises[0].sets[0].weight = 70;
  assert.deepEqual(model.getProgress(reloaded.sessions, exerciseId), [{ date: '2026-11-12', weight: 70 }]);
  assert.deepEqual(model.getWeeklyStats(reloaded.sessions, testDate), { sessions: 1, sets: 2, volume: 1180 });
});

test('failed saves and invalid stored data preserve the existing value', () => {
  const storage = createStorage();
  const state = model.createInitialState();
  model.saveState(storage, state);
  const original = storage.getItem(model.STORAGE_KEY);
  const invalid = createSquatSession(state, '2026-11-12', NaN);
  state.sessions.push(invalid);
  assert.throws(() => model.saveState(storage, state));
  assert.equal(storage.getItem(model.STORAGE_KEY), original);

  for (const raw of ['not JSON', '{"schemaVersion":9}']) {
    storage.setItem(model.STORAGE_KEY, raw);
    const result = model.loadState(storage);
    assert.equal(result.state, null);
    assert.ok(result.error);
    assert.equal(storage.getItem(model.STORAGE_KEY), raw);
  }

  const blockedStorage = { getItem() { throw new Error('Storage is blocked'); } };
  assert.ok(model.loadState(blockedStorage).error);
  const fullStorage = { setItem() { throw new Error('Quota exceeded'); } };
  assert.throws(() => model.saveState(fullStorage, model.createInitialState()), /Quota exceeded/);
});

test('legacy storage is upgraded in memory and keeps plans, drafts, and session snapshots', () => {
  const legacy = model.createInitialState();
  legacy.schemaVersion = 1;
  delete legacy.exerciseTargets;
  delete legacy.recommendationPreferences;
  delete legacy.recoveryPreferences;
  delete legacy.recoveryCheckIns;
  legacy.activePlanId = '4';
  legacy.plans['4'].days[0].name = '手作りプラン';
  const session = createSquatSession(legacy, '2026-11-12', 60);
  legacy.sessions.push(session);
  legacy.draftsByDayId[session.planDayId] = {
    [session.exercises[0].exerciseId]: [{ id: model.createId('set'), weight: '62.5', reps: '', rir: '' }],
  };
  const serialized = JSON.stringify(legacy);
  const storage = createStorage(serialized);

  const loaded = model.loadState(storage);
  assert.equal(loaded.error, null);
  assert.equal(loaded.raw, serialized);
  assert.equal(storage.getItem(model.STORAGE_KEY), serialized);
  assert.equal(loaded.state.schemaVersion, model.SCHEMA_VERSION);
  assert.equal(loaded.state.activePlanId, '4');
  assert.deepEqual(loaded.state.sessions, legacy.sessions);
  assert.deepEqual(loaded.state.draftsByDayId, legacy.draftsByDayId);
  assert.deepEqual(loaded.state.plans, legacy.plans);
  assert.deepEqual(loaded.state.exerciseCatalog, legacy.exerciseCatalog);
  assert.deepEqual(loaded.state.recoveryCheckIns, []);
  assert.deepEqual(loaded.state.recoveryPreferences.dayIntervalsHours, {});

  loaded.state.activePlanId = '5';
  model.saveState(storage, loaded.state);
  assert.deepEqual(model.loadState(storage).state.sessions, legacy.sessions);
});

test('exercise target edits are scoped by stable exercise ID and invalid targets preserve storage', () => {
  const recommendations = require('../js/recommendations.js');
  const state = model.createInitialState();
  const storage = createStorage();
  state.exerciseTargets['exercise-squat'] = { ...recommendations.DEFAULT_TARGETS, targetRepMin: 6, targetRepMax: 9 };
  model.saveState(storage, state);
  const saved = storage.getItem(model.STORAGE_KEY);
  const reloaded = model.loadState(storage).state;
  assert.equal(reloaded.exerciseTargets['exercise-squat'].targetRepMax, 9);
  assert.equal(reloaded.exerciseTargets['exercise-bench-press'], undefined);

  reloaded.exerciseTargets['exercise-squat'].targetRirMin = 9;
  assert.throws(() => model.saveState(storage, reloaded));
  assert.equal(storage.getItem(model.STORAGE_KEY), saved);
});

test('A2 storage upgrades to A3 with unchanged targets and optional feedback stays separate from Sessions', () => {
  const recommendations = require('../js/recommendations.js');
  const legacy = model.createInitialState();
  legacy.schemaVersion = 2;
  delete legacy.recoveryPreferences;
  delete legacy.recoveryCheckIns;
  legacy.exerciseTargets['exercise-squat'] = { ...recommendations.DEFAULT_TARGETS, targetRepMax: 10 };
  const session = createSquatSession(legacy, '2026-11-12', 60);
  legacy.sessions.push(session);
  const serialized = JSON.stringify(legacy);
  const storage = createStorage(serialized);
  const { state, error } = model.loadState(storage);

  assert.equal(error, null);
  assert.equal(storage.getItem(model.STORAGE_KEY), serialized);
  assert.equal(state.schemaVersion, model.SCHEMA_VERSION);
  assert.deepEqual(state.exerciseTargets, legacy.exerciseTargets);
  assert.deepEqual(state.sessions, [session]);

  state.recoveryPreferences.dayIntervalsHours[session.planDayId] = 72;
  state.recoveryCheckIns.push({
    id: model.createId('check-in'), recordedAt: session.completedAt, sessionId: session.sessionId,
    planDayId: session.planDayId, dayName: session.dayName, fatigue: 0, soreness: { 脚: 0 },
    sleepHours: null, sleepQuality: null, feeling: null,
  });
  model.saveState(storage, state);
  const saved = storage.getItem(model.STORAGE_KEY);
  assert.deepEqual(model.loadState(storage).state.sessions, [session]);
  assert.equal(model.loadState(storage).state.recoveryCheckIns[0].fatigue, 0);
  state.recoveryCheckIns[0].fatigue = 6;
  assert.throws(() => model.saveState(storage, state));
  assert.equal(storage.getItem(model.STORAGE_KEY), saved);
});
