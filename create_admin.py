
from getpass import getpass
from sqlalchemy import select

from app import create_app
from extensions import db
from models.user import User
from services.auth_service import AuthService

app = create_app()

with app.app_context():
    if db.engine.url.database != "gempa_dbscan_dev":
        raise SystemExit("STOP: Database bukan gempa_dbscan_dev.")

    existing = db.session.scalars(
        select(User).order_by(User.id)
    ).all()

    if existing:
        print("\nADMIN SUDAH TERSEDIA")
        for user in existing:
            print(
                f"ID: {user.id} | "
                f"Email: {user.email} | "
                f"Username: {user.username} | "
                f"Aktif: {user.is_active}"
            )
    else:
        print("BUAT ADMIN PERTAMA")

        email = input("Email: ").strip()
        username = input("Username: ").strip()
        password = getpass("Password baru: ")
        confirm = getpass("Konfirmasi password: ")

        if password != confirm:
            raise SystemExit("Password tidak cocok.")

        if len(password) < 12:
            raise SystemExit("Password minimal 12 karakter.")

        admin = AuthService().create_admin(
            email=email,
            username=username,
            password=password,
        )

        print("\nADMIN BERHASIL DIBUAT")
        print("ID:", admin.id)
        print("Email:", admin.email)
        print("Username:", admin.username)
        print("Role:", admin.role)

