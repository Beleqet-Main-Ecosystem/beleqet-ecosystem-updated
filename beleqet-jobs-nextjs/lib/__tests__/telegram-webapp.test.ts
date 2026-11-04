// @jest-environment jsdom

import { isTelegramLaunch, loadTelegramWebApp } from "../telegram-webapp";

describe("Telegram Mini App launch", () => {
  afterEach(() => {
    window.location.hash = "";
    sessionStorage.clear();
    delete window.Telegram;
  });

  it("is not a Mini App in a normal browser, and loads nothing", async () => {
    expect(isTelegramLaunch()).toBe(false);
    await expect(loadTelegramWebApp()).resolves.toBeNull();
    expect(document.querySelector('script[src*="telegram-web-app"]')).toBeNull();
  });

  it("recognises Telegram's launch data in the URL or from a reload", () => {
    window.location.hash = "#tgWebAppData=user%3D1&tgWebAppVersion=7.0";
    expect(isTelegramLaunch()).toBe(true);
    window.location.hash = "";
    sessionStorage.setItem("__telegram__initParams", "{}");
    expect(isTelegramLaunch()).toBe(true);
  });
});
