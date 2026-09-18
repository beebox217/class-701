(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const state = {
    nav: 'overview',
    records: [],
    search: '',
    filterType: 'all',
    editingId: null,
    loginMode: 'login',
    classInfo: null,
    users: [],
    studentsDraft: [],
    feeItemsDraft: []
  };

  const confirmQueue = [];
  function showConfirm({ title, message, okText = '確認', cancelText = '取消', iconClass = 'bg-red-50 text-red-500', iconName = 'alert-triangle', onOk, okClass = 'bg-red-500 hover:bg-red-600' }) {
    const overlay = $('#modal-confirm');
    $('#confirm-title').textContent = title || '確認動作';
    $('#confirm-message').textContent = message || '—';
    const okBtn = $('#confirm-ok');
    okBtn.textContent = okText;
    okBtn.className = `flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition ${okClass}`;
    $('#confirm-cancel').textContent = cancelText;
    const iconWrap = $('#confirm-icon-wrap');
    iconWrap.className = `w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconClass}`;
    if (window.lucide) {
      iconWrap.innerHTML = `<i data-lucide="${iconName}" class="w-5 h-5"></i>`;
      lucide.createIcons({ root: iconWrap });
    }
    overlay.classList.remove('hidden');
    const close = (result) => {
      overlay.classList.add('hidden');
      okBtn.removeEventListener('click', onOkClick);
      $('#confirm-cancel').removeEventListener('click', onCancelClick);
      if (result && typeof onOk === 'function') onOk();
    };
    const onOkClick = () => close(true);
    const onCancelClick = () => close(false);
    okBtn.addEventListener('click', onOkClick);
    $('#confirm-cancel').addEventListener('click', onCancelClick);
  }

  function showToast(message, type = 'info', duration = 2200) {
    const container = $('#toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : type === 'warn' ? 'alert-circle' : 'info';
    el.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i><span></span>`;
    el.querySelector('span').textContent = message;
    container.appendChild(el);
    if (window.lucide) lucide.createIcons({ root: el });
    setTimeout(() => {
      el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -8px)';
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, duration);
  }

  const CATEGORY_ICONS = {
    '班費收繳': 'users', '捐款': 'heart-handshake', '活動收入': 'party-popper', '其他收入': 'plus-square',
    '活動費用': 'calendar-range', '書籍用品': 'book-open', '點心餐飲': 'utensils',
    '交通費': 'bus', '禮物獎品': 'gift', '其他支出': 'more-horizontal'
  };
  function iconForCategory(cat) { return CATEGORY_ICONS[cat] || (cat && cat.includes('收入') ? 'plus-circle' : 'minus-circle'); }

  function formatCurrency(n) {
    const v = Number(n) || 0;
    return 'NT$ ' + v.toLocaleString('zh-TW');
  }
  function formatDate(d) {
    if (!d) return '';
    const s = String(d);
    const match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return s;
    return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
  }
  function formatDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(Number(ts) || ts);
    if (isNaN(d.getTime())) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  const VALID_PAGES = ['overview', 'records', 'settings', 'login'];

  function switchNav(name, { updateHash = true } = {}) {
    const loggedIn = window.AppAuth.isLoggedIn();
    if (!loggedIn && name !== 'login') name = 'login';
    if (loggedIn && name === 'login') name = 'overview';
    if (!VALID_PAGES.includes(name)) name = loggedIn ? 'overview' : 'login';

    if (loggedIn && name === 'settings' && !window.AppAuth.canAccessSettings()) {
      showToast('您沒有權限造訪設定頁', 'warn');
      name = 'overview';
    }

    state.nav = name;

    $$('.page-section').forEach((s) => s.classList.add('hidden'));
    const page = document.getElementById(`page-${name}`);
    if (page) page.classList.remove('hidden');

    $$('.footer-nav').forEach((btn) => {
      const active = loggedIn && btn.dataset.nav === name;
      btn.classList.toggle('active', active);
    });

    const addBtn = $('#btn-add-income-expense');
    if (addBtn) {
      if (name === 'records' && window.AppAuth.canWrite()) addBtn.classList.remove('hidden');
      else addBtn.classList.add('hidden');
    }

    const footer = $('#app-footer');
    const headerSub = $('#header-subtitle');
    if (name === 'login') {
      footer.classList.add('hidden');
      headerSub.classList.add('hidden');
    } else {
      if (loggedIn) footer.classList.remove('hidden');
      else footer.classList.add('hidden');
      if (loggedIn) headerSub.classList.remove('hidden');
      else headerSub.classList.add('hidden');
    }

    if (updateHash) {
      try { history.replaceState(null, '', `#${name}`); } catch (e) { /* ignore */ }
    }
    $('#app-main').scrollTop = 0;
    if (name === 'settings') {
      if (!state.classInfo) loadSettingsData().then(refreshIcons);
      else refreshIcons();
    } else {
      refreshIcons();
    }
  }

  function refreshIcons() { if (window.lucide) lucide.createIcons(); }

  function renderStats(records) {
    const stats = window.AppDB.computeStats(records);
    $('#stat-balance').textContent = formatCurrency(stats.balance);
    $('#stat-income').textContent = formatCurrency(stats.income);
    $('#stat-expense').textContent = formatCurrency(stats.expense);
    const header = $('#header-balance-short');
    if (header) header.textContent = `餘額：${formatCurrency(stats.balance)}`;
  }

  function recordCardHTML(r, { touchable = true } = {}) {
    const iconName = iconForCategory(r.category);
    const sign = r.type === 'income' ? '+' : '-';
    const amountClass = r.type === 'income' ? 'income' : 'expense';
    const touchableClass = touchable && window.AppAuth.canWrite() ? 'touchable' : '';
    const creator = r.createdBy && r.createdBy.name ? `<span class="badge ml-1">${r.createdBy.name}</span>` : '';
    const note = r.note ? `<div class="record-sub"><span class="inline-block max-w-full truncate">${escapeHTML(r.note)}</span></div>` : '';
    return `
      <div class="record-item ${touchableClass}" data-id="${r.id}" role="${touchable ? 'button' : 'listitem'}">
        <div class="record-icon ${r.type}"><i data-lucide="${iconName}" class="w-5 h-5"></i></div>
        <div class="record-body">
          <div class="record-title">
            <span>${escapeHTML(r.category)}</span>${creator}
          </div>
          <div class="record-sub">${formatDate(r.date)}</div>
          ${note}
        </div>
        <div class="record-amount ${amountClass}">${sign}${Number(r.amount).toLocaleString('zh-TW')}</div>
      </div>
    `;
  }

  function escapeHTML(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function applyFilters(list) {
    const search = state.search.trim().toLowerCase();
    return list.filter((r) => {
      if (state.filterType !== 'all' && r.type !== state.filterType) return false;
      if (!search) return true;
      return ((r.category || '').toLowerCase().includes(search) ||
              (r.note || '').toLowerCase().includes(search) ||
              String(r.amount).includes(search));
    });
  }

  function renderRecent() {
    const list = (state.records || []).slice(0, 5);
    const wrap = $('#recent-records-list');
    if (!list.length) {
      wrap.innerHTML = `<div class="py-6 text-center text-gray-400 text-sm">尚無紀錄</div>`;
    } else {
      wrap.innerHTML = list.map((r) => recordCardHTML(r)).join('');
    }
    bindRecordClicks(wrap);
    refreshIcons();
  }

  function renderRecordsList() {
    const list = applyFilters(state.records || []);
    const wrap = $('#records-list');
    const empty = $('#records-empty');
    $('#records-count').textContent = String(list.length);
    if (!list.length) {
      wrap.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      wrap.innerHTML = list.map((r) => recordCardHTML(r)).join('');
    }
    bindRecordClicks(wrap);
    refreshIcons();
  }

  function bindRecordClicks(root) {
    $$('.record-item', root).forEach((el) => {
      el.addEventListener('click', () => {
        if (!window.AppAuth.canWrite()) {
          showToast('僅管理員可編輯/刪除', 'warn');
          return;
        }
        const id = el.dataset.id;
        const record = state.records.find((r) => r.id === id);
        if (record) openRecordModal(record);
      });
    });
  }

  function renderHeaderClassInfo() {
    const info = state.classInfo || window.AppFirebase.getClassInfo();
    const el = $('#header-class-name');
    if (el && info && info.className) el.textContent = info.className;
    const input = $('#settings-class-name');
    if (input && info && info.className && document.activeElement !== input) {
      input.value = info.className;
    }
  }

  function roleText(user) {
    if (!user || user.role === 'guest') return '訪客';
    if (user.role === 'admin') return '管理員';
    if (user.role === 'teacher') return '老師';
    return '家長';
  }

  function renderUser() {
    const user = window.AppAuth.getUser();
    const badge = $('#user-role-badge');
    const btnLoginHeader = $('#btn-login-header');
    const btnLogout = $('#btn-logout');
    const btnLogoutSettings = $('#btn-logout-settings');
    const addBtn = $('#btn-add-income-expense');

    if (user && user.role !== 'guest') {
      badge.classList.remove('hidden');
      badge.textContent = roleText(user);
      if (btnLogout) btnLogout.classList.remove('hidden');
      if (btnLogoutSettings) btnLogoutSettings.classList.remove('hidden');
      if (btnLoginHeader) btnLoginHeader.innerHTML = `<i data-lucide="user" class="w-5 h-5"></i>`;
      refreshIcons();
    } else {
      badge.classList.add('hidden');
      if (btnLogout) btnLogout.classList.add('hidden');
      if (btnLogoutSettings) btnLogoutSettings.classList.add('hidden');
      if (btnLoginHeader) btnLoginHeader.innerHTML = `<i data-lucide="log-in" class="w-5 h-5"></i>`;
      refreshIcons();
    }

    if (addBtn) {
      if (state.nav === 'records' && window.AppAuth.canWrite()) addBtn.classList.remove('hidden');
      else addBtn.classList.add('hidden');
    }

    $('#settings-my-name').textContent = user && user.displayName ? user.displayName : (user && user.email ? user.email.split('@')[0] : '未登入');
    $('#settings-my-email').textContent = user && user.email ? user.email : '—';
    $('#settings-my-role').textContent = roleText(user);

    $('#profile-my-name').textContent = user && user.displayName ? user.displayName : (user && user.email ? user.email.split('@')[0] : '未登入');
    $('#profile-my-email').textContent = user && user.email ? user.email : '—';
    $('#profile-my-role').textContent = roleText(user);
    $('#profile-my-role-text').textContent = roleText(user);
    $('#profile-my-provider').textContent = (user && user.provider) ? (user.provider === 'password' ? 'Email / 密碼' : (user.provider === 'firebase' ? 'Firebase' : user.provider)) : '—';
    $('#profile-my-login-at').textContent = (user && user.loginAt) ? formatDateTime(user.loginAt) : '—';
    const btnProfileLogout = $('#btn-profile-logout');
    if (btnProfileLogout) {
      if (user && user.role !== 'guest') btnProfileLogout.classList.remove('hidden');
      else btnProfileLogout.classList.add('hidden');
    }
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('hidden');
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('hidden');
  }
  function bindModalClose() {
    $$('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.modal;
        if (id) closeModal(id);
      });
    });
    $$('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
      });
    });
  }

  function goToLoginPage() {
    $('#login-email').value = '';
    $('#login-password').value = '';
    $('#login-displayname').value = '';
    setLoginTab('login');
    switchNav('login');
  }

  function setLoginTab(mode) {
    state.loginMode = mode;
    const tabLogin = $('#login-tab-login');
    const tabRegister = $('#login-tab-register');
    const nameWrap = $('#register-name-wrap');
    const primaryBtn = $('#btn-primary-auth');
    const hint = $('#login-form-hint');

    if (mode === 'login') {
      tabLogin.className = 'py-3 text-sm font-semibold text-[#28837a] border-b-2 border-[#28837a] transition';
      tabRegister.className = 'py-3 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 transition';
      nameWrap.classList.add('hidden');
      primaryBtn.textContent = '登入';
      hint.textContent = '首次使用請切換至「註冊」建立帳號';
    } else {
      tabRegister.className = 'py-3 text-sm font-semibold text-[#28837a] border-b-2 border-[#28837a] transition';
      tabLogin.className = 'py-3 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 transition';
      nameWrap.classList.remove('hidden');
      primaryBtn.textContent = '註冊並登入';
      hint.textContent = '註冊後自動登入，密碼至少 6 碼';
    }
    refreshIcons();
  }

  function openRecordModal(record) {
    const title = $('#record-modal-title');
    const form = $('#record-form');
    const deleteBtn = $('#record-delete-btn');
    const catSelect = $('#record-category');
    form.reset();
    state.editingId = null;
    rebuildCategoryOptions();

    if (record) {
      state.editingId = record.id;
      title.innerHTML = `<i data-lucide="edit-3" class="w-5 h-5 text-[#28837a]"></i>編輯收支紀錄`;
      $$('input[name="record-type"]').forEach((r) => { r.checked = r.value === record.type; });
      $('#record-amount').value = record.amount;
      $('#record-category').value = record.category;
      $('#record-date').value = record.date;
      $('#record-note').value = record.note || '';
      $('#record-id').value = record.id;
      deleteBtn.classList.remove('hidden');
    } else {
      title.innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5 text-[#28837a]"></i>新增收支紀錄`;
      $$('input[name="record-type"]')[1].checked = true;
      $('#record-date').value = todayISO();
      $('#record-id').value = '';
      deleteBtn.classList.add('hidden');
    }
    refreshIcons();
    openModal('modal-add-record');
  }

  function rebuildCategoryOptions() {
    const sel = $('#record-category');
    if (!sel) return;
    const current = sel.value;
    const income = [];
    const expense = [];
    (state.classInfo && state.classInfo.feeItems || []).forEach((f) => {
      if (f.type === 'income') income.push(f.name);
      else expense.push(f.name);
    });
    if (!income.length) income.push('班費收繳', '捐款', '活動收入', '其他收入');
    if (!expense.length) expense.push('活動費用', '書籍用品', '點心餐飲', '交通費', '禮物獎品', '其他支出');
    const buildOpt = (val) => `<option value="${escapeHTML(val)}"${val === current ? ' selected' : ''}>${escapeHTML(val)}</option>`;
    sel.innerHTML = [
      '<option value="">請選擇分類</option>',
      '<optgroup label="收入">',
      income.map(buildOpt).join(''),
      '</optgroup>',
      '<optgroup label="支出">',
      expense.map(buildOpt).join(''),
      '</optgroup>'
    ].join('');
  }

  function handleRecordSubmit(e) {
    e.preventDefault();
    if (!window.AppAuth.canWrite()) {
      showToast('僅管理員可變更紀錄', 'warn');
      return;
    }
    const type = ($$('input[name="record-type"]').find((r) => r.checked) || {}).value || 'income';
    const amount = parseFloat($('#record-amount').value);
    const category = $('#record-category').value;
    const date = $('#record-date').value;
    const note = $('#record-note').value.trim();
    if (!amount || amount <= 0) { showToast('請輸入有效金額', 'error'); return; }
    if (!category) { showToast('請選擇分類', 'error'); return; }
    if (!date) { showToast('請選擇日期', 'error'); return; }

    const payload = { type, amount, category, date, note };
    const id = $('#record-id').value;
    const op = id ? window.AppDB.updateRecord(id, payload) : window.AppDB.addRecord(payload);

    op.then(() => {
      showToast(id ? '已更新紀錄' : '已新增紀錄', 'success');
      closeModal('modal-add-record');
      form.reset();
      state.editingId = null;
    }).catch((err) => showToast(err && err.message ? err.message : '儲存失敗', 'error'));
  }

  function handleDeleteRecord() {
    const id = state.editingId;
    if (!id) return;
    const record = state.records.find((r) => r.id === id);
    if (!record) return;
    showConfirm({
      title: '確認刪除？',
      message: `即將刪除「${record.category}」${Number(record.amount).toLocaleString('zh-TW')} 元的紀錄，此動作無法復原。`,
      okText: '確認刪除',
      iconClass: 'bg-red-50 text-red-500',
      iconName: 'trash-2',
      okClass: 'bg-red-500 hover:bg-red-600',
      onOk: () => {
        window.AppDB.deleteRecord(id)
          .then(() => {
            showToast('已刪除紀錄', 'success');
            closeModal('modal-add-record');
            state.editingId = null;
          })
          .catch((err) => showToast(err && err.message ? err.message : '刪除失敗', 'error'));
      }
    });
  }

  function handlePrimaryAuth() {
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    if (!email || !password) { showToast('請填入 Email 與密碼', 'warn'); return; }

    const btn = $('#btn-primary-auth');
    btn.disabled = true;
    btn.classList.add('opacity-70', 'cursor-not-allowed');

    let op;
    if (state.loginMode === 'login') {
      op = window.AppAuth.loginWithEmail(email, password);
    } else {
      if (password.length < 6) {
        btn.disabled = false;
        btn.classList.remove('opacity-70', 'cursor-not-allowed');
        showToast('密碼至少 6 碼', 'warn');
        return;
      }
      const displayName = $('#login-displayname').value.trim();
      op = window.AppAuth.registerWithEmail(email, password, displayName);
    }

    op.then(() => {
      showToast(state.loginMode === 'login' ? '登入成功' : '註冊並登入成功', 'success');
      switchNav('overview');
    }).catch((e) => {
      showToast(e.message || '操作失敗', 'error');
    }).finally(() => {
      btn.disabled = false;
      btn.classList.remove('opacity-70', 'cursor-not-allowed');
    });
  }

  function bindLoginButtons() {
    $('#btn-login-header').addEventListener('click', () => {
      if (window.AppAuth.isLoggedIn()) {
        renderUser();
        openModal('modal-profile');
      } else {
        goToLoginPage();
      }
    });

    const doLogout = () => {
      showConfirm({
        title: '確認登出？',
        message: '登出後必須重新登入才能使用系統。',
        okText: '登出',
        iconClass: 'bg-amber-50 text-amber-600',
        iconName: 'log-out',
        okClass: 'bg-[#28837a] hover:bg-[#236f67]',
        onOk: () => {
          closeModal('modal-profile');
          window.AppAuth.logout().then(() => {
            showToast('已登出', 'success');
            goToLoginPage();
          });
        }
      });
    };
    const btnLogout = $('#btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', doLogout);
    const btnLogoutSettings = $('#btn-logout-settings');
    if (btnLogoutSettings) btnLogoutSettings.addEventListener('click', doLogout);
    const btnProfileLogout = $('#btn-profile-logout');
    if (btnProfileLogout) btnProfileLogout.addEventListener('click', doLogout);

    const btnProfileGotoSettings = $('#btn-profile-goto-settings');
    if (btnProfileGotoSettings) {
      btnProfileGotoSettings.addEventListener('click', () => {
        closeModal('modal-profile');
        if (window.AppAuth.canAccessSettings()) switchNav('settings');
        else { showToast('您沒有權限造訪設定頁', 'warn'); switchNav('overview'); }
      });
    }

    $('#login-tab-login').addEventListener('click', () => setLoginTab('login'));
    $('#login-tab-register').addEventListener('click', () => setLoginTab('register'));

    $('#btn-toggle-password').addEventListener('click', () => {
      const pwd = $('#login-password');
      const btn = $('#btn-toggle-password');
      if (pwd.type === 'password') {
        pwd.type = 'text';
        btn.innerHTML = `<i data-lucide="eye-off" class="w-4 h-4 text-gray-400"></i>`;
      } else {
        pwd.type = 'password';
        btn.innerHTML = `<i data-lucide="eye" class="w-4 h-4 text-gray-400"></i>`;
      }
      refreshIcons();
    });

    $('#btn-primary-auth').addEventListener('click', handlePrimaryAuth);
    $('#login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handlePrimaryAuth();
    });
    $('#login-email').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#login-password').focus();
    });
  }

  function bindNav() {
    $$('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.nav;
        switchNav(name);
      });
    });
  }

  function bindRecordForm() {
    $('#record-form').addEventListener('submit', handleRecordSubmit);
    $('#record-delete-btn').addEventListener('click', handleDeleteRecord);
    const addBtn = $('#btn-add-income-expense');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (!window.AppAuth.canWrite()) { showToast('僅管理員可新增', 'warn'); return; }
        openRecordModal(null);
      });
    }
  }

  function bindSearch() {
    const input = $('#search-input');
    const clear = $('#search-clear');
    const updateClear = () => {
      if (input.value.trim()) clear.classList.remove('hidden');
      else clear.classList.add('hidden');
    };
    input.addEventListener('input', () => {
      state.search = input.value;
      updateClear();
      renderRecordsList();
    });
    clear.addEventListener('click', () => {
      input.value = '';
      state.search = '';
      updateClear();
      renderRecordsList();
      input.focus();
    });
    $('#filter-type').addEventListener('change', (e) => {
      state.filterType = e.target.value || 'all';
      renderRecordsList();
    });
  }

  function bindOffline() {
    const update = () => {
      const banner = $('#offline-banner');
      if (!navigator.onLine) banner.classList.remove('hidden');
      else banner.classList.add('hidden');
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then((reg) => { console.info('[SW] 註冊成功:', reg.scope); })
        .catch((err) => { console.warn('[SW] 註冊失敗:', err); });
    });
  }

  function handleURL() {
    const h = (window.location.hash || '').replace(/^#/, '');
    const params = new URLSearchParams(window.location.search);
    const loggedIn = window.AppAuth.isLoggedIn();

    let target;
    if (VALID_PAGES.includes(h)) target = h;
    else if (VALID_PAGES.includes(params.get('nav'))) target = params.get('nav');
    else target = loggedIn ? 'overview' : 'login';

    switchNav(target, { updateHash: true });

    window.addEventListener('hashchange', () => {
      const nh = (window.location.hash || '').replace(/^#/, '');
      if (VALID_PAGES.includes(nh)) switchNav(nh, { updateHash: false });
    });
    if (params.get('action') === 'add' && window.AppAuth.canWrite()) {
      setTimeout(() => openRecordModal(null), 300);
    }
  }

  /* ================= 設定頁邏輯 ================= */

  function loadSettingsData() {
    return window.AppDB.getClassInfo().then((info) => {
      state.classInfo = info;
      state.studentsDraft = JSON.parse(JSON.stringify(info.students || []));
      state.feeItemsDraft = JSON.parse(JSON.stringify(info.feeItems || []));
      renderHeaderClassInfo();
      renderStudents();
      renderFeeItems();
      rebuildCategoryOptions();
      return loadUsersRoles();
    }).catch(() => {
      showToast('無法載入設定，請稍後再試', 'error');
    });
  }

  function renderStudents() {
    const list = state.studentsDraft || [];
    const wrap = $('#students-list');
    const empty = $('#students-empty');
    if (!list.length) {
      wrap.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    const disabled = !window.AppAuth.canWrite() ? ' disabled' : '';
    const disabledClass = disabled ? ' opacity-60 cursor-not-allowed' : '';
    wrap.innerHTML = list.map((s, idx) => `
      <div class="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-[#fbfdfd]">
        <div class="w-12 shrink-0">
          <input type="number" min="1" value="${Number((s && s.seat) != null ? s.seat : (idx + 1))}"
            data-idx="${idx}" data-field="seat" class="student-input w-full px-2 py-1.5 rounded-md border border-gray-200 text-sm text-center focus:border-[#28837a] outline-none transition${disabled}${disabledClass}" />
        </div>
        <input type="text" value="${escapeHTML((s && s.name) || '')}" placeholder="姓名"
          data-idx="${idx}" data-field="name" class="student-input flex-1 px-3 py-1.5 rounded-md border border-gray-200 text-sm focus:border-[#28837a] outline-none transition${disabled}${disabledClass}" />
        <button type="button" data-idx="${idx}" class="btn-remove-student p-1.5 rounded-md hover:bg-red-50 text-red-500 transition${disabled}${disabledClass}"${disabled}>
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `).join('');
    $$('.student-input', wrap).forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const idx = Number(e.target.dataset.idx);
        const f = e.target.dataset.field;
        if (!state.studentsDraft[idx]) state.studentsDraft[idx] = { seat: idx + 1, name: '' };
        if (f === 'seat') state.studentsDraft[idx].seat = Number(e.target.value) || 0;
        else state.studentsDraft[idx].name = e.target.value;
      });
    });
    $$('.btn-remove-student', wrap).forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        state.studentsDraft.splice(idx, 1);
        renderStudents();
        refreshIcons();
      });
    });
    refreshIcons();
  }

  function renderFeeItems() {
    const list = state.feeItemsDraft || [];
    const wrap = $('#fee-items-list');
    const empty = $('#fee-items-empty');
    if (!list.length) {
      wrap.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    const disabled = !window.AppAuth.canWrite() ? ' disabled' : '';
    const disabledClass = disabled ? ' opacity-60 cursor-not-allowed' : '';
    wrap.innerHTML = list.map((f, idx) => {
      const type = (f && f.type) === 'income' ? 'income' : 'expense';
      return `
      <div class="grid grid-cols-12 gap-2 items-center p-2 rounded-lg border border-gray-100 bg-[#fbfdfd]">
        <input type="text" value="${escapeHTML((f && f.name) || '')}" placeholder="項目名稱"
          data-idx="${idx}" data-field="name" class="fee-item-input col-span-5 px-3 py-1.5 rounded-md border border-gray-200 text-sm focus:border-[#28837a] outline-none transition${disabled}${disabledClass}" />
        <input type="text" value="${escapeHTML((f && f.account) || '')}" placeholder="帳號"
          data-idx="${idx}" data-field="account" class="fee-item-input col-span-3 px-3 py-1.5 rounded-md border border-gray-200 text-sm focus:border-[#28837a] outline-none transition${disabled}${disabledClass}" />
        <select data-idx="${idx}" data-field="type" class="fee-item-input col-span-3 px-2 py-1.5 rounded-md border border-gray-200 text-sm bg-white focus:border-[#28837a] outline-none transition${disabled}${disabledClass}">
          <option value="income"${type === 'income' ? ' selected' : ''}>收入</option>
          <option value="expense"${type === 'expense' ? ' selected' : ''}>支出</option>
        </select>
        <button type="button" data-idx="${idx}" class="btn-remove-fee-item col-span-1 flex justify-center p-1.5 rounded-md hover:bg-red-50 text-red-500 transition${disabled}${disabledClass}"${disabled}>
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `}).join('');
    $$('.fee-item-input', wrap).forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const idx = Number(e.target.dataset.idx);
        const f = e.target.dataset.field;
        if (!state.feeItemsDraft[idx]) state.feeItemsDraft[idx] = { name: '', account: '', type: 'expense' };
        state.feeItemsDraft[idx][f] = (f === 'type') ? (e.target.value === 'income' ? 'income' : 'expense') : e.target.value;
      });
      inp.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.idx);
        const f = e.target.dataset.field;
        if (!state.feeItemsDraft[idx]) state.feeItemsDraft[idx] = { name: '', account: '', type: 'expense' };
        state.feeItemsDraft[idx][f] = (f === 'type') ? (e.target.value === 'income' ? 'income' : 'expense') : e.target.value;
      });
    });
    $$('.btn-remove-fee-item', wrap).forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        state.feeItemsDraft.splice(idx, 1);
        renderFeeItems();
        refreshIcons();
      });
    });
    refreshIcons();
  }

  function loadUsersRoles() {
    if (!window.AppDB.listUsers) return Promise.resolve();
    return window.AppDB.listUsers().then((users) => {
      state.users = users;
      renderUsersRoles();
    });
  }

  function renderUsersRoles() {
    const wrap = $('#users-roles-list');
    const empty = $('#users-roles-empty');
    const list = state.users || [];
    const adminEmails = (window.AppFirebase.getClassInfo() || {}).adminEmails || [];
    if (!list.length) {
      wrap.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    const canWrite = window.AppAuth.canWrite();
    wrap.innerHTML = list.map((u) => {
      const isLockedAdmin = adminEmails.some((x) => (x || '').toLowerCase().trim() === (u.email || '').toLowerCase().trim());
      let role = (u.role === 'admin' || u.role === 'teacher' || u.role === 'parent') ? u.role : 'parent';
      if (isLockedAdmin) role = 'admin';
      const disabled = !canWrite ? ' disabled' : (isLockedAdmin ? ' disabled' : '');
      const disabledClass = disabled ? ' opacity-60 cursor-not-allowed' : '';
      const lockBadge = isLockedAdmin ? `<span class="badge ml-2">系統管理員</span>` : '';
      return `
      <div class="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-[#fbfdfd]">
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-800 truncate flex items-center">
            ${escapeHTML(u.displayName || (u.email ? u.email.split('@')[0] : '使用者'))}
            ${lockBadge}
          </div>
          <div class="text-[11px] text-gray-500 truncate">${escapeHTML(u.email || '')}</div>
        </div>
        <select data-uid="${escapeHTML(u.uid)}" class="user-role-select px-2 py-1.5 rounded-md border border-gray-200 text-xs bg-white focus:border-[#28837a] outline-none transition${disabled}${disabledClass}"${disabled}>
          <option value="parent"${role === 'parent' ? ' selected' : ''}>家長</option>
          <option value="teacher"${role === 'teacher' ? ' selected' : ''}>老師</option>
          <option value="admin"${role === 'admin' ? ' selected' : ''}>管理員</option>
        </select>
      </div>
    `}).join('');
    $$('.user-role-select', wrap).forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const uid = e.target.dataset.uid;
        const next = e.target.value;
        const op = window.AppAuth.canWrite() ? window.AppDB.updateUserRole(uid, next) : Promise.reject(new Error('無權限'));
        op.then((res) => {
          const u = state.users.find((x) => x.uid === uid);
          if (u) u.role = res && res.role ? res.role : next;
          showToast('已變更角色', 'success');
          if (window.AppAuth.isLoggedIn()) {
            const me = window.AppAuth.getUser();
            if (me && me.uid === uid) {
              if (window.AppAuth.refreshRoleFromDB) window.AppAuth.refreshRoleFromDB();
            }
          }
        }).catch((err) => {
          showToast(err && err.message ? err.message : '變更失敗', 'error');
          renderUsersRoles();
        });
      });
    });
    refreshIcons();
  }

  function applyReadOnlyToSettings() {
    const canWrite = window.AppAuth.canWrite();
    const disable = (el) => {
      if (!el) return;
      if (canWrite) { el.removeAttribute('disabled'); el.classList.remove('opacity-60', 'cursor-not-allowed'); }
      else { el.setAttribute('disabled', 'disabled'); el.classList.add('opacity-60', 'cursor-not-allowed'); }
    };
    disable($('#settings-class-name'));
    disable($('#btn-save-class'));
    disable($('#btn-add-student'));
    disable($('#btn-save-students'));
    disable($('#btn-add-fee-item'));
    disable($('#btn-save-fee-items'));
    disable($('#btn-refresh-users'));
    renderStudents();
    renderFeeItems();
    renderUsersRoles();
  }

  function bindSettingsPage() {
    const canSave = () => window.AppAuth.canWrite();

    $('#btn-save-class').addEventListener('click', () => {
      if (!canSave()) { showToast('僅管理員可變更設定', 'warn'); return; }
      const name = ($('#settings-class-name').value || '').trim();
      if (!name) { showToast('請輸入班級名稱', 'warn'); return; }
      window.AppDB.saveClassInfo({
        className: name,
        students: state.studentsDraft,
        feeItems: state.feeItemsDraft
      }).then((info) => {
        state.classInfo = info;
        renderHeaderClassInfo();
        showToast('已儲存班級名稱', 'success');
      }).catch((err) => showToast(err && err.message ? err.message : '儲存失敗', 'error'));
    });

    $('#btn-add-student').addEventListener('click', () => {
      if (!canSave()) { showToast('僅管理員可變更設定', 'warn'); return; }
      const nextSeat = state.studentsDraft.reduce((m, s) => Math.max(m, Number(s && s.seat ? s.seat : 0)), 0) + 1;
      state.studentsDraft.push({ seat: nextSeat, name: '' });
      renderStudents();
      refreshIcons();
    });

    $('#btn-save-students').addEventListener('click', () => {
      if (!canSave()) { showToast('僅管理員可變更設定', 'warn'); return; }
      window.AppDB.saveClassInfo({
        className: state.classInfo && state.classInfo.className || ($('#settings-class-name').value || '').trim() || '班級',
        students: state.studentsDraft,
        feeItems: state.feeItemsDraft
      }).then((info) => {
        state.classInfo = info;
        showToast('已儲存同學名單', 'success');
      }).catch((err) => showToast(err && err.message ? err.message : '儲存失敗', 'error'));
    });

    $('#btn-add-fee-item').addEventListener('click', () => {
      if (!canSave()) { showToast('僅管理員可變更設定', 'warn'); return; }
      state.feeItemsDraft.push({ name: '', account: '', type: 'expense' });
      renderFeeItems();
      refreshIcons();
    });

    $('#btn-save-fee-items').addEventListener('click', () => {
      if (!canSave()) { showToast('僅管理員可變更設定', 'warn'); return; }
      window.AppDB.saveClassInfo({
        className: state.classInfo && state.classInfo.className || ($('#settings-class-name').value || '').trim() || '班級',
        students: state.studentsDraft,
        feeItems: state.feeItemsDraft
      }).then((info) => {
        state.classInfo = info;
        rebuildCategoryOptions();
        showToast('已儲存班費項目', 'success');
      }).catch((err) => showToast(err && err.message ? err.message : '儲存失敗', 'error'));
    });

    $('#btn-refresh-users').addEventListener('click', () => {
      showToast('重新整理中…', 'info');
      loadUsersRoles().then(() => refreshIcons());
    });
  }

  function subscribeData() {
    window.AppDB.subscribeAll((list) => {
      state.records = list;
      renderStats(list);
      renderRecent();
      renderRecordsList();
    });
    if (window.AppDB.subscribeClassInfo) {
      window.AppDB.subscribeClassInfo((info) => {
        state.classInfo = info;
        state.studentsDraft = JSON.parse(JSON.stringify(info.students || []));
        state.feeItemsDraft = JSON.parse(JSON.stringify(info.feeItems || []));
        renderHeaderClassInfo();
        if (state.nav === 'settings') {
          renderStudents();
          renderFeeItems();
          applyReadOnlyToSettings();
        }
        rebuildCategoryOptions();
      });
    }
    window.AppAuth.subscribe((user) => {
      renderUser();
      if (user && user.role !== 'guest' && state.nav === 'login') {
        switchNav('overview');
      } else if ((!user || user.role === 'guest') && state.nav !== 'login') {
        switchNav('login');
      }
      if (state.nav === 'settings') {
        applyReadOnlyToSettings();
      }
      renderRecordsList();
      renderRecent();
    });
  }

  function init() {
    renderHeaderClassInfo();
    renderUser();
    bindNav();
    bindModalClose();
    bindLoginButtons();
    bindRecordForm();
    bindSearch();
    bindSettingsPage();
    bindOffline();
    registerSW();
    handleURL();
    subscribeData();
    refreshIcons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
