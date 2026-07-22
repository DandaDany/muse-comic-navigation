(() => {
  const installLeftAutocompleteFix = () => {
    const input = document.getElementById('leftBrand');
    const panel = document.getElementById('leftSuggestions');
    if (!input || !panel || panel.dataset.uiFixInstalled) return Boolean(input && panel);

    panel.dataset.uiFixInstalled = 'true';
    const clean = () => {
      if (!input.value.trim()) {
        if (panel.innerHTML || panel.classList.contains('open')) {
          panel.innerHTML = '';
          panel.classList.remove('open');
        }
        return;
      }
      panel.querySelectorAll('.suggestion-item').forEach((item) => {
        if (item.textContent.trim() === '偶像星願') item.remove();
      });
    };

    input.addEventListener('input', () => queueMicrotask(clean));
    input.addEventListener('focus', () => queueMicrotask(clean));
    new MutationObserver(clean).observe(panel, { childList: true, subtree: true });
    clean();
    return true;
  };

  if (!installLeftAutocompleteFix()) {
    const observer = new MutationObserver(() => {
      if (installLeftAutocompleteFix()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
