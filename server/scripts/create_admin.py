#!/usr/bin/env python
"""Create an ADMIN user for the Cable Customer Management System."""

from __future__ import annotations

import sys
from getpass import getpass
from pathlib import Path

# Allow running as: python scripts/create_admin.py
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config.database import close_pool, get_connection, init_pool
from app.utils.security import hash_password


def main() -> None:
    init_pool()

    try:
        username = input("Admin username: ").strip()
        full_name = input("Admin full name: ").strip()
        password = getpass("Admin password: ")

        if not username or not full_name or not password:
            raise ValueError("All fields are required.")

        if len(password) < 12:
            raise ValueError(
                "Admin password must be at least 12 characters."
            )

        password_hash = hash_password(password)

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id
                    FROM users
                    WHERE username = %s
                    """,
                    (username,),
                )
                if cur.fetchone() is not None:
                    raise ValueError("Username already exists.")

                cur.execute(
                    """
                    INSERT INTO users (
                      username,
                      password_hash,
                      full_name,
                      role
                    )
                    VALUES (%s, %s, %s, 'ADMIN')
                    """,
                    (username, password_hash, full_name),
                )
                conn.commit()

        print("\nAdmin account created successfully.")
    except Exception as exc:
        print(f"\nFailed to create admin:\n{exc}")
        raise SystemExit(1) from exc
    finally:
        close_pool()


if __name__ == "__main__":
    main()
