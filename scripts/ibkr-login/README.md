# IBKR Gateway auto-login watchdog

Keeps the IBKR brokerage session alive without SSH tunnels or manual browser
logins: a headless Chromium logs into the gateway whenever the session expires
(~daily). The only remaining manual step is tapping the **IB Key push** on your
phone when 2FA fires.

## Why it works

IBKR's SSO flow rejects non-`localhost` origins (accessing the gateway via a
LAN IP or hostname causes login loops — verified). The watchdog therefore runs
**on the same host as the gateway** (or in a container with `network_mode:
host`), where `https://localhost:5000` resolves to the gateway itself.

## Setup (NixOS + agenix)

1. Add the IBKR credentials to your existing agenix secret
   (`secrets/spending-tracker.age`), e.g.:

   ```
   IBKR_USERNAME="your-ibkr-username"
   IBKR_PASSWORD="your-ibkr-password"
   ```

   The file at rest is age-encrypted; the script only ever reads the decrypted
   copy at `/run/agenix/spending-tracker` (tmpfs, root-only, mode 0400).

2. Add the service to docker-compose (already included in the root
   `docker-compose.yml`):

   ```yaml
   ibkr-login:
     build: ./scripts/ibkr-login
     network_mode: host   # login flow only works from localhost
     environment:
       GATEWAY_URL: https://localhost:5000
       SECRETS_FILE: /run/agenix/spending-tracker
       CHECK_INTERVAL_MIN: "10"
     volumes:
       - /run/agenix/spending-tracker:/run/agenix/spending-tracker:ro
     restart: unless-stopped
   ```

3. `docker compose up -d --build`

   On hosts without agenix, mount any KEY=VALUE file containing
   `IBKR_USERNAME`/`IBKR_PASSWORD` and point `SECRETS_FILE` at it.

## Usage

```bash
docker compose up -d --build                # start the watchdog
docker compose logs -f ibkr-login           # watch it work
docker compose stop ibkr-login              # disable

# manual one-shot login (entrypoint already provides `node login.js`):
docker compose run --rm ibkr-login --once

# just check the session (exit 0 = authenticated):
docker compose run --rm ibkr-login --check
# or, from inside a running container:
docker compose exec ibkr-login node login.js --check
```

## Notes

- Failed login attempts back off for 30 min to avoid IBKR cooldowns.
- On failure a debug screenshot is saved to `/tmp/ibkr-login-debug.png` in the
  container (`docker compose cp ibkr-login:/tmp/ibkr-login-debug.png .`).
- One active brokerage session per account: if you log in from the IBKR
  Client Portal website or another gateway, this watchdog (or that session)
  will be displaced — sessions are mutually exclusive.
