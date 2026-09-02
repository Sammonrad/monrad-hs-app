#!/usr/bin/env bash
# Durable Cloud Agent setup for the Monrad H&S app.
#
# Installs system packages and JS dependencies, and configures Docker so the
# bundled Supabase CLI can run a full local stack inside the Cloud Agent VM.
# This runs once after the repository is checked out. It must be idempotent and
# must terminate (no long-running processes are left behind).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

log() { printf '\n=== %s ===\n' "$*"; }

log "Installing system packages (docker, fuse-overlayfs)"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
# fuse-overlayfs lets Docker use an overlay-based storage driver inside the
# nested (unprivileged) VM, which is far faster than the vfs fallback.
# --force-confold/confdef keep the install non-interactive when a package ships
# a conffile that already exists on the base image (e.g. /etc/fuse.conf).
sudo apt-get install -y -q \
  -o Dpkg::Options::="--force-confold" \
  -o Dpkg::Options::="--force-confdef" \
  docker.io fuse-overlayfs

log "Configuring Docker daemon for the nested VM"
# - fuse-overlayfs storage driver: works without a host overlay mount.
# - containerd-snapshotter disabled: use the classic graph driver so the
#   fuse-overlayfs storage driver is honoured.
sudo mkdir -p /etc/docker
echo '{"features":{"containerd-snapshotter":false},"storage-driver":"fuse-overlayfs"}' \
  | sudo tee /etc/docker/daemon.json >/dev/null

# Docker's bridge networking needs the legacy iptables backend; the nft backend
# fails to program rules in this environment, breaking container-to-container
# networking (which the Supabase stack relies on).
log "Selecting legacy iptables backend"
sudo update-alternatives --set iptables /usr/sbin/iptables-legacy || true
sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy || true

log "Installing JS dependencies (npm ci)"
npm ci

# Pre-pull the Supabase Docker images and apply migrations once so the images
# are baked into the environment snapshot and later boots start quickly.
# Best-effort: never fail install if the daemon cannot come up during a build.
log "Pre-pulling Supabase images (best-effort)"
if bash "$REPO_DIR/scripts/lib-docker.sh" 2>/dev/null; then
  # shellcheck source=/dev/null
  source "$REPO_DIR/scripts/lib-docker.sh"
  if start_docker_daemon; then
    npx --yes supabase start || true
    npx --yes supabase stop --no-backup || true
    stop_docker_daemon || true
  fi
else
  echo "Skipping image pre-pull; lib-docker.sh unavailable."
fi

log "Install complete"
