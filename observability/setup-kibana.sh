#!/usr/bin/env sh
# Creates the `caribe-logs` data view in Kibana so Discover works out of the box.
#
# Idempotent: re-running it reports the existing view instead of duplicating it.
# Kibana keeps data views in its own saved-objects index, so this has to run
# once per Kibana volume — not once per clone.
#
#   ./observability/setup-kibana.sh                  # localhost:5601
#   KIBANA_URL=http://localhost:5602 ./observability/setup-kibana.sh
set -eu

KIBANA_URL="${KIBANA_URL:-http://localhost:5601}"
TITLE="caribe-logs-*"
NAME="caribe-logs"
# Filebeat's own timestamp. `hora` is mapped as a keyword, so Kibana will not
# accept it as the time field.
TIME_FIELD="@timestamp"

printf 'Waiting for Kibana at %s ' "$KIBANA_URL"
i=0
until curl -sf "$KIBANA_URL/api/status" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    printf '\nKibana did not answer after 120s. Is the observability profile up?\n' >&2
    exit 1
  fi
  printf '.'
  sleep 2
done
printf ' ready\n'

# Kibana pretty-prints this response, so match with optional whitespace rather
# than assuming a compact `"name":"value"`.
if curl -sf "$KIBANA_URL/api/data_views" 2>/dev/null |
  grep -Eq "\"name\":[[:space:]]*\"$NAME\""; then
  echo "Data view '$NAME' already exists — nothing to do."
  exit 0
fi

response=$(
  curl -s -X POST "$KIBANA_URL/api/data_views/data_view" \
    -H 'kbn-xsrf: true' \
    -H 'Content-Type: application/json' \
    -d "{\"data_view\":{\"title\":\"$TITLE\",\"name\":\"$NAME\",\"timeFieldName\":\"$TIME_FIELD\"}}"
)

case "$response" in
  *'"data_view"'*)
    echo "Created data view '$NAME' ($TITLE, time field $TIME_FIELD)."
    echo "Open $KIBANA_URL/app/discover and set the range to Last 24 hours."
    ;;
  # Lost a race with another run, or the listing above was served stale.
  *'Duplicate data view'*)
    echo "Data view '$NAME' already exists — nothing to do."
    ;;
  *)
    echo "Could not create the data view:" >&2
    echo "$response" >&2
    exit 1
    ;;
esac
