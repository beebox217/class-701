(function (global) {
  'use strict';

  const LOCAL_KEY = 'class-fee-records-demo';
  const UNsubscribeListeners = new Set();

  function uid() {
    return 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function defaultDemoRecords() {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    const d = (offset) => {
      const t = new Date(today);
      t.setDate(t.getDate() - offset);
      return iso(t);
    };
    return [
      { id: uid(), type: 'income',  amount: 15000, category: '班費收繳', date: d(20), note: '本學期班費 30 人 * 500', createdAt: Date.now() - 86400000 * 20 },
      { id: uid(), type: 'expense', amount: 3200,  category: '活動費用', date: d(15), note: '中秋節烤肉活動材料', createdAt: Date.now() - 86400000 * 15 },
      { id: uid(), type: 'expense', amount: 860,   category: '點心餐飲', date: d(10), note: '期中考加油便當 15 份', createdAt: Date.now() - 86400000 * 10 },
      { id: uid(), type: 'income',  amount: 2000,  category: '捐款',     date: d(7),  note: '家長會捐款', createdAt: Date.now() - 86400000 * 7 },
      { id: uid(), type: 'expense', amount: 1250,  category: '書籍用品', date: d(3),  note: '影印講義與資料夾', createdAt: Date.now() - 86400000 * 3 },
      { id: uid(), type: 'expense', amount: 680,   category: '禮物獎品', date: d(1),  note: '月考前三名禮物', createdAt: Date.now() - 86400000 * 1 }
    ];
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) {
        const seed = defaultDemoRecords();
        localStorage.setItem(LOCAL_KEY, JSON.stringify(seed));
        return seed.slice();
      }
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return defaultDemoRecords();
    }
  }

  function saveLocal(list) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list || [])); }
    catch (e) { /* ignore */ }
  }

  function normalizeRecord(data, id) {
    return {
      id: id || data.id || uid(),
      type: data.type === 'expense' ? 'expense' : 'income',
      amount: Math.max(0, Number(data.amount) || 0),
      category: String(data.category || '').trim() || '其他',
      date: data.date || new Date().toISOString().slice(0, 10),
      note: String(data.note || '').trim(),
      createdAt: data.createdAt || Date.now(),
      updatedAt: Date.now(),
      createdBy: data.createdBy || null,
      classId: data.classId || (global.AppFirebase.getClassInfo() || {}).classId || null
    };
  }

  function getClassId() {
    return (global.AppFirebase.getClassInfo() || {}).classId || null;
  }

  function firestoreQuery(limit, orderDesc) {
    const db = global.AppFirebase.getDB();
    if (!db) return null;
    const col = db.collection(global.AppFirebase.FIRESTORE_COLLECTION);
    const classId = getClassId();
    let q = classId ? col.where('classId', '==', classId) : col;
    q = q.orderBy('date', orderDesc ? 'desc' : 'asc')
         .orderBy('createdAt', orderDesc ? 'desc' : 'asc');
    if (limit && limit > 0) q = q.limit(limit);
    return q;
  }

  function fromSnapshot(snap) {
    const arr = [];
    if (!snap) return arr;
    snap.forEach((doc) => {
      const data = doc.data() || {};
      arr.push(normalizeRecord(data, doc.id));
    });
    return arr;
  }

  function useLocal() { return !global.AppFirebase.isReady(); }

  function getAll() {
    if (useLocal()) {
      const list = loadLocal();
      list.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      return Promise.resolve(list);
    }
    const q = firestoreQuery(null, true);
    return q.get().then(fromSnapshot);
  }

  function getRecent(limit) {
    const n = Number(limit) || 10;
    if (useLocal()) {
      return getAll().then((list) => list.slice(0, n));
    }
    const q = firestoreQuery(n, true);
    return q.get().then(fromSnapshot);
  }

  function addRecord(data) {
    if (!global.AppAuth.canWrite()) {
      return Promise.reject(new Error('僅管理員可新增紀錄'));
    }
    const record = normalizeRecord(data);
    const user = global.AppAuth.getUser();
    if (user) record.createdBy = { uid: user.uid, name: user.displayName || user.email };

    if (useLocal()) {
      const list = loadLocal();
      list.unshift(record);
      saveLocal(list);
      return Promise.resolve(record);
    }
    const db = global.AppFirebase.getDB();
    const payload = Object.assign({}, record);
    delete payload.id;
    return db.collection(global.AppFirebase.FIRESTORE_COLLECTION)
      .add(payload)
      .then((ref) => Object.assign({}, record, { id: ref.id }));
  }

  function updateRecord(id, data) {
    if (!global.AppAuth.canWrite()) {
      return Promise.reject(new Error('僅管理員可編輯紀錄'));
    }
    if (!id) return Promise.reject(new Error('缺少紀錄 ID'));

    if (useLocal()) {
      const list = loadLocal();
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return Promise.reject(new Error('找不到該紀錄'));
      list[idx] = normalizeRecord(Object.assign({}, list[idx], data, { id: id }), id);
      saveLocal(list);
      return Promise.resolve(list[idx]);
    }
    const db = global.AppFirebase.getDB();
    const payload = Object.assign({}, normalizeRecord(data, id));
    delete payload.id;
    delete payload.createdAt;
    return db.collection(global.AppFirebase.FIRESTORE_COLLECTION)
      .doc(id)
      .update(payload)
      .then(() => normalizeRecord(Object.assign({}, data, { id: id }), id));
  }

  function deleteRecord(id) {
    if (!global.AppAuth.canWrite()) {
      return Promise.reject(new Error('僅管理員可刪除紀錄'));
    }
    if (!id) return Promise.reject(new Error('缺少紀錄 ID'));

    if (useLocal()) {
      const list = loadLocal().filter((r) => r.id !== id);
      saveLocal(list);
      return Promise.resolve(true);
    }
    const db = global.AppFirebase.getDB();
    return db.collection(global.AppFirebase.FIRESTORE_COLLECTION)
      .doc(id)
      .delete()
      .then(() => true);
  }

  function subscribeAll(callback) {
    if (typeof callback !== 'function') return () => {};
    if (useLocal()) {
      const timer = setInterval(() => getAll().then(callback), 1500);
      const off = () => clearInterval(timer);
      UNsubscribeListeners.add(off);
      getAll().then(callback);
      return off;
    }
    const q = firestoreQuery(null, true);
    const unsub = q.onSnapshot(
      (snap) => callback(fromSnapshot(snap)),
      (err) => console.warn('[DB] 即時監聽中斷:', err)
    );
    const off = () => { try { unsub(); } catch (e) {} };
    UNsubscribeListeners.add(off);
    return off;
  }

  function computeStats(records) {
    const list = Array.isArray(records) ? records : [];
    let income = 0, expense = 0;
    list.forEach((r) => {
      const a = Number(r.amount) || 0;
      if (r.type === 'income') income += a;
      else if (r.type === 'expense') expense += a;
    });
    return {
      income,
      expense,
      balance: income - expense,
      count: list.length
    };
  }

  global.AppDB = {
    getAll,
    getRecent,
    addRecord,
    updateRecord,
    deleteRecord,
    subscribeAll,
    computeStats,
    normalizeRecord,
    isLocalMode: useLocal
  };
})(window);
