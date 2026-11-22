(() => {
  'use strict';

  const model = window.FitnessModel;
  const training = window.FitnessTraining;
  const records = window.FitnessRecords;
  const recovery = window.FitnessRecoveryView;
  const root = document.getElementById('main-content');
  const dialog = document.getElementById('app-dialog');
  const form = document.getElementById('dialog-form');
  const errorLine = document.getElementById('dialog-error');
  const toast = document.getElementById('toast');
  const storageProblem = document.getElementById('storage-problem');
  const storageKey = model.STORAGE_KEY;
  const pages = {
    dashboard: ['ダッシュボード', records.renderDashboard],
    training: ['トレーニングプラン', training.render],
    history: ['履歴', records.renderHistory],
    progress: ['進捗', records.renderProgress],
    recovery: ['リカバリー', recovery.render],
    calendar: ['カレンダー', window.FitnessCalendar.render],
  };

  const paths = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 15h3"/>',
    dumbbell: '<path d="M6 8v8m12-8v8M3 10v4m18-4v4M6 12H3m3 0h12m0 0h3"/><rect x="6" y="6" width="3" height="12" rx="1"/><rect x="15" y="6" width="3" height="12" rx="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    grip: '<circle cx="9" cy="5" r=".9"/><circle cx="15" cy="5" r=".9"/><circle cx="9" cy="12" r=".9"/><circle cx="15" cy="12" r=".9"/><circle cx="9" cy="19" r=".9"/><circle cx="15" cy="19" r=".9"/>',
    edit: '<path d="m14 6 4 4M4 20l4-.9L20 7a2.8 2.8 0 0 0-4-4L4.8 15z"/>',
    trash: '<path d="M4 7h16m-10 4v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    'chevron-up': '<path d="m6 15 6-6 6 6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'arrow-right': '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    'arrow-up-right': '<path d="M6 18 18 6M8 6h10v10"/>',
    activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    chart: '<path d="M4 4v16h16M8 15l4-5 3 2 5-6"/>',
    chest: '<path d="M9 4c0 3 6 3 6 0m-6 0L4 7l2 5v7m9-15 5 3-2 5v7M7 11c2 2 4 2 5 0 1 2 3 2 5 0m-5-4v11"/>',
    back: '<path d="M5 6c3-2 4-2 7-2s4 0 7 2l-2 6-1 7H8l-1-7-2-6Zm7 0v11m-4-9 2 3m6-3-2 3"/>',
    shoulders: '<path d="M8 4c1 2 2 3 4 3s3-1 4-3M9 6 5 8l-2 4 3 2m9-8 4 2 2 4-3 2M8 10l-1 9m9-9 1 9"/>',
    legs: '<path d="M8 4h8l2 7-2 2 1 7h-3l-2-7-2 7H7l1-7-2-2 2-7Zm4 2v6"/>',
    core: '<path d="M6 5l2 6-1 8h10l-1-8 2-6M12 6v10M10 9h4m-4 4h4"/>',
    arm: '<path d="M4 15l3-7 3-3 3 1-1 3-2 1 1 5c2-3 4-4 7-2 2 1 2 4 0 6H8l-4-4Z"/>',
  };

  function icon(name, size = 20) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  function escape(value) {
    const entities = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
    return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
  }

  let storage;
  let lastSaved;
  let blocked = false;
  let toastTimer;
  let submitDialog;
  let dialogOpener;
  let state;

  function showStorageProblem(message) {
    storageProblem.textContent = message;
    storageProblem.hidden = !message;
    document.querySelector('.storage-status').classList.toggle('has-error', Boolean(message));
    document.getElementById('storage-label').textContent = message ? '保存を確認してください' : 'この端末に保存';
  }

  try {
    storage = window.localStorage;
    const loaded = model.loadState(storage);
    state = loaded.state;
    lastSaved = loaded.raw;
    if (loaded.error) {
      blocked = true;
      showStorageProblem(loaded.error);
    }
  } catch {
    blocked = true;
    showStorageProblem('ブラウザーの保存領域にアクセスできません。設定を確認してから、ページを開き直してください。');
  }

  function requestedPage() {
    const page = window.location.hash.slice(1);
    return Object.hasOwn(pages, page) ? page : 'dashboard';
  }

  function render() {
    window.FitnessI18n.setNames(app.state);
    const [label, renderPage] = pages[app.page];
    document.getElementById('current-page').textContent = label;
    const date = new Date();
    const today = document.getElementById('today');
    today.dateTime = model.localDate(date);
    today.textContent = new Intl.DateTimeFormat('ja-JP', {year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'}).format(date);

    document.querySelectorAll('.nav-link').forEach((link) => {
      if (link.dataset.page === app.page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    for (const property of ['onclick', 'oninput', 'onchange', 'ondragstart', 'ondragover', 'ondragleave', 'ondrop', 'ondragend']) {
      root[property] = null;
    }
    root.innerHTML = renderPage(app);
    if (app.page === 'training') training.bind(app);
    else if (app.page === 'recovery') recovery.bind(app);
    else if (app.page === 'calendar') window.FitnessCalendar.bind(app);
    else records.bind(app);
  }

  function notify(message, kind = 'success') {
    window.clearTimeout(toastTimer);
    toast.innerHTML = icon(kind === 'error' ? 'info' : 'check') + `<span>${escape(message)}</span>`;
    toast.classList.toggle('toast--error', kind === 'error');
    toast.hidden = false;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4200);
  }

  function commit(mutator, {render: redraw = true} = {}) {
    if (blocked) {
      notify('画面上部の保存に関する案内を確認してください。', 'error');
      return false;
    }

    const next = structuredClone(app.state);
    mutator(next);
    try {
      if (storage.getItem(storageKey) !== lastSaved) {
        blocked = true;
        showStorageProblem('別のタブで記録が変更されました。ページを再読み込みして、最新の記録を表示してください。');
        return false;
      }
      model.saveState(storage, next);
      lastSaved = JSON.stringify(next);
    } catch {
      showStorageProblem('変更を保存できませんでした。ブラウザーの保存設定や空き容量を確認してください。');
      notify('変更を保存できませんでした。', 'error');
      return false;
    }

    app.state = next;
    if (!storageProblem.hidden) showStorageProblem('');
    if (redraw) render();
    return true;
  }

  function dialogError(message) {
    errorLine.textContent = message;
    errorLine.hidden = !message;
  }

  function openDialog({title, html, submitLabel, cancelLabel = 'キャンセル', onSubmit, onOpen, destructive = false}) {
    dialogOpener = document.activeElement;
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-body').innerHTML = html;
    const submit = document.getElementById('dialog-submit');
    submit.textContent = submitLabel;
    submit.className = `button ${destructive ? 'button--danger' : 'button--primary'}`;
    dialog.querySelector('.dialog-footer [data-close-dialog]').textContent = cancelLabel;
    dialogError('');
    submitDialog = onSubmit;
    dialog.showModal();
    onOpen?.(form);
    const firstField = dialog.querySelector('[autofocus], .dialog-body input, .dialog-body select');
    if (firstField) firstField.focus();
    else dialog.querySelector('.dialog-footer [data-close-dialog]').focus();
  }

  function confirm({title, message, submitLabel, onConfirm}) {
    openDialog({title, html: `<p>${escape(message)}</p>`, submitLabel, onSubmit: onConfirm, destructive: true});
  }

  function navigate(page) {
    if (page === app.page) return;
    window.clearTimeout(toastTimer);
    toast.hidden = true;
    app.page = page;
    render();
    window.scrollTo(0, 0);
    root.focus({preventScroll: true});
  }

  const app = {
    root, model, state: state || model.createInitialState(), page: requestedPage(),
    render, escape, icon, commit, openDialog, dialogError, confirm, notify,
  };

  document.querySelectorAll('[data-icon]').forEach((element) => {
    element.innerHTML = icon(element.dataset.icon, element.classList.contains('location-divider') ? 14 : 19);
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-page]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const page = link.dataset.page;
    if (!Object.hasOwn(pages, page)) return;
    event.preventDefault();
    if (window.location.hash !== `#${page}`) window.location.hash = page;
    navigate(page);
    if (page === 'training' && link.dataset.dayTarget) {
      const heading = document.getElementById(`day-title-${link.dataset.dayTarget}`);
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({preventScroll: true});
        heading.closest('.training-day').scrollIntoView({block: 'start'});
      }
    }
    if (page === 'recovery' && link.hasAttribute('data-recovery-check')) {
      const plan = app.state.plans[app.state.activePlanId];
      const day = plan.days.find(item => item.id === link.dataset.recoveryDay);
      recovery.openCheckIn(app, {day});
    }
  });
  window.addEventListener('hashchange', () => navigate(requestedPage()));
  window.addEventListener('storage', (event) => {
    if ((event.key === storageKey || event.key === null) && !blocked) {
      blocked = true;
      showStorageProblem('別のタブで記録が変更されました。ページを再読み込みして、最新の記録を表示してください。');
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    dialogError('');
    if (submitDialog && submitDialog(form) !== false) dialog.close();
  });
  form.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    submitDialog = null;
    if (dialogOpener?.isConnected) dialogOpener.focus({preventScroll: true});
    else root.focus({preventScroll: true});
  });

  render();
  window.FitnessI18n.start();
})();
