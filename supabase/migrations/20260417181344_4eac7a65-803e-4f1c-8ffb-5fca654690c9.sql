-- Enable RLS on realtime.messages and add owner-scoped policies.
-- Even though postgres_changes events are already filtered by table-level RLS,
-- this prevents abuse via custom broadcast/presence channel topics by requiring
-- the channel topic to begin with the authenticated user's id (e.g. "<uid>:job_queue_status").
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can subscribe to (read) only channels namespaced to their own uid.
CREATE POLICY "Users read own realtime messages"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    (realtime.topic() LIKE (auth.uid()::text || ':%'))
    OR (realtime.topic() = auth.uid()::text)
  );

-- Authenticated users can publish (broadcast/presence) only on their own namespace.
CREATE POLICY "Users write own realtime messages"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (realtime.topic() LIKE (auth.uid()::text || ':%'))
    OR (realtime.topic() = auth.uid()::text)
  );