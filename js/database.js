(function (global) {
  'use strict';

  const UNsubscribeListeners = new Set();

  function uid() {
    return 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
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

  function ensureReady() {
    if (!global.AppFirebase.isReady()) {
      throw new Error('Firebase 尚未設定，請先完成系統設定');
    }
  }

  function getAll() {
    ensureReady();
    const q = firestoreQuery(null, true);
    return q.get().then(fromSnapshot);
  }

  function getRecent(limit) {
    ensureReady();
    const n = Number(limit) || 10;
    const q = firestoreQuery(n, true);
    return q.get().then(fromSnapshot);
  }

  function addRecord(data) {
    ensureReady();
    if (!global.AppAuth.canWrite()) {
      return Promise.reject(new Error('僅管理員可新增紀錄'));
    }
    const record = normalizeRecord(data);
    const user = global.AppAuth.getUser();
    if (user) record.createdBy = { uid: user.uid, name: user.displayName || user.email };

    const db = global.AppFirebase.getDB();
    const payload = Object.assign({}, record);
    delete payload.id;
    return db.collection(global.AppFirebase.FIRESTORE_COLLECTION)
      .add(payload)
      .then((ref) => Object.assign({}, record, { id: ref.id }));
  }

  function updateRecord(id, data) {
    ensureReady();
    if (!global.AppAuth.canWrite()) {
      return Promise.reject(new Error('僅管理員可編輯紀錄'));
    }
    if (!id) return Promise.reject(new Error('缺少紀錄 ID'));

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
    ensureReady();
    if (!global.AppAuth.canWrite()) {
      return Promise.reject(new Error('僅管理員可刪除紀錄'));
    }
    if (!id) return Promise.reject(new Error('缺少紀錄 ID'));

    const db = global.AppFirebase.getDB();
    return db.collection(global.AppFirebase.FIRESTORE_COLLECTION)
      .doc(id)
      .delete()
      .then(() => true);
  }

  function subscribeAll(callback) {
    if (typeof callback !== 'function') return () => {};
    try { ensureReady(); } catch (e) {
      callback([]);
      return () => {};
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

  /* ================= classInfo 集合 ================= */
  function defaultClassInfo() {
    const info = global.AppFirebase.getClassInfo() || {};
    return {
      classId: info.classId || null,
      className: info.className || '班級',
      students: [],
      feeItems: [
        { name: '班費收繳', account: '', type: 'income' },
        { name: '捐款', account: '', type: 'income' },
        { name: '活動收入', account: '', type: 'income' },
        { name: '其他收入', account: '', type: 'income' },
        { name: '活動費用', account: '', type: 'expense' },
        { name: '書籍用品', account: '', type: 'expense' },
        { name: '點心餐飲', account: '', type: 'expense' },
        { name: '交通費', account: '', type: 'expense' },
        { name: '禮物獎品', account: '', type: 'expense' },
        { name: '其他支出', account: '', type: 'expense' }
      ],
      updatedAt: Date.now()
    };
  }

  function getClassInfoDoc() {
    ensureReady();
    const db = global.AppFirebase.getDB();
    return db.collection('classInfo').doc(getClassId() || 'default');
  }

  function getClassInfo() {
    ensureReady();
    const fallback = Promise.resolve(defaultClassInfo());
    try {
      return getClassInfoDoc().get().then((doc) => {
        if (!doc.exists) return defaultClassInfo();
        const raw = doc.data() || {};
        const def = defaultClassInfo();
        return Object.assign({}, def, raw, {
          students: Array.isArray(raw.students) ? raw.students : [],
          feeItems: Array.isArray(raw.feeItems) && raw.feeItems.length ? raw.feeItems : def.feeItems,
          className: raw.className || def.className,
          classId: getClassId()
        });
      }).catch(() => defaultClassInfo());
    } catch (e) {
      return fallback;
    }
  }

  function saveClassInfo(payload) {
    ensureReady();
    if (!global.AppAuth.canWrite()) {
      return Promise.reject(new Error('僅管理員可修改班級設定'));
    }
    const def = defaultClassInfo();
    const data = {
      classId: getClassId(),
      className: String((payload && payload.className) || def.className).trim(),
      students: Array.isArray(payload && payload.students) ? payload.students.map((s, i) => ({
        seat: Number((s && s.seat) != null ? s.seat : (i + 1)),
        name: String((s && s.name) || '').trim()
      })).filter((s) => s.name) : [],
      feeItems: Array.isArray(payload && payload.feeItems) ? payload.feeItems.map((f) => ({
        name: String((f && f.name) || '').trim(),
        account: String((f && f.account) || '').trim(),
        type: (f && (f.type === 'expense' || f.type === 'income')) ? f.type : 'expense'
      })).filter((f) => f.name) : def.feeItems,
      updatedAt: Date.now()
    };
    return getClassInfoDoc().set(data).then(() => data);
  }

  function subscribeClassInfo(callback) {
    if (typeof callback !== 'function') return () => {};
    try { ensureReady(); } catch (e) {
      callback(defaultClassInfo());
      return () => {};
    }
    const unsub = getClassInfoDoc().onSnapshot(
      (doc) => {
        if (!doc.exists) return callback(defaultClassInfo());
        const raw = doc.data() || {};
        const def = defaultClassInfo();
        callback(Object.assign({}, def, raw, {
          students: Array.isArray(raw.students) ? raw.students : [],
          feeItems: Array.isArray(raw.feeItems) && raw.feeItems.length ? raw.feeItems : def.feeItems,
          className: raw.className || def.className,
          classId: getClassId()
        }));
      },
      () => callback(defaultClassInfo())
    );
    const off = () => { try { unsub(); } catch (e) {} };
    UNsubscribeListeners.add(off);
    return off;
  }

  /* ================= users 集合 ================= */
  function listUsers() {
    ensureReady();
    const db = global.AppFirebase.getDB();
    const classId = getClassId();
    const col = db.collection(global.AppFirebase.USERS_COLLECTION);
    let q = classId ? col.where('classId', '==', classId) : col;
    return q.orderBy('email', 'asc').get().then((snap) => {
      const arr = [];
      snap.forEach((doc) => {
        const d = doc.data() || {};
        arr.push({
          uid: doc.id,
          email: d.email || '',
          displayName: d.displayName || (d.email ? d.email.split('@')[0] : ''),
          role: d.role || 'parent',
          classId: d.classId || null,
          updatedAt: d.updatedAt || null
        });
      });
      return arr;
    }).catch(() => []);
  }

  function updateUserRole(uid, role) {
    ensureReady();
    if (!global.AppAuth.canWrite()) {
      return Promise.reject(new Error('僅管理員可變更使用者角色'));
    }
    if (!uid) return Promise.reject(new Error('缺少使用者 ID'));
    const validRoles = ['admin', 'teacher', 'parent'];
    const next = validRoles.includes(role) ? role : 'parent';
    const db = global.AppFirebase.getDB();
    const classId = getClassId();
    const payload = {
      role: next,
      updatedAt: Date.now()
    };
    if (classId) payload.classId = classId;
    return db.collection(global.AppFirebase.USERS_COLLECTION).doc(uid)
      .set(payload, { merge: true })
      .then(() => ({ uid, role: next }));
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
    isLocalMode: () => false,
    getClassInfo,
    saveClassInfo,
    subscribeClassInfo,
    listUsers,
    updateUserRole
  };
})(window);
