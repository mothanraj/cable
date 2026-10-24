import ipaddress


def sanitize_ip(value: str | None) -> str | None:
    if not value:
        return None

    candidate = value.strip()
    if not candidate:
        return None

    if candidate.startswith("::ffff:"):
        candidate = candidate[7:]

    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return None
