from contextlib import closing
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from uuid import uuid4

from .models import CreateConfiguration


class DuplicateNameError(Exception):
    pass


class ConfigurationRepository:
    def __init__(self, database_path: Path):
        self.database_path = database_path

    def connect(self):
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        connection.create_collation(
            "NAME_CASEFOLD",
            lambda first_name, second_name: (first_name.casefold() > second_name.casefold()) - (first_name.casefold() < second_name.casefold()),
        )
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def initialize(self):
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self.connect()) as connection, connection:
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS configurations (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
                    owner_id TEXT NOT NULL,
                    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private', 'unlisted')),
                    share_token TEXT UNIQUE,
                    settings_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE(owner_id, name COLLATE NAME_CASEFOLD)
                );
                CREATE TABLE IF NOT EXISTS user_defaults (
                    user_id TEXT PRIMARY KEY,
                    configuration_id TEXT NOT NULL REFERENCES configurations(id)
                );
            """)

    def create(self, owner_id: str, draft: CreateConfiguration):
        record = {
            "id": str(uuid4()),
            "name": draft.name,
            "visibility": "private",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "configuration": draft.configuration.model_dump(),
        }
        with closing(self.connect()) as connection, connection:
            try:
                connection.execute(
                    "INSERT INTO configurations (id, name, owner_id, settings_json, created_at) VALUES (?, ?, ?, ?, ?)",
                    (record["id"], record["name"], owner_id,
                     json.dumps(record["configuration"], allow_nan=False), record["created_at"]),
                )
            except sqlite3.IntegrityError as error:
                if error.sqlite_errorname == "SQLITE_CONSTRAINT_UNIQUE":
                    raise DuplicateNameError from error
                raise
        return record

    def list(self, owner_id: str):
        with closing(self.connect()) as connection:
            return [dict(row) for row in connection.execute(
                "SELECT id, name, visibility, created_at FROM configurations WHERE owner_id = ? ORDER BY created_at DESC, id",
                (owner_id,),
            )]

    def get(self, owner_id: str, configuration_id: str):
        with closing(self.connect()) as connection:
            row = connection.execute(
                "SELECT id, name, visibility, created_at, settings_json FROM configurations WHERE id = ? AND owner_id = ?",
                (configuration_id, owner_id),
            ).fetchone()
        if row is None:
            return None
        record = dict(row)
        record["configuration"] = json.loads(record.pop("settings_json"))
        return record
