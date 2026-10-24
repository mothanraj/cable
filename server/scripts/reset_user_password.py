#!/usr/bin/env python
"""Reset any user's password (ADMIN or USER)."""

from __future__ import annotations

import sys
from getpass import getpass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config.database import close_pool, get_connection, init_pool
from app.utils.security import hash_password


def main() -> None:
    init_pool()

    try:
        username = input("Username: ").strip()
        password = getpass("New password: ")

        if not username or not password:
            raise ValueError("Username and password are required.")

        if len(password) < 12:
            raise ValueError(
                "Password must be at least 12 characters."
            )

        password_hash = hash_password(password)

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE users
                    SET
                      password_hash = %s,
                      updated_at = NOW()
                    WHERE username = %s
                    RETURNING id, username, role
                    """,
                    (password_hash, username),
                )
                updated = cur.fetchone()
                conn.commit()

        if updated is None:
            raise ValueError("User not found.")

        print(
            f"\nPassword reset successfully for "
            f"{updated['username']} ({updated['role']})."
        )
    except Exception as exc:
        print(f"\nFailed to reset password:\n{exc}")
        raise SystemExit(1) from exc
    finally:
        close_pool()


if __name__ == "__main__":
    main()
