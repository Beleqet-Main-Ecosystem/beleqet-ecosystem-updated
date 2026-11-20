/** The Telegram Mini App's pages (app/tg): no website header, footer, menus or chat bubble there. */
export function isMiniAppPath(pathname: string | null | undefined): boolean {
  return pathname === '/tg' || Boolean(pathname?.startsWith('/tg/'));
}
