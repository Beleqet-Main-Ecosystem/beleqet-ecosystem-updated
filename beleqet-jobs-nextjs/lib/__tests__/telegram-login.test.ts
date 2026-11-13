// @jest-environment jsdom

import { isPlaceholderEmail } from "../auth";
import { askTelegram, botRegistrationUrl, TELEGRAM_LOGIN_BOT_ID } from "../telegram-login";

type Callback = (data: Record<string, string | number> | false) => void;

function fakeTelegram(answer: Record<string, string | number> | false) {
  const auth = jest.fn((_options: unknown, callback: Callback) => callback(answer));
  (window as unknown as { Telegram: unknown }).Telegram = { Login: { auth } };
  return auth;
}

describe("Sign in with Telegram", () => {
  afterEach(() => {
    delete (window as unknown as { Telegram?: unknown }).Telegram;
  });

  it("asks Telegram with the Jobs bot, allowing it to message the person", async () => {
    const auth = fakeTelegram({ id: 42, first_name: "Hana", auth_date: 1, hash: "abc" });
    await expect(askTelegram("am")).resolves.toEqual({
      data: { id: 42, first_name: "Hana", auth_date: 1, hash: "abc" },
      failed: false,
    });
    expect(auth.mock.calls[0][0]).toEqual({ bot_id: TELEGRAM_LOGIN_BOT_ID, request_access: "write", lang: "am" });
  });

  it("tells a closed popup apart from a failure", async () => {
    fakeTelegram(false);
    await expect(askTelegram("en")).resolves.toEqual({ data: null, failed: false });
  });
});

describe("isPlaceholderEmail", () => {
  it("hides the internal addresses of accounts made in Telegram", () => {
    expect(isPlaceholderEmail("tma_42@tme.beleqet.local")).toBe(true);
    expect(isPlaceholderEmail("telegram_42@beleqet.internal")).toBe(true);
    expect(isPlaceholderEmail(null)).toBe(true);
    expect(isPlaceholderEmail("hana@gmail.com")).toBe(false);
  });
});

describe("botRegistrationUrl", () => {
  it("brings someone who wanted a job back to it after registering in the bot", () => {
    const id = "4f194529-2fc6-4511-aa7f-b37f6eba5e69";
    expect(botRegistrationUrl(`/jobs/${id}/apply`)).toBe(`https://t.me/BeleqetJobs_Bot?start=register_job-${id}`);
    expect(botRegistrationUrl(`/jobs/${id}`)).toBe(`https://t.me/BeleqetJobs_Bot?start=register_job-${id}`);
  });

  it("otherwise starts plain registration", () => {
    expect(botRegistrationUrl("/post-job")).toBe("https://t.me/BeleqetJobs_Bot?start=register");
    expect(botRegistrationUrl(null)).toBe("https://t.me/BeleqetJobs_Bot?start=register");
    expect(botRegistrationUrl("/jobs?q=driver")).toBe("https://t.me/BeleqetJobs_Bot?start=register");
  });
});
