-- Fix recursive RLS policies on group_members
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can join public groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;

CREATE POLICY "Users can view their own group memberships"
ON public.group_members
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can join groups as themselves"
ON public.group_members
FOR INSERT
WITH CHECK (user_id = auth.uid());
