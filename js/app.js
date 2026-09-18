(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const state = {
    nav: 'overview',
    records: [],
    search: '',
    filterType: 'all',
    editingId: null
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
    const icon = iconWrap.querySelector('svg') || iconWrap.querySelector('svg');
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

  function switchNav(name, { updateHash = true } = {}) {
    if (!['overview', 'records', 'profile'].includes(name)) name = 'overview';
    state.nav = name;
    $$('.page-section').forEach((s) => s.classList.add('hidden'));
    $(`#page-${name}`).classList.remove('hidden');
    $$('.footer-nav').forEach((btn) => {
      const active = btn.dataset.nav === name;
      btn.classList.toggle('active', active);
    });
    if (updateHash) {
      try { history.replaceState(null, '', `#${name}`); } catch (e) { /* ignore */ }
    }
    $('#app-main').scrollTop = 0;
    refreshIcons();
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
    const info = window.AppFirebase.getClassInfo();
    const el = $('#header-class-name');
    if (el && info && info.className) el.textContent = info.className;
  }

  function renderUser() {
    const user = window.AppAuth.getUser();
    const badge = $('#user-role-badge');
    const btnLoginHeader = $('#btn-login-header');
    const btnLogout = $('#btn-logout');
    const fab = $('#fab-add');

    if (user && user.role !== 'guest') {
      badge.classList.remove('hidden');
      badge.textContent = user.role === 'admin' ? '管理員' : '成員';
      btnLogout.classList.remove('hidden');
      const icon = btnLoginHeader.querySelector('svg') || btnLoginHeader.querySelector('[data-lucide]');
      if (icon) btnLoginHeader.innerHTML = `<i data-lucide="user" class="w-5 h-5"></i>`;
      refreshIcons();
    } else {
      badge.classList.add('hidden');
      btnLogout.classList.add('hidden');
      btnLoginHeader.innerHTML = `<i data-lucide="log-in" class="w-5 h-5"></i>`;
      refreshIcons();
    }

    if (window.AppAuth.canWrite()) {
      fab.classList.remove('hidden');
    } else {
      fab.classList.add('hidden');
    }

    $('#profile-name').textContent = user && user.displayName ? user.displayName : (user && user.email ? user.email.split('@')[0] : '未登入');
    $('#profile-role').textContent = roleText(user);
    $('#profile-email').textContent = user && user.email ? user.email : '—';
    $('#profile-role-detail').textContent = roleText(user);
    $('#profile-login-time').textContent = user && user.loginAt ? formatDateTime(user.loginAt) : '—';
  }
  function roleText(user) {
    if (!user || user.role === 'guest') return '訪客模式（唯讀）';
    if (user.role === 'admin') return '管理員（可編輯）';
    return '一般成員（唯讀）';
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
        if (e.target === overlay) {
          overlay.classList.add('hidden');
        }
      });
    });
  }

  function openLoginModal() {
    $('#login-email').value = '';
    $('#login-password').value = '';
    openModal('modal-login');
  }

  function openRecordModal(record) {
    const title = $('#record-modal-title');
    const form = $('#record-form');
    const deleteBtn = $('#record-delete-btn');
    form.reset();
    state.editingId = null;

    if (record) {
      state.editingId = record.id;
      title.innerHTML = `<i data-lucide="edit-3" class="w-5 h-5 text-[#2E7D32]"></i>編輯收支紀錄`;
      $$('input[name="record-type"]').forEach((r) => { r.checked = r.value === record.type; });
      $('#record-amount').value = record.amount;
      $('#record-category').value = record.category;
      $('#record-date').value = record.date;
      $('#record-note').value = record.note || '';
      $('#record-id').value = record.id;
      deleteBtn.classList.remove('hidden');
    } else {
      title.innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5 text-[#2E7D32]"></i>新增收支紀錄`;
      $$('input[name="record-type"]')[1].checked = true;
      $('#record-date').value = todayISO();
      $('#record-id').value = '';
      deleteBtn.classList.add('hidden');
    }
    refreshIcons();
    openModal('modal-add-record');
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

  function bindLoginButtons() {
    $('#btn-login-header').addEventListener('click', () => {
      if (window.AppAuth.isLoggedIn()) { switchNav('profile'); } else { openLoginModal(); }
    });
    $('#btn-login-page').addEventListener('click', openLoginModal);

    $('#btn-logout').addEventListener('click', () => {
      showConfirm({
        title: '確認登出？',
        message: '登出後將返回訪客模式。',
        okText: '登出',
        iconClass: 'bg-amber-50 text-amber-600',
        iconName: 'log-out',
        okClass: 'bg-[#2E7D32] hover:bg-[#256528]',
        onOk: () => {
          window.AppAuth.logout().then(() => { showToast('已登出', 'success'); });
        }
      });
    });

    $('#btn-demo-admin').addEventListener('click', () => {
      window.AppAuth.loginDemoAdmin()
        .then(() => { showToast('已進入管理員模式', 'success'); closeModal('modal-login'); })
        .catch((e) => showToast(e.message || '登入失敗', 'error'));
    });
    $('#btn-demo-member').addEventListener('click', () => {
      window.AppAuth.loginDemoMember()
        .then(() => { showToast('已進入成員模式', 'success'); closeModal('modal-login'); })
        .catch((e) => showToast(e.message || '登入失敗', 'error'));
    });
    $('#btn-email-login').addEventListener('click', () => {
      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;
      if (!email || !password) { showToast('請填入 Email 與密碼', 'warn'); return; }
      window.AppAuth.loginWithEmail(email, password)
        .then(() => { showToast('登入成功', 'success'); closeModal('modal-login'); })
        .catch((e) => showToast(e.message || '登入失敗', 'error'));
    });
    $('#btn-email-register').addEventListener('click', () => {
      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;
      if (!email || !password) { showToast('請填入 Email 與密碼', 'warn'); return; }
      if (password.length < 6) { showToast('密碼至少 6 碼', 'warn'); return; }
      window.AppAuth.registerWithEmail(email, password)
        .then(() => { showToast('註冊並登入成功', 'success'); closeModal('modal-login'); })
        .catch((e) => showToast(e.message || '註冊失敗', 'error'));
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
    $('#fab-add').addEventListener('click', () => {
      if (!window.AppAuth.canWrite()) { showToast('僅管理員可新增', 'warn'); return; }
      openRecordModal(null);
    });
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
    if (['overview', 'records', 'profile'].includes(h)) switchNav(h, { updateHash: false });
    else if (params.get('nav')) switchNav(params.get('nav'), { updateHash: true });
    window.addEventListener('hashchange', () => {
      const nh = (window.location.hash || '').replace(/^#/, '');
      if (['overview', 'records', 'profile'].includes(nh)) switchNav(nh, { updateHash: false });
    });
    if (params.get('action') === 'add' && window.AppAuth.canWrite()) {
      setTimeout(() => openRecordModal(null), 300);
    }
  }

  function subscribeData() {
    window.AppDB.subscribeAll((list) => {
      state.records = list;
      renderStats(list);
      renderRecent();
      renderRecordsList();
    });
    window.AppAuth.subscribe((user) => {
      renderUser();
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
    bindOffline();
    registerSW();
    handleURL();
    subscribeData();
    refreshIcons();
    if (!window.AppFirebase.isReady()) {
      setTimeout(() => showToast('使用本機 Demo 模式，請至 firebase-config.js 填入設定', 'info', 3500), 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
