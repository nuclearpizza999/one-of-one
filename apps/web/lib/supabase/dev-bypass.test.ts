import { describe, expect, it } from "vitest";
import { devBypassEnabled, isCodeword } from "./dev-bypass";

const ON = {
  NODE_ENV: "development",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  DEV_SIGNIN_PASSWORD: "local-only-password",
};

describe("devBypassEnabled", () => {
  it("is on in a development build against the local stack with a dev password", () => {
    expect(devBypassEnabled(ON)).toBe(true);
    expect(devBypassEnabled({ ...ON, NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" })).toBe(true);
    expect(devBypassEnabled({ ...ON, DEV_AUTO_SIGNIN: "1" })).toBe(true);
  });
  it("is off in a production build", () => {
    expect(devBypassEnabled({ ...ON, NODE_ENV: "production" })).toBe(false);
  });
  it("is off when DEV_AUTO_SIGNIN is 0", () => {
    expect(devBypassEnabled({ ...ON, DEV_AUTO_SIGNIN: "0" })).toBe(false);
  });
  it("is off against any database but the local one", () => {
    for (const url of ["https://abcd.supabase.co", "http://127.0.0.1.example.com:54321", "http://10.0.0.5:54321", "not a url", ""]) {
      expect(devBypassEnabled({ ...ON, NEXT_PUBLIC_SUPABASE_URL: url }), url).toBe(false);
    }
    expect(devBypassEnabled({ ...ON, NEXT_PUBLIC_SUPABASE_URL: undefined })).toBe(false);
  });
  it("is off without a dev password", () => {
    expect(devBypassEnabled({ ...ON, DEV_SIGNIN_PASSWORD: undefined })).toBe(false);
    expect(devBypassEnabled({ ...ON, DEV_SIGNIN_PASSWORD: "" })).toBe(false);
  });
});

describe("isCodeword", () => {
  it("accepts dev, trimmed and in any case", () => {
    for (const s of ["dev", " DEV ", "Dev"]) expect(isCodeword(s), s).toBe(true);
  });
  it("rejects anything else", () => {
    for (const s of ["", "de", "devs", "dev@example.com", "d ev"]) expect(isCodeword(s), s).toBe(false);
  });
});
