import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createAppleMapsAuthToken,
  getAppleMapsAccessToken,
  resetAppleMapsAccessTokenCacheForTests,
} from "./appleAuth.mjs";

async function signingFixture() {
  const directory = await mkdtemp(join(tmpdir(), "gymcircle-apple-maps-"));
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const privateKeyPath = join(directory, "AuthKey_TEST.p8");
  await writeFile(
    privateKeyPath,
    privateKey.export({ format: "pem", type: "pkcs8" }),
    { mode: 0o600 },
  );
  return {
    directory,
    environment: {
      APPLE_MAPS_TEAM_ID: "TEAM123456",
      APPLE_MAPS_KEY_ID: "KEY1234567",
      APPLE_MAPS_PRIVATE_KEY_PATH: privateKeyPath,
    },
    publicKey,
  };
}

test("Apple Maps auth token uses ES256 server_api claims without exposing the private key", async () => {
  const fixture = await signingFixture();
  try {
    const token = await createAppleMapsAuthToken({
      environment: fixture.environment,
      nowSeconds: 1_700_000_000,
    });
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url"));
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url"));
    assert.deepEqual(header, { alg: "ES256", kid: "KEY1234567", typ: "JWT" });
    assert.deepEqual(payload, {
      iss: "TEAM123456",
      iat: 1_700_000_000,
      exp: 1_700_000_300,
      scope: "server_api",
    });
    assert.equal(
      verify(
        "sha256",
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        { key: fixture.publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(encodedSignature, "base64url"),
      ),
      true,
    );
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test("Apple Maps access token is exchanged once and cached for the controlled run", async () => {
  const fixture = await signingFixture();
  resetAppleMapsAccessTokenCacheForTests();
  let calls = 0;
  try {
    const request = async (_url, init) => {
      calls += 1;
      assert.match(init.headers.Authorization, /^Bearer [^.]+\.[^.]+\.[^.]+$/);
      return {
        ok: true,
        async json() {
          return { accessToken: "short-lived-test-token", expiresInSeconds: 1800 };
        },
      };
    };
    assert.equal(
      await getAppleMapsAccessToken({ environment: fixture.environment, request }),
      "short-lived-test-token",
    );
    assert.equal(
      await getAppleMapsAccessToken({ environment: fixture.environment, request }),
      "short-lived-test-token",
    );
    assert.equal(calls, 1);
  } finally {
    resetAppleMapsAccessTokenCacheForTests();
    await rm(fixture.directory, { recursive: true, force: true });
  }
});
