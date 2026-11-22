const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DEFAULT_TARGETS, DEFAULT_PREFERENCES, validateTargets, validatePreferences, recommend } = require('../js/recommendations.js');

const exerciseId = 'exercise-shoulder-press';
const set = (weight, reps, rir) => ({ weight, reps, rir });

function workout(day, sets, { hour = '10', id = `session-${day}-${hour}`, exercise = exerciseId, completedAt } = {}) {
  const date = `2026-11-${String(day).padStart(2, '0')}`;
  return { sessionId: id, date, completedAt: completedAt || `${date}T${hour}:00:00Z`, exercises: [{ exerciseId: exercise, sets }] };
}

function suggest(sessions, options = {}) {
  return recommend({ sessions, exerciseId, targets: DEFAULT_TARGETS, ...options });
}

test('insufficient when no eligible history, targets, same-weight work groups, or RIR', () => {
  const valid = workout(3, [set(50, 12, 2)]);
  const earlier = workout(1, [set(50, 12, 2)]);
  const cases = [
    suggest([]),
    suggest([valid]),
    suggest([valid, workout(1, [set(50, 12, 2)], { exercise: 'exercise-other' })]),
    suggest([valid, workout(2, [set(48, 12, 2), set(55, 12, 2)])]),
    suggest([valid, workout(2, [set(50, 12, 2), set(50, 13, null)])]),
    suggest([valid, earlier], { targets: null }),
  ];
  for (const advice of cases) {
    assert.equal(advice.kind, 'insufficient');
    assert.equal(advice.title, 'データ不足');
    assert.equal(advice.next, null);
  }
});

test('goal and increase preferences validate inputs', () => {
  assert.equal(validateTargets(DEFAULT_TARGETS), true);
  assert.equal(validateTargets({ ...DEFAULT_TARGETS, targetRepMin: 0 }), false);
  assert.equal(validateTargets({ ...DEFAULT_TARGETS, targetRepMax: 7 }), false);
  assert.equal(validateTargets({ ...DEFAULT_TARGETS, targetRirMin: 1.5 }), false);
  assert.equal(validateTargets({ ...DEFAULT_TARGETS, targetRirMax: 11 }), false);
  assert.equal(validateTargets({ ...DEFAULT_TARGETS, weightIncrementKg: Infinity }), false);
  assert.equal(validatePreferences(DEFAULT_PREFERENCES), true);
  assert.equal(validatePreferences({ maxIncreasePercent: 0 }), true);
  assert.equal(validatePreferences({ maxIncreasePercent: '5' }), false);
});

test('two upper-limit workouts use one increment; a large step or an incomplete work group does not increase', () => {
  const earlier = workout(1, [set(50, 12, 1), set(50, 12, 2)]);
  const latest = workout(2, [set(50, 12, 2), set(50, 12, 2)]);
  const recommendation = suggest([earlier, latest]);
  assert.equal(recommendation.kind, 'increase');
  assert.deepEqual(recommendation.next, { weight: 52.5, reps: 8 });
  assert.match(recommendation.suggestion, /体調やフォーム/);
  assert.equal(suggest([earlier, latest], { targets: { ...DEFAULT_TARGETS, weightIncrementKg: 3 } }).kind, 'maintain');
  assert.equal(suggest([earlier, latest], { preferences: { maxIncreasePercent: 0 } }).kind, 'maintain');
  const partlyAtGoal = workout(2, [set(50, 12, 2), set(50, 11, 2)]);
  assert.notEqual(suggest([earlier, partlyAtGoal]).kind, 'increase');
});

test('rep progression stays at the same weight, adds one rep and honors new targets', () => {
  const earlier = workout(3, [set(16, 9, 2)]);
  const latest = workout(6, [set(16, 10, 2)]);
  const sessions = [latest, earlier];
  const advice = suggest(sessions);
  assert.equal(advice.kind, 'increase-reps');
  assert.deepEqual(advice.next, { weight: 16, reps: 11 });
  assert.equal(suggest(sessions, { targets: { ...DEFAULT_TARGETS, targetRepMax: 10 } }).kind, 'maintain');
  assert.deepEqual(suggest(sessions, { targets: { ...DEFAULT_TARGETS, targetRepMax: 11 } }).next, { weight: 16, reps: 11 });
  assert.equal(suggest([earlier, workout(6, [set(16, 10, 4)])]).kind, 'maintain');
});

