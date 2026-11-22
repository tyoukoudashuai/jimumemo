/* Completed training is the only source for these three views. */
(() => {
  'use strict';

  const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 6 });
  const filters = { from: '', to: '', part: '' };
  const expanded = new Set();
  let selectedExerciseId = '';

  function shortDate(date) {
    const [, month, day] = date.split('-');
    return `${Number(month)}/${Number(day)}`;
  }

  function setCount(session) {
    return session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  }

  function emptyState(app, icon, title, description, action = '') {
    return `<div class="empty-state">
      <span class="empty-icon">${app.icon(icon, 24)}</span>
      <p class="empty-title">${title}</p>
      <p>${description}</p>${action}
    </div>`;
  }

  function trainingLink(app, label, variant = 'primary') {
    return `<button class="button button--${variant}" type="button" data-page="training">
      ${label}${app.icon('arrow-right', 18)}
    </button>`;
  }

  function renderSparkline(points) {
    const weights = points.slice(-6).map(point => point.weight);
    const low = Math.min(...weights);
    const range = Math.max(...weights) - low;
    const coordinates = weights.map((weight, index) => [
      4 + (index / (weights.length - 1)) * 72,
      range ? 26 - ((weight - low) / range) * 21 : 16,
    ]);
    const [x, y] = coordinates.at(-1);

    return `<svg class="hero-sparkline" viewBox="0 0 80 32" aria-hidden="true">
      <path class="hero-sparkline-grid" d="M3 8H77M3 16H77M3 24H77"/>
      <polyline points="${coordinates.map(point => point.join(',')).join(' ')}"/>
      <circle cx="${x}" cy="${y}" r="2.5"/>
    </svg>`;
  }

  function renderProgressPreview(app, exercise) {
    if (!exercise) return '<p class="hero-preview-empty">トレーニング完了後に表示</p>';

    const points = app.model.getProgress(app.state.sessions, exercise.exerciseId);
    const latest = points.at(-1).weight;
    const delta = points.length > 1 ? latest - points.at(-2).weight : null;
    const comparison = delta === null ? '初回の記録' : !delta ? '前回と同じ'
      : `前回比 ${delta > 0 ? '+' : '−'}${formatChartWeight(Math.abs(delta))} kg`;

    return `<div class="hero-progress-data">
      <p class="hero-preview-name">${app.escape(exercise.name)}</p>
      <div class="hero-progress-value">
        <div>
          <p class="hero-weight"><span class="visually-hidden">最高重量 </span>${formatChartWeight(latest)} <span>kg</span></p>
          <p class="hero-comparison${delta > 0 ? ' hero-comparison--up' : ''}">${comparison}</p>
        </div>
        ${delta === null ? '' : renderSparkline(points)}
      </div>
    </div>`;
  }

  function renderDashboardHero(app, sessions, today) {
    const plan = app.state.plans[app.state.activePlanId];
    const lastPlanSession = sessions.find(session => session.planId === plan.id && session.date <= today
      && plan.days.some(day => day.id === session.planDayId));
    const trainedToday = lastPlanSession?.date === today;
    const lastDayIndex = plan.days.findIndex(day => day.id === lastPlanSession?.planDayId);
    const dayIndex = trainedToday ? lastDayIndex : (lastDayIndex + 1) % (plan.days.length || 1);
    const day = plan.days[dayIndex];
    const latestSession = sessions[0];
    const exercise = latestSession?.exercises[0];
    const lastSet = exercise?.sets.at(-1);
    const primaryLabel = day && !trainedToday ? 'トレーニングを始める' : 'プランを開く';

    return `<section class="dashboard-hero" aria-labelledby="dashboard-title">
      <div class="hero-copy">
        <p class="hero-eyebrow">${app.icon('layers', 14)} 現在のプラン <strong>${app.escape(plan.name)}</strong></p>
        <h1 class="hero-title" id="dashboard-title">今日のトレーニングを<wbr>始めよう。</h1>
        <p class="hero-description">分割プラン、前回の記録、進捗の推移をひと目で確認。</p>
        <div class="hero-actions">
          <button class="button button--primary" type="button" data-page="training"${day && !trainedToday && dayIndex > 0 ? ` data-day-target="${app.escape(day.id)}"` : ''}>${primaryLabel}${app.icon('arrow-right', 16)}</button>
          <button class="button button--secondary" type="button" data-page="progress">${app.icon('chart', 16)} 進捗を見る</button>
        </div>
      </div>
      <div class="hero-overview">
        <div class="hero-preview hero-preview--plan">
          <span class="hero-plan-icon">${app.icon('calendar', 19)}</span>
          <div class="hero-plan-copy">
            <h2>今日のプラン</h2>
            ${day ? `<p class="hero-plan-name">${app.escape(day.name)}</p>`
              : '<p class="hero-preview-empty">プランにトレーニング日を追加してください</p>'}
          </div>
          ${day ? `<div class="hero-plan-tags">
            <span class="tag">${app.escape(plan.name)}</span>
            <span class="tag hero-day-number">DAY ${String(dayIndex + 1).padStart(2, '0')}</span>
            ${trainedToday ? `<span class="tag hero-plan-done">${app.icon('check', 13)} 完了</span>` : ''}
          </div>` : ''}
        </div>
        <div class="hero-preview hero-preview--last">
          <div class="hero-preview-heading">
            <h2>${app.icon('clock', 15)} 前回の記録</h2>
            ${latestSession ? `<time datetime="${latestSession.date}">${shortDate(latestSession.date)}</time>` : ''}
          </div>
          ${lastSet ? `<p class="hero-preview-name">${app.escape(exercise.name)}</p>
            <p class="hero-set-summary"><span class="hero-weight">${formatChartWeight(lastSet.weight)} <span>kg</span></span>
              <span>× ${numberFormat.format(lastSet.reps)} 回</span>
              ${lastSet.rir === null ? '' : `<span class="tag">RIR ${lastSet.rir}</span>`}
            </p>` : '<p class="hero-preview-empty">記録はまだありません</p>'}
        </div>
        <div class="hero-preview hero-preview--progress">
          <h2>${app.icon('chart', 15)} 最近の進捗</h2>
          ${renderProgressPreview(app, exercise)}
        </div>
      </div>
    </section>`;
  }

  function renderDashboard(app) {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (today.getDay() + 6) % 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const { sessions, sets, volume } = app.model.getWeeklyStats(app.state.sessions, today);
    const stats = [
      { icon: 'calendar', label: 'トレーニング回数', value: sessions, unit: '回' },
      { icon: 'layers', label: '総セット数', value: sets, unit: 'セット' },
      { icon: 'dumbbell', label: '総トレーニング量', value: volume, unit: 'kg' },
    ];
    const completed = app.model.sortSessions(app.state.sessions);
    const recent = completed.slice(0, 4);

    return `${renderDashboardHero(app, completed, app.model.localDate(today))}
    ${window.FitnessRecoveryView.renderDashboard(app)}
    <section class="dashboard-section" aria-labelledby="stats-title">
      <div class="section-heading">
        <h2 class="section-title" id="stats-title">今週のサマリー</h2>
        <span class="section-meta">${app.icon('calendar', 16)} ${shortDate(app.model.localDate(weekStart))} 〜 ${shortDate(app.model.localDate(weekEnd))}</span>
      </div>
      <div class="stats-grid">
        ${stats.map(({ icon, label, value, unit }) => `<div class="surface stat-card">
          <span class="stat-icon">${app.icon(icon, 19)}</span><p class="stat-label">${label}</p>
          <p class="stat-value">${numberFormat.format(value)} <span class="stat-unit">${unit}</span></p>
        </div>`).join('')}
      </div>
    </section>
    <section class="dashboard-section" aria-labelledby="recent-title">
      <div class="section-heading">
        <h2 class="section-title" id="recent-title">最近のトレーニング</h2>
        <button class="button button--ghost" type="button" data-page="history">履歴を見る${app.icon('arrow-right', 16)}</button>
      </div>
      <div class="surface recent-list">
        ${recent.length ? recent.map(session => `<div class="recent-item">
          <span class="recent-icon">${app.icon('dumbbell', 20)}</span>
          <div class="recent-copy"><strong>${app.escape(session.dayName)}</strong><span>${app.model.formatDate(session.date)}</span></div>
          <span class="recent-meta">${setCount(session)} セット</span>
        </div>`).join('') : emptyState(app, 'list', 'トレーニング記録はまだありません', '完了したトレーニングがここに表示されます。')}
      </div>
    </section>`;
  }

  function renderHistory(app) {
    const invalidRange = filters.from && filters.to && filters.from > filters.to;
    const sessions = app.model.sortSessions(app.state.sessions).filter(session =>
      (!filters.from || session.date >= filters.from) &&
      (!filters.to || session.date <= filters.to) &&
      (!filters.part || session.parts.includes(filters.part))
    );

    return `<div class="page-heading">
      <h1 class="page-title">トレーニング履歴</h1>
      <p class="page-description">完了したトレーニングを振り返り、記録を編集できます。</p>
    </div>
    <div class="surface record-filters" aria-label="履歴の絞り込み">
      <label class="field">開始日<input type="date" data-history-filter="from" value="${app.escape(filters.from)}"></label>
      <label class="field">終了日<input type="date" data-history-filter="to" value="${app.escape(filters.to)}"></label>
      <label class="field">部位<select data-history-filter="part">
        <option value="">すべての部位</option>
        ${app.model.BODY_PARTS.map(part => `<option value="${app.escape(part)}"${part === filters.part ? ' selected' : ''}>${app.escape(part)}</option>`).join('')}
      </select></label>
      <button type="button" class="button button--secondary" data-record-action="clear-filters"${filters.from || filters.to || filters.part ? '' : ' disabled'}>絞り込みを解除</button>
    </div>
    <div class="history-list">
      ${sessions.map(session => renderSession(app, session)).join('')}
      ${sessions.length ? '' : `<div class="surface">${invalidRange
        ? emptyState(app, 'calendar', '日付の範囲を確認してください', '終了日は開始日と同じ日か、それ以降にしてください。')
        : app.state.sessions.length
          ? emptyState(app, 'list', '条件に一致する記録がありません', '日付や部位を変更してください。')
          : emptyState(app, 'list', 'トレーニング記録はまだありません', 'プランからトレーニングを記録できます。', trainingLink(app, 'トレーニングプランへ', 'secondary'))}</div>`}
    </div>`;
  }

  function renderSession(app, session) {
    const id = app.escape(session.sessionId);
    return `<details class="surface history-card" data-session-id="${id}"${expanded.has(session.sessionId) ? ' open' : ''}>
      <summary class="history-summary">
        <span class="recent-icon">${app.icon('calendar', 20)}</span>
        <span class="history-main"><time class="history-date" datetime="${session.date}">${app.model.formatDate(session.date)}</time>
          <strong>${app.escape(session.dayName)}</strong>
          ${session.parts.length ? `<span class="history-parts">${session.parts.map(part => `<span class="tag">${app.escape(part)}</span>`).join('')}</span>` : ''}
        </span>
        <span class="history-count">${setCount(session)} セット</span>
        <span class="history-chevron">${app.icon('chevron-down', 18)}</span>
      </summary>
      <div class="history-details">
        ${session.exercises.map(exercise => `<div class="history-exercise">
          <h2>${app.escape(exercise.name)}</h2>
          <table class="set-table">
            <thead><tr><th scope="col">セット</th><th scope="col">重量 (kg)</th><th scope="col">回数</th><th scope="col">RIR</th></tr></thead>
            <tbody>${exercise.sets.map((set, index) => `<tr>
              <th scope="row">${index + 1}</th><td>${numberFormat.format(set.weight)}</td><td>${numberFormat.format(set.reps)}</td><td>${set.rir ?? '—'}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>`).join('')}
        <div class="history-actions">
          <button type="button" class="button button--secondary" data-record-action="edit">${app.icon('edit', 16)} 編集</button>
          <button type="button" class="button button--ghost button--danger" data-record-action="delete">${app.icon('trash', 16)} 削除</button>
        </div>
      </div>
    </details>`;
  }

  function renderEditSet(app, set, index) {
    return `<div class="history-edit-set" role="group" aria-label="セット ${index + 1}">
      <span data-set-number>${index + 1}</span>
      <label class="field">重量 (kg)<input data-set-field="weight" inputmode="decimal" value="${app.escape(set.weight ?? '')}"></label>
      <label class="field">回数<input data-set-field="reps" inputmode="numeric" value="${app.escape(set.reps ?? '')}"></label>
      <label class="field">RIR<input data-set-field="rir" inputmode="numeric" value="${app.escape(set.rir ?? '')}"></label>
      <button class="icon-button" type="button" data-edit-action="remove-set" aria-label="セットを削除" title="セットを削除">${app.icon('trash', 16)}</button>
    </div>`;
  }

  function readEditSet(row) {
    return Object.fromEntries([...row.querySelectorAll('[data-set-field]')].map(input => [input.dataset.setField, input.value]));
  }

  function refreshEditSets(exercise) {
    const rows = exercise.querySelectorAll('.history-edit-set');
    rows.forEach((row, index) => {
      row.setAttribute('aria-label', `セット ${index + 1}`);
      row.querySelector('[data-set-number]').textContent = index + 1;
      row.querySelector('[data-edit-action="remove-set"]').disabled = rows.length === 1;
    });
  }

  function openHistoryEditor(app, session) {
    app.openDialog({
      title: 'トレーニング記録を編集',
      submitLabel: '変更を保存',
      html: `<div class="history-editor"><div class="form-grid">
        <label class="field">トレーニング日<input type="date" name="date" value="${app.escape(session.date)}" required></label>
        <label class="field">トレーニング名<input type="text" name="dayName" value="${app.escape(session.dayName)}" maxlength="60" required></label>
      </div>
      <fieldset class="part-options"><legend>部位</legend>
        ${app.model.BODY_PARTS.map(part => `<label class="tag part-option"><input type="checkbox" name="parts" value="${app.escape(part)}"${session.parts.includes(part) ? ' checked' : ''}>${app.escape(part)}</label>`).join('')}
      </fieldset>
      <p class="field-help">RIR：あと何回できるかの目安（任意）</p>
      ${session.exercises.map(exercise => `<fieldset class="history-edit-exercise" data-edit-exercise="${app.escape(exercise.exerciseId)}">
        <legend>${app.escape(exercise.name)}</legend>
        <label class="field">種目名<input type="text" data-exercise-name value="${app.escape(exercise.name)}" maxlength="60" required></label>
        <div class="history-edit-sets">${exercise.sets.map((set, index) => renderEditSet(app, set, index)).join('')}</div>
        <button type="button" class="button button--secondary" data-edit-action="add-set">${app.icon('plus', 16)} セットを追加</button>
        ${session.exercises.length > 1 ? `<button type="button" class="button button--ghost button--danger" data-edit-action="remove-exercise">${app.icon('trash', 16)} 種目を削除</button>` : ''}
      </fieldset>`).join('')}</div>`,
      onOpen(form) {
        form.querySelectorAll('[data-edit-exercise]').forEach(refreshEditSets);
        form.querySelector('.history-editor').addEventListener('click', event => {
          const button = event.target.closest('[data-edit-action]');
          if (!button) return;

          const exercise = button.closest('[data-edit-exercise]');
          const container = exercise.querySelector('.history-edit-sets');
          switch (button.dataset.editAction) {
            case 'add-set':
              container.insertAdjacentHTML('beforeend', renderEditSet(app, readEditSet(container.lastElementChild), container.children.length));
              container.lastElementChild.querySelector('input').focus();
              break;
            case 'remove-set':
              button.closest('.history-edit-set').remove();
              exercise.querySelector('[data-edit-action="add-set"]').focus();
              break;
            case 'remove-exercise': {
              exercise.remove();
              const removeButtons = form.querySelectorAll('[data-edit-action="remove-exercise"]');
              if (removeButtons.length === 1) removeButtons[0].disabled = true;
              form.querySelector('[data-edit-action="add-set"]').focus();
              return;
            }
          }
          refreshEditSets(exercise);
        });
      },
      onSubmit(form) {
        const fields = new FormData(form);
        const date = String(fields.get('date') ?? '');
        const dayName = String(fields.get('dayName') ?? '').trim();
        if (!app.model.isLocalDate(date) || !dayName) {
          app.dialogError('有効な日付とトレーニング名を入力してください。');
          return false;
        }

        const exercises = [];
        for (const fieldset of form.querySelectorAll('[data-edit-exercise]')) {
          const exerciseId = fieldset.dataset.editExercise;
          const name = fieldset.querySelector('[data-exercise-name]').value.trim();
          if (!name) {
            app.dialogError('種目名を入力してください。');
            return false;
          }
          const sets = [];
          for (const row of fieldset.querySelectorAll('.history-edit-set')) {
            const { set, error } = app.model.parseSet(readEditSet(row));
            if (error) {
              app.dialogError(`${name}のセット${sets.length + 1}：${error}`);
              return false;
            }
            sets.push(set);
          }
          exercises.push({ exerciseId, name, sets });
        }

        const saved = app.commit(draft => {
          const record = draft.sessions.find(item => item.sessionId === session.sessionId);
          Object.assign(record, { date, dayName, parts: fields.getAll('parts'), exercises });
        });
        if (saved) app.notify('トレーニング記録を更新しました。');
        return saved;
      },
    });
  }

  function deleteSession(app, session) {
    app.confirm({
      title: 'トレーニング記録を削除',
      message: `${app.model.formatDate(session.date)}の「${session.dayName}」を削除します。この操作は取り消せません。`,
      submitLabel: '記録を削除',
      onConfirm() {
        const saved = app.commit(draft => {
          draft.sessions = draft.sessions.filter(item => item.sessionId !== session.sessionId);
        });
        if (saved) {
          expanded.delete(session.sessionId);
          app.notify('トレーニング記録を削除しました。');
        }
        return saved;
      },
    });
  }

  function renderProgress(app) {
    const history = app.model.sortSessions(app.state.sessions);
    const exercises = new Map();
    for (const session of history) {
      for (const exercise of session.exercises) {
        if (!exercises.has(exercise.exerciseId)) exercises.set(exercise.exerciseId, exercise.name);
      }
    }
    for (const exercise of app.state.exerciseCatalog) {
      if (!exercises.has(exercise.id)) exercises.set(exercise.id, exercise.name);
    }
    const exerciseId = exercises.has(selectedExerciseId) ? selectedExerciseId
      : history[0]?.exercises[0]?.exerciseId ?? exercises.keys().next().value ?? '';
    const points = exerciseId ? app.model.getProgress(app.state.sessions, exerciseId) : [];
    const exerciseName = exercises.get(exerciseId) ?? '';

    return `<div class="page-heading">
      <h1 class="page-title">トレーニングの推移</h1>
      <p class="page-description">種目ごとに、トレーニングで扱った最高重量の変化を確認できます。</p>
    </div>
    <section class="surface progress-card" aria-labelledby="chart-title">
      <div class="progress-controls">
        <h2 class="section-title" id="chart-title">最高重量の推移</h2>
        <label class="field">種目<select data-progress-exercise${exercises.size ? '' : ' disabled'}>
          ${exercises.size ? [...exercises].sort((left, right) => left[1].localeCompare(right[1], 'ja')).map(([id, name]) =>
            `<option value="${app.escape(id)}"${id === exerciseId ? ' selected' : ''}>${app.escape(name)}</option>`).join('') : '<option>選べる種目がありません</option>'}
        </select></label>
      </div>
      ${points.length ? renderChart(app, points, exerciseName) : emptyState(app, 'chart', 'この種目の記録はまだありません', 'トレーニングを完了すると、最高重量がグラフに表示されます。')}
    </section>`;
  }

  function weightAxis(maxWeight) {
    if (!maxWeight) return { limit: 5, step: 1 };
    const target = maxWeight / 4;
    if (!target || target > 1e300) return { limit: maxWeight, step: target };
    const base = 10 ** Math.floor(Math.log10(target));
    if (!base) return { limit: maxWeight, step: target };
    const step = ([1, 2, 2.5, 5, 10].find(factor => factor >= target / base) ?? 10) * base;
    return { limit: Math.ceil(maxWeight / step) * step, step };
  }

  function formatChartWeight(weight) {
    return weight && (weight < 0.0001 || weight >= 1e8) ? weight.toExponential(2) : numberFormat.format(weight);
  }

  function renderChart(app, points, exerciseName) {
    const left = 78;
    const right = 669;
    const top = 31;
    const bottom = 229;
    const axis = weightAxis(points.reduce((max, point) => Math.max(max, point.weight), 0));
    const tickCount = axis.step ? Math.max(1, Math.round(axis.limit / axis.step)) : 1;
    const groups = new Map();
    for (const point of points) {
      if (!groups.has(point.date)) groups.set(point.date, []);
      groups.get(point.date).push(point);
    }
    const dates = [...groups.keys()];
    const days = dates.map(date => Date.parse(`${date}T00:00:00Z`) / 86_400_000);
    const duration = days.at(-1) - days[0];
    const xValues = days.map(day => duration ? left + 12 + (day - days[0]) / duration * (right - left - 24) : (left + right) / 2);
    const pixels = dates.flatMap((date, index) => {
      const entries = groups.get(date);
      const previousGap = xValues[index] - (xValues[index - 1] ?? left);
      const nextGap = (xValues[index + 1] ?? right) - xValues[index];
      const spread = entries.length <= 1 ? 0 : duration
        ? Math.min(previousGap / 3, nextGap / 3, 14)
        : Math.min(70, entries.length * 15);
      return entries.map((point, pointIndex) => ({
        ...point,
        x: xValues[index] + (spread ? (pointIndex / (entries.length - 1) * 2 - 1) * spread : 0),
        y: bottom - point.weight / axis.limit * (bottom - top),
      }));
    });
    let lastLabelX = -Infinity;
    const dateLabels = dates.map((date, index) => {
      const x = xValues[index];
      const last = index === dates.length - 1;
      if (!last && (x - lastLabelX < 58 || xValues.at(-1) - x < 58)) return '';
      lastLabelX = x;
      const label = dates[0].slice(0, 4) === dates.at(-1).slice(0, 4) ? shortDate(date) : date.replaceAll('-', '/');
      return `<text class="chart-label" x="${x}" y="253" text-anchor="middle">${app.escape(label)}</text>`;
    }).join('');
    const summary = `${exerciseName}の最高重量、${points.length}件のトレーニング`;

    return `<div class="chart-scroll" tabindex="0" aria-label="${app.escape(summary)}">
      <svg class="progress-chart" viewBox="0 0 700 285" role="img" aria-labelledby="chart-svg-title chart-svg-desc">
        <title id="chart-svg-title">${app.escape(summary)}</title>
        <desc id="chart-svg-desc">${app.escape(points.map(point => `${app.model.formatDate(point.date)} ${formatChartWeight(point.weight)} kg`).join('、'))}</desc>
        <text class="chart-axis-title" x="${left}" y="18">重量 (kg)</text>
        ${Array.from({ length: tickCount + 1 }, (_, index) => {
          const y = bottom - index / tickCount * (bottom - top);
          const weight = index / tickCount * axis.limit;
          return `<line class="chart-grid" x1="${left}" x2="${right}" y1="${y}" y2="${y}"/>
            <text class="chart-label" x="${left - 12}" y="${y}" dy="0.35em" text-anchor="end">${formatChartWeight(weight)}</text>`;
        }).join('')}
        <path class="chart-axis" d="M${left} ${top}V${bottom}H${right}" fill="none"/>
        ${pixels.length > 1 ? `<polyline class="chart-line" points="${pixels.map(point => `${point.x},${point.y}`).join(' ')}" fill="none"/>` : ''}
        ${pixels.map(point => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="5"><title>${app.escape(`${app.model.formatDate(point.date)} ${formatChartWeight(point.weight)} kg`)}</title></circle>`).join('')}
        ${dateLabels}
        <text class="chart-axis-title" x="${(left + right) / 2}" y="277" text-anchor="middle">トレーニング日</text>
      </svg>
    </div>`;
  }

  function bindHistory(app) {
    for (const details of app.root.querySelectorAll('[data-session-id]')) {
      details.addEventListener('toggle', () => {
        if (!details.isConnected) return;
        if (details.open) expanded.add(details.dataset.sessionId);
        else expanded.delete(details.dataset.sessionId);
      });
    }

    app.root.onchange = event => {
      const field = event.target.dataset.historyFilter;
      if (!field) return;
      filters[field] = event.target.value;
      app.render();
      app.root.querySelector(`[data-history-filter="${field}"]`)?.focus();
    };

    app.root.onclick = event => {
      const button = event.target.closest('[data-record-action]');
      if (!button) return;
      if (button.dataset.recordAction === 'clear-filters') {
        Object.assign(filters, { from: '', to: '', part: '' });
        app.render();
        app.root.querySelector('[data-history-filter="from"]')?.focus();
        return;
      }

      const details = button.closest('[data-session-id]');
      const session = app.state.sessions.find(item => item.sessionId === details.dataset.sessionId);
      if (!session) return;
      if (button.dataset.recordAction === 'edit') openHistoryEditor(app, session);
      else deleteSession(app, session);
    };
  }

  function bind(app) {
    if (app.page === 'history') bindHistory(app);
    if (app.page === 'progress') {
      app.root.onchange = event => {
        if (!event.target.matches('[data-progress-exercise]')) return;
        selectedExerciseId = event.target.value;
        app.render();
        app.root.querySelector('[data-progress-exercise]')?.focus();
      };
    }
  }

  window.FitnessRecords = { renderDashboard, renderHistory, renderProgress, bind };
})();
