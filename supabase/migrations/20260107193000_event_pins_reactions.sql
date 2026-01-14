-- External events metadata for persistence
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS external_id text UNIQUE,
ADD COLUMN IF NOT EXISTS source text;

CREATE POLICY "Authenticated can insert external events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (source IS NOT NULL AND external_id IS NOT NULL);

-- Pinned events per user
CREATE TABLE IF NOT EXISTS public.user_pinned_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE public.user_pinned_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pinned events"
ON public.user_pinned_events
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can pin events"
ON public.user_pinned_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unpin events"
ON public.user_pinned_events
FOR DELETE
USING (auth.uid() = user_id);

-- Message reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view reactions"
ON public.message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.group_members gm ON gm.group_id = m.group_id
    WHERE m.id = message_reactions.message_id
      AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Group members can react"
ON public.message_reactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.group_members gm ON gm.group_id = m.group_id
    WHERE m.id = message_reactions.message_id
      AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove their reactions"
ON public.message_reactions
FOR DELETE
USING (auth.uid() = user_id);
