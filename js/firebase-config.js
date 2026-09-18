(function (global) {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBJUeqSdPrm-O8juXRyNRXi6VlSIDSIgV0',
    authDomain: 'class-701.firebaseapp.com',
    projectId: 'class-701',
    storageBucket: 'class-701.firebasestorage.app',
    messagingSenderId: '9517930334',
    appId: '1:9517930334:web:e95adf602163264e1c21cf',
    measurementId: 'G-9J24W85D25'
  };

  const CLASS_INFO = {
    className: '三年二班',
    classId: 'class-701-1',
    adminEmails: ['admin@example.com', 'leader@example.com']
  };

  const isConfigured = () =>
    FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes('YOUR_');

  let app = null;
  let db = null;
  let auth = null;

  function initFirebase() {
    if (!isConfigured()) {
      console.warn('[Firebase] 尚未填入有效的 Firebase 設定，將使用本機 Demo 模式。');
      return false;
    }
    try {
      app = firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore(app);
      auth = firebase.auth(app);
      db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
          console.warn('[Firestore] 離線持久化啟用失敗:', err.code);
        }
      });
      return true;
    } catch (err) {
      console.error('[Firebase] 初始化失敗:', err);
      return false;
    }
  }

  const firebaseReady = typeof firebase !== 'undefined' ? initFirebase() : false;

  global.AppFirebase = {
    isConfigured: isConfigured,
    isReady: () => firebaseReady,
    getApp: () => app,
    getDB: () => db,
    getAuth: () => auth,
    getClassInfo: () => CLASS_INFO,
    FIRESTORE_COLLECTION: 'records',
    USERS_COLLECTION: 'users'
  };
})(window);
