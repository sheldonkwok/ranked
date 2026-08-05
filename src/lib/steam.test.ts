import { describe, expect, it } from "vitest";
import { buildSteamAuthUrl, buildVerificationBody, extractSteamId } from "./steam";

const RETURN_TO = "http://localhost:3000/api/auth/steam/callback?state=abc123";
const REALM = "http://localhost:3000";

describe("buildSteamAuthUrl", () => {
  it("sets identifier_select for both identity and claimed_id, and passes return_to/realm through", () => {
    const url = new URL(buildSteamAuthUrl(RETURN_TO, REALM));

    expect(url.origin + url.pathname).toBe("https://steamcommunity.com/openid/login");
    expect(url.searchParams.get("openid.mode")).toBe("checkid_setup");
    expect(url.searchParams.get("openid.identity")).toBe("http://specs.openid.net/auth/2.0/identifier_select");
    expect(url.searchParams.get("openid.claimed_id")).toBe("http://specs.openid.net/auth/2.0/identifier_select");
    expect(url.searchParams.get("openid.return_to")).toBe(RETURN_TO);
    expect(url.searchParams.get("openid.realm")).toBe(REALM);
  });
});

describe("buildVerificationBody", () => {
  it("rewrites openid.mode to check_authentication and passes other openid.* params through byte-for-byte", () => {
    const params = new URLSearchParams({
      "openid.mode": "id_res",
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.claimed_id": "https://steamcommunity.com/openid/id/76561197960287930",
      "openid.sig": "abc==",
    });

    const body = buildVerificationBody(params);

    expect(body.get("openid.mode")).toBe("check_authentication");
    expect(body.get("openid.ns")).toBe("http://specs.openid.net/auth/2.0");
    expect(body.get("openid.claimed_id")).toBe("https://steamcommunity.com/openid/id/76561197960287930");
    expect(body.get("openid.sig")).toBe("abc==");
  });

  it("drops params that aren't in the openid.* namespace", () => {
    const params = new URLSearchParams({
      "openid.mode": "id_res",
      state: "abc123",
    });

    const body = buildVerificationBody(params);

    expect(body.has("state")).toBe(false);
    expect([...body.keys()]).toEqual(["openid.mode"]);
  });
});

describe("extractSteamId", () => {
  function callbackParams(overrides: Record<string, string> = {}): URLSearchParams {
    return new URLSearchParams({
      "openid.claimed_id": "https://steamcommunity.com/openid/id/76561197960287930",
      "openid.return_to": RETURN_TO,
      ...overrides,
    });
  }

  it("extracts the SteamID64 from a well-formed claimed_id matching the expected return_to", () => {
    expect(extractSteamId(callbackParams(), RETURN_TO)).toBe("76561197960287930");
  });

  it("rejects a claimed_id from a non-Steam host", () => {
    const params = callbackParams({ "openid.claimed_id": "https://evil.example.com/openid/id/76561197960287930" });
    expect(extractSteamId(params, RETURN_TO)).toBeNull();
  });

  it("rejects a claimed_id whose id isn't a 17-digit SteamID64", () => {
    const params = callbackParams({ "openid.claimed_id": "https://steamcommunity.com/openid/id/notanumber" });
    expect(extractSteamId(params, RETURN_TO)).toBeNull();
  });

  it("rejects a return_to that doesn't match what we sent", () => {
    const params = callbackParams({
      "openid.return_to": "http://localhost:3000/api/auth/steam/callback?state=different",
    });
    expect(extractSteamId(params, RETURN_TO)).toBeNull();
  });

  it("rejects a callback missing claimed_id or return_to", () => {
    expect(extractSteamId(new URLSearchParams({ "openid.return_to": RETURN_TO }), RETURN_TO)).toBeNull();
    expect(
      extractSteamId(
        new URLSearchParams({ "openid.claimed_id": "https://steamcommunity.com/openid/id/76561197960287930" }),
        RETURN_TO
      )
    ).toBeNull();
  });
});
