export interface Deck {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  deck_id: string;
  card_number: string;
  name: string;
  image_url: string | null;
  meaning: string | null;
  keywords: string | null;
  one_line: string | null;
  notes: string | null;
  status: 'todo' | 'working' | 'done';
  created_at: string;
  updated_at: string;
}

export type CardStatus = 'todo' | 'working' | 'done';

export const STATUS_LABELS: Record<CardStatus, string> = {
  todo: '미작업',
  working: '작업중',
  done: '완료',
};

export const STATUS_COLORS: Record<CardStatus, string> = {
  todo: 'bg-gray-200 text-gray-600',
  working: 'bg-amber-100 text-amber-700',
  done: 'bg-emerald-100 text-emerald-700',
};
