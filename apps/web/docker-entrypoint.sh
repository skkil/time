#!/bin/sh
set -eu
cat > /usr/share/nginx/html/config.js <<CONFIG
window.__TIME_CONFIG__ = {
  VITE_API_URL: "${API_URL}",
  VITE_AUTH_AUTHORITY: "${AUTH_AUTHORITY}",
  VITE_AUTH_CLIENT_ID: "${AUTH_CLIENT_ID}",
  VITE_AUTH_AUDIENCE: "${AUTH_AUDIENCE:-}"
};
CONFIG
exec nginx -g 'daemon off;'
