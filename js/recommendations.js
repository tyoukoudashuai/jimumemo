/* 次回の提案は保存済みのトレーニングから計算し、記録や下書きには書き込まない。 */
(() => {
  'use strict';

  const DEFAULT_TARGETS = Object.freeze({
    targetRepMin: 8,
    targetRepMax: 12,
    targetRirMin: 1,
    targetRirMax: 3,
    weightIncrementKg: 2.5,
  });
  const DEFAULT_PREFERENCES = Object.freeze({ maxIncreasePercent: 5 });
  const DROP_REPS = 2;
  const HIGH_FATIGUE = 4;
  const formatter = new Intl.NumberFormat('ja-JP', { maximumSignificantDigits: 10 });
  const titles = {
    increase: '重量を上げる',
    'increase-reps': '回数を1回増やす',
    maintain: '現状を維持',
    deload: '負荷を抑えることを検討',
    insufficient: 'データ不足',
  };

  function validRir(value) {
    return Number.isInteger(value) && value >= 0 && value <= 10;
  }

  function validateTargets(targets) {
    if (!targets) return false;
    const { targetRepMin, targetRepMax, targetRirMin, targetRirMax, weightIncrementKg } = targets;
    return Number.isSafeInteger(targetRepMin) && targetRepMin > 0
      && Number.isSafeInteger(targetRepMax) && targetRepMax >= targetRepMin
      && validRir(targetRirMin) && validRir(targetRirMax) && targetRirMax >= targetRirMin
      && Number.isFinite(weightIncrementKg) && weightIncrementKg > 0;
  }

  function validatePreferences(preferences) {
    const limit = preferences?.maxIncreasePercent;
    return Number.isFinite(limit) && limit >= 0 && limit <= 100;
  }

  function workGroup(sets) {
    const valid = sets.filter(set => Number.isFinite(set?.weight) && set.weight >= 0
      && Number.isSafeInteger(set.reps) && set.reps > 0 && Number.isFinite(set.weight * set.reps));
    if (!valid.length) return null;

    const weight = valid.reduce((highest, set) => Math.max(highest, set.weight), 0);
    const workSets = valid.filter(set => set.weight === weight).map(set => ({
      reps: set.reps,
      rir: validRir(set.rir) ? set.rir : null,
    }));
    workSets.sort((a, b) => a.reps - b.reps || (a.rir ?? -1) - (b.rir ?? -1));

    // Pick a recorded set at the lower median repetition count, never a synthetic average.
    const medianReps = workSets[Math.floor((workSets.length - 1) / 2)].reps;
    const representative = workSets.find(set => set.reps === medianReps);
    const rirs = workSets.map(set => set.rir);
    return {
      weight,
      ...representative,
      setCount: workSets.length,
      minReps: workSets[0].reps,
      minRir: rirs.includes(null) ? null : rirs.reduce((lowest, rir) => Math.min(lowest, rir), 10),
      maxRir: rirs.includes(null) ? null : rirs.reduce((highest, rir) => Math.max(highest, rir), 0),
    };
  }

  function recentGroups(sessions, exerciseId) {
    const groups = [];
    for (const session of sessions) {
      if (!session || typeof session.sessionId !== 'string' || typeof session.date !== 'string'
        || !Array.isArray(session.exercises)) continue;
      const completed = Date.parse(session.completedAt);
      if (!Number.isFinite(completed)) continue;
      const exercise = session.exercises.find(item => item?.exerciseId === exerciseId);
      if (!Array.isArray(exercise?.sets)) continue;
      const group = workGroup(exercise.sets);
      if (group) groups.push({ ...group, sessionId: session.sessionId, date: session.date, completed });
    }
    return groups.sort((a, b) => b.date.localeCompare(a.date) || b.completed - a.completed
      || b.sessionId.localeCompare(a.sessionId)).slice(0, 3);
  }

  function snapshot(group) {
    if (!group) return null;
    const { sessionId, date, weight, reps, rir, setCount } = group;
    return { sessionId, date, weight, reps, rir, setCount };
  }

  function reserveLabel(group) {
    if (group.minRir === null) return 'RIRの記録がないセットあり';
    return group.minRir === group.maxRir ? `RIR ${group.minRir}` : `RIR ${group.minRir}〜${group.maxRir}`;
  }

  function weightLabel(weight) {
    return `${formatter.format(weight)} kg`;
  }

  function summarizeGroup(group) {
    const date = group.date.replaceAll('-', '/');
    return `${date}　${weightLabel(group.weight)}・${group.setCount}セット・${reserveLabel(group)}`;
  }

  function recommend({ sessions = [], exerciseId, targets, preferences = DEFAULT_PREFERENCES,
    fatigueBySessionId = {}, holdProgression = false } = {}) {
    const [latest, previous, earlier] = recentGroups(sessions, exerciseId);
    const reasons = [
      '各記録で最も重い重量帯のセットを比較します。回数比較には中央のセット（偶数の場合は少ない側）を使います。',
    ];
    const comparison = { latest: snapshot(latest), previous: snapshot(previous) };

    function result(kind, analysis, suggestion, next = null, evidence = []) {
      return { kind, title: titles[kind], analysis, suggestion, reasons: [...reasons, ...evidence], ...comparison, next };
    }

    if (!validateTargets(targets) || !validatePreferences(preferences)) {
      return result('insufficient', '目標設定を確認してください。', '目標回数、目標RIR、重量の刻み幅を設定すると判定できます。');
    }

    const { targetRepMin, targetRepMax, targetRirMin, targetRirMax, weightIncrementKg } = targets;
    reasons.push(`目標 ${targetRepMin}〜${targetRepMax}回・RIR ${targetRirMin}〜${targetRirMax}・重量の刻み幅 ${weightLabel(weightIncrementKg)}`);
    if (latest) reasons.push(`直近 ${summarizeGroup(latest)}`);
    if (previous) reasons.push(`前回 ${summarizeGroup(previous)}`);

    if (!previous) {
      return result('insufficient', '比較できるトレーニングがまだ2回分ありません。', '同じ重量での回数とRIRを記録しましょう。');
    }
    if (latest.weight !== previous.weight) {
      return result('insufficient', '直近2回の最も重い重量が異なります。', '同じ重量での記録がそろうと判定できます。');
    }
    if (latest.minRir === null || previous.minRir === null) {
      return result('insufficient', '比較対象のセットにRIRが未入力の記録があります。', '次回は回数とあわせてRIRを記録しましょう。');
    }

    const repDelta = latest.reps - previous.reps;
    const highFatigue = group => {
      const score = fatigueBySessionId?.[group.sessionId];
      return Number.isInteger(score) && score >= HIGH_FATIGUE && score <= 5;
    };
    const lowReserve = group => group.minRir === 0 || (group.minRir === 1 && group.minRir < targetRirMin);
    const repeatDrop = earlier?.weight === latest.weight && earlier.minRir !== null
      && earlier.reps - previous.reps >= DROP_REPS && repDelta <= -DROP_REPS;
    const repeatStrain = (lowReserve(previous) || highFatigue(previous)) && (lowReserve(latest) || highFatigue(latest));

    if (repeatDrop || repeatStrain) {
      const evidence = [];
      if (repeatDrop) {
        evidence.push(`同じ重量で代表セットの回数が2回連続で${DROP_REPS}回以上減少しました（${earlier.reps}回 → ${previous.reps}回 → ${latest.reps}回）。`);
      }
      if (repeatStrain) {
        evidence.push('直近2回で、RIR 0（目標を下回る場合は1も含む）または疲労の自己評価4以上が続きました。');
      }
      return result('deload', '同じ重量で、負担が大きい可能性を示す記録が続いています。',
        '次回は重量やセット数を抑えることを検討しましょう。体調やフォームも確認してください。', null, evidence);
    }

    const bothAboveRirMin = [latest, previous].every(group => group.minRir >= targetRirMin && group.minRir > 0);
    const latestFatigue = highFatigue(latest);
    const noClearDrop = repDelta > -DROP_REPS;
    const maintain = (analysis, suggestion = '次回も現在の重量と回数を目安にしましょう。', evidence = []) =>
      result('maintain', analysis, suggestion, { weight: latest.weight, reps: latest.reps }, evidence);

    if (holdProgression) {
      return result('maintain', '現在のコンディションに注意が必要です。',
        '重量や回数を増やすことは見送り、体調に合わせて休息や調整を検討しましょう。', null,
        ['最新のコンディションの自己評価を参考に、増量・回数追加を表示しません。']);
    }
    if (latestFatigue) {
      return maintain('最近の疲労の自己評価が高めです。', '次回は体調を確認し、重量や回数を増やすかは慎重に判断しましょう。',
        ['直近の疲労の自己評価が4以上でした。']);
    }
    if (!bothAboveRirMin || !noClearDrop) {
      return maintain(!bothAboveRirMin ? '比較対象にRIR 0または目標RIRを下回るセットがあります。'
        : `同じ重量で代表セットの回数が${Math.abs(repDelta)}回減りました。`,
      '次回は重量を維持し、回数を増やす前に体調とフォームを確認しましょう。');
    }

    const hitUpperLimit = [latest, previous].every(group => group.minReps >= targetRepMax);
    if (hitUpperLimit) {
      if (latest.weight === 0) {
        return maintain('自重種目で、直近2回とも目標の上限回数に達しました。', '現在の回数とフォームを維持しましょう。',
          ['0 kgで記録した種目には重量の加算を提案しません。']);
      }

      const increasePercent = weightIncrementKg / latest.weight * 100;
      const increasedWeight = Number((latest.weight + weightIncrementKg).toPrecision(15));
      if (increasePercent > preferences.maxIncreasePercent || increasedWeight <= latest.weight
        || !Number.isFinite(increasedWeight * targetRepMin)) {
        return maintain('直近2回とも目標の上限回数に達しました。', '現在の重量を維持し、利用できる刻み幅を確認しましょう。',
          [`設定の刻み幅が大きい場合は増量を見送ります（目安は現在の重量の${preferences.maxIncreasePercent}%まで）。`]);
      }

      return result('increase', '同じ重量で、直近2回とも全対象セットが目標上限の回数に達し、RIRにも余裕がありました。',
        `体調やフォームに問題がなければ、次回は${weightLabel(increasedWeight)}で${targetRepMin}回を目安に試せます。`,
        { weight: increasedWeight, reps: targetRepMin },
        [`対象セットのRIRは${Math.max(targetRirMin, 1)}以上でした。設定した刻み幅での増加率は約${formatter.format(increasePercent)}%です。`]);
    }

    const rirWithinRange = [latest, previous].every(group => group.maxRir <= targetRirMax);
    if (repDelta >= 0 && rirWithinRange && latest.reps < targetRepMax
      && Number.isFinite(latest.weight * (latest.reps + 1))) {
      const reps = latest.reps + 1;
      return result('increase-reps', repDelta > 0 ? '同じ重量で回数が増え、RIRも目標範囲内です。' : '同じ重量と回数で、RIRは目標範囲内です。',
        latest.weight === 0 ? `次回は自重のまま${reps}回を目安にしましょう。`
          : `次回も${weightLabel(latest.weight)}を維持し、${reps}回を目安にしましょう。`,
        { weight: latest.weight, reps }, ['目標の上限回数に達するまで、重量は維持して1回ずつ増やします。']);
    }

    return maintain('直近の記録からは、重量や回数を増やす条件がそろっていません。');
  }

  const recommendations = { DEFAULT_TARGETS, DEFAULT_PREFERENCES, validateTargets, validatePreferences, recommend };
  if (typeof window !== 'undefined') window.FitnessRecommendations = recommendations;
  if (typeof module === 'object' && module.exports) module.exports = recommendations;
})();
