import secrets

# Unambiguous lowercase alphabet (no 0/o/1/l/i) — typeable like Zoom IDs but
# enumeration-resistant: 28^10 ≈ 3e14 codes (PLAN §3.5).
_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
_GROUPS = (3, 4, 3)


def generate_meeting_code() -> str:
    groups = ("".join(secrets.choice(_ALPHABET) for _ in range(n)) for n in _GROUPS)
    return "-".join(groups)
