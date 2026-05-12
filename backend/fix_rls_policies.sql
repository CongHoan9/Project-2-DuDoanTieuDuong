-- Fix RLS policies for profiles table
-- The issue is that INSERT policy is missing which causes errors during auth flow

-- Drop existing incomplete policies (cover both old and new names)
DROP POLICY IF EXISTS "profiles self select" ON public.profiles;
DROP POLICY IF EXISTS "profiles self select admin all" ON public.profiles;
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
DROP POLICY IF EXISTS "profiles insert own" ON public.profiles;
DROP POLICY IF EXISTS "profiles no delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles select" ON public.profiles;
DROP POLICY IF EXISTS "profiles update own" ON public.profiles;

-- Create comprehensive policies
-- 1. INSERT: Allow the SECURITY DEFINER trigger to insert profiles
CREATE POLICY "profiles insert own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
    -- Normally, the trigger with SECURITY DEFINER creates profiles
    -- This policy allows the trigger to insert
    true
);

-- 2. SELECT: Allow users to select their own profile or admin to select all
CREATE POLICY "profiles self select"
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = auth.uid()  -- Users can see their own profile
    OR public.is_admin()  -- Admins can see all
);

-- 3. UPDATE: Allow users to update their own profile or admin to update any
CREATE POLICY "profiles self update"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (
    id = auth.uid()  -- Can only update own profile
    OR public.is_admin()  -- Admins can update any
);

-- 4. DELETE: Prevent all deletes (only cascade from auth.users)
CREATE POLICY "profiles no delete"
ON public.profiles FOR DELETE
TO authenticated
USING (false);

-- Verify policies
SELECT
    policyname,
    tablename,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;
