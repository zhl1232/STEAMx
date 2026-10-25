// Runs before the stylesheet and app: theme changes never reload the experiment.
(() => {
  const root = document.documentElement;
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const tokens = {
    '--bg': '--app-canvas',
    '--ink': '--foreground',
    '--muted': '--muted-foreground',
    '--surface': '--surface-raised',
    '--surface-muted': '--surface-muted',
    '--line': '--surface-border',
    '--line-strong': '--surface-border-strong',
    '--green': '--brand-blue',
    '--green-light': '--brand-blue-soft',
    '--accent-ink': '--brand-blue-foreground',
    '--accent-border': '--brand-blue-border',
    '--blue': '--brand-blue',
    '--orange': '--brand-amber',
    '--danger': '--status-danger',
    '--danger-surface': '--status-danger-surface',
    '--danger-border': '--status-danger-border',
  };
  let hostRoot = null;
  // Only the explicitly embedded, same-origin main site supplies theme tokens.
  try {
    if (new URLSearchParams(window.location.search).get('host') === 'steamx' &&
        window.parent !== window && window.parent.location.origin === window.location.origin) {
      hostRoot = window.parent.document.documentElement;
    }
  } catch { /* Cross-origin standalone embeds follow the system theme. */ }

  function syncTheme() {
    const theme = hostRoot
      ? hostRoot.classList.contains('black-gold') ? 'black-gold' : hostRoot.classList.contains('dark') ? 'dark' : 'light'
      : systemTheme.matches ? 'dark' : 'light';
    root.dataset.theme = theme;
    root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
    if (!hostRoot) return;
    const styles = window.parent.getComputedStyle(hostRoot);
    root.style.setProperty('--lab-font', window.parent.getComputedStyle(window.parent.document.body).fontFamily);
    for (const [target, source] of Object.entries(tokens)) {
      const value = styles.getPropertyValue(source).trim();
      if (value) root.style.setProperty(target, `hsl(${value})`);
      else root.style.removeProperty(target);
    }
  }

  const observer = hostRoot ? new MutationObserver(syncTheme) : null;
  function connect() {
    if (hostRoot) observer.observe(hostRoot, { attributes: true, attributeFilter: ['class', 'style'] });
    else systemTheme.addEventListener('change', syncTheme);
    syncTheme();
  }
  connect();
  window.addEventListener('pagehide', () => {
    observer?.disconnect();
    systemTheme.removeEventListener('change', syncTheme);
  });
  window.addEventListener('pageshow', connect);
})();
