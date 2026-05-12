#!/usr/bin/env python3
"""Diagnostic script to check database configuration"""
import os
import sys
from dotenv import load_dotenv

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("❌ DATABASE_URL is not set. Check your .env file.")
    sys.exit(1)

try:
    import psycopg2
    from urllib.parse import urlparse, unquote
except ImportError:
    print("❌ psycopg2 not installed. Install with: pip install psycopg2-binary")
    sys.exit(1)

parsed = urlparse(DATABASE_URL)
password = unquote(parsed.password) if parsed.password else ''

conn = None
try:
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port,
        database=parsed.path.lstrip('/'),
        user=parsed.username,
        password=password
    )
    
    cur = conn.cursor()
    
    print('=' * 60)
    print('DATABASE DIAGNOSTIC REPORT')
    print('=' * 60)
    
    # Check RLS status
    print('\n1️⃣  RLS POLICIES STATUS:')
    print('-' * 60)
    cur.execute("""
        SELECT schemaname, tablename, rowsecurity 
        FROM pg_tables 
        WHERE tablename IN ('profiles', 'predictions')
        ORDER BY tablename
    """)
    for row in cur.fetchall():
        status = "✅ ENABLED" if row[2] else "❌ DISABLED"
        print(f"  {row[1]:20} RLS: {status}")
    
    # Check policies
    print('\n2️⃣  ACTIVE POLICIES:')
    print('-' * 60)
    cur.execute("""
        SELECT policyname, tablename, cmd 
        FROM pg_policies 
        WHERE tablename IN ('profiles', 'predictions')
        ORDER BY tablename, policyname
    """)
    policies = cur.fetchall()
    if not policies:
        print("  ❌ NO POLICIES FOUND!")
    else:
        for row in policies:
            print(f"  {row[1]}: {row[0]} ({row[2] or 'ALL'})")
    
    # Check triggers
    print('\n3️⃣  TRIGGERS:')
    print('-' * 60)
    cur.execute("""
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name
    """)
    triggers = cur.fetchall()
    if not triggers:
        print("  ❌ NO TRIGGERS FOUND!")
    else:
        for row in triggers:
            print(f"  {row[1]}: {row[0]}")
    
    # Check functions
    print('\n4️⃣  PUBLIC FUNCTIONS:')
    print('-' * 60)
    cur.execute("""
        SELECT routine_name, routine_type 
        FROM information_schema.routines 
        WHERE routine_schema = 'public'
        ORDER BY routine_name
    """)
    functions = cur.fetchall()
    if not functions:
        print("  ❌ NO FUNCTIONS FOUND!")
    else:
        for row in functions:
            print(f"  {row[1]}: {row[0]}")
    
    # Check admin profile
    print('\n5️⃣  ADMIN PROFILE:')
    print('-' * 60)
    cur.execute("""
        SELECT id, email, full_name, role, created_at, updated_at
        FROM public.profiles
        WHERE email = 'admin@gmail.com'
    """)
    admin = cur.fetchone()
    if admin:
        print(f"  ✅ Found")
        print(f"     ID: {admin[0]}")
        print(f"     Email: {admin[1]}")
        print(f"     Name: {admin[2]}")
        print(f"     Role: {admin[3]}")
        print(f"     Created: {admin[4]}")
    else:
        print(f"  ❌ NOT FOUND")
    
    # Check if auth.users can be accessed
    print('\n6️⃣  AUTH.USERS ACCESS:')
    print('-' * 60)
    try:
        cur.execute("SELECT COUNT(*) FROM auth.users")
        count = cur.fetchone()[0]
        print(f"  ✅ Can access - {count} users total")
    except Exception as e:
        conn.rollback()
        print(f"  ❌ Cannot access: {e}")
    
    # Check trigger function for new users
    print('\n7️⃣  HANDLE_NEW_USER FUNCTION:')
    print('-' * 60)
    cur.execute("""
        SELECT pg_get_functiondef(oid) 
        FROM pg_proc 
        WHERE proname = 'handle_new_user'
    """)
    func_def = cur.fetchone()
    if func_def:
        lines = func_def[0].split('\n')
        for line in lines[:20]:  # First 20 lines
            print(f"  {line}")
    else:
        print("  ❌ Function not found!")
    
    print('\n' + '=' * 60)
    
    cur.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    if conn is not None:
        try:
            conn.close()
        except Exception:
            pass
