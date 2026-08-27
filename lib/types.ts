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
  image_url_2: string | null;
  image_url_3: string | null;
  meaning: string | null;
  keywords: string | null;
  one_line: string | null;
  notes: string | null;
  image_feedback: string | null;
  notes_last_editor: string | null;
  notes_read_by_doyoung: boolean;
  notes_read_by_hyojae: boolean;
  feedback_last_editor: string | null;
  feedback_read_by_doyoung: boolean;
  feedback_read_by_hyojae: boolean;
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
