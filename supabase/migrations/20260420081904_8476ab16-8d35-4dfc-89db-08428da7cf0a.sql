-- Conversations
CREATE TABLE public.assistant_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_conversations_user_updated
  ON public.assistant_conversations (user_id, updated_at DESC);

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own assistant_conversations"
  ON public.assistant_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own assistant_conversations"
  ON public.assistant_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own assistant_conversations"
  ON public.assistant_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own assistant_conversations"
  ON public.assistant_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_assistant_conversations_updated_at
  BEFORE UPDATE ON public.assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Messages
CREATE TABLE public.assistant_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_messages_conv_created
  ON public.assistant_messages (conversation_id, created_at);

ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own assistant_messages"
  ON public.assistant_messages FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM public.assistant_conversations c
    WHERE c.id = assistant_messages.conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users insert own assistant_messages"
  ON public.assistant_messages FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.assistant_conversations c
    WHERE c.id = assistant_messages.conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users delete own assistant_messages"
  ON public.assistant_messages FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM public.assistant_conversations c
    WHERE c.id = assistant_messages.conversation_id AND c.user_id = auth.uid()
  ));

-- Bump conversation updated_at on new message
CREATE OR REPLACE FUNCTION public.bump_assistant_conversation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.assistant_conversations
    SET updated_at = now()
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bump_assistant_conv_updated_at
  AFTER INSERT ON public.assistant_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_assistant_conversation_updated_at();