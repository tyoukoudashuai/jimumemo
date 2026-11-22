(() => {
  'use strict';

  const recommendations = typeof module === 'object' && module.exports
    ? require('./recommendations.js') : window.FitnessRecommendations;
  const recovery = typeof module === 'object' && module.exports
    ? require('./recovery.js') : window.FitnessRecovery;
  const STORAGE_KEY = 'haoFitnessLog:v1';
  const SCHEMA_VERSION = 4;
  const MAX_NAME_LENGTH = 60;
  const PLAN_IDS = Object.freeze(['3', '4', '5']);
  const BODY_PARTS = Object.freeze(['胸', '背中', '肩', '脚', '腹筋', '二頭筋', '三頭筋', 'その他']);

  const exercises = [
    ['bench-press', 'ベンチプレス', ['胸', '三頭筋']],
    ['dumbbell-fly', 'ダンベルフライ', ['胸']],
    ['shoulder-press', 'ショルダープレス', ['肩', '三頭筋']],
    ['side-raise', 'サイドレイズ', ['肩']],
    ['triceps-pushdown', 'トライセプスプッシュダウン', ['三頭筋']],
    ['lat-pulldown', 'ラットプルダウン', ['背中', '二頭筋']],
    ['seated-row', 'シーテッドロー', ['背中']],
    ['dumbbell-curl', 'ダンベルカール', ['二頭筋']],
    ['squat', 'スクワット', ['脚']],
    ['leg-curl', 'レッグカール', ['脚']],
    ['crunch', 'クランチ', ['腹筋']],
  ];

  const templates = {
    '3': [
      ['push', '胸・肩・三頭筋', ['胸', '肩', '三頭筋'], ['bench-press', 'shoulder-press', 'triceps-pushdown']],
      ['pull', '背中・二頭筋', ['背中', '二頭筋'], ['lat-pulldown', 'seated-row', 'dumbbell-curl']],
      ['legs', '脚・腹筋', ['脚', '腹筋'], ['squat', 'leg-curl', 'crunch']],
    ],
    '4': [
      ['chest', '胸・三頭筋', ['胸', '三頭筋'], ['bench-press', 'dumbbell-fly', 'triceps-pushdown']],
      ['back', '背中・二頭筋', ['背中', '二頭筋'], ['lat-pulldown', 'seated-row', 'dumbbell-curl']],
      ['shoulders', '肩・腹筋', ['肩', '腹筋'], ['shoulder-press', 'side-raise', 'crunch']],
      ['legs', '脚', ['脚'], ['squat', 'leg-curl']],
    ],
    '5': [
      ['chest', '胸', ['胸'], ['bench-press', 'dumbbell-fly']],
      ['back', '背中', ['背中'], ['lat-pulldown', 'seated-row']],
      ['shoulders', '肩', ['肩'], ['shoulder-press', 'side-raise']],
      ['legs', '脚', ['脚'], ['squat', 'leg-curl']],
      ['arms', '腕・腹筋', ['二頭筋', '三頭筋', '腹筋'], ['dumbbell-curl', 'triceps-pushdown', 'crunch']],
    ],
  };

  function createInitialState() {
    const plans = Object.fromEntries(PLAN_IDS.map(id => [id, {
      id,
      name: `${id}分割`,
      days: templates[id].map(([slug, name, parts, exerciseIds]) => ({
        id: `day-${id}-${slug}`,
        name,
        parts: [...parts],
        exerciseIds: exerciseIds.map(exerciseId => `exercise-${exerciseId}`),
      })),
    }]));

    return {
      schemaVersion: SCHEMA_VERSION,
      activePlanId: '3',
      plans,
      exerciseCatalog: exercises.map(([id, name, parts]) => ({
        id: `exercise-${id}`, name, parts: [...parts],
      })),
      draftsByDayId: {},
      sessions: [],
      profile: null,
      exerciseTargets: {},
      recommendationPreferences: { ...recommendations.DEFAULT_PREFERENCES },
      recoveryPreferences: { ...recovery.DEFAULT_PREFERENCES, dayIntervalsHours: {} },
      recoveryCheckIns: [],
      calendarOverrides: {},
    };
  }

  let idSequence = 0;

  function createId(prefix = 'id') {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return `${prefix}-${globalThis.crypto.randomUUID()}`;
    }
    idSequence += 1;
    return `${prefix}-${Date.now().toString(36)}-${idSequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function localDate(date = new Date()) {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function isLocalDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthLengths = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= monthLengths[month - 1];
  }

  function formatDate(value) {
    if (!isLocalDate(value)) return '—';
    const [year, month, day] = value.split('-').map(Number);
    return `${year}年${month}月${day}日`;
  }

  function readNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;
    const input = value.trim();
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(input)) return NaN;
    return Number(input);
  }

  function parseSet(row) {
    const weight = readNumber(row?.weight);
    const reps = readNumber(row?.reps);
    const rawRir = row?.rir;
    const rir = rawRir == null || (typeof rawRir === 'string' && !rawRir.trim()) ? null : readNumber(rawRir);

    if (!Number.isFinite(weight) || weight < 0) {
      return { set: null, error: '重量は0以上の数値で入力してください。' };
    }
    if (!Number.isSafeInteger(reps) || reps < 1) {
      return { set: null, error: '回数は1以上の整数で入力してください。' };
    }
    if (rir !== null && (!Number.isInteger(rir) || rir < 0 || rir > 10)) {
      return { set: null, error: 'RIRは0〜10の整数で入力してください。' };
    }
    if (!Number.isFinite(weight * reps)) {
      return { set: null, error: '重量または回数が大きすぎます。' };
    }
    return { set: { weight: weight || 0, reps, rir: rir === 0 ? 0 : rir }, error: null };
  }

  function isRecord(value) {
    if (value === null || typeof value !== 'object') return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function isId(value) {
    return typeof value === 'string' && /^[a-z\d][a-z\d_-]*$/i.test(value)
      && !Object.prototype.hasOwnProperty.call(Object.prototype, value);
  }

  function isName(value) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_NAME_LENGTH;
  }

  function validList(values, validateValue) {
    if (!Array.isArray(values)) return false;
    const distinct = new Set(values);
    return distinct.size === values.length && [...distinct].every(validateValue);
  }

  function validParts(parts) {
    return validList(parts, part => BODY_PARTS.includes(part));
  }

  function validOverrides(overrides, exerciseIds, validateValue) {
    return overrides === undefined || (isRecord(overrides) && Object.entries(overrides).every(
      ([exerciseId, value]) => exerciseIds.includes(exerciseId) && validateValue(value),
    ));
  }

  function validDraftRows(rows, rowIds) {
    if (!Array.isArray(rows)) return false;
    for (const row of rows) {
      if (!isRecord(row) || !isId(row.id) || rowIds.has(row.id)) return false;
      if (typeof row.weight !== 'string' || typeof row.reps !== 'string' || typeof row.rir !== 'string') return false;
      rowIds.add(row.id);
    }
    return true;
  }

  function isSavedSet(set) {
    return isRecord(set) && typeof set.weight === 'number' && typeof set.reps === 'number'
      && (set.rir === null || typeof set.rir === 'number') && parseSet(set).error === null;
  }

  function validSession(session, sessionIds) {
    if (!isRecord(session) || !isId(session.sessionId) || sessionIds.has(session.sessionId)) return false;
    if (!PLAN_IDS.includes(session.planId) || !isId(session.planDayId) || !isLocalDate(session.date)) return false;
    if (typeof session.completedAt !== 'string' || !Number.isFinite(Date.parse(session.completedAt))) return false;
    if (!isName(session.dayName) || !validParts(session.parts)) return false;
    if (!Array.isArray(session.exercises) || !session.exercises.length) return false;

    const exerciseIds = new Set();
    for (const exercise of session.exercises) {
      if (!isRecord(exercise) || !isId(exercise.exerciseId) || exerciseIds.has(exercise.exerciseId)) return false;
      if (!isName(exercise.name) || !Array.isArray(exercise.sets) || !exercise.sets.length) return false;
      for (const set of exercise.sets) {
        if (!isSavedSet(set)) return false;
      }
      exerciseIds.add(exercise.exerciseId);
    }
    sessionIds.add(session.sessionId);
    return true;
  }

  function validateTrainingState(state) {
    if (!isRecord(state) || state.profile !== null) return false;
    if (!PLAN_IDS.includes(state.activePlanId) || !isRecord(state.plans)) return false;
    if (Object.keys(state.plans).length !== PLAN_IDS.length || !Array.isArray(state.exerciseCatalog)) return false;

    const catalogIds = new Set();
    for (const exercise of state.exerciseCatalog) {
      if (!isRecord(exercise) || !isId(exercise.id) || catalogIds.has(exercise.id)) return false;
      if (!isName(exercise.name) || !validParts(exercise.parts)) return false;
      catalogIds.add(exercise.id);
    }

    const daysById = new Map();
    for (const id of PLAN_IDS) {
      const plan = state.plans[id];
      if (!isRecord(plan) || plan.id !== id || !isName(plan.name) || !Array.isArray(plan.days)) return false;
      for (const day of plan.days) {
        if (!isRecord(day) || !isId(day.id) || daysById.has(day.id)) return false;
        if (!isName(day.name) || !validParts(day.parts) || !validList(day.exerciseIds, item => catalogIds.has(item))) return false;
        if (!validOverrides(day.exerciseNames, day.exerciseIds, isName)) return false;
        if (!validOverrides(day.exerciseParts, day.exerciseIds, validParts)) return false;
        daysById.set(day.id, day);
      }
    }

    if (!isRecord(state.draftsByDayId)) return false;
    const rowIds = new Set();
    for (const [dayId, exercisesById] of Object.entries(state.draftsByDayId)) {
      const day = daysById.get(dayId);
      if (!day || !isRecord(exercisesById)) return false;
      for (const [exerciseId, rows] of Object.entries(exercisesById)) {
        if (!day.exerciseIds.includes(exerciseId) || !validDraftRows(rows, rowIds)) return false;
      }
    }

    if (!Array.isArray(state.sessions)) return false;
    const sessionIds = new Set();
    for (const session of state.sessions) {
      if (!validSession(session, sessionIds)) return false;
    }
    return true;
  }

  function validateState(state) {
    if (state?.schemaVersion !== SCHEMA_VERSION || !validateTrainingState(state)) return false;
    if (!isRecord(state.exerciseTargets) || !recommendations.validatePreferences(state.recommendationPreferences)) return false;
    const catalogIds = new Set(state.exerciseCatalog.map(exercise => exercise.id));
    if (!Object.entries(state.exerciseTargets).every(([id, targets]) =>
      catalogIds.has(id) && recommendations.validateTargets(targets))) return false;
    if (!recovery.validatePreferences(state.recoveryPreferences) || !Array.isArray(state.recoveryCheckIns)) return false;

    if (!isRecord(state.calendarOverrides) || !Object.entries(state.calendarOverrides).every(([id, value]) =>
      isId(id) && (value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)))))) return false;
    const checkInIds = new Set();
    for (const checkIn of state.recoveryCheckIns) {
      if (!recovery.validateCheckIn(checkIn, BODY_PARTS) || checkInIds.has(checkIn.id)) return false;
      checkInIds.add(checkIn.id);
    }
    return true;
  }

  function upgradeState(state) {
    let upgraded = state;
    if (upgraded?.schemaVersion === 1) {
      upgraded = {
        ...upgraded,
        schemaVersion: 2,
        exerciseTargets: upgraded.exerciseTargets ?? {},
        recommendationPreferences: upgraded.recommendationPreferences ?? { ...recommendations.DEFAULT_PREFERENCES },
      };
    }
    if (upgraded?.schemaVersion === 2) {
      upgraded = {
        ...upgraded,
        schemaVersion: 3,
        recoveryPreferences: upgraded.recoveryPreferences ?? { ...recovery.DEFAULT_PREFERENCES, dayIntervalsHours: {} },
        recoveryCheckIns: upgraded.recoveryCheckIns ?? [],
      };
    }
    if (upgraded?.schemaVersion === 3) upgraded = { ...upgraded, schemaVersion: 4, calendarOverrides: upgraded.calendarOverrides ?? {} };
    return upgraded;
  }

  function loadState(storage) {
    let value;
    try {
      value = storage.getItem(STORAGE_KEY);
    } catch {
      return { state: null, error: 'ブラウザーの保存機能を利用できません。設定をご確認ください。' };
    }

    if (value === null) return { state: createInitialState(), error: null, raw: value };

    try {
      const state = upgradeState(JSON.parse(value));
      if (validateState(state)) return { state, error: null, raw: value };
    } catch {
      // Preserve the original value even when the stored JSON cannot be read.
    }
    return { state: null, error: '保存データを読み込めません。元のデータはブラウザーに残っています。' };
  }

  function saveState(storage, state) {
    if (!validateState(state)) throw new Error('保存データの形式が正しくありません。');
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function compareSessions(first, second) {
    return second.date.localeCompare(first.date) || Date.parse(second.completedAt) - Date.parse(first.completedAt);
  }

  function sortSessions(sessions) {
    return [...sessions].sort(compareSessions);
  }

  function getLatestDaySession(sessions, dayId) {
    let latest = null;
    for (const session of sessions) {
      if (session.planDayId === dayId && (!latest || compareSessions(session, latest) < 0)) latest = session;
    }
    return latest;
  }

  function getLatestExercise(sessions, exerciseId) {
    let latest = null;
    for (const session of sessions) {
      if (latest && compareSessions(session, latest.session) >= 0) continue;
      const exercise = session.exercises.find(item => item.exerciseId === exerciseId);
      if (exercise) latest = { session, exercise };
    }
    return latest;
  }

  function getWeeklyStats(sessions, date = new Date()) {
    const monday = new Date(date);
    monday.setHours(12, 0, 0, 0);
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    const nextMonday = new Date(monday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    const start = localDate(monday);
    const end = localDate(nextMonday);

    const totals = { sessions: 0, sets: 0, volume: 0 };
    for (const session of sessions) {
      if (session.date < start || session.date >= end) continue;
      totals.sessions += 1;
      for (const exercise of session.exercises) {
        totals.sets += exercise.sets.length;
        for (const { weight, reps } of exercise.sets) totals.volume += weight * reps;
      }
    }
    return totals;
  }

  function getProgress(sessions, exerciseId) {
    const points = [];
    for (const session of sortSessions(sessions).reverse()) {
      const exercise = session.exercises.find(item => item.exerciseId === exerciseId);
      if (!exercise) continue;
      const weight = exercise.sets.reduce((maximum, set) => Math.max(maximum, set.weight), 0);
      points.push({ date: session.date, weight });
    }
    return points;
  }

  const model = {
    STORAGE_KEY, SCHEMA_VERSION, MAX_NAME_LENGTH, PLAN_IDS, BODY_PARTS, createInitialState, createId, localDate, isLocalDate, formatDate,
    parseSet, validateState, loadState, saveState, sortSessions, getLatestDaySession, getLatestExercise, getWeeklyStats,
    getProgress,
  };
  if (typeof window !== 'undefined') window.FitnessModel = model;
  if (typeof module === 'object' && module.exports) module.exports = model;
})();
