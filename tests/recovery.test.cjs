const assert = require('node:assert/strict');
const { test } = require('node:test');
const recovery = require('../js/recovery.js');

const chestDay = { id: 'day-chest', name: '胸', parts: ['胸'] };
const upperDay = { id: 'day-upper', name: '上半身', parts: ['胸', '肩'] };
const leftOut = { id: 'day-general', name: '自由', parts: [] };
const bodyParts = ['胸', '肩', '脚'];

function dateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const local = (day, hour = 9) => new Date(2026, 10, day, hour);

function workout(id, stamp, overrides = {}) {
  return {
    sessionId: id, planDayId: chestDay.id, planId: '3', parts: ['胸'], date: dateString(stamp), completedAt: stamp.toISOString(),
    exercises: [{ sets: [{ weight: 50, reps: 10, rir: null }, { weight: 60, reps: 7, rir: 0 }] }],
    ...overrides,
  };
}

function checkIn(id, stamp, overrides = {}) {
  return {
    id, recordedAt: stamp.toISOString(), sessionId: null, planDayId: null, dayName: null,
    fatigue: null, soreness: {}, sleepHours: null, sleepQuality: null, feeling: null, ...overrides,
  };
}

const stable = (stamp, soreness = { 胸: 0 }) => checkIn('check-stable', stamp, { fatigue: 0, soreness });

test('validates preferences and check-ins, including clearing voluntary inputs and fractional sleep', () => {
  const defaults = recovery.DEFAULT_PREFERENCES;
  assert.equal(recovery.validatePreferences(defaults), true);
  assert.equal(recovery.validatePreferences({ ...defaults, defaultIntervalHours: 0 }), false);
  assert.equal(recovery.validatePreferences({ ...defaults, checkInMaxAgeHours: 12, dayIntervalsHours: { [chestDay.id]: 72 } }), true);
  assert.equal(recovery.validatePreferences({ ...defaults, dayIntervalsHours: { [chestDay.id]: 8761 } }), false);
  const empty = checkIn('check-empty', local(15));
  assert.equal(recovery.validateCheckIn(empty, bodyParts), true);
  assert.equal(recovery.validateCheckIn({ ...empty, sleepHours: 7.25, sleepQuality: 5, feeling: 'normal' }, bodyParts), true);

  for (const invalid of [{ fatigue: 6 }, { soreness: { 背中: 3 } }, { soreness: { 胸: 4.5 } }, { sleepHours: 24.5 },
    { sleepQuality: 0 }, { feeling: ['normal'] }, { dayName: '   ' }, { recordedAt: '2026-11-31T09:00:00Z' }]) {
    assert.equal(recovery.validateCheckIn({ ...empty, ...invalid }, bodyParts), false);
  }
});

test('first use has neither a candidate date nor invented ratings', () => {
  const result = recovery.getDayRecovery({ day: chestDay, now: local(15) });
  assert.equal(result.status, 'check');
  assert.equal(result.label, 'コンディションを確認しましょう');
  assert.equal(result.lastTrainedAt, null);
  assert.equal(result.candidateAt, null);
  assert.equal(result.elapsedHours, null);
  assert.equal(result.load, null);
  assert.equal(result.condition.checkIn, null);
  assert.equal(result.condition.fatigue, null);
  assert.deepEqual(result.condition.soreness, {});
});

test('finds the most recent overlapping body part across plans and ignores future workouts', () => {
  const own = workout('own', local(10));
  const overlap = workout('overlap', local(13, 15), { planId: '4', planDayId: 'different-day', parts: ['肩'] });
  const future = workout('future', local(16, 15), { planId: '5', parts: ['胸'] });
  const irrelevant = workout('irrelevant', local(15, 8), { parts: ['脚'] });
  const sessions = [own, future, overlap, irrelevant];
  const result = recovery.getDayRecovery({ day: upperDay, sessions, now: local(15, 20) });
  assert.equal(result.lastSession, overlap);
  assert.equal(result.elapsedHours, 53);
  assert.equal(result.candidateAt.getTime(), local(15, 15).getTime());
  assert.equal(recovery.getMuscleRecovery({ part: '胸', sessions, now: local(15, 20) }).lastSession, own);
  assert.equal(recovery.getMuscleRecovery({ part: '肩', sessions, now: local(15, 20) }).lastSession, overlap);
  assert.equal(recovery.getMuscleRecovery({ part: '脚', sessions, now: local(15, 20) }).lastSession, irrelevant);
});

