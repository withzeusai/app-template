import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";
import { createServer } from "node:https";

// A minimal OpenID provider for the auth end-to-end test, standing in for
// Hercules Auth. It serves just what the template's two consumers read:
// `@usehercules/auth-tanstack` (discovery, authorization code with PKCE,
// refresh, end session) and the Convex backend (discovery and JWKS, to verify
// ID tokens). Every authorization request signs in the same test user at
// once, with no login page.
//
// It must be HTTPS: openid-client refuses plain HTTP issuers.

const KEY_ID = "e2e-key";
const TOKEN_TTL_SECONDS = 3600;

export const TEST_USER = {
  sub: "e2e-user",
  email: "e2e-user@example.com",
  email_verified: true,
  name: "E2E User",
  given_name: "E2E",
  family_name: "User",
};

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function randomToken() {
  return randomBytes(24).toString("base64url");
}

/**
 * Start the provider on `127.0.0.1` with the given TLS key and certificate.
 * Resolves once it listens, with its `issuer` URL and a `close()`.
 */
export async function startOidcProvider({ key, cert, clientId, port = 0 }) {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicJwk = {
    ...createPublicKey(privateKey).export({ format: "jwk" }),
    kid: KEY_ID,
    alg: "RS256",
    use: "sig",
  };

  // code -> { codeChallenge, redirectUri }; refresh token -> true
  const codes = new Map();
  const refreshTokens = new Set();
  let issuer = "";

  function signJwt(claims) {
    const header = base64url(
      JSON.stringify({ alg: "RS256", typ: "JWT", kid: KEY_ID }),
    );
    const payload = base64url(JSON.stringify(claims));
    const signature = sign(
      "RSA-SHA256",
      Buffer.from(`${header}.${payload}`),
      privateKey,
    ).toString("base64url");
    return `${header}.${payload}.${signature}`;
  }

  function issueTokens() {
    const now = Math.floor(Date.now() / 1000);
    const common = {
      iss: issuer,
      sub: TEST_USER.sub,
      aud: clientId,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    };
    const refreshToken = randomToken();
    refreshTokens.add(refreshToken);
    return {
      token_type: "Bearer",
      expires_in: TOKEN_TTL_SECONDS,
      scope: "openid profile email offline_access",
      access_token: signJwt({ ...common, client_id: clientId }),
      id_token: signJwt({ ...common, auth_time: now, ...TEST_USER }),
      refresh_token: refreshToken,
    };
  }

  function json(response, status, body) {
    response.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify(body));
  }

  async function readForm(request) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  }

  function authorize(url, response) {
    const params = url.searchParams;
    const redirectUri = params.get("redirect_uri");
    if (params.get("client_id") !== clientId || !redirectUri) {
      json(response, 400, { error: "invalid_request" });
      return;
    }
    const code = randomToken();
    codes.set(code, {
      codeChallenge: params.get("code_challenge"),
      redirectUri,
    });
    const location = new URL(redirectUri);
    location.searchParams.set("code", code);
    location.searchParams.set("iss", issuer);
    const state = params.get("state");
    if (state !== null) location.searchParams.set("state", state);
    response.writeHead(302, { location: location.toString() });
    response.end();
  }

  async function token(request, response) {
    const form = await readForm(request);
    const grantType = form.get("grant_type");

    if (grantType === "authorization_code") {
      const grant = codes.get(form.get("code") ?? "");
      codes.delete(form.get("code") ?? "");
      const verifier = form.get("code_verifier") ?? "";
      const challenge = createHash("sha256")
        .update(verifier)
        .digest("base64url");
      if (
        !grant ||
        grant.redirectUri !== form.get("redirect_uri") ||
        (grant.codeChallenge !== null && grant.codeChallenge !== challenge)
      ) {
        json(response, 400, { error: "invalid_grant" });
        return;
      }
      json(response, 200, issueTokens());
      return;
    }

    if (grantType === "refresh_token") {
      const refreshToken = form.get("refresh_token") ?? "";
      if (!refreshTokens.delete(refreshToken)) {
        json(response, 400, { error: "invalid_grant" });
        return;
      }
      json(response, 200, issueTokens());
      return;
    }

    json(response, 400, { error: "unsupported_grant_type" });
  }

  function endSession(url, response) {
    const target = url.searchParams.get("post_logout_redirect_uri");
    if (target) {
      response.writeHead(302, { location: target });
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("Signed out");
  }

  const server = createServer({ key, cert }, (request, response) => {
    const url = new URL(request.url ?? "/", issuer);
    const route = `${request.method} ${url.pathname}`;
    const handle = async () => {
      switch (route) {
        case "GET /.well-known/openid-configuration":
          json(response, 200, {
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            jwks_uri: `${issuer}/jwks`,
            end_session_endpoint: `${issuer}/end-session`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            subject_types_supported: ["public"],
            id_token_signing_alg_values_supported: ["RS256"],
            token_endpoint_auth_methods_supported: ["none"],
            code_challenge_methods_supported: ["S256"],
            scopes_supported: ["openid", "profile", "email", "offline_access"],
            authorization_response_iss_parameter_supported: true,
          });
          return;
        case "GET /jwks":
          json(response, 200, { keys: [publicJwk] });
          return;
        case "GET /authorize":
          authorize(url, response);
          return;
        case "POST /token":
          await token(request, response);
          return;
        case "GET /end-session":
          endSession(url, response);
          return;
        default:
          json(response, 404, { error: "not_found" });
      }
    };
    handle().catch((error) => {
      console.error("OIDC provider error:", error);
      if (!response.headersSent) json(response, 500, { error: "server_error" });
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  issuer = `https://127.0.0.1:${server.address().port}`;

  return {
    issuer,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
