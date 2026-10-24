#!/bin/sh
# Prints credentials for one simulated client of store's conformance suite:
# signs in as $STORE_CONFORMANCE_USER at the mock OIDC issuer, asks the server
# for a sync token for $STORE_CONFORMANCE_CLIENT_ID, and pushes with the API
# token (Push is authenticated like the API, not with the sync token).
set -eu

auth_url=${AUTH_URL:-http://localhost:8090/default}
server_url=${SERVER_URL:-http://localhost:8080}

access=$(curl -fsS "$auth_url/token" \
  -d grant_type=client_credentials \
  -d "client_id=$STORE_CONFORMANCE_USER" \
  -d client_secret=conformance \
  | sed -n 's/.*"access_token" *: *"\([^"]*\)".*/\1/p')

token=$(curl -fsS "$server_url/api/v1/sync/token" \
  -H "Authorization: Bearer $access" \
  -H 'Content-Type: application/json' \
  -d "{\"clientId\":\"$STORE_CONFORMANCE_CLIENT_ID\"}" \
  | sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p')

printf '{"token":"%s","push_headers":{"Authorization":"Bearer %s"}}\n' "$token" "$access"
