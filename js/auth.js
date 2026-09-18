(function (global) {
  'use strict';

  const SESSION_KEY = 'class-fee-auth-session';
  const ROLE = { GUEST: 'guest', MEMBER: 'member', ADMIN: 'admin' };

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
      provider: 'demo'
    };
    if (!profile) return base;
    return Object.assign({}, base, profile, {
      loginAt: profile.loginAt || Date.now(),
      role: role || base.role
    });
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

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    try { fn(currentUser); } catch (e) { /* ignore */ }
    return () => listeners.delete(fn);
  }

  function loginDemoAdmin() {
    const user = buildUser(ROLE.ADMIN, {
      uid: 'demo-admin-001',
      email: 'admin@example.com',
      displayName: '示範管理員',
      provider: 'demo'
    });
    setUser(user);
    return Promise.resolve(user);
  }

  function loginDemoMember() {
    const user = buildUser(ROLE.MEMBER, {
      uid: 'demo-member-001',
      email: 'student@example.com',
      displayName: '示範成員',
      provider: 'demo'
    });
    setUser(user);
    return Promise.resolve(user);
  }

  function loginWithEmail(email, password) {
    const auth = global.AppFirebase.getAuth();
    if (!auth) {
      return Promise.reject(new Error('Firebase Auth 尚未設定，請先填入設定或使用示範帳號。'));
    }
    return auth.signInWithEmailAndPassword(email, password)
      .then((cred) => {
        const fbUser = cred.user;
        const isAdmin = isAdminEmail(fbUser.email);
        const user = buildUser(isAdmin ? ROLE.ADMIN : ROLE.MEMBER, {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : null),
          provider: 'password'
        });
        setUser(user);
        return user;
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
        const isAdmin = isAdminEmail(fbUser.email);
        const user = buildUser(isAdmin ? ROLE.ADMIN : ROLE.MEMBER, {
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
  function isMember() { return !!currentUser && currentUser.role === ROLE.MEMBER; }
  function canWrite() { return isAdmin(); }

  function bindFirebaseAuth() {
    const auth = global.AppFirebase.getAuth();
    if (!auth) return;
    try {
      auth.onAuthStateChanged((fbUser) => {
        if (fbUser) {
          if (!currentUser || currentUser.provider !== 'demo') {
            const isAdmin = isAdminEmail(fbUser.email);
            const user = buildUser(isAdmin ? ROLE.ADMIN : ROLE.MEMBER, {
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
            }
          }
        } else if (currentUser && currentUser.provider !== 'demo') {
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
    isMember,
    canWrite,
    loginDemoAdmin,
    loginDemoMember,
    loginWithEmail,
    registerWithEmail,
    logout
  };
})(window);
