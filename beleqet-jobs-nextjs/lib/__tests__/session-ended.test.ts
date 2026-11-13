// @jest-environment jsdom

const post = jest.fn();
jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, default: { ...actual, create: () => ({ post, defaults: { baseURL: "" } }), isAxiosError: actual.isAxiosError } };
});

import { authenticatedFetch, SESSION_ENDED_EVENT } from "../auth";

function axiosError(status?: number) {
  return Object.assign(new Error("request failed"), {
    isAxiosError: true,
    response: status ? { status, data: {} } : undefined,
  });
}

describe("a session the server no longer accepts", () => {
  let ended: jest.Mock;

  beforeEach(() => {
    localStorage.setItem("beleqet_token", "old-access");
    localStorage.setItem("beleqet_refresh", "old-refresh");
    localStorage.setItem("beleqet_user", JSON.stringify({ id: "gone" }));
    global.fetch = jest.fn().mockResolvedValue({ status: 401 }) as never;
    ended = jest.fn();
    window.addEventListener(SESSION_ENDED_EVENT, ended);
    post.mockReset();
  });

  afterEach(() => window.removeEventListener(SESSION_ENDED_EVENT, ended));

  it("is dropped, and the page is told, when the refresh is refused", async () => {
    post.mockRejectedValueOnce(axiosError(401));
    const response = await authenticatedFetch("/api/v1/users/company");
    expect(response.status).toBe(401);
    expect(localStorage.getItem("beleqet_token")).toBeNull();
    expect(localStorage.getItem("beleqet_user")).toBeNull();
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("is kept when the refresh only failed for lack of a connection", async () => {
    post.mockRejectedValueOnce(axiosError());
    await authenticatedFetch("/api/v1/users/company");
    expect(localStorage.getItem("beleqet_token")).toBe("old-access");
    expect(ended).not.toHaveBeenCalled();
  });
});
