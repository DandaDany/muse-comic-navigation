(() => {
  'use strict';
  const install = () => {
    const launcher = document.querySelector('.service-launcher');
    const panel = document.querySelector('.service-panel');
    const welcome = document.querySelector('.welcome-card .bubble');
    if (!launcher || !panel || !welcome || welcome.querySelector('.service-entry')) return Boolean(launcher && panel && welcome);
    const open = () => {
      if (!panel.classList.contains('open')) launcher.click();
    };
    const entry = document.createElement('button');
    entry.type = 'button';
    entry.className = 'service-entry';
    entry.innerHTML = '<strong>\u5ba2\u670d\u554f\u7b54\uff1a\u5546\u54c1\u3001\u512a\u60e0\u3001\u4ed8\u6b3e\u8207\u9810\u8cfc</strong><span>\u6587\u5316\u5e63\u3001\u6298\u50f9\u5238\u3001\u798f\u888b\u3001\u7cbe\u9078\u5546\u54c1\u3001\u96fb\u5f71\u7968\u3001\u6a5f\u53f0\u3001\u6eff\u984d\u8d08\u90fd\u53ef\u4ee5\u554f</span>';
    entry.addEventListener('click', open);
    welcome.appendChild(entry);
    const quick = panel.querySelector('.service-quick');
    const form = panel.querySelector('.service-form');
    const input = panel.querySelector('.service-form input');
    if (quick && form && input && !quick.querySelector('[data-service-selected]')) {
      const selected = document.createElement('button');
      selected.type = 'button'; selected.dataset.serviceSelected = 'true'; selected.textContent = '\u7cbe\u9078\u5546\u54c1\u5340';
      selected.addEventListener('click', () => { open(); input.value = selected.textContent; form.requestSubmit(); });
      quick.prepend(selected);
    }
    return true;
  };
  if (!install()) {
    const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