test('uses the same training-day ID when no body parts are assigned', () => {
  const sameDay = workout('same-day', local(11), { planDayId: leftOut.id, parts: [] });
  const otherDay = workout('other-day', local(14), { parts: [] });
  const result = recovery.getDayRecovery({ day: leftOut, sessions: [sameDay, otherDay], checkIns: [stable(local(15, 8), {})], now: local(15) });
  assert.equal(result.lastSession, sameDay);
  assert.equal(result.status, 'ready');
});

test('matching interval and complete fresh ratings are both required for the available candidate label', () => {
  const sessions = [workout('work', local(13))];
  const now = local(15, 12);
  const checkIns = [stable(local(15, 10), { 胸: 1, 肩: 2 })];
  const result = recovery.getDayRecovery({ day: upperDay, sessions, checkIns, now });
  assert.equal(result.status, 'ready');
  assert.equal(result.label, 'トレーニング候補日です');
  const partial = recovery.getDayRecovery({ day: upperDay, sessions, checkIns: [stable(local(15, 10))], now });
  assert.equal(partial.status, 'check');
  assert.equal(partial.condition.soreness.肩, undefined);

  const prefs = { ...recovery.DEFAULT_PREFERENCES, dayIntervalsHours: { [upperDay.id]: 72 } };
  const delayed = recovery.getDayRecovery({ day: upperDay, sessions, checkIns, preferences: prefs, now });
  assert.equal(delayed.intervalHours, 72);
  assert.equal(delayed.candidateAt.getTime(), local(16).getTime());
  assert.equal(delayed.status, 'check');
  assert.ok(delayed.reasons.some(reason => reason.includes('まだ達していません')));
});

test('checks stale or pre-workout feedback without making old severe values current', () => {
  const sessions = [workout('work', local(13, 10))];
  const old = checkIn('old', local(14, 7), { fatigue: 5, soreness: { 胸: 5 } });
  const now = local(15, 12);
  const stale = recovery.getDayRecovery({ day: chestDay, sessions, checkIns: [old], now });
  assert.equal(stale.status, 'check');
  assert.equal(stale.condition.stale, true);
  assert.equal(stale.condition.severe, false);
  assert.equal(stale.condition.fatigue, 5);

  const closer = local(13, 11);
  const before = recovery.getDayRecovery({ day: chestDay, sessions, checkIns: [stable(local(13, 9))], now: closer });
  assert.equal(before.condition.stale, true);
  const prefs = { ...recovery.DEFAULT_PREFERENCES, checkInMaxAgeHours: 48 };
  assert.equal(recovery.getDayRecovery({ day: chestDay, sessions, checkIns: [old], preferences: prefs, now }).status, 'rest');
});

test('severe condition prompts rest and moderate or poor sleep prompts an update', () => {
  const sessions = [workout('work', local(13))];
  const now = local(15);
  const at = local(15, 8);
  function check(input) {
    return recovery.getDayRecovery({ day: chestDay, sessions, checkIns: [checkIn('conditions', at, {
      fatigue: 1, soreness: { 胸: 1 }, ...input,
    })], now });
  }
  for (const input of [{ fatigue: 4 }, { soreness: { 胸: 5 } }, { feeling: 'very-tired' }]) {
    const severe = check(input);
    assert.equal(severe.status, 'rest');
    assert.equal(severe.label, '休息・調整を検討');
    assert.ok(severe.reasons.some(reason => reason.includes('アプリの候補日を根拠に')));
    assert.equal(severe.candidateAt.getTime(), now.getTime());
  }
  for (const input of [{ fatigue: 3 }, { soreness: { 胸: 3 } }, { feeling: 'tired' }, { sleepHours: 5 }, { sleepQuality: 2 }]) {
    assert.equal(check(input).status, 'check');
  }
  assert.equal(check({ soreness: { 胸: 0, 脚: 5 } }).status, 'ready');
});

