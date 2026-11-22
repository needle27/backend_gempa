from __future__ import annotations

from logging.config import fileConfig
from pathlib import Path

from alembic import context
from flask import current_app

config = context.config
if config.config_file_name is not None:
    config_path = Path(config.config_file_name)
    if not config_path.is_file():
        config_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    if config_path.is_file():
        fileConfig(str(config_path))

# Flask-Migrate supplies the active Flask-SQLAlchemy metadata here.
target_metadata = current_app.extensions["migrate"].db.metadata


def get_engine():
    return current_app.extensions["migrate"].db.engine


def run_migrations_offline() -> None:
    url = current_app.config["SQLALCHEMY_DATABASE_URI"]
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = get_engine()
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            render_as_batch=connection.dialect.name == "sqlite",
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
