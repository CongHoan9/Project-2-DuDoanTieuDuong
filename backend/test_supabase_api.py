#!/usr/bin/env python3
"""Test Supabase RPC functions via HTTP API"""
import os
import sys
import json
import urllib.request
from dotenv import load_dotenv

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY")
    sys.exit(1)

print("🔍 Testing Supabase API...\n")

# Test 1: Check profiles table RLS policies
print("1️⃣  Testing profiles table access...")
try:
    headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
    }
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/profiles?limit=1',
        headers=headers,
        method='GET'
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read())
        print(f"✅ profiles table accessible")
        if isinstance(data, list):
            print(f"   Records found: {len(data)}")
except Exception as e:
    print(f"❌ profiles table error: {e}")

# Test 2: Sign in user
print("\n2️⃣  Testing sign in...")
try:
    headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
    }
    payload = json.dumps({
        "email": "admin@gmail.com",
        "password": "AdminPassword123"
    }).encode()
    
    req = urllib.request.Request(
        f'{SUPABASE_URL}/auth/v1/token?grant_type=password',
        data=payload,
        headers=headers,
        method='POST'
    )
    with urllib.request.urlopen(req) as response:
        auth_data = json.loads(response.read())
        access_token = auth_data.get('access_token')
        print(f"✅ Sign in successful")
        print(f"   Token: {access_token[:20]}..." if access_token else "No token")
        
        # Test 3: Call ensure_my_profile RPC
        print("\n3️⃣  Calling ensure_my_profile RPC...")
        try:
            headers_with_auth = {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            req = urllib.request.Request(
                f'{SUPABASE_URL}/rest/v1/rpc/ensure_my_profile',
                headers=headers_with_auth,
                method='POST'
            )
            with urllib.request.urlopen(req) as response:
                rpc_data = json.loads(response.read())
                print(f"✅ ensure_my_profile successful")
                print(f"   Data: {json.dumps(rpc_data, indent=6)}")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"❌ ensure_my_profile failed")
            print(f"   Status: {e.code}")
            print(f"   Error: {error_body}")
        
        # Test 4: Call get_prediction_history RPC
        print("\n4️⃣  Calling get_prediction_history RPC...")
        try:
            headers_with_auth = {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            rpc_payload = json.dumps({
                "target_user_id": auth_data.get('user', {}).get('id'),
                "row_limit": 50
            }).encode()
            
            req = urllib.request.Request(
                f'{SUPABASE_URL}/rest/v1/rpc/get_prediction_history',
                data=rpc_payload,
                headers=headers_with_auth,
                method='POST'
            )
            with urllib.request.urlopen(req) as response:
                rpc_data = json.loads(response.read())
                print(f"✅ get_prediction_history successful")
                print(f"   Records: {len(rpc_data) if isinstance(rpc_data, list) else 'N/A'}")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"❌ get_prediction_history failed")
            print(f"   Status: {e.code}")
            print(f"   Error: {error_body}")
            
except urllib.error.HTTPError as e:
    error_body = e.read().decode()
    print(f"❌ Sign in failed")
    print(f"   Status: {e.code}")
    print(f"   Error: {error_body}")
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
