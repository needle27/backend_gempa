"""Public read-only WebGIS API; all endpoints resolve the same global active run."""

from flask import Blueprint, request

from services.exceptions import NotFoundError, ValidationError
from services.webgis_service import WebGISService
from utils.api_response import error, list_success, success
from utils.service_errors import service_error_response

public_historical_bp = Blueprint("public_historical", __name__)


def _optional_float(name):
    raw = request.args.get(name)
    if raw in (None, ""):
        return None
    try:
        return float(raw)
    except ValueError as exc:
        raise ValidationError(f"Parameter {name} harus berupa angka.") from exc


@public_historical_bp.get("/api/metadata")
def get_metadata():
    try:
        return success(WebGISService().get_metadata())
    except NotFoundError as exc:
        return service_error_response(exc)


@public_historical_bp.get("/api/summary")
def get_summary():
    try:
        return success(WebGISService().get_summary())
    except NotFoundError as exc:
        return service_error_response(exc)


@public_historical_bp.get("/api/profil")
def get_profiles():
    try:
        data = WebGISService().get_profiles()
        return list_success(data, count=len(data), limit=len(data), offset=0)
    except NotFoundError as exc:
        return service_error_response(exc)


@public_historical_bp.get("/api/gempa")
def get_earthquakes():
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 1000))
        cluster_raw = request.args.get("cluster_id")
        cluster_id = int(cluster_raw) if cluster_raw not in (None, "") else None
        if page < 1 or limit < 1 or limit > 5000:
            raise ValidationError("page minimal 1 dan limit harus antara 1 sampai 5000.")

        data = WebGISService().get_earthquakes(
            page=page,
            per_page=limit,
            min_lat=_optional_float("min_lat"),
            max_lat=_optional_float("max_lat"),
            min_lon=_optional_float("min_lon"),
            max_lon=_optional_float("max_lon"),
            cluster_id=cluster_id,
        )
        return list_success(
            data,
            count=len(data),
            limit=limit,
            offset=(page - 1) * limit,
        )
    except (ValueError, ValidationError) as exc:
        return error(message=str(exc), code="VALIDATION_ERROR", status_code=422)
    except NotFoundError as exc:
        return service_error_response(exc)
