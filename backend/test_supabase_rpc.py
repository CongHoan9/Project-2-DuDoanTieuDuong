#!/usr/bin/env python3
"""Test Supabase RPC functions and auth flow"""
import os
import sys
import json
from dotenv import load_dotenv

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

# Try supabase-py if available
try:
    from supabase import create_client, Client
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY")
        sys.exit(1)
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("🔍 Testing Supabase RPC functions...\n")
    
    # Test 1: Sign in
    print("1️⃣  Testing signin with admin@gmail.com...")
    try:
        response = supabase.auth.sign_in_with_password({
            "email": "admin@gmail.com",
            "password": "AdminPassword123"
        })
        session = response.session
        print(f"✅ Sign in successful")
        print(f"   Session ID: {session.access_token[:20]}...")
        print(f"   User ID: {session.user.id}")
        
    except Exception as e:
        print(f"❌ Sign in failed: {e}")
        sys.exit(1)
    
    # Test 2: Call ensure_my_profile
    print("\n2️⃣  Calling ensure_my_profile RPC...")
    try:
        result = supabase.rpc("ensure_my_profile").execute()
        print(f"✅ ensure_my_profile successful")
        print(f"   Result: {json.dumps(result.data, indent=2)}")
    except Exception as e:
        print(f"❌ ensure_my_profile failed: {e}")
        if hasattr(e, 'response'):
            print(f"   Response: {e.response}")
    
    # Test 3: Call get_prediction_history
    print("\n3️⃣  Calling get_prediction_history RPC...")
    try:
        result = supabase.rpc("get_prediction_history", {
            "target_user_id": session.user.id,
            "row_limit": 50
        }).execute()
        print(f"✅ get_prediction_history successful")
        print(f"   Result count: {len(result.data) if result.data else 0}")
    except Exception as e:
        print(f"❌ get_prediction_history failed: {e}")
        if hasattr(e, 'response'):
            print(f"   Response: {e.response}")
    
    # Test 4: Call admin_search_profiles (should fail for non-admin)
    print("\n4️⃣  Calling admin_search_profiles RPC...")
    try:
        result = supabase.rpc("admin_search_profiles", {
            "search_text": "",
            "disease_filter": None
        }).execute()
        print(f"✅ admin_search_profiles successful")
        print(f"   Result count: {len(result.data) if result.data else 0}")
    except Exception as e:
        print(f"⚠️  admin_search_profiles (expected to fail for non-admin): {e}")
    
    print("\n✅ All tests completed!")
    
except ImportError:
    print("❌ supabase-py not installed")
    print("Install with: pip install supabase")
    sys.exit(1)

except Exception as e:
    print(f"❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
