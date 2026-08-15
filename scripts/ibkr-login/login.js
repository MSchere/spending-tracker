#!/usr/bin/env node
/**
 * IBKR Client Portal Gateway auto-login watchdog (minimal).
 *
 * IBKR's SSO flow only accepts localhost origins, so this runs on the
 * gateway host (compose: network_mode: host). Reads IBKR_USERNAME and
 * IBKR_PASSWORD from an agenix-style KEY=VALUE secrets file. The only
 * manual step: tap the IB Key push on the phone when 2FA fires.
 *
 * Loop: check auth status every CHECK_INTERVAL_MIN; when the session is
 * gone, log in with headless Chromium and poll until authenticated.
 */
const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");

const GATEWAY_URL = process.env.GATEWAY_URL || "https://localhost:5000";
const SECRETS_FILE = process.env.SECRETS_FILE || "/run/agenix/spending-tracker";
const CHECK_INTERVAL_MS =
  (parseInt(process.env.CHECK_INTERVAL_MIN || "10", 10) || 10) * 60 * 1000;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function getCredentials() {
  const raw = fs.readFileSync(SECRETS_FILE, "utf8");
  const secrets = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    secrets[t.slice(0, i).trim()] = v;
  }
  if (!secrets.IBKR_USERNAME || !secrets.IBKR_PASSWORD) {
    throw new Error(`IBKR_USERNAME/IBKR_PASSWORD missing in ${SECRETS_FILE}`);
  }
  return secrets;
}

function authStatus() {
  return new Promise((resolve) => {
    const req = https.get(
      GATEWAY_URL + "/v1/api/iserver/auth/status",
      { rejectUnauthorized: false, timeout: 10000 },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ authenticated: false, httpStatus: res.statusCode });
          }
        });
      }
    );
    req.on("error", () => resolve({ authenticated: false, httpStatus: null }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ authenticated: false, httpStatus: null });
    });
  });
}

async function login() {
  const { IBKR_USERNAME, IBKR_PASSWORD } = getCredentials();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  try {
    log("Opening", GATEWAY_URL);
    await page.goto(GATEWAY_URL + "/", { waitUntil: "domcontentloaded", timeout: 60000 });

    const userInputs = await page.$$(
      'input[name="username"], input[name="user_name"], input#user_name, input#username, input[autocomplete="username"]'
    );
    const pwdInputs = await page.$$('input[type="password"]');
    if (userInputs.length === 0 || pwdInputs.length === 0) {
      throw new Error("Login form not found");
    }
    await userInputs[0].fill(IBKR_USERNAME);
    await pwdInputs[0].fill(IBKR_PASSWORD);
    await pwdInputs[0].press("Enter");
    log("Credentials submitted — waiting for 2FA approval on your phone...");

    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const s = await authStatus();
      if (s.authenticated) {
        log("Authenticated");
        return true;
      }
    }
    log("Not authenticated after 5 minutes");
    return false;
  } finally {
    await browser.close();
  }
}

async function main() {
  let consecutiveFailures = 0;
  for (;;) {
    const s = await authStatus();
    log(s.authenticated ? "Session: authenticated" : "Session: not authenticated");
    if (!s.authenticated) {
      let ok = false;
      try {
        ok = await login();
      } catch (e) {
        log("Login error:", e.message);
      }
      consecutiveFailures = ok ? 0 : consecutiveFailures + 1;
    } else {
      consecutiveFailures = 0;
    }

    // After failed attempts, back off hard — every attempt fires an IB Key
    // push, and rapid retries trigger IBKR cooldowns that break approvals.
    const backoffMs =
      consecutiveFailures === 0
        ? CHECK_INTERVAL_MS
        : Math.min(consecutiveFailures * 30 * 60 * 1000, 4 * 60 * 60 * 1000);
    if (consecutiveFailures > 0) {
      log(
        `Backing off ${Math.round(backoffMs / 60000)} min after ${consecutiveFailures} failed attempt(s)`
      );
    }
    await new Promise((r) => setTimeout(r, backoffMs));
  }
}

main().catch((e) => {
  log("Fatal:", e.message);
  process.exit(1);
});
