from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from extensions import db
from models.user import User
from repositories.user_repository import UserRepository
from services.exceptions import ConflictError, ValidationError
from services.utils import utc_now


class AuthService:
    """Admin credential operations. HTTP cookie/JWT handling belongs in routes."""

    def __init__(self, repository=None, password_hasher=None):
        self.repository = repository or UserRepository()
        self.password_hasher = password_hasher or PasswordHasher()

    def create_admin(self, *, email, username, password):
        email = str(email or "").strip().lower()
        username = str(username or "").strip()
        password = str(password or "")
        if not email or not username or not password:
            raise ValidationError("Email, username, dan password wajib diisi.")
        if self.repository.get_by_email(email):
            raise ConflictError("Email admin sudah digunakan.")
        if self.repository.get_by_username(username):
            raise ConflictError("Username admin sudah digunakan.")

        user = User(
            email=email,
            username=username,
            password_hash=self.password_hasher.hash(password),
            role="admin",
            is_active=True,
            failed_login_count=0,
        )
        try:
            self.repository.add(user)
            db.session.commit()
            return user
        except Exception:
            db.session.rollback()
            raise

    def authenticate(self, *, identity, password):
        user = self.repository.get_by_identity(str(identity or ""))
        if user is None or not user.is_active:
            return None

        now = utc_now()
        if user.locked_until is not None:
            lock_until = user.locked_until
            # SQLite test databases may return naive datetimes for timezone=True columns.
            if lock_until.tzinfo is None:
                from datetime import timezone
                lock_until = lock_until.replace(tzinfo=timezone.utc)
            if lock_until > now:
                return None

        try:
            valid = self.password_hasher.verify(user.password_hash, str(password or ""))
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            valid = False

        if not valid:
            user.failed_login_count = int(user.failed_login_count or 0) + 1
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
                raise
            return None

        try:
            user.failed_login_count = 0
            user.last_login_at = now
            if self.password_hasher.check_needs_rehash(user.password_hash):
                user.password_hash = self.password_hasher.hash(str(password))
            db.session.commit()
            return user
        except Exception:
            db.session.rollback()
            raise
