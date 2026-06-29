/**
 * canvas.js — Deep-Focus Canvas Engine
 * Handles: HiDPI rendering, ResizeObserver, drawing primitives
 */
'use strict';

const CanvasEngine = (() => {
  /* ── Private State ───────────────────────────────────────── */
  let _canvas  = null;
  let _ctx     = null;
  let _dpr     = 1;
  let _width   = 0;
  let _height  = 0;
  let _resizeObserver = null;
  let _resizeCallback = null;

  /* ── Initialise ──────────────────────────────────────────── */
  function init(canvasEl, onResize) {
    _canvas = canvasEl;
    _ctx    = _canvas.getContext('2d');
    _dpr    = Math.max(1, window.devicePixelRatio || 1);
    _resizeCallback = onResize || null;

    _applySize();

    // ResizeObserver for smooth canvas scaling
    _resizeObserver = new ResizeObserver(() => {
      _applySize();
      if (_resizeCallback) _resizeCallback(_width, _height);
    });
    _resizeObserver.observe(document.documentElement);

    // Orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        _applySize();
        if (_resizeCallback) _resizeCallback(_width, _height);
      }, 300);
    });
  }

  function _applySize() {
    _dpr    = Math.max(1, window.devicePixelRatio || 1);
    _width  = window.innerWidth;
    _height = window.innerHeight;

    // Set the canvas backing-store size at device pixels
    _canvas.width  = Math.round(_width  * _dpr);
    _canvas.height = Math.round(_height * _dpr);

    // CSS size stays at logical pixels
    _canvas.style.width  = _width  + 'px';
    _canvas.style.height = _height + 'px';

    // Scale the context so every draw call uses logical coords
    _ctx.setTransform(_dpr, 0, 0, _dpr, 0, 0);
  }

  function destroy() {
    if (_resizeObserver) {
      _resizeObserver.disconnect();
      _resizeObserver = null;
    }
  }

  /* ── Getters ─────────────────────────────────────────────── */
  const getCtx    = () => _ctx;
  const getWidth  = () => _width;
  const getHeight = () => _height;
  const getDpr    = () => _dpr;

  /* ── Background Drawing ──────────────────────────────────── */
  function drawBackground(isDark) {
    const ctx = _ctx;
    const w   = _width;
    const h   = _height;

    // Solid background
    ctx.fillStyle = isDark ? '#0f2020' : '#e8f5f5';
    ctx.fillRect(0, 0, w, h);

    // Soft radial overlay
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    if (isDark) {
      grad.addColorStop(0, 'rgba(45,106,106,0.08)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      grad.addColorStop(0, 'rgba(110,194,194,0.12)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  /* ── Dot Drawing ─────────────────────────────────────────── */
  function drawDot(x, y, radius, isDark) {
    const ctx = _ctx;

    // Outer glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
    glow.addColorStop(0, isDark ? 'rgba(110,194,194,0.15)' : 'rgba(79,168,168,0.12)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
    ctx.fill();

    // Ring
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.6, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? 'rgba(110,194,194,0.25)' : 'rgba(79,168,168,0.2)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Main dot (radial gradient for depth)
    const dotGrad = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, 0,
      x, y, radius
    );
    dotGrad.addColorStop(0, isDark ? '#94d4d4' : '#6ec2c2');
    dotGrad.addColorStop(0.6, isDark ? '#4fa8a8' : '#3d8a8a');
    dotGrad.addColorStop(1, '#2d6a6a');
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = dotGrad;
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
  }

  /* ── Distractor Drawing ──────────────────────────────────── */
  function drawDistractor(d, isDark) {
    const ctx = _ctx;
    const op  = d.opacity * (0.8 + 0.2 * Math.sin(d.phase));
    ctx.globalAlpha = Math.max(0, Math.min(1, op));

    if (d.type === 'circle') {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.strokeStyle = isDark ? 'rgba(110,194,194,0.5)' : 'rgba(45,106,106,0.3)';
      ctx.lineWidth   = 1;
      ctx.stroke();
    } else {
      const ex = d.x + Math.cos(d.phase) * 30;
      const ey = d.y + Math.sin(d.phase) * 30;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = isDark ? 'rgba(110,194,194,0.3)' : 'rgba(45,106,106,0.2)';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  /* ── Pause Overlay ───────────────────────────────────────── */
  function drawPauseOverlay() {
    const ctx = _ctx;
    const w   = _width;
    const h   = _height;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle  = '#fff';
    ctx.font       = `bold ${Math.round(28 * (_width / 375))}px Cairo`;
    ctx.textAlign  = 'center';
    ctx.fillText('متوقف مؤقتاً', w / 2, h / 2 - 10);

    ctx.font      = `${Math.round(16 * (_width / 375))}px Cairo`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('اضغط للمتابعة', w / 2, h / 2 + 25);
    ctx.textAlign = 'start';
  }

  /* ── Clear ───────────────────────────────────────────────── */
  function clear() {
    _ctx.clearRect(0, 0, _width, _height);
  }

  /* ── Public API ──────────────────────────────────────────── */
  return {
    init,
    destroy,
    getCtx,
    getWidth,
    getHeight,
    getDpr,
    drawBackground,
    drawDot,
    drawDistractor,
    drawPauseOverlay,
    clear,
  };
})();

window.CanvasEngine = CanvasEngine;
