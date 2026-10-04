import { describe, expect, it } from "vitest";

import { BRAND_HERO_STATEMENT, BRAND_POSITIONING } from "@/lib/brand";

import { DEFAULT_WELCOME_SETTINGS } from "./types";
import { parseCommunicationInput, welcomeInput } from "./validation";

describe("DEFAULT_WELCOME_SETTINGS", () => {
  it("greets new users with the current brand tagline and positioning", () => {
    expect(DEFAULT_WELCOME_SETTINGS.title).toBe("欢迎来到创探空间");
    expect(DEFAULT_WELCOME_SETTINGS.body.startsWith(BRAND_HERO_STATEMENT)).toBe(true);
    expect(DEFAULT_WELCOME_SETTINGS.body).toContain(`创探空间是${BRAND_POSITIONING}`);
    expect(DEFAULT_WELCOME_SETTINGS.body).toContain("兴趣是最好的老师。在真实项目中动手探索，学会拆解问题、持续迭代。");
    expect(DEFAULT_WELCOME_SETTINGS.body).not.toContain("从兴趣出发");
    expect(DEFAULT_WELCOME_SETTINGS.body).not.toContain("学习与创作");
  });

  it("stays valid for the admin welcome settings schema", () => {
    expect(parseCommunicationInput(welcomeInput, DEFAULT_WELCOME_SETTINGS)).toEqual(DEFAULT_WELCOME_SETTINGS);
  });
});
