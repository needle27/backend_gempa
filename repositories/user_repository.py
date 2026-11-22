from sqlalchemy import or_, select

from models.user import User
from repositories.base import BaseRepository


class UserRepository(BaseRepository):
    model = User

    def get_by_email(self, email):
        return self.session.scalar(select(User).where(User.email == email.strip().lower()))

    def get_by_username(self, username):
        return self.session.scalar(select(User).where(User.username == username.strip()))

    def get_by_identity(self, identity):
        identity = identity.strip()
        return self.session.scalar(
            select(User).where(
                or_(User.email == identity.lower(), User.username == identity)
            )
        )
