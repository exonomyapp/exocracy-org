#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# harden_ubuntu.sh — OVH Testbox Baseline Hardening (Idempotent)
# ==============================================================================
# This script is designed to be run repeatedly (via GitHub Actions over SSH).
# It targets a *testing* instance but enforces sane defaults so the box behaves
# like a stable deployment target:
# - OS patched
# - key-only SSH, no root login
# - basic host firewall
# - brute-force protection
# - unattended security updates
#
# 🧠 Junior-dev note:
# Hardening is not “one big switch”. It is a sequence of small, reversible
# configuration changes that reduce the number of ways the machine can be
# surprised by the network.
# ==============================================================================

log() { printf "\n== %s ==\n" "$*"; }

require_sudo() {
  if ! sudo -n true 2>/dev/null; then
    echo "This script requires passwordless sudo on the remote host." >&2
    exit 1
  fi
}

write_file_if_changed() {
  # write_file_if_changed /path/to/file "contents"
  local path="$1"
  local tmp
  tmp="$(mktemp)"
  cat >"$tmp"
  if sudo test -f "$path" && sudo cmp -s "$tmp" "$path"; then
    sudo rm -f "$tmp"
    return 0
  fi
  sudo install -m 0644 "$tmp" "$path"
  sudo rm -f "$tmp"
}

main() {
  require_sudo

  log "System update"
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get -y dist-upgrade

  log "Install baseline packages"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates curl git jq ufw fail2ban unattended-upgrades

  log "SSH hardening (drop-in config)"
  # Use a drop-in file so we don't fight cloud-image defaults.
  # This makes the change easy to audit and easy to remove.
  write_file_if_changed /etc/ssh/sshd_config.d/99-exocracy-hardening.conf <<'EOF'
# Managed by exocracy-org/.github/infra/harden_ubuntu.sh
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
EOF

  sudo systemctl restart ssh || sudo systemctl restart sshd

  log "Firewall (UFW)"
  # Allow SSH. GitHub Actions connects on 22 by default.
  sudo ufw allow OpenSSH >/dev/null || true
  sudo ufw --force enable >/dev/null || true
  sudo ufw status verbose || true

  log "Fail2ban (sshd jail)"
  write_file_if_changed /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 30m
EOF
  sudo systemctl enable --now fail2ban

  log "Unattended upgrades"
  sudo systemctl enable --now unattended-upgrades
  # Ensure the default config is present (Ubuntu typically ships it, but we keep it explicit).
  sudo dpkg-reconfigure -f noninteractive unattended-upgrades || true

  log "Summary"
  echo "OS:"; . /etc/os-release && echo "$PRETTY_NAME"
  echo "Kernel:"; uname -r
  echo "Uptime:"; uptime -p || true
  echo "SSHD:"; (sudo sshd -T 2>/dev/null || true) | egrep 'permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication' || true
}

main "$@"