test('RIR 0 and recent severe condition hold progression without auto-reducing weight', () => {
  const earlier = workout(3, [set(50, 12, 2)]);
  const lowReserve = workout(6, [set(50, 12, 0)]);
  const good = workout(6, [set(50, 12, 2)]);
  const permissive = { ...DEFAULT_TARGETS, targetRirMin: 0 };
  assert.equal(suggest([earlier, lowReserve], { targets: permissive }).kind, 'maintain');
  const currentFatigue = suggest([earlier, good], { holdProgression: true });
  assert.equal(currentFatigue.kind, 'maintain');
  assert.equal(currentFatigue.next, null);
  assert.match(currentFatigue.analysis, /コンディション/);
  assert.equal(suggest([earlier, good], { fatigueBySessionId: { [good.sessionId]: 4 } }).kind, 'maintain');
  assert.equal(suggest([earlier, workout(6, [set(50, 12, null)])], { holdProgression: true }).kind, 'insufficient');
});

test('two consecutive drops or repeated low reserve or fatigue can suggest a deload', () => {
  const earlier = workout(1, [set(40, 13, 2)]);
  const middle = workout(2, [set(40, 11, 2)]);
  const latest = workout(3, [set(40, 9, 2)]);
  assert.equal(suggest([earlier, latest]).kind, 'maintain');
  const trend = suggest([earlier, middle, latest]);
  assert.equal(trend.kind, 'deload');
  assert.equal(trend.next, null);
  assert.ok(trend.reasons.some(reason => reason.includes('13回 → 11回 → 9回')));
  assert.equal(suggest([workout(1, [set(40, 12, 0)]), workout(3, [set(40, 10, 0)])]).kind, 'deload');
  assert.equal(suggest([earlier, latest], {
    fatigueBySessionId: { [earlier.sessionId]: 4, [latest.sessionId]: 5 },
  }).kind, 'deload');
  assert.equal(suggest([earlier, workout(2, [set(45, 11, 2)]), latest]).kind, 'insufficient');
});

test('heavier work groups exclude lower-weight warmups and select a recorded representative set', () => {
  const earlier = workout(1, [set(10, 20, null), set(50, 12, 2), set(50, 12, 2)]);
  const latest = workout(2, [set(15, 20, 0), set(35, 15, null), set(50, 14, 3), set(50, 12, 1), set(50, 12, 2)]);
  const advice = suggest([earlier, latest]);
  assert.equal(advice.kind, 'increase');
  assert.deepEqual(advice.latest, { sessionId: latest.sessionId, date: latest.date, weight: 50, reps: 12, rir: 1, setCount: 3 });
  assert.equal(advice.previous.setCount, 2);
});

test('bodyweight can progress in reps and never adds kilograms', () => {
  const earlier = workout(1, [set(0, 9, 2)]);
  const latest = workout(2, [set(0, 10, 2)]);
  assert.deepEqual(suggest([earlier, latest]).next, { weight: 0, reps: 11 });
  const upper = suggest([workout(1, [set(0, 12, 2)]), workout(2, [set(0, 12, 2)])]);
  assert.equal(upper.kind, 'maintain');
  assert.equal(upper.next.weight, 0);
  assert.doesNotMatch(upper.suggestion, /kg/);
});

test('sorts by workout date then completion instant and responds to edited or deleted history', () => {
  const olderDate = workout(4, [set(50, 12, 2)], { completedAt: '2026-11-10T13:00:00Z' });
  const earlierSameDate = workout(5, [set(50, 12, 2)], { id: 'session-early', completedAt: '2026-11-05T12:00:00+09:00' });
  const laterSameDate = workout(5, [set(50, 12, 2)], { id: 'session-late', completedAt: '2026-11-05T07:00:00Z' });
  const sessions = [olderDate, laterSameDate, earlierSameDate];
  const before = structuredClone(sessions);
  const advice = suggest(sessions);
  assert.equal(advice.kind, 'increase');
  assert.equal(advice.latest.sessionId, laterSameDate.sessionId);
  assert.equal(advice.previous.sessionId, earlierSameDate.sessionId);
  assert.deepEqual(sessions, before);

  laterSameDate.exercises[0].sets[0].rir = 0;
  assert.equal(suggest(sessions).kind, 'maintain');
  assert.equal(suggest(sessions.filter(session => session !== laterSameDate)).kind, 'increase');
  assert.equal(suggest([earlierSameDate]).kind, 'insufficient');
});
