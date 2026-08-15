#!/usr/bin/env node
/**
 * IBKR Client Portal Gateway auto-login watchdog (scheduled).
 *
 * One login attempt per day at a fixed hour — no retry storms. The gateway
 * session lasts ~24h, so a single daily attempt keeps it alive for any sync
 * within that window. Tap the IB Key push when it fires; if the attempt
 * fails, the next one is tomorrow at the same hour.
 *
 * IBKR's SSO flow only accepts localhost origins, so this runs on the
 * gateway host (compose: network_mode: host). Credentials come from an
 * agenix-style KEY=VALUE secrets file.
 *
 * Environment:
 *   GATEWAY_URL          default https://localhost:5000
 *   SECRETS_FILE         default /run/agenix/spending-tracker
 *   CHECK_INTERVAL_MIN   poll interval (default 10)
 *   LOGIN_HOUR           hour of the daily login attempt, 0-23 (default 12)
 *
 * Usage: node login.js            (scheduled loop — the container default)
 *        node login.js --once     (one login attempt, then exit)
 */
const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");

const GATEWAY_URL = process.env.GATEWAY_URL || "https://localhost:5000";
const SECRETS_FILE = process.env.SECRETS_FILE || "/run/agenix/spending-tracker";
const CHECK_INTERVAL_MS =
  (parseInt(process.env.CHECK_INTERVAL_MIN || "10", 10) || 10) * 60 * 1000;
const LOGIN_HOUR = parseInt(process.env.LOGIN_HOUR || "12", 10) || 12;

const ONCE = process.argv[2] === "--once";

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
  let lastAttemptDay = "";

  if (ONCE) {
    const s = await authStatus();
    if (s.authenticated) {
      log("Already authenticated");
      process.exit(0);
    }
    process.exit((await login()) ? 0 : 1);
  }

  log(`Scheduled watchdog — one login attempt per day at ${LOGIN_HOUR}:00 (local time).`);
  for (;;) {
    const s = await authStatus();
    if (s.authenticated) {
      log("Session: authenticated");
      lastAttemptDay = "";
    } else {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      if (now.getHours() === LOGIN_HOUR && lastAttemptDay !== today) {
        log("Scheduled login attempt");
        try {
          await login();
        } catch (e) {
          log("Login error:", e.message);
        }
        // One attempt per day, success or not
        lastAttemptDay = today;
      } else {
        log(`Session: not authenticated (next attempt at ${LOGIN_HOUR}:00)`);
      }
    }
    await new Promise((r) => setTimeout(r, CHECK_INTERVAL_MS));
  }
}

main().catch((e) => {
  log("Fatal:", e.message);
  process.exit(1);
});
