// Set the theme before first paint so dark mode never flashes light.
// A file, not an inline script, so the Content-Security-Policy can forbid inline scripts.
try {
  var p = JSON.parse(localStorage.getItem('bench-tracker-prefs') || '{}')
  var m = p.mode || 'system'
  document.documentElement.dataset.theme = m === 'dark' || (m === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
} catch (e) {}
