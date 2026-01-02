-- Enable Realtime for tables
-- Run this in Supabase SQL Editor

-- Enable realtime on statuses table
ALTER PUBLICATION supabase_realtime ADD TABLE statuses;

-- Enable realtime on circle_members table
ALTER PUBLICATION supabase_realtime ADD TABLE circle_members;

-- Enable realtime on profiles table (for profile updates)
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Enable realtime on circles table (for circle changes)
ALTER PUBLICATION supabase_realtime ADD TABLE circles;

-- Verify realtime is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
