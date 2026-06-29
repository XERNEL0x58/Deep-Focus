/**
 * app.js — Deep-Focus Application Controller
 * Wires Storage, CanvasEngine, Game, UI, and PWA together
 */
'use strict';

(function () {
  /* ── Application State ───────────────────────────────────── */
  const App = {
    settings:  null,
    duration:  60,
    mode:      'track',
  };

  /* ── Boot ────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    App.settings = Storage.getSettings();

    UI.loadSettings(App.settings);
    UI.initParticles();
    UI.initHomeButtons(
      dur  => { App.duration = dur; },
      mode => { App.mode = mode; }
    );

    _bindHomeButtons();
    _bindSessionButtons();
    _bindCompleteButtons();
    _bindStatsButtons();
    _bindSettingsPage();

    PWA.init();
  });

  /* ── Home Buttons ────────────────────────────────────────── */
  function _bindHomeButtons() {
    document.getElementById('btn-start')?.addEventListener('click', _startFlow);
    document.getElementById('btn-stats')?.addEventListener('click', () => {
      UI.renderStats();
      UI.showPage('page-stats');
    });
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      UI.showPage('page-settings');
    });
  }

  /* ── Start Flow ──────────────────────────────────────────── */
  function _startFlow() {
    UI.showPage('page-session');
    UI.updateTimer(App.duration);
    UI.updateFocusBar(100);
    UI.hideComplete();

    if (App.settings.fullscreen) UI.requestFullscreen();

    UI.runCountdown(() => {
      Game.configure(App.settings, {
        onTick:        remaining => UI.updateTimer(remaining),
        onFocusUpdate: score     => UI.updateFocusBar(score),
        onComplete:    _onSessionComplete,
      });
      Game.startSession(App.duration, App.mode);

      _bindCanvasInput();
    });
  }

  /* ── Canvas Input (cursor / touch tracking) ──────────────── */
  function _bindCanvasInput() {
    const canvas = document.getElementById('session-canvas');
    if (!canvas) return;

    const track = (x, y) => {
      if (!Game.isPaused()) Game.updateCursor(x, y);
    };

    // Mouse
    canvas.addEventListener('mousemove', e => track(e.clientX, e.clientY), { passive: true });

    // Touch
    canvas.addEventListener('touchmove', e => {
      const t = e.touches[0];
      if (t) track(t.clientX, t.clientY);
    }, { passive: true });

    // Click/tap to resume when paused
    canvas.addEventListener('click', () => {
      if (Game.isPaused()) _resumeSession();
    });
  }

  /* ── Session Buttons ─────────────────────────────────────── */
  function _bindSessionButtons() {
    document.getElementById('btn-pause')?.addEventListener('click', _togglePause);
    document.getElementById('btn-end-session')?.addEventListener('click', _endSessionEarly);
  }

  function _togglePause() {
    const btn = document.getElementById('btn-pause');
    if (Game.isPaused()) {
      _resumeSession();
    } else {
      Game.setPaused(true);
      if (btn) btn.textContent = '▶ متابعة';
    }
  }

  function _resumeSession() {
    Game.setPaused(false);
    const btn = document.getElementById('btn-pause');
    if (btn) btn.textContent = '⏸ توقف مؤقت';
  }

  function _endSessionEarly() {
    const snapshot = Game.stopSession();
    if (snapshot) {
      _saveAndShow(snapshot, false);
    } else {
      UI.exitFullscreen();
      UI.showPage('page-home');
    }
  }

  /* ── Session Complete ────────────────────────────────────── */
  function _onSessionComplete(snapshot, completed) {
    _saveAndShow(snapshot, completed);
  }

  async function _saveAndShow(snapshot, completed) {
    UI.exitFullscreen();

    const record = Storage.buildSessionRecord({
      duration:   snapshot.duration,
      remaining:  snapshot.remaining,
      mode:       snapshot.mode,
      focusScore: snapshot.focusScore,
      losses:     snapshot.losses,
      completed,
    });
    await Storage.saveSession(record);

    // Check achievements
    _checkAchievements(record);

    UI.showComplete(snapshot, completed);
  }

  /* ── Achievements ────────────────────────────────────────── */
  function _checkAchievements(record) {
    const ach = Storage.getAchievements();
    let earned = null;

    if (!ach.first_session) {
      ach.first_session = true;
      earned = '🎉 أول جلسة — مرحباً بك!';
    } else if (record.focusScore >= 90 && !ach.sharp_mind) {
      ach.sharp_mind = true;
      earned = '🧠 عقل حاد — تركيز فوق ٩٠٪!';
    } else if (record.duration >= 300 && !ach.five_min) {
      ach.five_min = true;
      earned = '⏱ خمس دقائق — صبر ومثابرة!';
    }

    if (earned) {
      Storage.saveAchievements(ach);
      setTimeout(() => UI.notify(earned, 4000), 1500);
    }
  }

  /* ── Complete Buttons ────────────────────────────────────── */
  function _bindCompleteButtons() {
    document.getElementById('btn-again')?.addEventListener('click', () => {
      UI.hideComplete();
      _startFlow();
    });
    document.getElementById('btn-go-stats')?.addEventListener('click', () => {
      UI.hideComplete();
      UI.renderStats();
      UI.showPage('page-stats');
    });
    document.getElementById('btn-go-home')?.addEventListener('click', () => {
      UI.hideComplete();
      UI.showPage('page-home');
    });
  }

  /* ── Stats Page ──────────────────────────────────────────── */
  function _bindStatsButtons() {
    document.getElementById('btn-stats-back')?.addEventListener('click', () => {
      UI.showPage('page-home');
    });
  }

  /* ── Settings Page ───────────────────────────────────────── */
  function _bindSettingsPage() {
    document.getElementById('btn-settings-back')?.addEventListener('click', () => {
      UI.showPage('page-home');
    });

    // Toggles
    UI.bindToggle('tog-dark', on => {
      App.settings.dark = on;
      document.body.classList.toggle('dark', on);
      _persistSettings();
    });

    UI.bindToggle('tog-distract', on => {
      App.settings.distractions = on;
      _persistSettings();
    });

    UI.bindToggle('tog-fullscreen', on => {
      App.settings.fullscreen = on;
      _persistSettings();
    });

    // Sliders
    UI.bindSlider('sl-dotsize', val => {
      App.settings.dotSize = val;
      _persistSettings();
    });

    UI.bindSlider('sl-speed', val => {
      App.settings.speed = val;
      _persistSettings();
    });

    // Select
    document.getElementById('sel-difficulty')?.addEventListener('change', e => {
      App.settings.difficulty = e.target.value;
      _persistSettings();
    });

    // Clear data
    document.getElementById('btn-clear-data')?.addEventListener('click', async () => {
      if (!confirm('هل تريد حذف جميع البيانات والإحصائيات؟')) return;
      await Storage.clearAllSessions();
      App.settings = Storage.resetSettings();
      UI.loadSettings(App.settings);
      UI.notify('🗑 تم مسح جميع البيانات');
    });
  }

  function _persistSettings() {
    Storage.saveSettings(App.settings);
  }

  /* ── Keyboard Shortcuts ──────────────────────────────────── */
  document.addEventListener('keydown', e => {
    const session = document.getElementById('page-session');
    const isSession = session?.classList.contains('active');

    if (isSession) {
      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        _togglePause();
      }
      if (e.key === 'Escape') {
        _endSessionEarly();
      }
    }
  });

  /* ── Visibility Change (auto-pause when tab hidden) ──────── */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      const session = document.getElementById('page-session');
      if (session?.classList.contains('active') && !Game.isPaused()) {
        Game.setPaused(true);
        const btn = document.getElementById('btn-pause');
        if (btn) btn.textContent = '▶ متابعة';
      }
    }
  });
})();