test('prior set volume and low or absent RIR are disclosed without changing the interval', () => {
  const now = local(15, 14);
  const checkIns = [stable(local(15, 10))];
  const sessions = [workout('high-load', local(13, 14))];
  const high = recovery.getDayRecovery({ day: chestDay, sessions, checkIns, now });
  assert.deepEqual(high.load, { sets: 2, volume: 920, minRir: 0 });
  assert.equal(high.status, 'ready');
  assert.ok(high.reasons.some(reason => reason.includes('RIR 1以下')));

  const sessionsUnrated = [workout('unrated', local(13, 14), { exercises: [{ sets: [{ weight: 0, reps: 8, rir: null }] }] })];
  const unrated = recovery.getDayRecovery({ day: chestDay, sessions: sessionsUnrated, checkIns, now });
  assert.equal(unrated.load.minRir, null);
  assert.equal(high.candidateAt.getTime(), unrated.candidateAt.getTime());
});

test('handles year crossover, history date edits and deletion without mixing B date snapshots', () => {
  const moved = workout('moved', new Date(2026, 11, 31, 19));
  const other = workout('other', new Date(2026, 11, 30, 9));
  const now = new Date(2027, 0, 5, 19);
  const args = { day: chestDay, now, preferences: { ...recovery.DEFAULT_PREFERENCES, dayIntervalsHours: { [chestDay.id]: 72 } } };
  const first = recovery.getDayRecovery({ ...args, sessions: [other, moved] });
  assert.equal(first.candidateAt.getTime(), new Date(2027, 0, 3, 19).getTime());
  const edited = { ...moved, date: '2027-01-02' };
  const second = recovery.getDayRecovery({ ...args, sessions: [other, edited] });
  assert.equal(second.lastTrainedAt.getTime(), new Date(2027, 0, 2, 19).getTime());
  assert.equal(second.candidateAt.getTime(), now.getTime());
  assert.equal(edited.completedAt, moved.completedAt);
  assert.equal(recovery.getDayRecovery({ ...args, sessions: [other] }).candidateAt.getTime(), new Date(2027, 0, 2, 9).getTime());
  assert.equal(recovery.getDayRecovery(args).candidateAt, null);
});

test('next active training day advances after today, ignores removed or other-plan days, and wraps', () => {
  const state = { activePlanId: '3', plans: { '3': { id: '3', days: [chestDay, upperDay] } }, sessions: [] };
  assert.deepEqual(recovery.getNextTrainingDay(state, local(15)), { day: chestDay, index: 0 });
  state.sessions.push(workout('first', local(15, 7)));
  assert.deepEqual(recovery.getNextTrainingDay(state, local(15)), { day: upperDay, index: 1 });
  state.sessions.push(workout('removed', local(15, 8), { planDayId: 'removed-day' }),
    workout('other', local(15, 8), { planId: '4', planDayId: upperDay.id }));
  assert.deepEqual(recovery.getNextTrainingDay(state, local(15)), { day: upperDay, index: 1 });
  state.sessions.push(workout('second', local(15, 8), { planDayId: upperDay.id }));
  assert.deepEqual(recovery.getNextTrainingDay(state, local(15)), { day: chestDay, index: 0 });
  state.plans['3'].days = [];
  assert.equal(recovery.getNextTrainingDay(state, local(15)), null);
});

test('linked fatigue respects latest update and leaves skipped values absent', () => {
  const sessions = [checkIn('check1', local(14, 7), { sessionId: 'first', fatigue: 4 }),
    checkIn('check2', local(14, 8), { sessionId: 'second', fatigue: 2 }),
    checkIn('check3', local(14, 9), { sessionId: 'first' }),
    checkIn('check4', local(14, 10), { fatigue: 5 }),
    checkIn('check5', local(18), { sessionId: 'second', fatigue: 5 })];
  assert.deepEqual(recovery.getFatigueBySessionId(sessions, local(15)), { second: 2 });
});
