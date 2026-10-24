import hashlib

from argon2 import PasswordHasher
from argon2.exceptions import (
    InvalidHash,
    InvalidHashError,
    VerificationError,
    VerifyMismatchError,
)

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    if not password_hash or not password:
        return False

    try:
        return _hasher.verify(password_hash, password)
    except (
        VerifyMismatchError,
        VerificationError,
        InvalidHash,
        InvalidHashError,
        TypeError,
        ValueError,
    ):
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
