/**
 * storage.js — Deep-Focus Storage Module
 * Handles: Sessions (IndexedDB + localStorage fallback), Settings, Achievements
 */
'use strict';

const Storage = (() => {
  /* ── Constants ──────────────────────────────────────────── */
  const DB_NAME        = 'DeepFocusDB';
  const DB_VERSION     = 1;
  const STORE_SESSIONS = 'sessions';
  const KEY_SETTINGS   = 'df_settings';
  const KEY_ACHIEVEMENTS = 'df_achievements';

  /* ── State ───────────────────────────────────────────────── */
  let _db = null;

  /* ── Default Settings ────────────────────────────────────── */
  const DEFAULT_SETTINGS = Object.freeze({
    dark:        false,
    dotSize:     22,
    speed:       5,
    difficulty:  'medium',
    distractions: true,
    fullscreen:  true,
  });

  /* ── IndexedDB Helpers ───────────────────────────────────── */
  function openDB() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, {
            keyPath:       'id',
            autoIncrement: true,
          });
        }
      };

      req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror    = ()  => reject(req.error);
    });
  }

  /* ── Sessions ────────────────────────────────────────────── */
  async function saveSession(data) {
    const record = { ...data, timestamp: Date.now() };

    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_SESSIONS, 'readwrite');
        const req = tx.objectStore(STORE_SESSIONS).add(record);
        tx.oncomplete = () => resolve(req.result);
        tx.onerror    = () => reject(tx.error);
      });
    } catch {
      // localStorage fallback
      try {
        localStorage.setItem('df_sess_' + Date.now(), JSON.stringify(record));
      } catch { /* quota exceeded – silently ignore */ }
    }
  }

  async function getAllSessions() {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_SESSIONS, 'readonly');
        const req = tx.objectStore(STORE_SESSIONS).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => reject(req.error);
      });
    } catch {
      // localStorage fallback
      const sessions = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('df_sess_')) {
          try { sessions.push(JSON.parse(localStorage.getItem(key))); } catch { /* skip */ }
        }
      }
      return sessions;
    }
  }

  async function clearAllSessions() {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SESSIONS, 'readwrite');
        tx.objectStore(STORE_SESSIONS).clear();
        tx.oncomplete = resolve;
        tx.onerror    = () => reject(tx.error);
      });
    } catch { /* ignore */ }

    // Also clear localStorage fallback sessions
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('df_sess_')) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }

  /* ── Settings ────────────────────────────────────────────── */
  function getSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY_SETTINGS) || '{}');
      return { ...DEFAULT_SETTINGS, ...stored };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
    } catch { /* quota – ignore */ }
  }

  function resetSettings() {
    try {
      localStorage.removeItem(KEY_SETTINGS);
    } catch { /* ignore */ }
    return { ...DEFAULT_SETTINGS };
  }

  /* ── Achievements ────────────────────────────────────────── */
  function getAchievements() {
    try {
      return JSON.parse(localStorage.getItem(KEY_ACHIEVEMENTS) || '{}');
    } catch {
      return {};
    }
  }

  function saveAchievements(ach) {
    try {
      localStorage.setItem(KEY_ACHIEVEMENTS, JSON.stringify(ach));
    } catch { /* ignore */ }
  }

  /* ── Statistics Helpers ──────────────────────────────────── */
  async function computeStats() {
    const sessions = await getAllSessions();
    if (!sessions.length) return null;

    const today      = new Date().toISOString().split('T')[0];
    const totalFocus = sessions.reduce((a, s) => a + (s.duration || 0), 0);
    const avgFocus   = Math.round(
      sessions.reduce((a, s) => a + (s.focusScore || 0), 0) / sessions.length
    );
    const best       = sessions.reduce(
      (a, b) => (b.focusScore > (a ? a.focusScore : -1) ? b : a), null
    );
    const totalLosses = sessions.reduce((a, s) => a + (s.losses || 0), 0);
    const todaySessions = sessions.filter(s => s.date === today);

    // Streak
    const dates = [...new Set(sessions.map(s => s.date))].sort();
    let streak = 0;
    const checkDate = new Date(today);
    while (true) {
      const d = checkDate.toISOString().split('T')[0];
      if (!dates.includes(d)) break;
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
      sessions,
      today,
      totalFocus,
      avgFocus,
      best,
      totalLosses,
      todaySessions,
      streak,
    };
  }

  /* ── Session Data ────────────────────────────────────────── */
  function buildSessionRecord({ duration, remaining, mode, focusScore, losses, completed }) {
    return {
      date:       new Date().toISOString().split('T')[0],
      timestamp:  Date.now(),
      duration:   duration - remaining,
      mode,
      focusScore: Math.round(focusScore),
      losses,
      completed,
    };
  }

  /* ── Public API ──────────────────────────────────────────── */
  return {
    // Sessions
    saveSession,
    getAllSessions,
    clearAllSessions,
    buildSessionRecord,
    computeStats,

    // Settings
    DEFAULT_SETTINGS,
    getSettings,
    saveSettings,
    resetSettings,

    // Achievements
    getAchievements,
    saveAchievements,
  };
})();

// Make available globally
window.Storage = Storage;
