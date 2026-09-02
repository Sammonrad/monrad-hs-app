#!/usr/bin/env bash
# Shared helpers for bringing the Docker daemon up inside the Cloud Agent VM.
# Sourced by the install and start scripts.

# Start dockerd (if not already running) and wait until it is responsive.
# Returns non-zero if the daemon cannot be reached.
start_docker_daemon() {
  if docker info >/dev/null 2>&1; then
    sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
    return 0
  fi

  if ! pgrep -x dockerd >/dev/null 2>&1; then
    echo "Starting dockerd..."
    sudo nohup dockerd >/tmp/dockerd.log 2>&1 &
    disown || true
  fi

  for _ in $(seq 1 30); do
    if sudo docker info >/dev/null 2>&1; then
      sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
      echo "Docker daemon is ready."
      return 0
    fi
    sleep 2
  done

  echo "Docker daemon did not become ready in time." >&2
  return 1
}

# Stop the dockerd we started (used by install so it terminates cleanly).
stop_docker_daemon() {
  local pid
  pid="$(pgrep -x dockerd | head -1 || true)"
  if [ -n "$pid" ]; then
    echo "Stopping dockerd (pid $pid)..."
    sudo kill "$pid" 2>/dev/null || true
    sleep 3
  fi
}
