FROM alpine:3.22 AS download

ARG VALIDATOR_URL=https://github.com/itplr-kosit/validator/releases/download/v1.6.2/validator-1.6.2-standalone.jar
ARG VALIDATOR_SHA256=244978514ad48f67c7573acfffc8f4fd73d81feda6f276710033f9913579857e
ARG CONFIG_URL=https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v2026-01-31/xrechnung-3.0.2-validator-configuration-2026-01-31.zip
ARG CONFIG_SHA256=6a5a5911a421b25fbc423f62f93f894df7b236f5d73ca4f84bb222a945082704

RUN apk add --no-cache ca-certificates unzip \
  && wget -q -O /tmp/validator.jar "$VALIDATOR_URL" \
  && echo "$VALIDATOR_SHA256  /tmp/validator.jar" | sha256sum -c - \
  && wget -q -O /tmp/config.zip "$CONFIG_URL" \
  && echo "$CONFIG_SHA256  /tmp/config.zip" | sha256sum -c - \
  && mkdir -p /opt/kosit/config \
  && unzip -q /tmp/config.zip -d /opt/kosit/config \
  && test -f /opt/kosit/config/scenarios.xml

FROM eclipse-temurin:21-jre-alpine
WORKDIR /opt/kosit
COPY --from=download /tmp/validator.jar /opt/kosit/validator.jar
COPY --from=download /opt/kosit/config /opt/kosit/config

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/server/health >/dev/null || exit 1

ENTRYPOINT ["java", "-jar", "/opt/kosit/validator.jar", "-s", "/opt/kosit/config/scenarios.xml", "-D", "-H", "0.0.0.0", "-P", "8080", "--disable-gui"]
