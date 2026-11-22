(() => {
  'use strict';

  const engine = window.FitnessRecommendations;
  const dismissed = new Map();
  const targetFields = [
    { key: 'targetRepMin', label: '回数の下限', min: 1, step: 1 },
    { key: 'targetRepMax', label: '回数の上限', min: 1, step: 1 },
    { key: 'targetRirMin', label: 'RIRの下限', min: 0, max: 10, step: 1 },
    { key: 'targetRirMax', label: 'RIRの上限', min: 0, max: 10, step: 1 },
    { key: 'weightIncrementKg', label: '最小の増量幅（kg）', min: 0, step: 'any' },
  ];

  function targetsFor(state, exerciseId) {
    return state.exerciseTargets?.[exerciseId] ?? engine.DEFAULT_TARGETS;
  }

  function getRecommendation(app, exerciseId, day) {
    const recovery = window.FitnessRecovery;
    const exercise = app.state.exerciseCatalog.find(item => item.id === exerciseId);
    const parts = exercise?.parts.length ? exercise.parts : day?.parts ?? [];
    const { severe } = recovery.getCurrentCondition({
      checkIns: app.state.recoveryCheckIns,
      parts,
      preferences: app.state.recoveryPreferences,
    });
    return engine.recommend({
      sessions: app.state.sessions,
      exerciseId,
      targets: targetsFor(app.state, exerciseId),
      preferences: app.state.recommendationPreferences ?? engine.DEFAULT_PREFERENCES,
      fatigueBySessionId: recovery.getFatigueBySessionId(app.state.recoveryCheckIns),
      holdProgression: severe,
    });
  }

  function panelKey(day, exercise) {
    return `${day.id}/${exercise.id}`;
  }

  function signature(app, exercise, result) {
    return JSON.stringify([targetsFor(app.state, exercise.id), result]);
  }

  function hasDraft(card, rows = []) {
    return rows.some(row => row.weight !== '' || row.reps !== '' || row.rir !== '')
      || [...card.querySelectorAll('input[data-set-field]')].some(input => input.value !== '' || input.validity.badInput);
  }

  function refreshDraftState(card) {
    const button = card.querySelector('[data-training-action="apply-recommendation"]');
    if (!button) return;
    button.disabled = hasDraft(card);
    card.querySelector('[data-recommendation-draft-note]').hidden = !button.disabled;
  }

  function renderRecord(app, label, record) {
    return `<div>
      <dt>${label} <time datetime="${app.escape(record.date)}">${app.model.formatDate(record.date)}</time></dt>
      <dd><strong>${record.weight} kg × ${record.reps} 回</strong><span>RIR ${record.rir ?? '未入力'} · ${record.setCount} セットを参照</span></dd>
    </div>`;
  }

  function render(app, day, exercise, { open = false, reasonsOpen = false } = {}) {
    const result = getRecommendation(app, exercise.id, day);
    const { kind, title, latest, previous, next } = result;
    const ignored = dismissed.get(panelKey(day, exercise)) === signature(app, exercise, result);
    const rows = app.state.draftsByDayId[day.id]?.[exercise.id] ?? [];
    const draftActive = rows.some(row => row.weight !== '' || row.reps !== '' || row.rir !== '');
    const noteId = app.escape(`recommendation-draft-${day.id.length}-${day.id}-${exercise.id}`);
    const targetButton = '<button type="button" class="button button--secondary" data-training-action="edit-targets">目標を編集</button>';

    return `<details class="recommendation-panel" data-recommendation-panel data-recommendation-kind="${app.escape(kind)}" ${open ? 'open' : ''}>
      <summary class="recommendation-summary">
        <span class="recommendation-title">${app.icon('activity', 17)} 次回のトレーニング提案</span>
        <span class="recommendation-status tag">${ignored ? '見送り' : app.escape(title)}</span>
        ${app.icon('chevron-down', 16)}
      </summary>
      <div class="recommendation-body">
        ${ignored ? `
          <p class="form-help">この提案を見送りました。</p>
          <div class="recommendation-actions">
            <button type="button" class="button button--secondary" data-training-action="restore-recommendation">提案を表示</button>
            ${targetButton}
          </div>` : `
          ${latest ? `<dl class="recommendation-records">
            ${renderRecord(app, '今回', latest)}
            ${previous ? renderRecord(app, '前回', previous) : ''}
          </dl>` : ''}
          <dl class="recommendation-guidance">
            <div><dt>分析</dt><dd>${app.escape(result.analysis)}</dd></div>
            <div><dt>提案</dt><dd>${app.escape(result.suggestion)}</dd></div>
          </dl>
          <details class="recommendation-reasons" data-recommendation-reasons ${reasonsOpen ? 'open' : ''}>
            <summary>提案の理由を見る</summary>
            <ul class="recommendation-reason-list">${result.reasons.map(reason => `<li>${app.escape(reason)}</li>`).join('')}</ul>
          </details>
          <div class="recommendation-actions">
            ${next ? `<button type="button" class="button button--primary" data-training-action="apply-recommendation" aria-describedby="${noteId}" ${draftActive ? 'disabled' : ''}>下書きに反映</button>` : ''}
            ${targetButton}
            ${kind === 'insufficient' ? '' : '<button type="button" class="button button--ghost" data-training-action="dismiss-recommendation">今回は見送る</button>'}
          </div>
          ${next ? `<p class="form-help" id="${noteId}" data-recommendation-draft-note ${draftActive ? '' : 'hidden'}>入力中の下書きには反映できません。</p>` : ''}
        `}
      </div>
    </details>`;
  }

  function replacePanel(app, day, exercise, card) {
    const panel = card.querySelector('[data-recommendation-panel]');
    panel.outerHTML = render(app, day, exercise, {
      open: panel.open,
      reasonsOpen: panel.querySelector('[data-recommendation-reasons]')?.open,
    });
    refreshDraftState(card);
  }

  function editTargets(app, exercise, card) {
    const targets = targetsFor(app.state, exercise.id);
    app.openDialog({
      title: '種目の目標を編集',
      html: `<div class="form-grid">
        <div><p>${app.escape(card.querySelector('h3').textContent)}</p>
          <p class="form-help">同じ種目を登録した各プランで共通の目標です。</p></div>
        <div class="recommendation-target-fields">
          ${targetFields.map(({ key, label, min, max, step }) => `<label class="field">
            <span>${label}</span>
            <input type="number" name="${key}" inputmode="${step === 'any' ? 'decimal' : 'numeric'}"
              min="${min}" ${max === undefined ? '' : `max="${max}"`} step="${step}" required value="${targets[key]}">
          </label>`).join('')}
        </div>
      </div>`,
      submitLabel: '変更を保存',
      onSubmit(form) {
        const values = {};
        for (const { key } of targetFields) {
          values[key] = form.elements.namedItem(key).valueAsNumber;
        }
        if (!engine.validateTargets(values)) {
          app.dialogError('回数は1以上の整数、RIRは0〜10の整数で、下限が上限以下になるよう設定してください。増量幅は0より大きい数値を入力してください。');
          return false;
        }

        const saved = app.commit(state => { state.exerciseTargets[exercise.id] = values; }, { render: false });
        if (!saved) return false;

        const plan = app.state.plans[app.state.activePlanId];
        for (const exerciseCard of app.root.querySelectorAll('[data-exercise-id]')) {
          if (exerciseCard.dataset.exerciseId !== exercise.id) continue;
          const dayId = exerciseCard.closest('[data-day-id]').dataset.dayId;
          replacePanel(app, plan.days.find(day => day.id === dayId), exercise, exerciseCard);
        }

        const dialog = form.closest('dialog');
        dialog.addEventListener('close', () => {
          if (!dialog.open) card.querySelector('[data-training-action="edit-targets"]')?.focus({ preventScroll: true });
        }, { once: true });
        app.notify('種目の目標を保存しました。');
        return true;
      },
    });
  }

  function handleAction(app, day, exercise, card, action) {
    if (action === 'edit-targets') {
      editTargets(app, exercise, card);
      return;
    }

    const key = panelKey(day, exercise);
    const isDismissing = action === 'dismiss-recommendation';
    if (isDismissing) dismissed.set(key, signature(app, exercise, getRecommendation(app, exercise.id, day)));
    else dismissed.delete(key);

    replacePanel(app, day, exercise, card);
    const nextAction = isDismissing ? 'restore-recommendation' : 'dismiss-recommendation';
    card.querySelector(`[data-training-action="${nextAction}"]`)?.focus({ preventScroll: true });
  }

  window.FitnessRecommendationView = { render, getRecommendation, hasDraft, refreshDraftState, handleAction };
})();
