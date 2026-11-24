"""Admin authentication endpoints using HttpOnly JWT cookies."""

from flask import Blueprint, current_app, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_csrf_token,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies,
)

from repositories.user_repository import UserRepository
from services.audit_service import AuditService
from services.auth_service import AuthService
from utils.api_response import error, success
from utils.db_retry import run_read_with_retry

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    identity = payload.get("email") or payload.get("username")
    password = payload.get("password")
    if not identity or not password:
        return error(
            message="Email/username dan password wajib diisi.",
            code="VALIDATION_ERROR",
            status_code=422,
        )

    user = AuthService().authenticate(identity=identity, password=password)
    if user is None:
        return error(
            message="Kredensial tidak valid atau akun sedang terkunci.",
            code="INVALID_CREDENTIALS",
            status_code=401,
        )

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    csrf_access = get_csrf_token(access_token)
    csrf_refresh = get_csrf_token(refresh_token)
    response, status_code = success(
        {
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "role": user.role,
            },
            "access_token": access_token,
            "refresh_token": refresh_token,
            "csrf_token": csrf_access,
            "csrf_refresh_token": csrf_refresh,
        }
    )
    response.headers["X-CSRF-TOKEN"] = csrf_access
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    AuditService().record(
        action="ADMIN_LOGIN",
        user_id=user.id,
        entity_type="user",
        entity_id=user.id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get("User-Agent"),
    )
    return response, status_code


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return error(message="Token tidak valid.", code="AUTH_REQUIRED", status_code=401)

    user = run_read_with_retry(lambda: UserRepository().get(user_id))
    if user is None or not user.is_active:
        return error(message="Akun tidak aktif.", code="AUTH_REQUIRED", status_code=401)

    new_access_token = create_access_token(identity=str(user.id))
    csrf_access = get_csrf_token(new_access_token)
    response, status_code = success(
        {
            "user_id": user.id,
            "message": "Access token diperbarui.",
            "access_token": new_access_token,
            "csrf_token": csrf_access,
        }
    )
    response.headers["X-CSRF-TOKEN"] = csrf_access
    set_access_cookies(response, new_access_token)
    return response, status_code


@auth_bp.post("/logout")
@jwt_required(optional=True)
def logout():
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        user_id = None

    response, status_code = success({"message": "Cookie autentikasi dibersihkan."})
    unset_jwt_cookies(response)
    if user_id is not None:
        AuditService().record(
            action="ADMIN_LOGOUT",
            user_id=user_id,
            entity_type="user",
            entity_id=user_id,
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )
    return response, status_code


@auth_bp.get("/me")
@jwt_required()
def me():
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return error(message="Token tidak valid.", code="AUTH_REQUIRED", status_code=401)

    user = run_read_with_retry(lambda: UserRepository().get(user_id))
    if user is None or not user.is_active:
        return error(message="Akun tidak aktif.", code="AUTH_REQUIRED", status_code=401)

    return success(
        {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role,
        }
    )
