(function (global) {
  'use strict';

  const SESSION_KEY = 'class-fee-auth-session';
  const ROLE = { GUEST: 'guest', PARENT: 'parent', TEACHER: 'teacher', ADMIN: 'admin' };

  const listeners = new Set();
  let currentUser = null;

  function notify() {
    listeners.forEach((fn) => {
      try { fn(currentUser); } catch (e) { /* ignore */ }
    });
  }

  function isAdminEmail(email) {
    const info = global.AppFirebase.getClassInfo();
    const list = (info && info.adminEmails) || [];
    const e = (email || '').toLowerCase().trim();
    return list.some((x) => x.toLowerCase().trim() === e);
  }

  function buildUser(role, profile) {
    const base = {
      role: role || ROLE.GUEST,
      uid: null,
      email: null,
      displayName: null,
      loginAt: null,
      provider: 'firebase'
    };
    if (!profile) return base;
    return Object.assign({}, base, profile, {
      loginAt: profile.loginAt || Date.now(),
      role: role || base.role
    });
  }

  function resolveRole(email, storedRole) {
    if (isAdminEmail(email)) return ROLE.ADMIN;
    if (storedRole === ROLE.TEACHER) return ROLE.TEACHER;
    if (storedRole === ROLE.ADMIN) return ROLE.PARENT;
    if (storedRole === ROLE.PARENT) return ROLE.PARENT;
    return ROLE.PARENT;
  }

  function persist(user) {
    try {
      if (user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function setUser(user) {
    currentUser = user;
    persist(user);
    notify();
  }

  function refreshRoleFromDB() {
    if (!currentUser || !currentUser.email || !currentUser.uid) return Promise.resolve(currentUser);
    if (isAdminEmail(currentUser.email)) return Promise.resolve(currentUser);
    const db = global.AppFirebase && global.AppFirebase.getDB();
    if (!db || !global.AppFirebase.USERS_COLLECTION) return Promise.resolve(currentUser);
    return db.collection(global.AppFirebase.USERS_COLLECTION).doc(currentUser.uid).get()
      .then((doc) => {
        const data = doc.exists ? (doc.data() || {}) : {};
        const newRole = resolveRole(currentUser.email, data.role);
        if (newRole !== currentUser.role) {
          currentUser = buildUser(newRole, Object.assign({}, currentUser, { role: newRole }));
          persist(currentUser);
          notify();
        }
        return currentUser;
      })
      .catch(() => currentUser);
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    try { fn(currentUser); } catch (e) { /* ignore */ }
    return () => listeners.delete(fn);
  }

  function loginWithEmail(email, password) {
    const auth = global.AppFirebase.getAuth();
    if (!auth) {
      return Promise.reject(new Error('Firebase Auth 尚未設定，請聯絡系統管理員。'));
    }
    return auth.signInWithEmailAndPassword(email, password)
      .then((cred) => {
        const fbUser = cred.user;
        const preRole = resolveRole(fbUser.email, null);
        const user = buildUser(preRole, {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : null),
          provider: 'password'
        });
        setUser(user);
        return refreshRoleFromDB().then((u) => u || user);
      });
  }

  function registerWithEmail(email, password, displayName) {
    const auth = global.AppFirebase.getAuth();
    if (!auth) {
      return Promise.reject(new Error('Firebase Auth 尚未設定。'));
    }
    return auth.createUserWithEmailAndPassword(email, password)
      .then((cred) => {
        const fbUser = cred.user;
        if (displayName && fbUser.updateProfile) {
          try { fbUser.updateProfile({ displayName: displayName }); } catch (e) { /* ignore */ }
        }
        const db = global.AppFirebase.getDB();
        if (db && global.AppFirebase.USERS_COLLECTION) {
          const payload = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: displayName || (fbUser.email ? fbUser.email.split('@')[0] : null),
            role: resolveRole(fbUser.email, null),
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          try {
            db.collection(global.AppFirebase.USERS_COLLECTION).doc(fbUser.uid).set(payload).catch(() => {});
          } catch (e) { /* ignore */ }
        }
        const user = buildUser(resolveRole(fbUser.email, null), {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: displayName || (fbUser.email ? fbUser.email.split('@')[0] : null),
          provider: 'password'
        });
        setUser(user);
        return user;
      });
  }

  function logout() {
    const auth = global.AppFirebase.getAuth();
    setUser(null);
    if (auth) {
      try { auth.signOut(); } catch (e) { /* ignore */ }
    }
    return Promise.resolve();
  }

  function getUser() { return currentUser; }
  function isLoggedIn() { return !!currentUser && currentUser.role !== ROLE.GUEST; }
  function isAdmin() { return !!currentUser && currentUser.role === ROLE.ADMIN; }
  function isTeacher() { return !!currentUser && currentUser.role === ROLE.TEACHER; }
  function isParent() { return !!currentUser && currentUser.role === ROLE.PARENT; }
  function canAccessSettings() { return isAdmin() || isTeacher(); }
  function canWrite() { return isAdmin(); }

  function bindFirebaseAuth() {
    const auth = global.AppFirebase.getAuth();
    if (!auth) return;
    try {
      auth.onAuthStateChanged((fbUser) => {
        if (fbUser) {
          const preRole = resolveRole(fbUser.email, null);
          const user = buildUser(preRole, {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : null),
            loginAt: (currentUser && currentUser.loginAt) || Date.now(),
            provider: 'firebase'
          });
          if (!currentUser || currentUser.uid !== user.uid) {
            currentUser = user;
            persist(user);
            notify();
            refreshRoleFromDB();
          } else {
            refreshRoleFromDB();
          }
        } else if (currentUser) {
          setUser(null);
        }
      });
    } catch (e) {
      console.warn('[Auth] Firebase 狀態監聽綁定失敗:', e);
    }
  }

  const restored = restore();
  if (restored) currentUser = restored;
  bindFirebaseAuth();

  global.AppAuth = {
    ROLE,
    getUser,
    subscribe,
    isLoggedIn,
    isAdmin,
    isTeacher,
    isParent,
    canAccessSettings,
    canWrite,
    refreshRoleFromDB,
    loginWithEmail,
    registerWithEmail,
    logout
  };
})(window);
