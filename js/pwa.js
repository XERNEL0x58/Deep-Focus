/**
 * pwa.js — Deep-Focus PWA Module
 * Handles: Service Worker registration, install prompt, update detection
 */
'use strict';

const PWA = (() => {
  let _deferredPrompt = null;
  let _installBtn     = null;

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    _installBtn = document.getElementById('btn-install');

    _registerServiceWorker();
    _listenInstallPrompt();
    _listenInstallBtn();
    _listenAppInstalled();
    _detectStandalone();
  }

  /* ── Service Worker ──────────────────────────────────────── */
  async function _registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });

      // Update detection
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            if (window.UI) {
              UI.notify('🔄 تحديث جديد متاح — أعد تشغيل التطبيق', 5000);
            }
          }
        });
      });
    } catch (err) {
      console.warn('[PWA] Service Worker registration failed:', err);
    }
  }

  /* ── Install Prompt ──────────────────────────────────────── */
  function _listenInstallPrompt() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      _deferredPrompt = e;
      _showInstallBtn();
    });
  }

  function _listenInstallBtn() {
    if (!_installBtn) return;
    _installBtn.addEventListener('click', async () => {
      if (!_deferredPrompt) return;
      _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        _hideInstallBtn();
      }
      _deferredPrompt = null;
    });
  }

  function _listenAppInstalled() {
    window.addEventListener('appinstalled', () => {
      _hideInstallBtn();
      _deferredPrompt = null;
      if (window.UI) UI.notify('✅ تم تثبيت Deep-Focus بنجاح!');
    });
  }

  function _detectStandalone() {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) _hideInstallBtn();
  }

  function _showInstallBtn() {
    if (_installBtn) _installBtn.classList.remove('hidden');
  }

  function _hideInstallBtn() {
    if (_installBtn) _installBtn.classList.add('hidden');
  }

  /* ── Public API ──────────────────────────────────────────── */
  return { init };
})();

window.PWA = PWA;
