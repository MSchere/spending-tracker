# syntax=docker/dockerfile:1

# =============================================================================
# IBKR Client Portal Gateway
#
# Downloads the official gateway at build time from IBKR (the zip is the same
# April 2023 build IBKR still distributes today) and overlays our customized
# root/conf.yaml (committed in git — allows Docker network IPs).
#
# The gateway serves a self-signed HTTPS API on port 5000 and proxies
# api.ibkr.com. After starting, open https://<host>:5000 and log in with
# your IBKR credentials + 2FA — sessions last roughly 24h.
# =============================================================================

FROM alpine:3 AS download
RUN apk add --no-cache curl unzip
RUN curl -fSL https://download2.interactivebrokers.com/portal/clientportal.gw.zip \
      -o /tmp/clientportal.gw.zip \
    && unzip -q /tmp/clientportal.gw.zip -d /gateway \
    && chmod +x /gateway/bin/run.sh \
    && rm /tmp/clientportal.gw.zip

FROM eclipse-temurin:21-jre

WORKDIR /gateway

COPY --from=download /gateway .
# Our customized config (allows requests from docker/container networks)
COPY root/conf.yaml root/conf.yaml

EXPOSE 5000

# run.sh expects to be invoked from the gateway root with a config path
# relative to it.
CMD ["bin/run.sh", "root/conf.yaml"]
