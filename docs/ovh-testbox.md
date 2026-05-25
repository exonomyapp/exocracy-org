# OVH Testbox (Public Cloud) — GitHub Actions Setup

This repo contains automation to configure an OVH Public Cloud Ubuntu instance as a test deployment target.

## 1) Required GitHub Actions secrets

Set these in: **Repo → Settings → Secrets and variables → Actions**.

### SSH (required)

- `DEPLOY_HOST` — instance public IPv4 (e.g. `141.95.239.189`)
- `DEPLOY_USER` — usually `ubuntu`
- `DEPLOY_SSH_KEY` — the *private* key contents used to SSH (PEM/OpenSSH format)

### OpenStack (recommended)

These allow the workflow to ensure an inbound SSH rule exists via the OpenStack API.

- `OS_AUTH_URL` — e.g. `https://auth.cloud.ovh.net/`
- `OS_REGION_NAME` — e.g. `GRA9`
- `OS_APPLICATION_CREDENTIAL_ID`
- `OS_APPLICATION_CREDENTIAL_SECRET`

## 2) Run the workflow

Go to **Actions → OVH Testbox - Configure → Run workflow**.

It will:
1. (Optional) Use OpenStack app-cred auth to normalize the default security group and ensure inbound SSH on TCP/22.
2. SSH into the box and run `.github/infra/harden_ubuntu.sh`.

## 3) What the hardening does (baseline)

- OS updates
- Install `ufw`, `fail2ban`, `unattended-upgrades`, plus basic tooling (`curl`, `git`, `jq`)
- Configure key-only SSH and disable root login via `sshd_config.d` drop-in
- Enable UFW and allow SSH
- Enable fail2ban sshd jail
- Enable unattended upgrades

