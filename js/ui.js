/**
 * ui.js — Deep-Focus UI Module
 * Handles: Page navigation, HUD, Stats, Settings, Notifications
 */
'use strict';

const UI = (() => {
  /* ── Page Navigation ─────────────────────────────────────── */
  function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(id);
    if (page) page.classList.add('active');
  }

  /* ── HUD ─────────────────────────────────────────────────── */
  function updateTimer(remaining) {
    const el = document.getElementById('hud-timer');
    if (!el) return;
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
  }

  function updateFocusBar(score) {
    const fill  = document.getElementById('hud-focus');
    const label = document.getElementById('hud-score');
    if (fill)  fill.style.width = score + '%';
    if (label) label.textContent = `التركيز: ${score}٪`;

    // Color shift
    if (fill) {
      if (score > 70) {
        fill.style.background = 'linear-gradient(90deg, #4fa8a8, #94d4d4)';
      } else if (score > 40) {
        fill.style.background = 'linear-gradient(90deg, #e0a030, #f0c060)';
      } else {
        fill.style.background = 'linear-gradient(90deg, #c0392b, #e74c3c)';
      }
    }
  }

  /* ── Countdown ───────────────────────────────────────────── */
  function runCountdown(onDone) {
    const overlay = document.getElementById('countdown-overlay');
    const numEl   = document.getElementById('cd-num');
    if (!overlay || !numEl) { onDone(); return; }

    overlay.classList.remove('hidden');
    const nums = ['٣', '٢', '١'];
    let i = 0;

    function step() {
      if (i >= nums.length) {
        overlay.classList.add('hidden');
        onDone();
        return;
      }
      numEl.textContent  = nums[i];
      numEl.style.animation = 'none';
      void numEl.offsetWidth;
      numEl.style.animation = 'countPulse 1s forwards';
      i++;
      setTimeout(step, 1000);
    }
    step();
  }

  /* ── Session Complete Overlay ────────────────────────────── */
  function showComplete(snapshot, completed) {
    const overlay = document.getElementById('complete-overlay');
    if (!overlay) return;

    const icon  = overlay.querySelector('.complete-icon');
    const title = document.getElementById('complete-title');
    const sub   = document.getElementById('complete-sub');

    const elapsed   = (snapshot.duration - snapshot.remaining);
    const durMins   = Math.floor(elapsed / 60);
    const durSecs   = elapsed % 60;
    const durStr    = durMins > 0 ? `${durMins}د ${durSecs}ث` : `${durSecs}ث`;
    const focusPct  = Math.round(snapshot.focusScore);

    if (completed) {
      icon.textContent  = '🌿';
      title.textContent = 'أحسنت!';
      sub.textContent   = 'اكتملت جلسة التركيز بنجاح';
    } else {
      icon.textContent  = '⏸';
      title.textContent = 'انتهت الجلسة';
      sub.textContent   = 'تم إنهاء جلسة التركيز';
    }

    document.getElementById('cs-duration').textContent = durStr;
    document.getElementById('cs-focus').textContent    = focusPct + '٪';
    document.getElementById('cs-losses').textContent   = snapshot.losses;

    overlay.classList.remove('hidden');
  }

  function hideComplete() {
    const overlay = document.getElementById('complete-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  /* ── Stats Page ──────────────────────────────────────────── */
  async function renderStats() {
    const container = document.getElementById('stats-content');
    if (!container) return;

    const stats = await Storage.computeStats();

    if (!stats) {
      container.innerHTML = `
        <div class="empty-stats">
          <div class="empty-icon">📊</div>
          <p>لا توجد جلسات محفوظة بعد.<br>ابدأ جلستك الأولى!</p>
        </div>`;
      return;
    }

    const totalMins = Math.floor(stats.totalFocus / 60);
    const bestScore = stats.best ? stats.best.focusScore : 0;

    container.innerHTML = `
      <div class="stats-grid">
        ${_statCard('🧠', stats.sessions.length, 'جلسة')}
        ${_statCard('⏱', totalMins, 'دقيقة')}
        ${_statCard('🎯', stats.avgFocus + '٪', 'متوسط التركيز')}
        ${_statCard('🏆', bestScore + '٪', 'أفضل تركيز')}
        ${_statCard('🔥', stats.streak, 'يوم متواصل')}
      </div>
      <div class="chart-card">
        <div class="chart-title">📈 آخر ٧ جلسات</div>
        ${_renderBarChart(stats.sessions)}
      </div>
      <div class="chart-card">
        <div class="chart-title">📅 نشاط هذا الشهر</div>
        ${_renderStreak(stats)}
      </div>`;
  }

  function _statCard(icon, val, lbl) {
    return `
      <div class="stat-card">
        <div class="stat-icon">${icon}</div>
        <span class="stat-val">${val}</span>
        <div class="stat-lbl">${lbl}</div>
      </div>`;
  }

  function _renderBarChart(sessions) {
    const last7 = sessions.slice(-7);
    if (!last7.length) return '<p style="opacity:0.5;font-size:0.875rem">لا توجد بيانات</p>';

    const max = Math.max(...last7.map(s => s.focusScore), 1);
    const bars = last7.map(s => {
      const h    = Math.round((s.focusScore / max) * 100);
      const date = new Date(s.timestamp);
      const lbl  = `${date.getMonth() + 1}/${date.getDate()}`;
      return `
        <div class="bar-wrap">
          <div class="bar" style="height:${h}%" title="${s.focusScore}٪"></div>
          <span class="bar-lbl">${lbl}</span>
        </div>`;
    }).join('');

    return `<div class="bar-chart">${bars}</div>`;
  }

  function _renderStreak(stats) {
    const today   = new Date();
    const days    = [];
    const doneDates = new Set(stats.sessions.map(s => s.date));

    for (let i = 29; i >= 0; i--) {
      const d    = new Date(today);
      d.setDate(d.getDate() - i);
      const iso  = d.toISOString().split('T')[0];
      const day  = d.getDate();
      const cls  = iso === stats.today ? 'today' : doneDates.has(iso) ? 'done' : 'empty';
      days.push(`<div class="streak-day ${cls}" title="${iso}">${day}</div>`);
    }

    return `<div class="streak-row">${days.join('')}</div>`;
  }

  /* ── Settings Page ───────────────────────────────────────── */
  function loadSettings(settings) {
    _setToggle('tog-dark',       settings.dark);
    _setToggle('tog-distract',   settings.distractions);
    _setToggle('tog-fullscreen', settings.fullscreen);
    _setSlider('sl-dotsize', settings.dotSize);
    _setSlider('sl-speed',   settings.speed);

    const sel = document.getElementById('sel-difficulty');
    if (sel) sel.value = settings.difficulty;

    if (settings.dark) document.body.classList.add('dark');
    else document.body.classList.remove('dark');
  }

  function _setToggle(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    if (on) { el.classList.add('on');  el.setAttribute('aria-checked', 'true'); }
    else    { el.classList.remove('on'); el.setAttribute('aria-checked', 'false'); }
  }

  function _setSlider(id, val) {
    const slider = document.getElementById(id);
    const label  = document.getElementById(id + '-val');
    if (slider) { slider.value = val; slider.setAttribute('aria-valuenow', val); }
    if (label)  label.textContent = val;
  }

  function readSettings(current) {
    return {
      dark:        document.getElementById('tog-dark')?.classList.contains('on')       ?? current.dark,
      distractions: document.getElementById('tog-distract')?.classList.contains('on') ?? current.distractions,
      fullscreen:  document.getElementById('tog-fullscreen')?.classList.contains('on') ?? current.fullscreen,
      dotSize:     parseInt(document.getElementById('sl-dotsize')?.value  ?? current.dotSize),
      speed:       parseInt(document.getElementById('sl-speed')?.value    ?? current.speed),
      difficulty:  document.getElementById('sel-difficulty')?.value       ?? current.difficulty,
    };
  }

  /* ── Notification Toast ──────────────────────────────────── */
  let _notifTimeout = null;
  function notify(msg, duration = 2500) {
    const el = document.getElementById('notif');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(_notifTimeout);
    _notifTimeout = setTimeout(() => el.classList.remove('show'), duration);
  }

  /* ── Ambient Particles ───────────────────────────────────── */
  function initParticles() {
    const container = document.getElementById('ambient-particles');
    if (!container) return;

    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    container.innerHTML = '';
    const count = Math.min(12, Math.floor(window.innerWidth / 80));
    for (let i = 0; i < count; i++) {
      const p    = document.createElement('div');
      p.className = 'particle';
      const size = 20 + Math.random() * 60;
      const left = Math.random() * 100;
      const dur  = 8 + Math.random() * 12;
      const del  = Math.random() * 10;
      p.style.cssText = `
        width:${size}px; height:${size}px;
        left:${left}%;  bottom:-${size}px;
        animation-duration:${dur}s;
        animation-delay:${del}s;
      `;
      container.appendChild(p);
    }
  }

  /* ── Mode / Duration Selection Buttons ──────────────────── */
  function initHomeButtons(onDurChange, onModeChange) {
    document.getElementById('dur-btns')?.addEventListener('click', e => {
      const btn = e.target.closest('.dur-btn');
      if (!btn) return;
      document.querySelectorAll('.dur-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      onDurChange(parseInt(btn.dataset.dur));
    });

    document.getElementById('mode-btns')?.addEventListener('click', e => {
      const btn = e.target.closest('.mode-btn');
      if (!btn) return;
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      onModeChange(btn.dataset.mode);
    });
  }

  /* ── Toggle Helper (settings page) ──────────────────────── */
  function bindToggle(id, onChange) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
      const on = !el.classList.contains('on');
      if (on) { el.classList.add('on');    el.setAttribute('aria-checked', 'true');  }
      else    { el.classList.remove('on'); el.setAttribute('aria-checked', 'false'); }
      onChange(on);
    });
  }

  function bindSlider(id, onChange) {
    const slider = document.getElementById(id);
    const label  = document.getElementById(id + '-val');
    if (!slider) return;
    slider.addEventListener('input', () => {
      const val = parseInt(slider.value);
      if (label) { label.textContent = val; }
      slider.setAttribute('aria-valuenow', val);
      onChange(val);
    });
  }

  /* ── Fullscreen ──────────────────────────────────────────── */
  function requestFullscreen() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (fn) fn.call(el).catch(() => {});
  }

  function exitFullscreen() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
    if (fn) fn.call(document).catch(() => {});
  }

  /* ── Public API ──────────────────────────────────────────── */
  return {
    showPage,
    updateTimer,
    updateFocusBar,
    runCountdown,
    showComplete,
    hideComplete,
    renderStats,
    loadSettings,
    readSettings,
    notify,
    initParticles,
    initHomeButtons,
    bindToggle,
    bindSlider,
    requestFullscreen,
    exitFullscreen,
  };
})();

window.UI = UI;
