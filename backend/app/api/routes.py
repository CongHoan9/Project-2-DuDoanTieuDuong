from fastapi import APIRouter, Header, HTTPException, status
from typing import Optional

from app.config import get_settings
from app.schemas.prediction import PredictionInput, PredictionOutput
from app.schemas.admin import AdminDeleteUserRequest, AdminDeleteUserResponse
from app.services.prediction import (
    get_clinical_content,
    get_model_profile,
    get_reference_stats,
    predict_diabetes,
)
from app.services.admin import delete_user_and_data, delete_user_from_auth


router = APIRouter(prefix="/api", tags=["diabetes"])
APP_VERSION = "2.3.0"


@router.get("/health")
def health_check():
    settings = get_settings()
    return {
        "status": "ok",
        "version": APP_VERSION,
        "history_backend": "supabase.public.predictions",
        "database_backend": settings.database_backend,
        "model_load_policy": "preloaded-on-startup and reused from in-memory cache",
    }


@router.get("/supabase-config")
def supabase_public_config():
    settings = get_settings()
    return {
        "url": settings.supabase_url,
        "anon_key": settings.supabase_public_key,
    }


@router.post("/predict", response_model=PredictionOutput)
async def predict(data: PredictionInput):
    return predict_diabetes(data)


@router.get("/reference-stats")
def reference_stats():
    return get_reference_stats()


@router.get("/model-info")
def model_info():
    return get_model_profile()


@router.get("/clinical-content")
def clinical_content():
    return get_clinical_content()


@router.post("/admin/delete-user", response_model=AdminDeleteUserResponse)
async def admin_delete_user(
    request: AdminDeleteUserRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Delete a user account and all their data (admin only).
    
    Requires:
    - Valid Supabase JWT token in Authorization header (Bearer token)
    - User must have admin role
    
    Args:
        request: Contains target_user_id (UUID of user to delete)
        authorization: Bearer token from Supabase Auth
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )
    
    # Extract token (without Bearer prefix)
    token = authorization[7:]
    
    try:
        # Verify admin role by checking database
        import json
        import base64
        from urllib.parse import urlparse, unquote
        import psycopg2
        import os
        from pathlib import Path
        from dotenv import load_dotenv
        
        settings = get_settings()
        
        # Decode JWT to get user_id (basic decode without verification)
        # Production: verify signature with Supabase public key
        try:
            parts = token.split(".")
            if len(parts) != 3:
                raise ValueError("Invalid JWT format")
            
            # Decode payload (add padding if needed)
            payload_b64 = parts[1]
            padding = 4 - len(payload_b64) % 4
            if padding != 4:
                payload_b64 += "=" * padding
            
            payload_json = base64.urlsafe_b64decode(payload_b64)
            payload = json.loads(payload_json)
            admin_user_id = payload.get("sub")
            
            if not admin_user_id:
                raise ValueError("No user ID in token")
        
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}"
            )
        
        # Verify admin role from database
        BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
        load_dotenv(os.path.join(BACKEND_DIR, ".env"))
        DATABASE_URL = os.getenv("DATABASE_URL")
        
        if not DATABASE_URL:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database not configured"
            )
        
        parsed = urlparse(DATABASE_URL)
        password = unquote(parsed.password) if parsed.password else ""
        
        conn = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port,
            database=parsed.path.lstrip("/"),
            user=parsed.username,
            password=password
        )
        
        cursor = conn.cursor()
        
        # Check if requesting user is admin
        cursor.execute(
            "SELECT role FROM public.profiles WHERE id = %s;",
            (admin_user_id,)
        )
        admin_row = cursor.fetchone()
        
        if not admin_row or admin_row[0] != "admin":
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin role required"
            )
        
        conn.close()
        
        # Delete auth user first using service role key, then clean up remaining profile data.
        auth_result = {"success": False, "message": "Auth deletion skipped or failed."}
        try:
            auth_result = delete_user_from_auth(request.target_user_id)
        except Exception as e:
            auth_result = {"success": False, "message": str(e)}

        result = delete_user_and_data(request.target_user_id)
        if auth_result["success"]:
            result["message"] = f"{auth_result['message']} {result['message']}"
        else:
            result["message"] = f"{result['message']} (Auth deletion warning: {auth_result['message']})"

        return AdminDeleteUserResponse(**result)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting user: {str(e)}"
        )

