#!/usr/bin/env bash
# Per-boot startup for the Monrad H&S Cloud Agent environment.
#
# Brings up the local Supabase stack (Docker), writes the app's .env.local from
# the running stack's credentials, and seeds a confirmed admin test user so the
# app is immediately usable. Runs on every boot; must tolerate restarts.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# shellcheck source=/dev/null
source "$REPO_DIR/scripts/lib-docker.sh"

log() { printf '\n=== %s ===\n' "$*"; }

# Ensure the legacy iptables backend (required for Docker bridge networking).
sudo update-alternatives --set iptables /usr/sbin/iptables-legacy 2>/dev/null || true
sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy 2>/dev/null || true

log "Starting Docker daemon"
if ! start_docker_daemon; then
  echo "ERROR: Docker daemon is not available; cannot start Supabase." >&2
  exit 1
fi

log "Starting local Supabase stack"
npx --yes supabase start

log "Writing .env.local from Supabase status"
STATUS_JSON="$(npx --yes supabase status -o json)"
export STATUS_JSON
node <<'NODE'
const fs = require('fs');
const s = JSON.parse(process.env.STATUS_JSON);
const url = s.API_URL;
// Prefer the modern publishable key; fall back to the legacy anon key.
const key = s.PUBLISHABLE_KEY || s.ANON_KEY;
fs.writeFileSync('.env.local', `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${key}\n`);
console.log('Wrote .env.local ->', url);
NODE

log "Seeding admin test user (idempotent)"
ADMIN_EMAIL="admin@monrad.test"
ADMIN_PASSWORD="Password123!"
API_URL="$(node -e 'console.log(JSON.parse(process.env.STATUS_JSON).API_URL)')"
SERVICE_ROLE_KEY="$(node -e 'console.log(JSON.parse(process.env.STATUS_JSON).SERVICE_ROLE_KEY)')"

# Create the auth user (ignore "already registered" errors).
curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"email_confirm\":true}" \
  >/dev/null || true

# Promote the profile to an active admin so the app is reachable.
DB_CONTAINER="supabase_db_$(grep -E '^project_id' supabase/config.toml | head -1 | sed -E 's/.*"(.*)".*/\1/')"
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "
  insert into public.user_profiles (id, email, full_name, role, status, phone, notes)
  select u.id, u.email, 'Site Admin', 'admin', 'active', '', ''
  from auth.users u where u.email = '$ADMIN_EMAIL'
  on conflict (id) do update set role='admin', status='active';" || true

log "Startup complete"
echo "App will be served by the 'dev' terminal at http://localhost:5173"
echo "Sign in with: $ADMIN_EMAIL / $ADMIN_PASSWORD"
