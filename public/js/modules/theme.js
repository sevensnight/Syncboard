import { state } from './state.js';

const ICON_SUN = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
const ICON_MOON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z"/></svg>`;

function createThemeModule({ root, themeToggleButton }) {
  function applyTheme(theme) {
    state.theme = theme === 'light' ? 'light' : 'dark';
    root.classList.toggle('dark', state.theme === 'dark');
    localStorage.setItem('syncboard-theme', state.theme);
    themeToggleButton.innerHTML = state.theme === 'dark' ? ICON_SUN : ICON_MOON;
    themeToggleButton.setAttribute('aria-label', state.theme === 'dark' ? '切换到浅色' : '切换到深色');
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  function init() {
    const storedTheme = localStorage.getItem('syncboard-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(storedTheme || (prefersDark ? 'dark' : 'light'));
    themeToggleButton.addEventListener('click', toggleTheme);
  }

  return {
    init,
    applyTheme,
  };
}

export { createThemeModule };
