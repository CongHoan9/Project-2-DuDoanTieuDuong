import os
from pathlib import Path
from dotenv import load_dotenv
import httpx

load_dotenv(Path(__file__).resolve().parent / '.env')
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
print('SUPABASE_URL', SUPABASE_URL)
print('SERVICE KEY LOADED', bool(SUPABASE_SERVICE_ROLE_KEY))
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise SystemExit('Missing configuration')
headers = {
    'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
}
url = f'{SUPABASE_URL}/auth/v1/admin/users'
print('CALL', url)
with httpx.Client() as client:
    resp = client.get(url, headers=headers, timeout=10.0)
    print('STATUS', resp.status_code)
    print('TEXT', resp.text[:400])
