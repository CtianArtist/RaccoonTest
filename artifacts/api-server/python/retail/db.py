import os
from contextlib import contextmanager
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

pool = ConnectionPool(os.environ["DATABASE_URL"], min_size=1, max_size=8,
                      kwargs={"row_factory": dict_row}, open=False)

@contextmanager
def transaction():
    with pool.connection() as connection:
        with connection.transaction():
            yield connection

def rows(query, params=()):
    with transaction() as connection:
        return connection.execute(query, params).fetchall()

def one(query, params=()):
    result = rows(query, params)
    return result[0] if result else None
