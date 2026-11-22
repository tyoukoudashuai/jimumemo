(() => {
  'use strict';

  const planner = window.FitnessRecovery;
  const fullDate = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const shortDate = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });

  function context(app, now = new Date()) {
    return {
      sessions: app.state.sessions,
      checkIns: app.state.recoveryCheckIns ?? [],
      preferences: app.state.recoveryPreferences ?? planner.DEFAULT_PREFERENCES,
      now,
    };
  }

  function nextWorkout(app, args) {
    const next = planner.getNextTrainingDay(app.state, args.now);
    return next && { ...next, recovery: planner.getDayRecovery({ ...args, day: next.day }) };
  }

  function findDay(state, dayId) {
    return Object.values(state.plans).flatMap(plan => plan.days).find(day => day.id === dayId);
  }

  function renderTime(date, { compact = false, candidate = false } = {}) {
    if (!date) return candidate ? '<span data-recovery-candidate="">未算出</span>' : '<span>記録なし</span>';
    const iso = date.toISOString();
    return `<time datetime="${iso}"${candidate ? ` data-recovery-candidate="${iso}"` : ''}>${(compact ? shortDate : fullDate).format(date)}</time>`;
  }

  function elapsedLabel(hours) {
    if (hours === null) return '';
    const whole = Math.floor(hours);
    if (whole < 1) return '1時間未満';
    if (whole < 24) return `${whole}時間経過`;
    const days = Math.floor(whole / 24);
    return `${days}日${whole % 24 ? ` ${whole % 24}時間` : ''}経過`;
  }

  function statusLabel(app, recovery) {
    return `<span class="recovery-status" data-recovery-status="${app.escape(recovery.status)}">${app.escape(recovery.label)}</span>`;
  }

  function tags(app, parts) {
    return parts.map(part => `<span class="tag">${app.escape(part)}</span>`).join('');
  }

  function reasons(app, recovery) {
    return `<details class="recovery-reasons">
      <summary>判断理由を見る</summary>
      <ul>${recovery.reasons.map(reason => `<li>${app.escape(reason)}</li>`).join('')}</ul>
    </details>`;
  }

  function recoveryFacts(recovery, compact = false) {
    return `<div><dt>対象部位の最終記録</dt><dd>${renderTime(recovery.lastTrainedAt, { compact })}</dd></div>
      <div><dt>次回の候補日</dt><dd>${renderTime(recovery.candidateAt, { compact, candidate: true })}</dd></div>`;
  }

  function renderDaySummary(app, day) {
    const recovery = planner.getDayRecovery({ ...context(app), day });
    return `<section class="recovery-day-summary" aria-label="この日のリカバリー" data-recovery-day-summary>
      <dl class="recovery-day-facts">
        ${recoveryFacts(recovery, true)}
        <div><dt>現在のコンディション</dt><dd>${statusLabel(app, recovery)}</dd></div>
      </dl>
      <div class="recovery-day-actions">
        <button type="button" class="button button--secondary" data-training-action="edit-recovery-interval">${app.icon('clock', 15)} 設定間隔 ${recovery.intervalHours}時間</button>
        ${reasons(app, recovery)}
      </div>
    </section>`;
  }

  function renderDashboard(app) {
    const next = nextWorkout(app, context(app));
    return `<section class="surface recovery-dashboard" aria-labelledby="recovery-dashboard-title">
      <span class="recovery-dashboard-icon">${app.icon('calendar', 19)}</span>
      <div>
        <h2 id="recovery-dashboard-title">次回のトレーニング</h2>
        ${next ? `<p class="recovery-dashboard-name">${app.escape(next.day.name)}</p><div class="recovery-parts">${tags(app, next.day.parts)}</div>`
          : '<p class="form-help">トレーニング日がありません。</p>'}
      </div>
      ${next ? `<div class="recovery-dashboard-date"><span>次回の候補日</span>${renderTime(next.recovery.candidateAt, { compact: true, candidate: true })}${statusLabel(app, next.recovery)}</div>` : ''}
      <button type="button" class="button button--secondary recovery-dashboard-cta" data-page="recovery" data-recovery-check${next ? ` data-recovery-day="${app.escape(next.day.id)}"` : ''}>コンディションを確認 ${app.icon('arrow-right', 15)}</button>
    </section>`;
  }

  function renderNext(app, next) {
    if (!next) return `<section class="surface recovery-panel" aria-labelledby="recovery-next-title">
      <h2 class="section-title" id="recovery-next-title">次回のトレーニング</h2>
      <p class="form-help">現在のプランにトレーニング日がありません。</p>
      <button type="button" class="button button--secondary" data-page="training">トレーニングプランを開く</button>
    </section>`;

    const { day, index, recovery } = next;
    return `<section class="surface recovery-panel" aria-labelledby="recovery-next-title">
      <div class="recovery-panel-heading">
        <h2 class="section-title" id="recovery-next-title">次回のトレーニング</h2>
        <span class="tag">DAY ${String(index + 1).padStart(2, '0')}</span>
      </div>
      <div class="recovery-next-day"><h3>${app.escape(day.name)}</h3><div class="recovery-parts">${tags(app, day.parts)}</div></div>
      <dl class="recovery-next-facts">
        ${recoveryFacts(recovery)}
        <div><dt>設定間隔</dt><dd>${recovery.intervalHours}時間</dd></div>
      </dl>
      <div class="recovery-next-actions">
        ${statusLabel(app, recovery)}
        <button type="button" class="button button--secondary" data-recovery-action="edit-interval" data-recovery-day="${app.escape(day.id)}">設定間隔を編集</button>
      </div>
      ${reasons(app, recovery)}
      ${recovery.status === 'rest' ? '<p class="recovery-rest-note">普段と違う強い症状がある場合は、アプリの提案を頼りにトレーニングを続けないでください。</p>' : ''}
    </section>`;
  }

  function checkInMetrics(app, checkIn) {
    const metrics = [];
    if (checkIn.fatigue !== null) metrics.push(`疲労 ${checkIn.fatigue}/5`);
    for (const [part, score] of Object.entries(checkIn.soreness)) metrics.push(`${part}の筋肉痛 ${score}/5`);
    if (checkIn.sleepHours !== null) metrics.push(`睡眠 ${checkIn.sleepHours}時間`);
    if (checkIn.sleepQuality !== null) metrics.push(`睡眠の質 ${checkIn.sleepQuality}/5`);
    if (checkIn.feeling !== null) metrics.push(planner.FEELINGS[checkIn.feeling]);
    return metrics.length ? `<ul class="recovery-metrics">${metrics.map(value => `<li class="tag">${app.escape(value)}</li>`).join('')}</ul>`
      : '<p class="form-help">入力された項目はありません。</p>';
  }

  function renderCurrent(app, next, args) {
    const condition = next?.recovery.condition ?? planner.getCurrentCondition({ ...args, parts: [] });
    const checkIn = condition.checkIn;
    return `<section class="surface recovery-panel recovery-current" aria-labelledby="recovery-current-title">
      <h2 class="section-title" id="recovery-current-title">コンディションチェック</h2>
      ${checkIn ? `<div class="recovery-current-date"><span>最新の自己評価</span>${renderTime(new Date(checkIn.recordedAt))}${condition.stale ? '<span class="tag">再確認が必要</span>' : ''}</div>
        ${checkInMetrics(app, checkIn)}` : '<p class="form-help">自己評価はまだありません。疲労や筋肉痛など、気になる項目から記録できます。</p>'}
      <p class="form-help">候補日は設定間隔をもとにした日程の目安です。現在の状態は自己評価で確認してください。</p>
      <button type="button" class="button button--primary" data-recovery-action="check-in">${app.icon('plus', 16)} コンディションを入力</button>
    </section>`;
  }

  function renderMuscle(app, part, args) {
    const { lastTrainedAt, elapsedHours, condition } = planner.getMuscleRecovery({ ...args, part });
    const score = condition.soreness[part];
    return `<article class="surface recovery-muscle" data-recovery-part="${app.escape(part)}">
      <h3>${app.escape(part)}</h3>
      <div>${renderTime(lastTrainedAt, { compact: true })}${lastTrainedAt ? `<p class="form-help">${elapsedLabel(elapsedHours)}</p>` : ''}</div>
      <p class="recovery-muscle-condition">${score === undefined ? '筋肉痛の自己評価なし' : `筋肉痛 ${score}/5${condition.stale ? '（再確認が必要）' : ''}`}</p>
    </article>`;
  }

  function renderRecord(app, checkIn) {
    const source = checkIn.sessionId ? 'トレーニング後' : 'コンディションチェック';
    return `<article class="surface recovery-record" data-recovery-record>
      <div>
        <h3>${checkIn.dayName ? app.escape(checkIn.dayName) : source}</h3>
        <p class="form-help">${renderTime(new Date(checkIn.recordedAt))}${checkIn.dayName ? ` · ${source}` : ''}</p>
        ${checkInMetrics(app, checkIn)}
      </div>
      <button type="button" class="button button--secondary" data-recovery-action="edit-check-in" data-check-in-id="${app.escape(checkIn.id)}">${app.icon('edit', 15)} 編集</button>
    </article>`;
  }

  function render(app) {
    const args = context(app);
    const next = nextWorkout(app, args);
    const history = [...args.checkIns].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    return `<header class="page-heading">
      <h1 class="page-title">リカバリー</h1>
      <p class="page-description">トレーニング間隔とコンディションを確認し、次の予定を立てましょう。</p>
    </header>
    <div class="recovery-overview">${renderNext(app, next)}${renderCurrent(app, next, args)}</div>
    <section class="recovery-section" aria-labelledby="recovery-muscles-title">
      <h2 class="section-title" id="recovery-muscles-title">部位ごとのリカバリー</h2>
      <div class="recovery-muscles">${app.model.BODY_PARTS.map(part => renderMuscle(app, part, args)).join('')}</div>
    </section>
    <section class="recovery-section" aria-labelledby="recovery-history-title">
      <h2 class="section-title" id="recovery-history-title">コンディション履歴</h2>
      ${history.length ? `<div class="recovery-history">${history.map(checkIn => renderRecord(app, checkIn)).join('')}</div>`
        : '<div class="surface recovery-empty"><p>コンディションの記録はまだありません。</p></div>'}
    </section>`;
  }

  function scaleOptions(min, max, value, labels = {}) {
    let options = '<option value="">未入力</option>';
    for (let score = min; score <= max; score += 1) {
      options += `<option value="${score}"${score === value ? ' selected' : ''}>${score}${labels[score] ? ` — ${labels[score]}` : ''}</option>`;
    }
    return options;
  }

  function optionalNumber(fields, name) {
    const value = fields.get(name);
    return value === null || value === '' ? null : Number(value);
  }

  function openCheckIn(app, { day = null, session = null, checkIn = null } = {}) {
    const linkedSession = session ?? app.state.sessions.find(record => record.sessionId === checkIn?.sessionId);
    const linkedDay = day ?? findDay(app.state, checkIn?.planDayId);
    const related = linkedSession?.parts ?? linkedDay?.parts ?? [];
    const knownParts = new Set([...related, ...Object.keys(checkIn?.soreness ?? {})]);
    const parts = related.length ? app.model.BODY_PARTS.filter(part => knownParts.has(part)) : app.model.BODY_PARTS;
    const dayName = checkIn ? checkIn.dayName : linkedSession?.dayName ?? linkedDay?.name ?? null;
    const sorenessOptions = { 0: 'なし', 5: '非常に強い' };

    app.openDialog({
      title: checkIn ? 'コンディションを編集' : session ? 'トレーニング後のコンディション' : 'コンディションチェック',
      cancelLabel: session ? 'スキップ' : 'キャンセル',
      submitLabel: '保存',
      html: `<div class="form-grid">
        <div>${dayName ? `<p><strong>${app.escape(dayName)}</strong></p>` : ''}<p class="form-help">入力は任意です。気になる項目だけ記録できます。</p>${session ? '<p class="form-help">保存すると疲労を参考にカレンダーの次回予定を更新します。</p>' : ''}</div>
        <div class="recovery-form-fields">
          <label class="field"><span>身体の疲労（0〜5）</span><select name="fatigue">${scaleOptions(0, 5, checkIn?.fatigue, { 0: 'ほとんどない', 5: '非常に強い' })}</select></label>
          <label class="field"><span>体感</span><select name="feeling"><option value="">未入力</option>${Object.entries(planner.FEELINGS).map(([value, label]) => `<option value="${app.escape(value)}"${value === checkIn?.feeling ? ' selected' : ''}>${app.escape(label)}</option>`).join('')}</select></label>
        </div>
        <fieldset class="recovery-form-soreness">
          <legend>部位ごとの筋肉痛（0〜5）</legend>
          <div class="recovery-form-fields">
            ${parts.map(part => `<label class="field"><span>${app.escape(part)}</span><select name="soreness-${app.escape(part)}">${scaleOptions(0, 5, checkIn?.soreness[part], sorenessOptions)}</select></label>`).join('')}
          </div>
        </fieldset>
        <div class="recovery-form-fields">
          <label class="field"><span>昨晩の睡眠時間</span><input name="sleepHours" type="number" min="0" max="24" step="any" inputmode="decimal" placeholder="時間" value="${app.escape(checkIn?.sleepHours ?? '')}"></label>
          <label class="field"><span>睡眠の質（1〜5）</span><select name="sleepQuality">${scaleOptions(1, 5, checkIn?.sleepQuality, { 1: '低い', 5: '高い' })}</select></label>
        </div>
      </div>`,
      onSubmit(form) {
        const fields = new FormData(form);
        const soreness = {};
        for (const part of parts) {
          const score = optionalNumber(fields, `soreness-${part}`);
          if (score !== null) soreness[part] = score;
        }
        const entry = {
          id: checkIn?.id ?? app.model.createId('check-in'),
          recordedAt: checkIn?.recordedAt ?? new Date().toISOString(),
          sessionId: checkIn ? checkIn.sessionId : linkedSession?.sessionId ?? null,
          planDayId: checkIn ? checkIn.planDayId : linkedSession?.planDayId ?? linkedDay?.id ?? null,
          dayName,
          fatigue: optionalNumber(fields, 'fatigue'),
          soreness,
          sleepHours: optionalNumber(fields, 'sleepHours'),
          sleepQuality: optionalNumber(fields, 'sleepQuality'),
          feeling: fields.get('feeling') || null,
        };

        if (form.elements.namedItem('sleepHours').validity.badInput || !planner.validateCheckIn(entry, app.model.BODY_PARTS)) {
          app.dialogError('数値を確認してください。睡眠時間は0〜24時間で入力できます。');
          return false;
        }
        if (!checkIn && entry.fatigue === null && Object.keys(entry.soreness).length === 0
          && entry.sleepHours === null && entry.sleepQuality === null && entry.feeling === null) return true;

        const saved = app.commit(state => {
          if (checkIn) {
            const index = state.recoveryCheckIns.findIndex(record => record.id === checkIn.id);
            state.recoveryCheckIns[index] = entry;
          } else {
            state.recoveryCheckIns.push(entry);
          }
        });
        if (saved) app.notify('コンディションを保存しました。');
        return saved;
      },
    });
  }

  function openInterval(app, day) {
    const { intervalHours } = planner.getDayRecovery({ ...context(app), day });
    const presetHours = [48, 72];
    app.openDialog({
      title: '設定間隔を編集',
      submitLabel: '変更を保存',
      html: `<div class="form-grid">
        <div><p><strong>${app.escape(day.name)}</strong></p><p class="form-help">予定を立てるときに空けたい時間を設定します。</p></div>
        <div class="recovery-interval-presets" role="group" aria-label="間隔のプリセット">
          ${presetHours.map(hours => `<button type="button" class="button button--secondary" data-recovery-interval-preset="${hours}" aria-pressed="${hours === intervalHours}">${hours}時間</button>`).join('')}
        </div>
        <label class="field"><span>間隔（時間）</span><input type="number" name="intervalHours" min="${planner.MIN_INTERVAL_HOURS}" max="${planner.MAX_INTERVAL_HOURS}" step="1" inputmode="numeric" value="${intervalHours}" required></label>
      </div>`,
      onOpen(form) {
        const input = form.elements.namedItem('intervalHours');
        const buttons = [...form.querySelectorAll('[data-recovery-interval-preset]')];
        function updatePresets() {
          for (const button of buttons) button.setAttribute('aria-pressed', String(input.valueAsNumber === Number(button.dataset.recoveryIntervalPreset)));
        }
        input.addEventListener('input', updatePresets);
        for (const button of buttons) button.addEventListener('click', () => {
          input.value = button.dataset.recoveryIntervalPreset;
          updatePresets();
        });
      },
      onSubmit(form) {
        const hours = form.elements.namedItem('intervalHours').valueAsNumber;
        if (!Number.isSafeInteger(hours) || hours < planner.MIN_INTERVAL_HOURS || hours > planner.MAX_INTERVAL_HOURS) {
          app.dialogError(`間隔は${planner.MIN_INTERVAL_HOURS}〜${planner.MAX_INTERVAL_HOURS}時間の整数で入力してください。`);
          return false;
        }
        const saved = app.commit(state => { state.recoveryPreferences.dayIntervalsHours[day.id] = hours; });
        if (saved) app.notify('設定間隔を保存しました。');
        return saved;
      },
    });
  }

  function bind(app) {
    app.root.onclick = event => {
      const button = event.target.closest('button[data-recovery-action]');
      if (!button) return;

      const day = findDay(app.state, button.dataset.recoveryDay);
      switch (button.dataset.recoveryAction) {
        case 'check-in':
          openCheckIn(app, { day });
          break;
        case 'edit-interval':
          if (day) openInterval(app, day);
          break;
        case 'edit-check-in': {
          const checkIn = app.state.recoveryCheckIns.find(record => record.id === button.dataset.checkInId);
          if (checkIn) openCheckIn(app, { checkIn });
          break;
        }
      }
    };
  }

  window.FitnessRecoveryView = { render, bind, renderDaySummary, renderDashboard, openCheckIn, openInterval };
})();
