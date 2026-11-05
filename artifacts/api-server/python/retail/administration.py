"""Trusted server-operator administration; never exposed as a public route."""
import argparse
from .db import pool, one

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--clerk-id", required=True, help="Verified Clerk user ID, not an email")
    args = parser.parse_args()
    pool.open()
    try:
        item = one("UPDATE retail.customers SET role='admin' WHERE clerk_id=%s RETURNING id", (args.clerk_id,))
        if not item:
            raise SystemExit("No customer found. Sign in and visit Account once, then retry.")
        print("Administrator role granted to the verified account.")
    finally:
        pool.close()

if __name__ == "__main__":
    main()
