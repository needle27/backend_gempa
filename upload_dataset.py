#!/usr/bin/env python3
"""Upload a cleaned earthquake CSV to the local Flask WebGIS API.

Usage:
    python upload_dataset.py "/path/to/gempa_bersih.csv"
"""

import argparse
import getpass
import json
import sys
from pathlib import Path

import requests


def print_response(response):
    try:
        payload = response.json()
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return payload
    except ValueError:
        print(response.text[:4000])
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", help="Path to the cleaned CSV file")
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:5000",
        help="Flask API base URL (default: http://127.0.0.1:5000)",
    )
    parser.add_argument("--dataset-name", help="Dataset name in PostgreSQL")
    parser.add_argument("--source-name", help="Actual dataset source/provider")
    parser.add_argument(
        "--preprocessing-version",
        default="jupyter-cleaning-final",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv_path).expanduser().resolve()
    if not csv_path.is_file():
        sys.exit(f"CSV tidak ditemukan: {csv_path}")
    if csv_path.suffix.lower() != ".csv":
        sys.exit("File harus berekstensi .csv")

    dataset_name = args.dataset_name or input("Nama dataset: ").strip()
    source_name = args.source_name or input(
        "Sumber dataset sesuai sumber sebenarnya: "
    ).strip()

    if not dataset_name or not source_name:
        sys.exit("Nama dataset dan sumber dataset wajib diisi.")

    identity = input("Email/username admin: ").strip()
    password = getpass.getpass("Password admin: ")

    base_url = args.base_url.rstrip("/")
    session = requests.Session()

    print("\n[1/2] Login ke Flask API...")
    try:
        login = session.post(
            f"{base_url}/api/auth/login",
            json={"email": identity, "username": identity, "password": password},
            timeout=30,
        )
    except requests.RequestException as exc:
        sys.exit(f"Tidak dapat menghubungi Flask API: {exc}")

    if login.status_code != 200:
        print(f"Login gagal: HTTP {login.status_code}")
        print_response(login)
        sys.exit(1)

    csrf_token = session.cookies.get("csrf_access_token")
    headers = {}
    if csrf_token:
        headers["X-CSRF-TOKEN"] = csrf_token

    print("Login berhasil. Cookie autentikasi diterima.")
    print(f"CSV: {csv_path.name} ({csv_path.stat().st_size:,} bytes)")

    print("\n[2/2] Mengunggah CSV...")
    try:
        with csv_path.open("rb") as file_handle:
            response = session.post(
                f"{base_url}/api/admin/datasets",
                headers=headers,
                data={
                    "dataset_name": dataset_name,
                    "source_name": source_name,
                    "preprocessing_version": args.preprocessing_version,
                },
                files={"file": (csv_path.name, file_handle, "text/csv")},
                timeout=(15, 600),
            )
    except requests.RequestException as exc:
        sys.exit(
            "Request upload terputus/gagal. Jangan langsung mengulang upload; "
            "periksa GET /api/admin/datasets terlebih dahulu agar tidak membuat "
            f"dataset duplikat.\nDetail: {exc}"
        )

    print(f"HTTP {response.status_code}")
    payload = print_response(response)

    if response.status_code != 201:
        sys.exit(
            "\nUpload belum berhasil. Periksa pesan error di atas; "
            "jangan mengubah atau menghapus baris CSV secara otomatis."
        )

    data = (payload or {}).get("data") or {}
    print("\nUPLOAD BERHASIL")
    print(f"dataset_id      : {data.get('dataset_id')}")
    print(f"status          : {data.get('status')}")
    print(f"raw_row_count   : {data.get('raw_row_count')}")
    print(f"cleaned_row_count: {data.get('cleaned_row_count')}")
    print(f"rejected_row_count: {data.get('rejected_row_count')}")
    print("\nSimpan dataset_id untuk pengujian Parameter Search berikutnya.")


if __name__ == "__main__":
    main()
