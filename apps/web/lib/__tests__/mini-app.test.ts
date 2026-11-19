import { isMiniAppPath } from "../mini-app";
import { stageOf } from "../../features/miniapp/stages";

describe("Telegram Mini App pages", () => {
  it("are /tg and everything under it, nothing else", () => {
    expect(isMiniAppPath("/tg")).toBe(true);
    expect(isMiniAppPath("/tg/jobs/42/apply")).toBe(true);
    expect(isMiniAppPath("/tgif")).toBe(false);
    expect(isMiniAppPath("/jobs")).toBe(false);
    expect(isMiniAppPath(null)).toBe(false);
  });
});

describe("how far an application got", () => {
  it("follows the four steps a job seeker sees", () => {
    expect(stageOf("SUBMITTED")).toEqual({ reached: 0, ended: false });
    expect(stageOf("SCREENING")).toEqual({ reached: 1, ended: false });
    expect(stageOf("SHORTLISTED")).toEqual({ reached: 2, ended: false });
    expect(stageOf("INTERVIEW_SCHEDULED")).toEqual({ reached: 3, ended: false });
    expect(stageOf("OFFERED")).toEqual({ reached: 3, ended: false });
  });

  it("marks an application that ended", () => {
    expect(stageOf("REJECTED").ended).toBe(true);
    expect(stageOf("WITHDRAWN").ended).toBe(true);
  });
});
