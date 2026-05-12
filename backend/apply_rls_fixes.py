#!/usr/bin/env python3
"""Apply RLS policy fixes to Supabase database"""
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
    
    print("🔧 Fixing RLS Policies...\n")
    
    # SQL statements to execute — policy names match supabase_schema.sql
    sql_stmts = [
        # Drop old policies (cover both old and new names to avoid conflicts)
        'DROP POLICY IF EXISTS "profiles self select" ON public.profiles',
        'DROP POLICY IF EXISTS "profiles self select admin all" ON public.profiles',
        'DROP POLICY IF EXISTS "profiles self update" ON public.profiles',
        'DROP POLICY IF EXISTS "profiles insert own" ON public.profiles',
        'DROP POLICY IF EXISTS "profiles no delete" ON public.profiles',
        'DROP POLICY IF EXISTS "profiles select" ON public.profiles',
        'DROP POLICY IF EXISTS "profiles update own" ON public.profiles',
        
        # Create new policies — names consistent with supabase_schema.sql
        '''CREATE POLICY "profiles insert own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (true)''',
        
        '''CREATE POLICY "profiles self select"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin())''',
        
        '''CREATE POLICY "profiles self update"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin())''',
        
        '''CREATE POLICY "profiles no delete"
ON public.profiles FOR DELETE
TO authenticated
USING (false)'''
    ]
    
    for stmt in sql_stmts:
        if not stmt.strip():
            continue
        try:
            print(f"Executing: {stmt[:60]}...")
            cur.execute(stmt)
            conn.commit()
            print("  ✅ Success\n")
        except Exception as e:
            conn.rollback()
            print(f"  ⚠️  Error: {e}\n")
    
    # Verify policies
    print("=" * 60)
    print("FINAL RLS POLICIES FOR PROFILES:")
    print("=" * 60 + "\n")
    
    cur.execute("""
        SELECT 
            policyname,
            cmd,
            qual,
            with_check
        FROM pg_policies
        WHERE tablename = 'profiles'
        ORDER BY cmd, policyname
    """)
    
    for row in cur.fetchall():
        policy, cmd, qual, check = row
        print(f"Policy: {policy}")
        print(f"  Command: {cmd}")
        print(f"  Qual: {qual}")
        print(f"  With Check: {check}\n")
    
    cur.close()
    conn.close()
    print("✅ RLS policy fixes applied successfully!")
    
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
