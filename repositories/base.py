"""Small SQLAlchemy repository base with no implicit commits."""

from sqlalchemy import func, select

from extensions import db


class BaseRepository:
    model = None

    def __init__(self, session=None):
        self.session = session or db.session

    def get(self, entity_id):
        return self.session.get(self.model, entity_id)

    def add(self, instance, *, flush=True):
        self.session.add(instance)
        if flush:
            self.session.flush()
        return instance

    def add_many(self, instances, *, flush=True):
        items = list(instances)
        if not items:
            return 0
        self.session.add_all(items)
        if flush:
            self.session.flush()
        return len(items)

    def update(self, instance, **values):
        for key, value in values.items():
            if not hasattr(instance, key):
                raise AttributeError(f"{self.model.__name__} tidak memiliki atribut {key!r}")
            setattr(instance, key, value)
        self.session.flush()
        return instance

    def delete(self, instance, *, flush=True):
        self.session.delete(instance)
        if flush:
            self.session.flush()

    def list(self, *, page=1, per_page=50, order_by="id", descending=False, **filters):
        page = max(int(page), 1)
        per_page = min(max(int(per_page), 1), 500)
        statement = select(self.model)
        for key, value in filters.items():
            if not hasattr(self.model, key):
                raise AttributeError(f"{self.model.__name__} tidak memiliki atribut {key!r}")
            statement = statement.where(getattr(self.model, key) == value)
        if order_by:
            column = getattr(self.model, order_by)
            statement = statement.order_by(column.desc() if descending else column.asc())
        statement = statement.offset((page - 1) * per_page).limit(per_page)
        return list(self.session.scalars(statement))

    def count(self, **filters):
        statement = select(func.count()).select_from(self.model)
        for key, value in filters.items():
            if not hasattr(self.model, key):
                raise AttributeError(f"{self.model.__name__} tidak memiliki atribut {key!r}")
            statement = statement.where(getattr(self.model, key) == value)
        return int(self.session.scalar(statement) or 0)
