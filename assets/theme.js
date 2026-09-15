'use strict';
(() => {
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.setAttribute('aria-label', theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي');
      button.innerHTML = theme === 'dark' ? '☀ <span>نهاري</span>' : '☾ <span>ليلي</span>';
    });
  }
  let theme = 'dark';
  try {
    const saved = localStorage.getItem('velmor_theme');
    if (saved === 'light') theme = 'light';
    else if (saved === 'dark') theme = 'dark';
    else theme = 'dark';
  } catch {}
  apply(theme);
  document.addEventListener('DOMContentLoaded', () => apply(document.documentElement.dataset.theme));
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-theme-toggle]')) return;
    theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('velmor_theme', theme); } catch {}
    apply(theme);
  });
})();
