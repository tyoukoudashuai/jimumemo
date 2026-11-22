(function () {
  'use strict';

  const recommendationView = window.FitnessRecommendationView;
  const recoveryView = window.FitnessRecoveryView;
  const setFields = [
    { key: 'weight', label: '重量 (kg)', keyboard: 'decimal', step: 'any' },
    { key: 'reps', label: '回数', keyboard: 'numeric', min: 1, step: 1 },
    { key: 'rir', label: 'RIR', keyboard: 'numeric', max: 10, step: 1 },
  ];
  const partIcons = { 胸: 'chest', 背中: 'back', 肩: 'shoulders', 脚: 'legs', 腹筋: 'core', 二頭筋: 'arm', 三頭筋: 'arm' };

  function currentPlan(state) {
    return state.plans[state.activePlanId];
  }

  function blankRow(id) {
    return { id, weight: '', reps: '', rir: '' };
  }

  function getRows(state, dayId, exerciseId) {
    return state.draftsByDayId[dayId]?.[exerciseId]
      ?? [blankRow(`set-initial-${dayId.length}-${dayId}-${exerciseId}`)];
  }

  function setRows(state, dayId, exerciseId, rows) {
    const dayDraft = state.draftsByDayId[dayId] ??= {};
    dayDraft[exerciseId] = rows;
  }

  function eraseExerciseDraft(state, dayId, exerciseId) {
    const draft = state.draftsByDayId[dayId];
    if (!draft) return;

    delete draft[exerciseId];
    if (Object.keys(draft).length === 0) delete state.draftsByDayId[dayId];
  }

  function exerciseName(day, exercise) {
    return day.exerciseNames?.[exercise.id] ?? exercise.name;
  }

  function dateText(date) {
    return date.replaceAll('-', '/');
  }

  function render(app) {
    const { state, model, icon, escape } = app;
    const plan = currentPlan(state);
    return `
      <section aria-labelledby="training-title">
        <header class="page-heading">
          <div>
            <h1 class="page-title" id="training-title">トレーニングプラン</h1>
            <p class="page-description">トレーニング日を組み立て、種目ごとにセットを記録できます。</p>
          </div>
        </header>
        <div class="training-plan-bar">
          <div class="plan-switcher" role="group" aria-label="分割プラン">
            ${model.PLAN_IDS.map(id => `
              <button type="button" class="plan-tab" aria-pressed="${id === plan.id}"
                data-training-action="switch-plan" data-plan-id="${escape(id)}">${escape(state.plans[id].name)}</button>
            `).join('')}
          </div>
          <button type="button" class="button button--secondary" data-training-action="add-day">
            ${icon('plus', 18)} トレーニング日を追加
          </button>
        </div>
        <div class="training-days">
          ${plan.days.length ? plan.days.map((day, index) => renderDay(app, day, index, plan.days.length)).join('') : `
            <div class="surface empty-state">
              ${icon('calendar', 28)}
              <h2>トレーニング日がありません</h2>
              <p>トレーニング日を追加してプランを作成できます。</p>
            </div>
          `}
        </div>
      </section>
    `;
  }

  function renderDay(app, day, index, totalDays) {
    const { state, model, icon, escape } = app;
    const prev = model.getLatestDaySession(state.sessions, day.id);
    const catalog = new Map(state.exerciseCatalog.map(exercise => [exercise.id, exercise]));
    const dayTitle = `day-title-${day.id}`;
    return `
      <article class="surface training-day" data-day-id="${escape(day.id)}" aria-labelledby="${escape(dayTitle)}">
        <header class="training-day-header">
          <div class="training-day-identity">
            <span class="training-day-icon">${icon(partIcons[day.parts[0]] ?? 'dumbbell', 24)}</span>
            <div class="training-day-title-group">
              <span class="training-day-number">DAY ${String(index + 1).padStart(2, '0')}</span>
              <h2 id="${escape(dayTitle)}">${escape(day.name)}</h2>
            </div>
          </div>
          <div class="training-day-actions">
            <div class="day-move-actions" role="group" aria-label="トレーニング日の表示順">
              ${actionIcon(app, 'move-up', 'chevron-up', '上に移動', index === 0)}
              ${actionIcon(app, 'move-down', 'chevron-down', '下に移動', index === totalDays - 1)}
            </div>
            ${actionIcon(app, 'edit-day', 'edit', 'トレーニング日を編集')}
            ${actionIcon(app, 'delete-day', 'trash', 'トレーニング日を削除')}
            <span class="icon-button drag-handle" title="ドラッグして並べ替え" draggable="true"
              aria-hidden="true" data-drag-day="${escape(day.id)}">${icon('grip', 18)}</span>
          </div>
        </header>
        <div class="training-day-meta">
          <div class="training-day-parts">
            ${day.parts.map(part => `<span class="tag">${escape(part)}</span>`).join('')}
          </div>
          <div class="training-day-last">${icon('clock', 15)}
            <span>前回のトレーニング ${prev ? dateText(prev.date) : '記録なし'}</span>
          </div>
        </div>
        ${recoveryView.renderDaySummary(app, day)}
        <div class="training-exercises">
          ${day.exerciseIds.length
            ? day.exerciseIds.map(id => renderExercise(app, day, catalog.get(id))).join('')
            : `<p class="training-no-exercises">この日に記録する種目を追加してください。</p>`}
        </div>
        <p class="training-day-error" role="alert" data-day-error hidden></p>
        <footer class="training-day-footer">
          <button type="button" class="button button--secondary" data-training-action="add-exercise">
            ${icon('plus', 18)} 種目を追加
          </button>
          <button type="button" class="button button--primary" data-training-action="complete-day"
            ${day.exerciseIds.length ? '' : 'disabled'}>
            ${icon('check', 18)} トレーニング完了
          </button>
        </footer>
      </article>
    `;
  }

  function actionIcon(app, action, name, label, disabled = false) {
    return `<button type="button" class="icon-button" data-training-action="${action}"
      title="${label}" aria-label="${label}" ${disabled ? 'disabled' : ''}>${app.icon(name, 18)}</button>`;
  }

  function renderExercise(app, day, exercise) {
    const { state, model, icon, escape } = app;
    const name = exerciseName(day, exercise);
    const previous = model.getLatestExercise(state.sessions, exercise.id);
    const rows = getRows(state, day.id, exercise.id);
    return `
      <section class="training-exercise" data-exercise-id="${escape(exercise.id)}">
        <header class="exercise-heading">
          <div class="exercise-name">
            ${icon('dumbbell', 17)}
            <h3>${escape(name)}</h3>
          </div>
          <div class="exercise-actions">
            ${actionIcon(app, 'edit-exercise', 'edit', '種目名を編集')}
            ${actionIcon(app, 'delete-exercise', 'trash', '種目を削除')}
          </div>
        </header>
        ${renderPrevious(app, previous)}
        <div class="set-table">
          <div class="set-row set-table-head" aria-hidden="true">
            <span>セット</span><span>重量 (kg)</span><span>回数</span><span>RIR</span><span></span>
          </div>
          ${rows.map((row, index) => renderSet(app, row, index, name, day.id, exercise.id)).join('')}
        </div>
        ${rows.length ? '' : '<p class="set-empty">セットがありません。</p>'}
        <div class="exercise-set-tools">
          <button type="button" class="button button--ghost" data-training-action="add-set">
            ${icon('plus', 16)} セットを追加
          </button>
          <span class="rir-help" id="${escape(`rir-help-${day.id}-${exercise.id}`)}">${icon('info', 14)} RIRはあと何回できるかの目安。</span>
        </div>
        ${recommendationView.render(app, day, exercise)}
      </section>
    `;
  }

  function renderPrevious(app, previous) {
    if (!previous) {
      return `<div class="last-performance"><span class="last-performance-label">前回</span><span>記録なし</span></div>`;
    }

    const { session, exercise } = previous;
    return `
      <div class="last-performance">
        <span class="last-performance-label">前回</span>
        <span>${dateText(session.date)} ・ ${exercise.sets.length}セット</span>
        <ul class="last-performance-sets">
          ${exercise.sets.map((set, index) => `<li><span class="previous-set-index">${index + 1}</span><strong>${set.weight} <small>kg</small></strong><span>× ${set.reps}回</span><span class="tag">RIR ${set.rir === null ? '—' : set.rir}</span></li>`).join('')}
        </ul>
      </div>
    `;
  }

  function renderSet(app, row, index, name, dayId, exerciseId) {
    const { escape } = app;
    return `
      <div class="set-row" data-set-id="${escape(row.id)}">
        <span class="set-number">${index + 1}</span>
        ${setFields.map(field => `
          <input type="number" class="set-input" data-set-field="${field.key}" inputmode="${field.keyboard}"
            min="${field.min ?? 0}" ${field.max == null ? '' : `max="${field.max}"`} step="${field.step}"
            aria-label="${escape(`${name} セット${index + 1} ${field.label}`)}"
            ${field.key === 'rir' ? `aria-describedby="${escape(`rir-help-${dayId}-${exerciseId}`)}"` : ''}
            placeholder="–" value="${escape(row[field.key])}">
        `).join('')}
        <div class="set-actions">
          ${actionIcon(app, 'copy-set', 'copy', 'セットを複製')}
          ${actionIcon(app, 'delete-set', 'trash', 'セットを削除')}
        </div>
      </div>
    `;
  }

  function partOptions(app, selected, legend) {
    return `
      <fieldset class="part-options">
        <legend>${legend}</legend>
        <div class="part-option-list">
          ${app.model.BODY_PARTS.map(part => `
            <label class="part-option">
              <input type="checkbox" name="parts" value="${app.escape(part)}" ${selected.includes(part) ? 'checked' : ''}>
              <span>${app.escape(part)}</span>
            </label>
          `).join('')}
        </div>
      </fieldset>
    `;
  }

  function editDay(app, day) {
    const limit = app.model.MAX_NAME_LENGTH;
    app.openDialog({
      title: day ? 'トレーニング日を編集' : 'トレーニング日を追加',
      html: `
        <div class="form-grid">
          <label class="field">
            <span>トレーニング日名</span>
            <input name="name" required maxlength="${limit}" placeholder="例　胸・肩" value="${app.escape(day?.name ?? '')}">
          </label>
          ${partOptions(app, day?.parts ?? [], 'トレーニング部位')}
        </div>`,
      submitLabel: day ? '変更を保存' : '追加',
      onSubmit(form) {
        const data = new FormData(form);
        const name = String(data.get('name') ?? '').trim();
        if (!name) return invalidDialog(app, 'トレーニング日名を入力してください。');
        if (name.length > limit) return invalidDialog(app, `トレーニング日名は${limit}文字以内で入力してください。`);
        const parts = data.getAll('parts');
        return app.commit(state => {
          const plan = currentPlan(state);
          if (day) {
            Object.assign(plan.days.find(item => item.id === day.id), { name, parts });
          } else {
            plan.days.push({ id: app.model.createId('day'), name, parts, exerciseIds: [] });
          }
        });
      },
    });
  }

  function invalidDialog(app, message) {
    app.dialogError(message);
    return false;
  }

  function deleteDay(app, day) {
    app.confirm({
      title: 'トレーニング日を削除',
      message: `「${day.name}」と、この日に入力中のセットを削除しますか？`,
      submitLabel: '削除',
      onConfirm: () => app.commit(state => {
        const plan = currentPlan(state);
        plan.days = plan.days.filter(item => item.id !== day.id);
        delete state.draftsByDayId[day.id];
      delete state.recoveryPreferences.dayIntervalsHours[day.id];
      }),
    });
  }

  function normalizedName(name) {
    return name.normalize('NFKC').trim().toLowerCase();
  }

  function editExercise(app, day, exercise) {
    const catalog = app.state.exerciseCatalog;
    const options = catalog.filter(item => !day.exerciseIds.includes(item.id));
    const limit = app.model.MAX_NAME_LENGTH;
    app.openDialog({
      title: exercise ? '種目名を編集' : '種目を追加',
      html: `
        <div class="form-grid">
          <label class="field">
            <span>種目名</span>
            <input name="name" required maxlength="${limit}" placeholder="例　スクワット"
              value="${app.escape(exercise ? exerciseName(day, exercise) : '')}"
              ${exercise ? '' : 'list="training-catalog-options"'}>
          </label>
          ${exercise ? '' : `
            <datalist id="training-catalog-options">
              ${options.map(item => `<option value="${app.escape(item.name)}"></option>`).join('')}
            </datalist>
            <p class="form-help">登録済みの種目と同じ名前を入力すると、過去の記録を参照できます。</p>
            ${partOptions(app, day.parts, '新規種目のトレーニング部位')}
          `}
        </div>`,
      submitLabel: exercise ? '変更を保存' : '追加',
      onSubmit(form) {
        const data = new FormData(form);
        const name = String(data.get('name') ?? '').trim();
        if (!name) return invalidDialog(app, '種目名を入力してください。');
        if (name.length > limit) return invalidDialog(app, `種目名は${limit}文字以内で入力してください。`);

        const key = normalizedName(name);
        const parts = data.getAll('parts');
        const duplicate = catalog.find(item => day.exerciseIds.includes(item.id)
          && item.id !== exercise?.id && normalizedName(exerciseName(day, item)) === key);
        const existing = exercise ?? catalog.find(item => normalizedName(item.name) === key);
        if (duplicate || (!exercise && existing && day.exerciseIds.includes(existing.id))) {
          return invalidDialog(app, 'この種目は追加済みです。種目の下からセットを追加できます。');
        }

        return app.commit(state => {
          const currentDay = currentPlan(state).days.find(item => item.id === day.id);
          if (exercise) {
            const names = currentDay.exerciseNames ??= {};
            if (name === exercise.name) {
              delete names[exercise.id];
            } else {
              names[exercise.id] = name;
            }
          } else if (existing) {
            currentDay.exerciseIds.push(existing.id);
          } else {
            const id = app.model.createId('exercise');
            state.exerciseCatalog.push({ id, name, parts });
            currentDay.exerciseIds.push(id);
          }
        });
      },
    });
  }

  function deleteExercise(app, day, exercise) {
    app.confirm({
      title: '種目を削除',
      message: `「${exerciseName(day, exercise)}」と、この種目に入力中のセットを削除しますか？`,
      submitLabel: '削除',
      onConfirm: () => app.commit(state => {
        const currentDay = currentPlan(state).days.find(item => item.id === day.id);
        currentDay.exerciseIds = currentDay.exerciseIds.filter(id => id !== exercise.id);
        if (currentDay.exerciseNames) delete currentDay.exerciseNames[exercise.id];
        if (currentDay.exerciseParts) delete currentDay.exerciseParts[exercise.id];
        eraseExerciseDraft(state, day.id, exercise.id);
      }),
    });
  }

  function reorderDay(app, dayId, destinationIndex) {
    const days = currentPlan(app.state).days;
    const fromIndex = days.findIndex(day => day.id === dayId);
    if (fromIndex < 0 || destinationIndex < 0 || destinationIndex >= days.length || fromIndex === destinationIndex) {
      return false;
    }

    return app.commit(state => {
      const orderedDays = currentPlan(state).days;
      const [day] = orderedDays.splice(fromIndex, 1);
      orderedDays.splice(destinationIndex, 0, day);
    });
  }

  function editSets(app, day, exercise, rowId, action) {
    app.commit(state => {
      const rows = getRows(state, day.id, exercise.id);
      const index = rows.findIndex(row => row.id === rowId);
      if (action === 'add-set') {
        rows.push(blankRow(app.model.createId('set')));
      } else if (index >= 0 && action === 'copy-set') {
        rows.splice(index + 1, 0, { ...rows[index], id: app.model.createId('set') });
      } else if (index >= 0 && action === 'delete-set') {
        rows.splice(index, 1);
      }
      setRows(state, day.id, exercise.id, rows);
    });
  }

  function applyRecommendation(app, day, exercise, card) {
    const rows = getRows(app.state, day.id, exercise.id);
    const { next } = recommendationView.getRecommendation(app, exercise.id, day);
    if (!next || recommendationView.hasDraft(card, rows)) return;

    const rowId = rows[0]?.id ?? app.model.createId('set');
    const values = { weight: String(next.weight), reps: String(next.reps) };
    const saved = app.commit(state => {
      const draft = getRows(state, day.id, exercise.id);
      if (!draft.length) draft.push(blankRow(rowId));
      Object.assign(draft[0], values);
      setRows(state, day.id, exercise.id, draft);
    }, { render: false });
    if (!saved) return;

    const existing = card.querySelector('[data-set-id]');
    if (existing) {
      existing.querySelector('[data-set-field="weight"]').value = values.weight;
      existing.querySelector('[data-set-field="reps"]').value = values.reps;
    } else {
      const [row] = getRows(app.state, day.id, exercise.id);
      card.querySelector('.set-table').insertAdjacentHTML('beforeend', renderSet(app, row, 0, exerciseName(day, exercise), day.id, exercise.id));
      card.querySelector('.set-empty')?.remove();
    }
    card.closest('[data-day-id]').querySelector('[data-day-error]').hidden = true;
    recommendationView.refreshDraftState(card);
    card.querySelector('.recommendation-summary').focus({ preventScroll: true });
    app.notify('提案を下書きの1セット目に反映しました。');
  }

  function showDayError(card, message, rowId) {
    const output = card.querySelector('[data-day-error]');
    output.textContent = message;
    output.hidden = false;
    if (rowId) {
      const row = [...card.querySelectorAll('[data-set-id]')].find(element => element.dataset.setId === rowId);
      row?.querySelector('input')?.focus();
    }
  }

  function completeDay(app, day, card) {
    const { state, model } = app;
    const exercises = [];
    const rowElements = new Map([...card.querySelectorAll('[data-set-id]')]
      .map(element => [element.dataset.setId, element]));

    for (const exerciseId of day.exerciseIds) {
      const exercise = state.exerciseCatalog.find(item => item.id === exerciseId);
      const name = exerciseName(day, exercise);
      const rows = getRows(state, day.id, exerciseId);
      const sets = [];
      for (const [index, row] of rows.entries()) {
        const inputs = rowElements.get(row.id)?.querySelectorAll('input') ?? [];
        if ([...inputs].some(input => input.validity.badInput)) {
          return showDayError(card, `「${name}」のセット${index + 1}に有効な数値を入力してください。`, row.id);
        }
        if (setFields.every(field => row[field.key].trim() === '')) continue;
        const result = model.parseSet(row);
        if (result.error) {
          return showDayError(card, `「${name}」のセット${index + 1}　${result.error}`, row.id);
        }
        sets.push(result.set);
      }
      if (sets.length) exercises.push({ exerciseId, name, sets });
    }

    if (exercises.length === 0) {
      showDayError(card, '完了するには、少なくとも1セットの重量と回数を入力してください。');
      return;
    }

    const now = new Date();
    const session = {
      sessionId: model.createId('session'),
      planId: state.activePlanId,
      planDayId: day.id,
      date: model.localDate(now),
      completedAt: now.toISOString(),
      dayName: day.name,
      parts: [...day.parts],
      exercises,
    };

    if (app.commit(next => {
      next.sessions.push(session);
      delete next.draftsByDayId[day.id];
    })) {
      app.notify('トレーニングを記録しました。', 'success');
      recoveryView.openCheckIn(app, {day, session});
    }
  }

  function bind(app) {
    const { root } = app;
    root.onclick = event => {
      const button = event.target.closest('button[data-training-action]');
      if (!button || button.disabled) return;
      const action = button.dataset.trainingAction;
      const plan = currentPlan(app.state);

      if (action === 'switch-plan') {
        const planId = button.dataset.planId;
        if (planId !== plan.id && app.model.PLAN_IDS.includes(planId)) {
          app.commit(state => { state.activePlanId = planId; });
        }
        return;
      }
      if (action === 'add-day') {
        editDay(app);
        return;
      }

      const card = button.closest('[data-day-id]');
      const day = plan.days.find(item => item.id === card?.dataset.dayId);
      if (!day) return;
      const exerciseCard = button.closest('[data-exercise-id]');
      const exerciseId = exerciseCard?.dataset.exerciseId;
      const exercise = app.state.exerciseCatalog.find(item => item.id === exerciseId);
      const rowId = button.closest('[data-set-id]')?.dataset.setId;

      switch (action) {
        case 'edit-day':
          editDay(app, day);
          break;
        case 'delete-day':
          deleteDay(app, day);
          break;
        case 'edit-recovery-interval':
          recoveryView.openInterval(app, day);
          break;
        case 'move-up':
        case 'move-down': {
          const delta = action === 'move-up' ? -1 : 1;
          const moved = reorderDay(app, day.id, plan.days.indexOf(day) + delta);
          if (moved) {
            const updatedCard = [...root.querySelectorAll('[data-day-id]')].find(item => item.dataset.dayId === day.id);
            const sameButton = updatedCard?.querySelector(`[data-training-action="${action}"]:enabled`);
            const nextButton = updatedCard?.querySelector('[data-training-action="move-up"]:enabled, [data-training-action="move-down"]:enabled');
            (sameButton ?? nextButton)?.focus();
          }
          break;
        }
        case 'add-exercise':
        case 'edit-exercise':
          editExercise(app, day, exercise);
          break;
        case 'delete-exercise':
          deleteExercise(app, day, exercise);
          break;
        case 'edit-targets':
        case 'dismiss-recommendation':
        case 'restore-recommendation':
          recommendationView.handleAction(app, day, exercise, exerciseCard, action);
          break;
        case 'apply-recommendation':
          applyRecommendation(app, day, exercise, exerciseCard);
          break;
        case 'add-set':
        case 'copy-set':
        case 'delete-set':
          editSets(app, day, exercise, rowId, action);
          break;
        case 'complete-day':
          completeDay(app, day, card);
          break;
      }
    };

    root.oninput = event => {
      const input = event.target.closest('input[data-set-field]');
      if (!input) return;

      const card = input.closest('[data-day-id]');
      const dayId = card.dataset.dayId;
      const exerciseCard = input.closest('[data-exercise-id]');
      const exerciseId = exerciseCard.dataset.exerciseId;
      const rowId = input.closest('[data-set-id]').dataset.setId;
      const field = input.dataset.setField;
      const before = getRows(app.state, dayId, exerciseId).find(row => row.id === rowId);
      if (!before) return;

      const error = card.querySelector('[data-day-error]');
      error.hidden = true;
      if (before[field] !== input.value) {
        const value = input.value;
        const saved = app.commit(state => {
          const rows = getRows(state, dayId, exerciseId);
          const row = rows.find(item => item.id === rowId);
          row[field] = value;
          setRows(state, dayId, exerciseId, rows);
        }, { render: false });
        if (!saved) input.value = before[field];
      }
      recommendationView.refreshDraftState(exerciseCard);
    };

    bindDrag(app);
  }

  function bindDrag(app) {
    const { root } = app;
    let draggedId;
    let dropTarget;

    function clearTarget() {
      if (dropTarget) delete dropTarget.dataset.dropPosition;
      dropTarget = undefined;
    }

    function finishDrag() {
      clearTarget();
      const source = [...root.querySelectorAll('[data-day-id]')].find(card => card.dataset.dayId === draggedId);
      if (source) delete source.dataset.dragging;
      draggedId = undefined;
    }

    root.ondragstart = event => {
      const handle = event.target.closest('[data-drag-day]');
      if (!handle) return;

      draggedId = handle.dataset.dragDay;
      handle.closest('[data-day-id]').dataset.dragging = 'true';
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', draggedId);
    };

    root.ondragover = event => {
      const card = event.target.closest('[data-day-id]');
      if (!draggedId || !card || card.dataset.dayId === draggedId) return clearTarget();

      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (dropTarget !== card) {
        clearTarget();
        dropTarget = card;
        const ids = currentPlan(app.state).days.map(day => day.id);
        card.dataset.dropPosition = ids.indexOf(draggedId) < ids.indexOf(card.dataset.dayId) ? 'after' : 'before';
      }
    };

    root.ondragleave = event => {
      if (dropTarget?.contains(event.target) && !dropTarget.contains(event.relatedTarget)) clearTarget();
    };

    root.ondrop = event => {
      const card = event.target.closest('[data-day-id]');
      if (!draggedId || !card || card.dataset.dayId === draggedId) return;

      event.preventDefault();
      const sourceId = draggedId;
      const index = currentPlan(app.state).days.findIndex(day => day.id === card.dataset.dayId);
      finishDrag();
      reorderDay(app, sourceId, index);
    };

    root.ondragend = finishDrag;
  }

  window.FitnessTraining = { render, bind };
}());
