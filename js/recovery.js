/* 候補日時は記録と設定間隔から計算し、コンディションは本人の入力だけを評価する。 */
(() => {
  'use strict';

  const HOUR_MS = 60 * 60 * 1000;
  const MIN_INTERVAL_HOURS = 1;
  const MAX_INTERVAL_HOURS = 8760;
  const CHECK_SCORE = 3;
  const REST_SCORE = 4;
  const SHORT_SLEEP_HOURS = 6;
  const LOW_SLEEP_QUALITY = 2;
  const MANY_SETS = 10;
  const LOW_RIR = 1;
  const DEFAULT_PREFERENCES = Object.freeze({
    defaultIntervalHours: 48,
    checkInMaxAgeHours: 24,
    dayIntervalsHours: Object.freeze({}),
  });
  const FEELINGS = Object.freeze({
    'very-good': 'とても良い',
    good: '良い',
    normal: '普通',
    tired: '疲れている',
    'very-tired': 'かなり疲れている',
  });
  const LABELS = {
    ready: 'トレーニング候補日です',
    check: 'コンディションを確認しましょう',
    rest: '休息・調整を検討',
  };
  const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 });

  function isRecord(value) {
    if (value === null || typeof value !== 'object') return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function isId(value) {
    return typeof value === 'string' && /^[a-z\d][a-z\d_-]*$/i.test(value)
      && !Object.hasOwn(Object.prototype, value);
  }

  function integerBetween(value, min, max) {
    return Number.isInteger(value) && value >= min && value <= max;
  }

  function validInterval(value) {
    return integerBetween(value, MIN_INTERVAL_HOURS, MAX_INTERVAL_HOURS);
  }

  function calendarParts(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000')) return null;
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) return null;
    return date.split('-').map(Number);
  }

  function isIsoTimestamp(value) {
    return typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      && calendarParts(value.slice(0, 10)) !== null && Number.isFinite(Date.parse(value));
  }

  function validatePreferences(preferences) {
    return isRecord(preferences) && validInterval(preferences.defaultIntervalHours)
      && validInterval(preferences.checkInMaxAgeHours) && isRecord(preferences.dayIntervalsHours)
      && Object.entries(preferences.dayIntervalsHours).every(([id, hours]) => isId(id) && validInterval(hours));
  }

  function validateCheckIn(checkIn, bodyParts) {
    if (!isRecord(checkIn) || !isId(checkIn.id) || !isIsoTimestamp(checkIn.recordedAt)) return false;
    const { sessionId, planDayId, dayName, fatigue, soreness, sleepHours, sleepQuality, feeling } = checkIn;
    return (sessionId === null || isId(sessionId)) && (planDayId === null || isId(planDayId))
      && (dayName === null || (typeof dayName === 'string' && dayName.trim().length > 0 && dayName.length <= 60))
      && (fatigue === null || integerBetween(fatigue, 0, 5))
      && isRecord(soreness) && Object.entries(soreness).every(([part, score]) => bodyParts.includes(part) && integerBetween(score, 0, 5))
      && (sleepHours === null || (Number.isFinite(sleepHours) && sleepHours >= 0 && sleepHours <= 24))
      && (sleepQuality === null || integerBetween(sleepQuality, 1, 5))
      && (feeling === null || (typeof feeling === 'string' && Object.hasOwn(FEELINGS, feeling)));
  }

  function sessionInstant(session) {
    const parts = calendarParts(session.date);
    if (typeof session.completedAt !== 'string') return null;
    const completed = new Date(session.completedAt);
    if (!parts || !Number.isFinite(completed.getTime())) return null;

    // History can reassign the workout day; the completion time supplies its local clock time.
    const [year, month, day] = parts;
    if (completed.getFullYear() !== year || completed.getMonth() !== month - 1 || completed.getDate() !== day) {
      completed.setFullYear(year, month - 1, day);
    }
    return completed;
  }

  function latestTraining(sessions, now, matches) {
    let session = null;
    let trainedAt = null;
    for (const workout of sessions) {
      if (!matches(workout)) continue;
      const date = sessionInstant(workout);
      if (date && date <= now && (trainedAt === null || date > trainedAt)) {
        session = workout;
        trainedAt = date;
      }
    }
    return { lastSession: session, lastTrainedAt: trainedAt, elapsedHours: trainedAt === null ? null : (now - trainedAt) / HOUR_MS };
  }

  function getNextTrainingDay(state, now = new Date()) {
    const plan = state.plans[state.activePlanId];
    if (!plan?.days.length) return null;
    const positions = new Map(plan.days.map((day, index) => [day.id, index]));
    const { lastSession } = latestTraining(state.sessions, now,
      session => session.planId === plan.id && positions.has(session.planDayId));
    const index = lastSession ? (positions.get(lastSession.planDayId) + 1) % plan.days.length : 0;
    return { day: plan.days[index], index };
  }

  function latestCheckIn(checkIns, now) {
    let latest = null;
    let latestTime = -Infinity;
    for (const checkIn of checkIns) {
      const time = Date.parse(checkIn.recordedAt);
      if (time <= now.getTime() && time >= latestTime) {
        latest = checkIn;
        latestTime = time;
      }
    }
    return { latest, latestTime };
  }

  function getCurrentCondition({ checkIns = [], parts = [], preferences = DEFAULT_PREFERENCES, now = new Date(), lastTrainedAt = null } = {}) {
    const { latest: checkIn, latestTime } = latestCheckIn(checkIns, now);
    const fatigue = checkIn?.fatigue ?? null;
    const sleepHours = checkIn?.sleepHours ?? null;
    const sleepQuality = checkIn?.sleepQuality ?? null;
    const feeling = checkIn?.feeling ?? null;
    const soreness = Object.fromEntries(parts.filter(part => Object.hasOwn(checkIn?.soreness ?? {}, part))
      .map(part => [part, checkIn.soreness[part]]));
    const stale = checkIn !== null && (now - latestTime > preferences.checkInMaxAgeHours * HOUR_MS
      || (lastTrainedAt !== null && latestTime < lastTrainedAt.getTime()));
    const highestSoreness = Math.max(0, ...Object.values(soreness));
    const severe = !stale && (fatigue >= REST_SCORE || highestSoreness >= REST_SCORE || feeling === 'very-tired');
    const moderate = !stale && (fatigue >= CHECK_SCORE || highestSoreness >= CHECK_SCORE || feeling === 'tired'
      || (sleepHours !== null && sleepHours < SHORT_SLEEP_HOURS) || (sleepQuality !== null && sleepQuality <= LOW_SLEEP_QUALITY));
    return { checkIn, fatigue, soreness, sleepHours, sleepQuality, feeling, stale, moderate, severe };
  }

  function workoutLoad(session) {
    if (session === null) return null;
    const load = { sets: 0, volume: 0, minRir: null };
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        load.sets += 1;
        load.volume += set.weight * set.reps;
        if (integerBetween(set.rir, 0, 10)) load.minRir = load.minRir === null ? set.rir : Math.min(load.minRir, set.rir);
      }
    }
    return load;
  }

  function workloadReasons(load) {
    if (!load) return [];
    const loadReason = Number.isFinite(load.volume)
      ? `直近のセッション全体は${load.sets}セット、重量×回数の合計は${numberFormat.format(load.volume)} kgでした。`
      : `直近のセッション全体は${load.sets}セットでした。重量×回数の合計は表示できる範囲を超えています。`;
    const rirReason = load.minRir === null ? 'RIRの記録はありません。' : `入力されたRIRの最低値は${load.minRir}でした。`;
    const notes = [loadReason, rirReason];
    if (load.sets >= MANY_SETS || (load.minRir !== null && load.minRir <= LOW_RIR)) {
      notes.push(`${MANY_SETS}セット以上、またはRIR ${LOW_RIR}以下の記録は負担を確認するための参考情報です。候補日時は設定した間隔で計算します。`);
    }
    return notes;
  }

  function getDayRecovery({ day, sessions = [], checkIns = [], preferences = DEFAULT_PREFERENCES, now = new Date() } = {}) {
    const parts = day?.parts ?? [];
    const intervalHours = preferences.dayIntervalsHours[day?.id] ?? preferences.defaultIntervalHours;
    const training = latestTraining(sessions, now, session => Boolean(day) && (parts.length
      ? parts.some(part => session.parts.includes(part)) : session.planDayId === day.id));
    const { lastSession, lastTrainedAt, elapsedHours } = training;
    const candidateAt = lastTrainedAt === null ? null : new Date(lastTrainedAt.getTime() + intervalHours * HOUR_MS);
    const condition = getCurrentCondition({ checkIns, parts, preferences, now, lastTrainedAt });
    const load = workoutLoad(lastSession);
    const reasons = [candidateAt
      ? `${parts.length ? '対象部位を最後にトレーニングした日時' : '同じトレーニング日の最終記録日時'}に、設定した${intervalHours}時間を加えています。`
      : '対象の完了記録がまだないため、候補日時は表示できません。'];
    const hasFullCondition = condition.fatigue !== null && parts.every(part => Object.hasOwn(condition.soreness, part));
    let status = 'check';

    if (condition.severe) {
      status = 'rest';
      reasons.push(`疲労または対象部位の筋肉痛が${REST_SCORE}以上、もしくは「${FEELINGS['very-tired']}」という報告があります。`,
        '強い痛みや普段と違う症状がある場合は、アプリの候補日を根拠にトレーニングを続けないでください。');
    } else if (condition.stale) {
      reasons.push(`最新のチェックが${preferences.checkInMaxAgeHours}時間を超えているか、対象の直近トレーニングより前です。現在の状態を確認してください。`);
    } else if (condition.moderate) {
      reasons.push(`疲労や対象部位の筋肉痛が${CHECK_SCORE}以上、「${FEELINGS.tired}」、睡眠が${SHORT_SLEEP_HOURS}時間未満、または睡眠の質が${LOW_SLEEP_QUALITY}以下の入力があります。`);
    } else if (!hasFullCondition) {
      reasons.push(parts.length ? '疲労と対象部位すべての筋肉痛を記録すると、現在の状態を確認できます。'
        : '現在の疲労が未入力です。コンディションを確認してください。');
    } else if (candidateAt && now >= candidateAt) {
      status = 'ready';
      reasons.push('設定間隔に達し、最新の自己評価に強い疲労や筋肉痛は報告されていません。');
    }

    if (candidateAt && now < candidateAt) reasons.push('設定間隔にまだ達していません。候補日時以降に状態を確認してください。');
    return { status, label: LABELS[status], intervalHours, lastSession, lastTrainedAt, candidateAt, elapsedHours,
      load, condition, reasons: [...reasons, ...workloadReasons(load)] };
  }

  function getMuscleRecovery({ part, sessions = [], checkIns = [], preferences = DEFAULT_PREFERENCES, now = new Date() } = {}) {
    const training = latestTraining(sessions, now, session => session.parts.includes(part));
    const condition = getCurrentCondition({ checkIns, parts: [part], preferences, now, lastTrainedAt: training.lastTrainedAt });
    return { part, ...training, condition };
  }

  function getFatigueBySessionId(checkIns = [], now = new Date()) {
    const mostRecent = new Map();
    for (const checkIn of checkIns) {
      const time = Date.parse(checkIn.recordedAt);
      const previous = mostRecent.get(checkIn.sessionId);
      if (checkIn.sessionId !== null && time <= now.getTime() && (!previous || time >= previous.time)) {
        mostRecent.set(checkIn.sessionId, { time, fatigue: checkIn.fatigue });
      }
    }
    return Object.fromEntries([...mostRecent].filter(([, record]) => integerBetween(record.fatigue, 0, 5))
      .map(([id, record]) => [id, record.fatigue]));
  }

  const recovery = { DEFAULT_PREFERENCES, MIN_INTERVAL_HOURS, MAX_INTERVAL_HOURS, FEELINGS,
    validatePreferences, validateCheckIn, getNextTrainingDay, getDayRecovery, getCurrentCondition,
    getMuscleRecovery, getFatigueBySessionId };
  if (typeof window !== 'undefined') window.FitnessRecovery = recovery;
  if (typeof module === 'object' && module.exports) module.exports = recovery;
})();
