import { createPrivateKey, sign } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const TOKEN_URL = "https://maps-api.apple.com/v1/token";
const AUTH_TOKEN_TTL_SECONDS = 300;
let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function hasAppleMapsSigningConfiguration(environment = process.env) {
  return Boolean(
    environment.APPLE_MAPS_TEAM_ID &&
      environment.APPLE_MAPS_KEY_ID &&
      environment.APPLE_MAPS_PRIVATE_KEY_PATH,
  );
}

export async function createAppleMapsAuthToken({
  environment = process.env,
  nowSeconds = Math.floor(Date.now() / 1000),
} = {}) {
  const teamId = environment.APPLE_MAPS_TEAM_ID;
  const keyId = environment.APPLE_MAPS_KEY_ID;
  const privateKeyPath = environment.APPLE_MAPS_PRIVATE_KEY_PATH;
  if (!teamId || !keyId || !privateKeyPath) {
    throw new Error("Apple Maps signing configuration is incomplete");
  }

  const privateKeyStats = await stat(privateKeyPath);
  if ((privateKeyStats.mode & 0o077) !== 0) {
    throw new Error("Apple Maps private key file must not be readable by group or others");
  }
  const privateKeyPem = await readFile(privateKeyPath, "utf8");
  const header = encodeJson({ alg: "ES256", kid: keyId, typ: "JWT" });
  const payload = encodeJson({
    iss: teamId,
    iat: nowSeconds,
    exp: nowSeconds + AUTH_TOKEN_TTL_SECONDS,
    scope: "server_api",
  });
  const signingInput = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(privateKeyPem),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `${signingInput}.${signature}`;
}

export async function getAppleMapsAccessToken({
  environment = process.env,
  request = fetch,
  signal,
} = {}) {
  if (environment.APPLE_MAPS_TOKEN) return environment.APPLE_MAPS_TOKEN;
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) {
    return cachedAccessToken;
  }

  const authToken = await createAppleMapsAuthToken({ environment });
  const response = await request(TOKEN_URL, {
    signal,
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!response.ok) {
    throw new Error(`Apple Maps token endpoint returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!payload?.accessToken || !Number.isFinite(payload.expiresInSeconds)) {
    throw new Error("Apple Maps token endpoint returned an invalid response");
  }
  cachedAccessToken = payload.accessToken;
  cachedAccessTokenExpiresAt = Date.now() + Math.max(0, payload.expiresInSeconds - 60) * 1000;
  return cachedAccessToken;
}

export function resetAppleMapsAccessTokenCacheForTests() {
  cachedAccessToken = null;
  cachedAccessTokenExpiresAt = 0;
}
