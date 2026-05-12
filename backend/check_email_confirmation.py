#!/usr/bin/env python3
"""
Script to check and fix email confirmation status in Supabase.
"""
import os
from dotenv import load_dotenv

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")


def _connect():
    """Create a database connection from DATABASE_URL."""
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set. Check your .env file.")

    import psycopg2
    from urllib.parse import urlparse, unquote

    parsed = urlparse(DATABASE_URL)
    password = unquote(parsed.password) if parsed.password else ""

    return psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port,
        database=parsed.path.lstrip('/'),
        user=parsed.username,
        password=password
    )


def check_email_confirmation(email: str):
    """Check if email is confirmed in auth.users"""
    conn = None
    try:
        import psycopg2  # noqa: F811 – re-import for ImportError guard
    except ImportError:
        print("❌ psycopg2 not installed. Install with: pip install psycopg2-binary")
        return None

    try:
        conn = _connect()
        cur = conn.cursor()

        # Check auth.users
        cur.execute(
            "SELECT id, email, email_confirmed_at, created_at FROM auth.users WHERE email = %s",
            (email,)
        )
        result = cur.fetchone()

        if result:
            user_id, user_email, email_confirmed_at, created_at = result
            print(f"\n📧 User found in auth.users:")
            print(f"   ID: {user_id}")
            print(f"   Email: {user_email}")
            print(f"   Email Confirmed At: {email_confirmed_at}")
            print(f"   Created At: {created_at}")

            if email_confirmed_at is None:
                print(f"\n❌ Email NOT confirmed!")
                print(f"\n🔧 To mark as confirmed, run:")
                print(f"   UPDATE auth.users SET email_confirmed_at = now() WHERE id = '{user_id}';")
                return False
            else:
                print(f"\n✅ Email is confirmed!")
                return True
        else:
            print(f"❌ User '{email}' NOT found in auth.users")

            # Check profiles table
            cur.execute(
                "SELECT id, email, full_name, role FROM public.profiles WHERE email = %s",
                (email,)
            )
            profile = cur.fetchone()
            if profile:
                print(f"\n⚠️  But found in public.profiles:")
                print(f"   ID: {profile[0]}")
                print(f"   Email: {profile[1]}")
                print(f"   Name: {profile[2]}")
                print(f"   Role: {profile[3]}")
            return None

    except Exception as e:
        print(f"❌ Error: {e}")
        return None
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


def mark_email_confirmed(email: str):
    """Mark email as confirmed for a user"""
    conn = None
    try:
        import psycopg2  # noqa: F811 – re-import for ImportError guard
    except ImportError:
        print("❌ psycopg2 not installed. Install with: pip install psycopg2-binary")
        return

    try:
        conn = _connect()
        cur = conn.cursor()

        # Find user
        cur.execute("SELECT id FROM auth.users WHERE email = %s", (email,))
        result = cur.fetchone()

        if result:
            user_id = result[0]
            # Mark as confirmed
            cur.execute(
                "UPDATE auth.users SET email_confirmed_at = now() WHERE id = %s RETURNING email_confirmed_at",
                (user_id,)
            )
            confirmed_at = cur.fetchone()
            conn.commit()

            print(f"✅ Email confirmed at: {confirmed_at[0] if confirmed_at else 'N/A'}")
        else:
            print(f"❌ User '{email}' not found")

        cur.close()

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python check_email_confirmation.py check <email>")
        print("  python check_email_confirmation.py fix <email>")
        sys.exit(1)

    command = sys.argv[1]
    email = sys.argv[2] if len(sys.argv) > 2 else None

    if command == "check" and email:
        check_email_confirmation(email)
    elif command == "fix" and email:
        print(f"Marking '{email}' as confirmed...")
        mark_email_confirmed(email)
    else:
        print("Invalid arguments")
        sys.exit(1)
