"""
openstack_security_group.py — Ensure SSH ingress in OVH Public Cloud

This is invoked by GitHub Actions using OpenStack application credentials.

Why this exists:
- OVH instances often start with a "default" security group that allows ingress
  only from itself (good baseline), but we need SSH from the CI runner.
- On this project, the default SG already has a large number of rules and hit
  the security_group_rule quota; so we also normalize egress rules to a small,
  predictable set (2 rules: allow all egress IPv4 + IPv6).

Environment variables expected (standard OpenStack):
- OS_AUTH_URL
- OS_REGION_NAME
- OS_APPLICATION_CREDENTIAL_ID
- OS_APPLICATION_CREDENTIAL_SECRET
- DEPLOY_HOST (public IPv4 of the instance; used to locate the server)
"""

from __future__ import annotations

import os
import sys

from openstack import connect


def die(msg: str) -> None:
    print(msg, file=sys.stderr)
    sys.exit(2)


def main() -> None:
    deploy_host = os.environ.get("DEPLOY_HOST", "").strip()
    if not deploy_host:
        die("DEPLOY_HOST is required to locate the instance.")

    conn = connect()

    # Find the server by matching its public IPv4.
    target_server = None
    for s in conn.compute.servers(details=True, all_projects=False):
        addrs = getattr(s, "addresses", None) or {}
        # addresses shape differs by cloud; attempt to flatten IPs.
        ips = []
        if isinstance(addrs, dict):
            for _, lst in addrs.items():
                if isinstance(lst, list):
                    for a in lst:
                        ip = a.get("addr") if isinstance(a, dict) else None
                        if ip:
                            ips.append(ip)
        if deploy_host in ips:
            target_server = s
            break

    if not target_server:
        die(f"Unable to find a server that has public IP {deploy_host}.")

    # Grab the first security group attached to the server (usually "default").
    sgs = getattr(target_server, "security_groups", None) or []
    if not sgs:
        die("No security groups attached to the server.")

    sg_name = sgs[0].get("name") if isinstance(sgs[0], dict) else getattr(sgs[0], "name", None)
    if not sg_name:
        die(f"Unable to determine security group name from {sgs!r}")

    sg = conn.network.find_security_group(sg_name, ignore_missing=False)

    rules = list(conn.network.security_group_rules(security_group_id=sg.id))

    # Normalize egress rules to avoid SG rule quota explosions.
    # Delete all existing egress rules, then add two allow-all egress rules.
    for r in rules:
        if getattr(r, "direction", None) == "egress":
            conn.network.delete_security_group_rule(r.id, ignore_missing=True)

    def ensure_rule(direction: str, ether_type: str, protocol=None, port_min=None, port_max=None, remote="0.0.0.0/0"):
        # Re-fetch latest rules each time to avoid duplicates.
        current = list(conn.network.security_group_rules(security_group_id=sg.id))
        for r in current:
            if (
                getattr(r, "direction", None) == direction
                and getattr(r, "ether_type", None) == ether_type
                and getattr(r, "protocol", None) == protocol
                and getattr(r, "port_range_min", None) == port_min
                and getattr(r, "port_range_max", None) == port_max
                and getattr(r, "remote_ip_prefix", None) == remote
            ):
                return
        conn.network.create_security_group_rule(
            security_group_id=sg.id,
            direction=direction,
            ether_type=ether_type,
            protocol=protocol,
            port_range_min=port_min,
            port_range_max=port_max,
            remote_ip_prefix=remote,
        )

    # Allow all egress (IPv4 + IPv6).
    ensure_rule("egress", "IPv4", protocol=None, port_min=None, port_max=None, remote="0.0.0.0/0")
    ensure_rule("egress", "IPv6", protocol=None, port_min=None, port_max=None, remote="::/0")

    # Allow inbound SSH from anywhere (CI runner IPs are dynamic).
    ensure_rule("ingress", "IPv4", protocol="tcp", port_min=22, port_max=22, remote="0.0.0.0/0")

    print(f"OK: ensured SSH ingress for server={target_server.id} security_group={sg.name} ({sg.id})")


if __name__ == "__main__":
    main()

