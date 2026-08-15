#!/usr/bin/env node
/**
 * IBKR Client Portal Gateway auto-login watchdog.
 *
 * IBKR's SSO flow only works when the browser origin is `localhost`, so this
 * script MUST run on the same host as the gateway (or via an SSH tunnel).
 * It reads IBKR_USERNAME / IBKR_PASSWORD from an agenix-style KEY=VALUE
 * secrets file (age-encrypted at rest, decrypted to /run/agenix by NixOS).
 *
 * Usage:
 *   node login.js --check    # print auth status, exit 0 if authenticated
 *   node login.js --once     # one login attempt (waits for the 2FA tap)
 *   node login.js --watch    # loop forever (default)
 *
 * Environment:
 *   GATEWAY_URL          default https://localhost:5000
 *   SECRETS_FILE         default /run/agenix/spending-tracker
 *   CHECK_INTERVAL_MIN   poll interval when authenticated (default 10)
 *   LOGIN_TIMEOUT_SEC    how long to wait for the 2FA tap (default 240)
 */
const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");

const GATEWAY_URL = process.env.GATEWAY_URL || "https://localhost:5000";
const SECRETS_FILE = process.env.SECRETS_FILE || "/run/agenix/spending-tracker";
const CHECK_INTERVAL_MS =
  (parseInt(process.env.CHECK_INTERVAL_MIN || "10", 10) || 10) * 60 * 1000;
const LOGIN_TIMEOUT_MS =
  (parseInt(process.env.LOGIN_TIMEOUT_SEC || "240", 10) || 240) * 1000;
const FAIL_BACKOFF_MS = 30 * 60 * 1000; // after a failed login attempt

const MODE = process.argv[2] === "--check" ? "check"
  : process.argv[2] === "--once" ? "once"
  : "watch";

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function getCredentials() {
  const secrets = readSecrets(SECRETS_FILE);
  const username = secrets.IBKR_USERNAME;
  const password = secrets.IBKR_PASSWORD;
  if (!username || !password) {
    throw new Error(`IBKR_USERNAME/IBKR_PASSWORD missing in ${SECRETS_FILE}`);
  }
  return { username, password };
}

function readSecrets(file) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Secrets file not found: ${file} (set SECRETS_FILE or deploy the agenix secret)`
    );
  }
  const secrets = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    secrets[key] = value;
  }
  return secrets;
}

function authStatus() {
  return new Promise((resolve) => {
    const req = https.get(GATEWAY_URL + "/v1/api/iserver/auth/status", {
      rejectUnauthorized: false,
      timeout: 10000,
    }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          // Non-JSON body: an unauthenticated gateway answers 401/403 with an
          // HTML error page. That's "session expired", not "unreachable".
          resolve({
            authenticated: false,
            httpStatus: res.statusCode,
            error: `HTTP ${res.statusCode}: ${body.slice(0, 60)}`,
          });
        }
      });
    });
    req.on("error", (err) =>
      resolve({ authenticated: false, httpStatus: null, error: err.message })
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ authenticated: false, httpStatus: null, error: "timeout" });
    });
  });
}

async function fillAndSubmit(page, username, password) {
  // Let the portal JS settle
  await page.waitForTimeout(1500);

  const userInputs = await page.$$(
    'input[name="username"], input[name="user_name"], input#user_name, input#username, input[autocomplete="username"]'
  );
  if (userInputs.length === 0) {
    // Last resort: first visible text input (portal markup varies by region/version)
    const textInputs = await page.$$('input[type="text"]');
    if (textInputs.length === 0) throw new Error("Login form not found");
    await textInputs[0].fill(username);
  } else {
    await userInputs[0].fill(username);
  }

  const pwdInputs = await page.$$('input[type="password"]');
  if (pwdInputs.length === 0) throw new Error("Password field not found");
  await pwdInputs[0].fill(password);
  await pwdInputs[0].press("Enter");
}

async function loginOnce(username, password) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    log("Opening", GATEWAY_URL);
    await page.goto(GATEWAY_URL + "/", { waitUntil: "domcontentloaded", timeout: 60000 });

    log("Filling credentials");
    await fillAndSubmit(page, username, password);

    // The 2FA (IB Key push) is approved on the phone — poll the session state.
    log(`Waiting for 2FA approval on your phone (up to ${LOGIN_TIMEOUT_MS / 1000}s)...`);
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    let status = { authenticated: false };
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      status = await authStatus();
      if (status.authenticated) break;
    }

    if (status.authenticated) {
      log("✅ Authenticated:", JSON.stringify(status));
      return true;
    }

    log("❌ Login did not complete within timeout. Page URL:", page.url());
    const shot = "/tmp/ibkr-login-debug.png";
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    log("Screenshot saved to", shot);
    return false;
  } finally {
    await browser.close();
  }
}

async function main() {
  // Re-read on every login attempt so secret updates apply without a restart
  const { username, password } = getCredentials();

  const status = await authStatus();
  log("Auth status:", JSON.stringify(status));

  if (MODE === "check") {
    process.exit(status.authenticated ? 0 : 1);
  }

  if (MODE === "once") {
    if (status.authenticated) {
      log("Already authenticated — nothing to do.");
      process.exit(0);
    }
    process.exit((await loginOnce(username, password)) ? 0 : 1);
  }

  // --watch
  log(`Watchdog running — checking every ${CHECK_INTERVAL_MS / 60000} min.`);
  let backoffUntil = 0;
  for (;;) {
    const current = await authStatus();
    if (current.authenticated) {
      backoffUntil = 0;
      await new Promise((r) => setTimeout(r, CHECK_INTERVAL_MS));
      continue;
    }

    // Connection-level failures only (no HTTP response) = gateway down.
    if (current.error && current.httpStatus == null) {
      log("Gateway unreachable:", current.error, "— retrying later.");
      await new Promise((r) => setTimeout(r, CHECK_INTERVAL_MS));
      continue;
    }

    // HTTP 401/403 (or any non-JSON response) = session expired → log in.
    if (current.httpStatus != null) {
      log("Session not authenticated (HTTP", current.httpStatus + ") — will log in.");
    }

    if (Date.now() < backoffUntil) {
      await new Promise((r) => setTimeout(r, CHECK_INTERVAL_MS));
      continue;
    }

    log("Session expired — attempting login...");
    let ok;
    try {
      const creds = getCredentials();
      ok = await loginOnce(creds.username, creds.password);
    } catch (err) {
      log("Login error:", err.message);
      ok = false;
    }
    if (ok) {
      backoffUntil = 0;
    } else {
      log("Login failed — backing off for 30 min.");
      backoffUntil = Date.now() + FAIL_BACKOFF_MS;
    }
    await new Promise((r) => setTimeout(r, CHECK_INTERVAL_MS));
  }
}

main().catch((err) => {
  log("Fatal:", err.message);
  process.exit(1);
});
