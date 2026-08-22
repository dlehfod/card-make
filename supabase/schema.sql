-- TAROT LAB Database Schema
-- Run this SQL in Supabase SQL Editor

-- 1. Create decks table
CREATE TABLE IF NOT EXISTS decks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create cards table
CREATE TABLE IF NOT EXISTS cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  meaning TEXT,
  keywords TEXT,
  one_line TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'working', 'done')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);

-- 4. Enable Row Level Security (RLS) - allow all access (no auth)
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access to decks
CREATE POLICY "Allow all access to decks" ON decks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow anonymous access to cards
CREATE POLICY "Allow all access to cards" ON cards
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Attach trigger to tables
CREATE TRIGGER update_decks_updated_at
  BEFORE UPDATE ON decks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Create shared_notes table for Doyoung & Hyojae
CREATE TABLE IF NOT EXISTS shared_notes (
  id TEXT PRIMARY KEY DEFAULT 'main',
  doyoung_note TEXT DEFAULT '',
  doyoung_read_by_hyojae BOOLEAN DEFAULT false,
  doyoung_read_at TIMESTAMPTZ,
  hyojae_note TEXT DEFAULT '',
  hyojae_read_by_doyoung BOOLEAN DEFAULT false,
  hyojae_read_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shared_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to shared_notes" ON shared_notes
  FOR ALL
  USING (true)
  WITH CHECK (true);

INSERT INTO shared_notes (id, doyoung_note, hyojae_note)
VALUES ('main', '', '')
ON CONFLICT (id) DO NOTHING;

-- 8. Create roadmaps table for Final Goal & Sub-goals
CREATE TABLE IF NOT EXISTS roadmaps (
  id TEXT PRIMARY KEY DEFAULT 'main',
  main_goal TEXT DEFAULT '타로 덱 제작 및 완성',
  target_date DATE,
  sub_goals JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to roadmaps" ON roadmaps
  FOR ALL
  USING (true)
  WITH CHECK (true);

INSERT INTO roadmaps (id, main_goal, target_date, sub_goals)
VALUES ('main', '타로 덱 제작 및 완성', null, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
