#!/usr/bin/env bash
# QR Maker API quickstart: create a dynamic QR code, save its SVG, change the destination, read the scans.
# Needs: curl, jq. Usage: QR_TOKEN=qrs_... ./quickstart.sh
set -euo pipefail

API="${QR_API:-https://qrmaker.ai/api/v1}"
: "${QR_TOKEN:?Set QR_TOKEN to an API token from Settings > API Tokens}"
AUTH=(-H "Authorization: Bearer $QR_TOKEN" -H "Content-Type: application/json")

# external_id is your own reference (an order number, a SKU...). Sending the same one again returns the same code,
# which makes retries safe. This demo uses a fresh one per run so you can run it as often as you like.
EXT="demo-menu-$(date +%s)-$RANDOM"

# 1. Create, and get the SVG in the same call.
curl -sS -X POST "$API/qrcodes?include=svg" "${AUTH[@]}" -d "{
  \"target_url\": \"https://example.com/spring-menu\",
  \"external_id\": \"$EXT\",
  \"name\": \"Spring menu\",
  \"folder\": \"demo\"
}" > created.json

if [ "$(jq -r '.success' created.json)" != "true" ]; then
  echo "Request failed: $(jq -r '.code + ": " + .error' created.json)" >&2
  exit 1
fi
jq -r '.data.svg' created.json > "$EXT.svg"
ID=$(jq -r '.data.id' created.json)
echo "Created $ID -> $(jq -r '.data.short_link' created.json)  (SVG saved to $EXT.svg)"

# 2. Change where the printed code goes. The picture does not change, so nothing needs reprinting.
curl -sS -X PATCH "$API/qrcodes/by-external-id/$EXT" "${AUTH[@]}" \
  -d '{ "target_url": "https://example.com/summer-menu" }' | jq -r '"Now points to " + .data.target_url'

# 3. Scans for the last 30 days, in your own time zone.
curl -sS "$API/qrcodes/$ID/analytics?tz=America/Toronto" "${AUTH[@]}" \
  | jq '{scans: .data.scans, unique_visitors: .data.unique_visitors, countries: .data.countries}'

# 4. How much of this month's quota is left (this call is free).
curl -sS "$API/usage" "${AUTH[@]}" | jq '.data | {api_calls, api_quota}'
