import json
import urllib.request
import urllib.error
import http.cookiejar
import getpass
import sys

BASE = "http://127.0.0.1:5000"

cookies = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cookies)
)

passed = 0
failed = 0


def report(name, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
        print(f"PASS: {name}")
    else:
        failed += 1
        print(f"FAIL: {name}")
    if detail:
        print(detail)


def request(method, path, payload=None, headers=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req_headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers=req_headers,
    )

    try:
        with opener.open(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
            try:
                body = json.loads(raw)
            except json.JSONDecodeError:
                body = {"_raw": raw}
            return response.status, body
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = {"_raw": raw}
        return exc.code, body
    except Exception as exc:
        return None, {"_error": repr(exc)}


print("=" * 65)
print("SEISMAP BE 4.1 - JOB MONITORING API TEST")
print("BASE:", BASE)
print("=" * 65)

# 1. Ensure the route is protected.
status, body = request("GET", "/api/admin/jobs")
report(
    "Endpoint requires authentication",
    status == 401,
    f"HTTP: {status}; response: {json.dumps(body, ensure_ascii=False)[:400]}",
)

# 2. Login.
password = getpass.getpass("Password admin: ")
status, body = request(
    "POST",
    "/api/auth/login",
    {"email": "sam@gmail.com", "password": password},
)
report(
    "Admin login",
    status == 200 and (body.get("meta") or {}).get("status") == "success",
    f"HTTP: {status}",
)
if status != 200:
    print("Login gagal. Pengujian dihentikan.")
    sys.exit(1)

print("Cookie names:", sorted(cookie.name for cookie in cookies))

# 3. Main list endpoint.
status, body = request("GET", "/api/admin/jobs")
data = body.get("data") if isinstance(body, dict) else None
meta = body.get("meta") if isinstance(body, dict) else None

main_ok = (
    status == 200
    and isinstance(data, list)
    and isinstance(meta, dict)
    and meta.get("status") == "success"
    and isinstance(meta.get("count"), int)
    and meta.get("limit") == 20
    and meta.get("offset") == 0
)
report(
    "GET /api/admin/jobs default",
    main_ok,
    f"HTTP: {status}; rows: {len(data) if isinstance(data, list) else 'N/A'}; "
    f"meta: {json.dumps(meta, ensure_ascii=False)}",
)

if status == 404:
    print("\nEndpoint belum ada di source runtime. Pastikan patch diterapkan dan Flask direstart.")
    sys.exit(1)
if not main_ok:
    print("\nResponse utama tidak sesuai kontrak. Periksa response di atas.")
    sys.exit(1)

required_fields = {
    "id", "dataset_id", "run_id", "job_type", "status", "progress",
    "current_step", "message", "error_code", "created_at",
    "started_at", "finished_at",
}
if data:
    missing = required_fields - set(data[0].keys())
    report(
        "Job item contains required fields",
        not missing,
        f"Missing fields: {sorted(missing)}",
    )
else:
    report("Job item schema", True, "Belum ada job; schema item tidak dapat diperiksa.")

# 4. Pagination.
status2, body2 = request("GET", "/api/admin/jobs?page=1&limit=2")
data2 = body2.get("data") if isinstance(body2, dict) else None
meta2 = body2.get("meta") if isinstance(body2, dict) else None
pagination_ok = (
    status2 == 200
    and isinstance(data2, list)
    and isinstance(meta2, dict)
    and meta2.get("limit") == 2
    and meta2.get("offset") == 0
    and len(data2) <= 2
)
report(
    "Pagination page=1 limit=2",
    pagination_ok,
    f"HTTP: {status2}; rows: {len(data2) if isinstance(data2, list) else 'N/A'}; "
    f"meta: {json.dumps(meta2, ensure_ascii=False)}",
)

# 5. Status filter.
status3, body3 = request("GET", "/api/admin/jobs?status=SUCCESS")
data3 = body3.get("data") if isinstance(body3, dict) else None
status_ok = (
    status3 == 200
    and isinstance(data3, list)
    and all(item.get("status") == "SUCCESS" for item in data3)
)
report(
    "Filter status=SUCCESS",
    status_ok,
    f"HTTP: {status3}; rows: {len(data3) if isinstance(data3, list) else 'N/A'}",
)

# 6. Job type filter.
status4, body4 = request("GET", "/api/admin/jobs?job_type=PARAMETER_SEARCH")
data4 = body4.get("data") if isinstance(body4, dict) else None
type_ok = (
    status4 == 200
    and isinstance(data4, list)
    and all(item.get("job_type") == "PARAMETER_SEARCH" for item in data4)
)
report(
    "Filter job_type=PARAMETER_SEARCH",
    type_ok,
    f"HTTP: {status4}; rows: {len(data4) if isinstance(data4, list) else 'N/A'}",
)

# 7. Dataset filter: use dataset_id from an actual job if available.
dataset_id = data[0].get("dataset_id") if data else None
if dataset_id is not None:
    status5, body5 = request("GET", f"/api/admin/jobs?dataset_id={dataset_id}")
    data5 = body5.get("data") if isinstance(body5, dict) else None
    dataset_ok = (
        status5 == 200
        and isinstance(data5, list)
        and all(item.get("dataset_id") == dataset_id for item in data5)
    )
    report(
        f"Filter dataset_id={dataset_id}",
        dataset_ok,
        f"HTTP: {status5}; rows: {len(data5) if isinstance(data5, list) else 'N/A'}",
    )
else:
    report("Filter dataset_id", True, "SKIP: belum ada job untuk mengambil dataset_id.")

# 8. Combined filters.
status6, body6 = request(
    "GET",
    "/api/admin/jobs?status=SUCCESS&job_type=PARAMETER_SEARCH&page=1&limit=5",
)
data6 = body6.get("data") if isinstance(body6, dict) else None
combined_ok = (
    status6 == 200
    and isinstance(data6, list)
    and all(
        item.get("status") == "SUCCESS"
        and item.get("job_type") == "PARAMETER_SEARCH"
        for item in data6
    )
)
report(
    "Combined filters",
    combined_ok,
    f"HTTP: {status6}; rows: {len(data6) if isinstance(data6, list) else 'N/A'}",
)

# 9. Invalid query parameters should return 422.
for label, path in [
    ("Reject page=0", "/api/admin/jobs?page=0"),
    ("Reject limit=101", "/api/admin/jobs?limit=101"),
    ("Reject invalid status", "/api/admin/jobs?status=UNKNOWN"),
    ("Reject invalid job_type", "/api/admin/jobs?job_type=UNKNOWN"),
    ("Reject invalid dataset_id", "/api/admin/jobs?dataset_id=abc"),
]:
    s, b = request("GET", path)
    report(label, s == 422, f"HTTP: {s}; meta: {json.dumps(b.get('meta'), ensure_ascii=False)}")

# 10. Existing detail route must remain functional.
if data:
    job_id = data[0].get("id")
    detail_status, detail_body = request("GET", f"/api/admin/jobs/{job_id}")
    detail_data = detail_body.get("data") if isinstance(detail_body, dict) else None
    detail_ok = (
        detail_status == 200
        and isinstance(detail_data, dict)
        and detail_data.get("id") == job_id
    )
    report(
        f"Existing job detail route /api/admin/jobs/{job_id}",
        detail_ok,
        f"HTTP: {detail_status}",
    )
else:
    report("Existing job detail route regression", True, "SKIP: belum ada job.")

print("\n" + "=" * 65)
print(f"RESULT: {passed} PASS / {failed} FAIL")
print("OVERALL:", "ALL PASS" if failed == 0 else "CHECK FAILED TESTS")
print("=" * 65)

sys.exit(0 if failed == 0 else 2)
