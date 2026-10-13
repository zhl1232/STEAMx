import { describe, expect, it } from "vitest";
import { PLATFORM_SUPPORT_HREF } from "@/lib/product/support";
import { DEFAULT_WELCOME_SETTINGS } from "./types";
import { parseCommunicationInput, welcomeInput } from "./validation";

describe("DEFAULT_WELCOME_SETTINGS", () => {
  it("gives newcomers one short next step instead of a feature catalogue", () => {
    expect(DEFAULT_WELCOME_SETTINGS.title).toBe("欢迎来到创探空间");
    expect(DEFAULT_WELCOME_SETTINGS.body).toBe("和孩子选一件想做的事，一起动手试试。");
    expect(DEFAULT_WELCOME_SETTINGS.body).not.toMatch(/STEAM|PBL|入群|公众号/);
    expect(DEFAULT_WELCOME_SETTINGS.contact_href).toBe(PLATFORM_SUPPORT_HREF);
  });

  it("stays valid for the admin welcome settings schema", () => {
    expect(parseCommunicationInput(welcomeInput, DEFAULT_WELCOME_SETTINGS)).toEqual(DEFAULT_WELCOME_SETTINGS);
  });
});
