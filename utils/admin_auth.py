"""JWT-protected admin authorization helper."""

from functools import wraps

from flask import g
from flask_jwt_extended import get_jwt_identity

from repositories.user_repository import UserRepository
from utils.api_response import error


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        try:
            user_id = int(get_jwt_identity())
        except (TypeError, ValueError):
            return error(
                message="Autentikasi admin diperlukan.",
                code="AUTH_REQUIRED",
                status_code=401,
            )

        user = UserRepository().get(user_id)
        if user is None or not user.is_active:
            return error(
                message="Akun admin tidak aktif atau tidak ditemukan.",
                code="AUTH_REQUIRED",
                status_code=401,
            )
        if user.role != "admin":
            return error(
                message="Akses hanya tersedia untuk admin.",
                code="FORBIDDEN",
                status_code=403,
            )

        g.current_admin = user
        return view(*args, **kwargs)

    return wrapped
