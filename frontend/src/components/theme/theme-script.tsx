import { DARK_THEME_CLASS, THEME_COOKIE_KEY, THEME_STORAGE_KEY } from './theme-preference';

/**
 * Executes before hydration to apply the cached resolved theme and prevent FOUC.
 * It intentionally contains no user data beyond the minimal theme value.
 */
export function ThemeScript(): JSX.Element {
  const script = `!function(){try{var k='${THEME_STORAGE_KEY}',c='${THEME_COOKIE_KEY}',v=localStorage.getItem(k)||document.cookie.match(new RegExp('(?:^|; )'+c+'=([^;]*)'))?.[1]||'SYSTEM';var d=v==='DARK'||v==='SYSTEM'&&window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('${DARK_THEME_CLASS}',d);document.documentElement.dataset.theme=v}catch(e){}}();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
