#!/bin/sh
set -eu

: "${KOSIT_VALIDATOR_TOKEN:?KOSIT_VALIDATOR_TOKEN is required}"

/opt/java/openjdk/bin/java -jar /opt/kosit/validator.jar \
  -s /opt/kosit/config/scenarios.xml \
  -D -H 127.0.0.1 -P 8081 --disable-gui &

exec /opt/kosit/kosit-proxy
