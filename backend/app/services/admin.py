"""
Admin service functions for user management
"""
import os
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse, unquote
import psycopg2
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def get_db_connection():
    """Create database connection from DATABASE_URL"""
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set. Check your .env file.")
    
    parsed = urlparse(DATABASE_URL)
    password = unquote(parsed.password) if parsed.password else ""
    
    return psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port,
        database=parsed.path.lstrip("/"),
        user=parsed.username,
        password=password
    )


def delete_user_and_data(user_id: str) -> dict:
    """
    Delete user account and all related data (predictions, profiles)
    Cascade deletion from auth.users handled by Supabase.
    
    Args:
        user_id: UUID of user to delete
        
    Returns:
        dict with success status and message
    """
    if not user_id or not isinstance(user_id, str):
        raise ValueError("Invalid user_id format")
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Delete predictions (cascade will be handled by DB constraints)
        cursor.execute(
            "DELETE FROM public.predictions WHERE user_id = %s;",
            (user_id,)
        )
        deleted_predictions = cursor.rowcount
        
        # Delete profile (this will trigger cascade)
        cursor.execute(
            "DELETE FROM public.profiles WHERE id = %s;",
            (user_id,)
        )
        deleted_profiles = cursor.rowcount
        
        conn.commit()
        
        return {
            "success": True,
            "message": f"User deleted successfully. Removed {deleted_predictions} predictions and {deleted_profiles} profile(s).",
            "deleted_user_id": user_id,
            "details": {
                "predictions_deleted": deleted_predictions,
                "profiles_deleted": deleted_profiles
            }
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
        raise RuntimeError(f"Failed to delete user data: {str(e)}")
    finally:
        if conn:
            conn.close()


def delete_user_from_auth(user_id: str) -> dict:
    """
    Delete user from Supabase auth.users table using Service Role Key
    
    Args:
        user_id: UUID of user to delete
        
    Returns:
        dict with success status
    """
    if not SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY not configured")
    
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL not configured")
    
    try:
        import httpx
        
        headers = {
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "apikey": SUPABASE_SERVICE_KEY,
            "Accept": "application/json"
        }
        
        # Use Supabase Admin API to delete auth user
        url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
        
        with httpx.Client() as client:
            response = client.delete(url, headers=headers)
            
            if response.status_code in [200, 204]:
                return {
                    "success": True,
                    "message": "Auth user deleted from Supabase"
                }
            else:
                return {
                    "success": False,
                    "message": f"Failed to delete from auth: {response.text}",
                    "status_code": response.status_code
                }
    
    except ImportError:
        # Fallback if httpx not available
        import urllib.request
        import json
        
        headers = {
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "apikey": SUPABASE_SERVICE_KEY,
            "Accept": "application/json"
        }
        
        url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
        
        try:
            req = urllib.request.Request(
                url,
                headers=headers,
                method="DELETE"
            )
            with urllib.request.urlopen(req) as response:
                return {
                    "success": True,
                    "message": "Auth user deleted from Supabase"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to delete from auth: {str(e)}"
            }
