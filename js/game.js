/**
 * game.js — Deep-Focus Session Engine
 * Handles: All 6 training modes, dot physics, focus scoring, adaptive difficulty
 */
'use strict';

const Game = (() => {
  /* ── Private State ───────────────────────────────────────── */
  let _state       = null;
  let _animFrame   = null;
  let _timerInterval = null;
  let _paused      = false;
  let _settings    = null;

  /* ── Callbacks injected by app.js ────────────────────────── */
  let _onTick       = null; // (remaining) => void
  let _onFocusUpdate = null; // (score) => void
  let _onComplete   = null; // (state) => void

  /* ── Init ────────────────────────────────────────────────── */
  function configure(settings, callbacks) {
    _settings = settings;
    _onTick         = callbacks.onTick;
    _onFocusUpdate  = callbacks.onFocusUpdate;
    _onComplete     = callbacks.onComplete;
  }

  /* ── Start Session ───────────────────────────────────────── */
  function startSession(duration, mode) {
    const canvas = document.getElementById('session-canvas');
    CanvasEngine.init(canvas, () => {
      if (_state) {
        // Re-clamp dot position on resize
        const pad = 80;
        _state.dotX = Math.max(pad, Math.min(CanvasEngine.getWidth()  - pad, _state.dotX));
        _state.dotY = Math.max(pad, Math.min(CanvasEngine.getHeight() - pad, _state.dotY));
      }
    });

    _paused = false;

    _state = {
      duration,
      mode,
      remaining:       duration,
      losses:          0,
      focusScore:      100,
      speedMultiplier: 1,
      dotX:            0,
      dotY:            0,
      vx:              0,
      vy:              0,
      breathPhase:     0,
      hideDot:         false,
      hideTimer:       null,
      distractors:     [],
      cursorNear:      true,
      cursorX:         -1000,
      cursorY:         -1000,
      adaptiveTimer:   0,
    };

    _initDotPosition();
    _initVelocity();

    if (mode === 'distract' || mode === 'adaptive') {
      _generateDistractors();
    }

    _startTimer();
    _runLoop();
  }

  /* ── Pause / Resume ──────────────────────────────────────── */
  function setPaused(value) {
    _paused = value;
  }

  function isPaused() {
    return _paused;
  }

  /* ── Stop ────────────────────────────────────────────────── */
  function stopSession() {
    clearInterval(_timerInterval);
    cancelAnimationFrame(_animFrame);
    CanvasEngine.destroy();

    if (_state && _state.hideTimer) {
      clearTimeout(_state.hideTimer);
    }

    const snapshot = _state ? { ..._state } : null;
    _state         = null;
    _timerInterval = null;
    _animFrame     = null;
    return snapshot;
  }

  /* ── Cursor tracking ─────────────────────────────────────── */
  function updateCursor(x, y) {
    if (_state) {
      _state.cursorX = x;
      _state.cursorY = y;
    }
  }

  /* ── Private: Dot Init ───────────────────────────────────── */
  function _initDotPosition() {
    const pad = 80;
    const w   = CanvasEngine.getWidth();
    const h   = CanvasEngine.getHeight();
    _state.dotX = pad + Math.random() * (w - pad * 2);
    _state.dotY = pad + Math.random() * (h - pad * 2);
  }

  function _initVelocity() {
    const baseSpeed = (_settings.speed / 5) * _state.speedMultiplier;
    const angle     = Math.random() * Math.PI * 2;
    const speed     = (1 + Math.random()) * baseSpeed;
    _state.vx = Math.cos(angle) * speed;
    _state.vy = Math.sin(angle) * speed;
  }

  function _generateDistractors() {
    const w = CanvasEngine.getWidth();
    const h = CanvasEngine.getHeight();
    _state.distractors = [];

    for (let i = 0; i < 8; i++) {
      _state.distractors.push({
        x:       Math.random() * w,
        y:       Math.random() * h,
        r:       5 + Math.random() * 15,
        vx:      (Math.random() - 0.5) * 0.5,
        vy:      (Math.random() - 0.5) * 0.5,
        opacity: 0.1 + Math.random() * 0.2,
        type:    Math.random() > 0.5 ? 'circle' : 'line',
        phase:   Math.random() * Math.PI * 2,
      });
    }
  }

  /* ── Private: Timer ──────────────────────────────────────── */
  function _startTimer() {
    _timerInterval = setInterval(() => {
      if (_paused || !_state) return;
      _state.remaining--;
      if (_onTick) _onTick(_state.remaining);
      if (_state.remaining <= 0) _endSession(true);
    }, 1000);
  }

  /* ── Private: Game Loop ──────────────────────────────────── */
  function _runLoop() {
    if (!_state) return;

    const isDark = document.body.classList.contains('dark');

    // Draw background
    CanvasEngine.drawBackground(isDark);

    if (!_paused) {
      _updateDot();
      _updateAdaptive();
      if (_state.mode === 'cursor') _checkCursorFocus();
    }

    // Draw distractors
    if (_settings.distractions && _state.distractors.length) {
      _state.distractors.forEach(d => {
        // Move distractor
        d.x     += d.vx;
        d.y     += d.vy;
        d.phase += 0.01;
        const w = CanvasEngine.getWidth();
        const h = CanvasEngine.getHeight();
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
        CanvasEngine.drawDistractor(d, isDark);
      });
    }

    // Draw dot
    if (!_state.hideDot) {
      let r = _settings.dotSize;
      if (_state.mode === 'breathe' || _state.mode === 'adaptive') {
        r = _settings.dotSize * (1 + 0.4 * Math.sin(_state.breathPhase));
      }
      CanvasEngine.drawDot(_state.dotX, _state.dotY, r, isDark);
    }

    // Draw pause overlay
    if (_paused) {
      CanvasEngine.drawPauseOverlay();
    }

    _animFrame = requestAnimationFrame(_runLoop);
  }

  /* ── Private: Dot Physics ────────────────────────────────── */
  function _updateDot() {
    const pad       = 60;
    const baseSpeed = (_settings.speed / 5) * _state.speedMultiplier;
    const w         = CanvasEngine.getWidth();
    const h         = CanvasEngine.getHeight();

    // Natural drift
    _state.vx += (Math.random() - 0.5) * 0.08;
    _state.vy += (Math.random() - 0.5) * 0.08;

    // Speed limit
    const maxSpd = 2.5 * baseSpeed;
    const spd    = Math.hypot(_state.vx, _state.vy);
    if (spd > maxSpd) {
      _state.vx = (_state.vx / spd) * maxSpd;
      _state.vy = (_state.vy / spd) * maxSpd;
    }

    _state.dotX += _state.vx;
    _state.dotY += _state.vy;

    // Bounce
    if (_state.dotX < pad)     { _state.dotX = pad;     _state.vx =  Math.abs(_state.vx); }
    if (_state.dotX > w - pad) { _state.dotX = w - pad; _state.vx = -Math.abs(_state.vx); }
    if (_state.dotY < pad)     { _state.dotY = pad;     _state.vy =  Math.abs(_state.vy); }
    if (_state.dotY > h - pad) { _state.dotY = h - pad; _state.vy = -Math.abs(_state.vy); }

    // Breathing phase
    if (_state.mode === 'breathe' || _state.mode === 'adaptive') {
      _state.breathPhase += 0.018;
    }

    // Memory mode: briefly hide dot
    if (_state.mode === 'memory' && !_state.hideDot && !_state.hideTimer) {
      if (Math.random() < 0.002) {
        _state.hideDot  = true;
        _state.hideTimer = setTimeout(() => {
          if (_state) {
            _state.hideDot  = false;
            _state.hideTimer = null;
          }
        }, 1500);
      }
    }
  }

  /* ── Private: Cursor Focus Check (cursor mode) ───────────── */
  function _checkCursorFocus() {
    const threshold = _settings.dotSize * 3;
    const dist      = Math.hypot(_state.cursorX - _state.dotX, _state.cursorY - _state.dotY);
    const near      = dist < threshold;

    if (!near && _state.cursorNear) {
      _recordLoss();
    }
    _state.cursorNear = near;
  }

  /* ── Private: Focus Management ───────────────────────────── */
  function _recordLoss() {
    _state.losses++;
    _state.focusScore = Math.max(0, _state.focusScore - 3);
    _emitFocusUpdate();
    _triggerFlash();
  }

  function _emitFocusUpdate() {
    if (_onFocusUpdate) _onFocusUpdate(Math.round(_state.focusScore));
  }

  function _triggerFlash() {
    const el = document.getElementById('loss-flash');
    if (!el) return;
    el.style.display   = 'block';
    el.style.animation = 'none';
    void el.offsetWidth; // reflow
    el.style.animation = 'lossFlash 0.5s ease';
    setTimeout(() => { if (el) el.style.display = 'none'; }, 500);
  }

  /* ── Private: Adaptive Difficulty ───────────────────────── */
  function _updateAdaptive() {
    if (!_state) return;
    _state.adaptiveTimer++;

    // Every ~5 seconds at 60fps
    if (_state.adaptiveTimer % 300 === 0) {
      const score = _state.focusScore;
      if (score > 85) {
        _state.speedMultiplier = Math.min(2, _state.speedMultiplier + 0.05);
      } else if (score < 60) {
        _state.speedMultiplier = Math.max(0.4, _state.speedMultiplier - 0.05);
      }
      // Gradual focus recovery
      _state.focusScore = Math.min(100, _state.focusScore + 0.5);
      _emitFocusUpdate();
    }
  }

  /* ── Private: End Session ────────────────────────────────── */
  function _endSession(completed) {
    const snapshot = stopSession();
    if (_onComplete) _onComplete(snapshot, completed);
  }

  /* ── Public API ──────────────────────────────────────────── */
  return {
    configure,
    startSession,
    stopSession,
    setPaused,
    isPaused,
    updateCursor,
  };
})();

window.Game = Game;
