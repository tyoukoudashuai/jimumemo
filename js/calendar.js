(() => {
  'use strict';
  const recovery = typeof module === 'object' && module.exports ? require('./recovery.js') : window.FitnessRecovery;
  let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selected = '';
  const keyDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  function proposal(state, now = new Date()) {
    const next = recovery.getNextTrainingDay(state, now);
    const source = [...state.sessions].filter(s => s.planId === state.activePlanId && s.date <= keyDate(now))
      .sort((a,b) => b.date.localeCompare(a.date) || Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
    if (!next || !source) return null;
    const info = recovery.getDayRecovery({day:next.day,sessions:state.sessions,checkIns:state.recoveryCheckIns,preferences:state.recoveryPreferences,now});
    const anchor = new Date(source.completedAt);
    const [year, m, d] = source.date.split('-').map(Number);
    anchor.setFullYear(year,m-1,d);
    const feedback = [...state.recoveryCheckIns].filter(c => c.sessionId === source.sessionId)
      .sort((a,b) => Date.parse(b.recordedAt)-Date.parse(a.recordedAt))[0];
    const fatigue = feedback?.fatigue;
    const bufferHours = fatigue >= 4 ? 48 : fatigue === 3 ? 24 : 0;
    // This is a conservative scheduling buffer, never an estimate of physiological recovery.
    const earliest = new Date(Math.max(anchor.getTime() + info.intervalHours * 3600000, info.candidateAt?.getTime() || 0) + bufferHours * 3600000);
    const id = `next-${state.activePlanId}-${source.sessionId}`;
    const override = state.calendarOverrides?.[id];
    const at = override ? new Date(override) : earliest;
    const held = info.condition.severe;
    return {id,day:next.day,at,info,held,bufferHours,cancelled:override === null,manual:Boolean(override),source};
  }

  function render(app) {
    const {escape,icon} = app;
    const next = proposal(app.state);
    const today = keyDate(new Date());
    if (!selected) selected = today;
    const start = new Date(month);
    start.setDate(1 - (start.getDay()+6)%7);
    const dates = Array.from({length:42},(_,i) => {const date=new Date(start);date.setDate(date.getDate()+i);return date;});
    const sessions = app.model.sortSessions(app.state.sessions);
    const daySessions = sessions.filter(s=>s.date===selected);
    const scheduled = next && !next.cancelled;
    const nextDate = next ? keyDate(next.at) : '';
    return `<header class="page-heading"><h1 class="page-title">カレンダー</h1><p class="page-description">完了したトレーニングと次回の予定を確認できます。</p></header>
      <section class="surface calendar-proposal"><h2 class="section-title">次回のトレーニング</h2>
      ${next ? `<strong>${escape(next.day.name)}</strong><p>${next.held ? '強い疲労の報告があるため、予定は保留中です。' : next.cancelled ? 'この予定は見送りました。' : `${next.manual ? '手動設定' : '自動作成'} · <time datetime="${next.at.toISOString()}">${app.model.formatDate(nextDate)} ${next.at.toTimeString().slice(0,5)}</time>`}</p>
        <span class="recovery-status" data-recovery-status="${next.info.status}">${escape(next.info.label)}</span>
        ${next.held ? `<time datetime="${next.at.toISOString()}">${app.model.formatDate(nextDate)} ${next.at.toTimeString().slice(0,5)} · 仮予定</time>` : ''}
        <details><summary>判断理由を見る</summary><p>予定は設定間隔と自己評価に基づく目安です。体調を確認して調整してください。</p><p>疲労3は24時間、疲労4〜5は48時間の予定上の余裕を追加します。回復時間の予測ではありません。</p><ul>${next.info.reasons.map(r=>`<li>${escape(r)}</li>`).join('')}</ul></details>
        <div class="calendar-actions"><button class="button button--secondary" data-calendar-action="edit">日時を変更</button><button class="button button--ghost" data-calendar-action="${next.cancelled ? 'restore' : 'cancel'}">${next.cancelled ? '自動予定に戻す' : '今回は見送る'}</button><button class="button button--secondary" data-page="recovery" data-recovery-check data-recovery-day="${escape(next.day.id)}">コンディションを確認</button></div>` : '<p class="form-help">トレーニング完了後に次回の予定を表示します。</p>'}</section>
      <section class="surface calendar-month"><div class="section-heading"><button class="icon-button" data-calendar-action="previous" aria-label="前の月">${icon('chevron-up')}</button><h2>${month.getFullYear()}/${month.getMonth()+1}</h2><button class="button button--ghost" data-calendar-action="today">今日</button><button class="icon-button" data-calendar-action="next" aria-label="次の月">${icon('chevron-down')}</button></div>
      <div class="calendar-grid">${['月','火','水','木','金','土','日'].map(day=>`<span class="calendar-weekday">${day}</span>`).join('')}${dates.map(date=>{
        const key=keyDate(date);const count=sessions.filter(s=>s.date===key).length;
        return `<button class="calendar-cell ${date.getMonth()!==month.getMonth()?'calendar-muted':''}" data-calendar-date="${key}" aria-pressed="${key===selected}" ${key===today?'aria-current="date"':''}><span>${date.getDate()}</span>${count?`<small>${count} · 完了</small>`:''}${scheduled && nextDate===key?`<small class="calendar-planned">${next.held?'仮予定':'予定'}</small>`:''}</button>`;
      }).join('')}</div></section>
      <section class="surface calendar-agenda"><h2 class="section-title">${app.model.formatDate(selected)}</h2>${daySessions.map(s=>`<div class="calendar-agenda-row"><strong>${escape(s.dayName)}</strong><span class="tag">完了</span><button class="button button--ghost" data-page="history">履歴を見る</button></div>`).join('')}${scheduled && selected===nextDate?`<div class="calendar-agenda-row"><strong>${escape(next.day.name)}</strong><span class="tag">${next.held ? '仮予定' : '予定'}</span><span>${next.at.toTimeString().slice(0,5)}</span></div>`:''}${!daySessions.length && !(scheduled && selected===nextDate)?'<p class="form-help">この日の記録・予定はありません。</p>':''}</section>`;
  }

  function bind(app) {
    app.root.onclick = event => {
      const dateButton=event.target.closest('[data-calendar-date]');
      if(dateButton){selected=dateButton.dataset.calendarDate;app.render();return;}
      const action=event.target.closest('[data-calendar-action]')?.dataset.calendarAction;
      if(!action)return;
      if(['previous','next','today'].includes(action)){
        if(action==='today'){month=new Date(new Date().getFullYear(),new Date().getMonth(),1);selected=keyDate(new Date());}
        else month=new Date(month.getFullYear(),month.getMonth()+(action==='next'?1:-1),1);
        app.render();return;
      }
      const next=proposal(app.state);if(!next)return;
      if(action==='cancel'||action==='restore'){
        app.commit(state=>{if(action==='cancel')state.calendarOverrides[next.id]=null;else delete state.calendarOverrides[next.id];});return;
      }
      app.openDialog({title:'日時を変更',submitLabel:'保存',html:`<label class="field">予定日時<input name="scheduledAt" type="datetime-local" value="${keyDate(next.at)}T${next.at.toTimeString().slice(0,5)}" required></label>`,onSubmit(form){
        const input=form.elements.scheduledAt;const at=new Date(input.value);
        if(!input.value||!Number.isFinite(at.getTime())){app.dialogError('有効な日時を入力してください。');return false;}
        return app.commit(state=>{state.calendarOverrides[next.id]=at.toISOString();});
      }});
    };
  }
  const api={proposal,render,bind};
  if(typeof window!=='undefined')window.FitnessCalendar=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
