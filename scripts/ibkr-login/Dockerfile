# syntax=docker/dockerfile:1

# =============================================================================
# IBKR gateway auto-login watchdog
#
# Runs a headless Chromium that logs into the Client Portal Gateway at
# https://localhost:5000 whenever the brokerage session expires (~daily).
# Uses host networking so `localhost` resolves to the gateway container's
# published port — the IBKR SSO flow only accepts localhost origins.
# Credentials come from the agenix secrets file (age-encrypted at rest),
# mounted read-only. The only manual step is tapping the IB Key push
# notification on the phone when 2FA fires.
# =============================================================================

FROM mcr.microsoft.com/playwright:v1.62.1-jammy

WORKDIR /app

# Match the playwright version of the base image (browsers ship with it)
RUN npm init -y >/dev/null && npm install playwright@1.62.1 --no-fund --no-audit

COPY login.js .

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

ENTRYPOINT ["node", "login.js"]
CMD ["--watch"]
