'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Deck } from '@/lib/types';
import SharedMemoBoard from '@/components/SharedMemoBoard';
import GoalRoadmap from '@/components/GoalRoadmap';

interface DeckWithCount extends Deck {
  card_count: number;
}

const DECK_ICONS = ['🎨', '🔮', '🌙', '✨', '🌟', '🃏', '💫', '🌸', '🦋', '🔥'];

export default function HomePage() {
  const [decks, setDecks] = useState<DeckWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDecks = async () => {
    setLoading(true);
    const { data: decksData, error } = await supabase
      .from('decks')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching decks:', error);
      setLoading(false);
      return;
    }

    // Get card counts for each deck
    const decksWithCounts: DeckWithCount[] = [];
    for (const deck of decksData || []) {
      const { count } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('deck_id', deck.id);
      decksWithCounts.push({ ...deck, card_count: count || 0 });
    }

    setDecks(decksWithCounts);
    setLoading(false);
  };

  useEffect(() => {
    fetchDecks();
  }, []);

  const handleAddDeck = async () => {
    if (!newDeckName.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from('decks')
      .insert({ name: newDeckName.trim() });

    if (error) {
      console.error('Error adding deck:', error);
      alert('덱 추가에 실패했습니다.');
    } else {
      setNewDeckName('');
      setShowAddModal(false);
      await fetchDecks();
    }
    setSaving(false);
  };

  const handleEditDeck = async () => {
    if (!editingDeck || !editName.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from('decks')
      .update({ name: editName.trim() })
      .eq('id', editingDeck.id);

    if (error) {
      console.error('Error updating deck:', error);
      alert('덱 수정에 실패했습니다.');
    } else {
      setEditingDeck(null);
      setEditName('');
      await fetchDecks();
    }
    setSaving(false);
  };

  const handleDeleteDeck = async (deck: Deck) => {
    const confirmed = window.confirm(`"${deck.name}" 덱을 삭제하시겠습니까?\n포함된 모든 카드도 함께 삭제됩니다.`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', deck.id);

    if (error) {
      console.error('Error deleting deck:', error);
      alert('덱 삭제에 실패했습니다.');
    } else {
      await fetchDecks();
    }
  };

  return (
    <main className="flex-1 pb-16">
      {/* Header */}
      <header className="border-b border-beige-dark/50 bg-warm-white">
        <div className="max-w-3xl mx-auto px-6 py-10 text-center">
          <div className="inline-flex items-center gap-2 mb-2 px-3 py-1 bg-beige rounded-full border border-beige-dark/50 text-[11px] text-brown-dark font-medium tracking-widest uppercase">
            ✦ TAROT ARCHIVE & WORKSPACE ✦
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-charcoal tracking-wide">
            TAROT LAB
          </h1>
          <p className="mt-3 text-sm text-charcoal-light tracking-widest">
            점술신 & 양효재의 타로 공동 작업실
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* 1. Doyoung & Hyojae Shared Memo Board */}
        <SharedMemoBoard />

        {/* 2. Goal & D-Day Roadmap Widget */}
        <GoalRoadmap />

        {/* 3. Decks Section */}
        <div id="deck-list" className="pt-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-bold text-charcoal-light uppercase tracking-wider flex items-center gap-1.5">
              <span>🃏</span>
              <span>작업 덱 목록</span>
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-20 text-charcoal-light">
              불러오는 중...
            </div>
          ) : (
            <>
              {decks.length === 0 ? (
                <div className="text-center py-16 bg-warm-white border border-dashed border-beige-dark/50 rounded-2xl p-8">
                  <p className="text-charcoal-light text-sm mb-4">아직 등록된 덱이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {decks.map((deck, index) => (
                    <div
                      key={deck.id}
                      className="group bg-warm-white border border-beige-dark/40 rounded-2xl hover:border-brown/40 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center">
                        <Link
                          href={`/deck/${deck.id}`}
                          className="flex-1 flex items-center gap-4 px-6 py-5"
                        >
                          <span className="text-2xl">
                            {DECK_ICONS[index % DECK_ICONS.length]}
                          </span>
                          <div>
                            <h2 className="text-base font-bold text-charcoal">
                              {deck.name}
                            </h2>
                            <p className="text-xs text-charcoal-light mt-0.5">
                              {deck.card_count}장의 카드
                            </p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-1 pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setEditingDeck(deck);
                              setEditName(deck.name);
                            }}
                            className="p-2 text-charcoal-light hover:text-brown rounded-lg hover:bg-beige"
                            title="수정"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleDeleteDeck(deck);
                            }}
                            className="p-2 text-charcoal-light hover:text-red-500 rounded-lg hover:bg-red-50"
                            title="삭제"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Deck Button */}
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 w-full py-3.5 border-2 border-dashed border-beige-dark/60 rounded-2xl text-charcoal-light hover:border-brown/50 hover:text-brown hover:bg-warm-white font-medium text-xs transition-all"
              >
                + 새 덱 추가하기
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add Deck Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
          <div className="bg-warm-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-semibold text-charcoal mb-6">새 덱 추가</h3>
            <input
              type="text"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              placeholder="덱 이름"
              className="w-full px-4 py-3 bg-ivory border border-beige-dark/50 rounded-xl text-charcoal placeholder:text-charcoal-light/50 focus:border-gold"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddDeck()}
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewDeckName('');
                }}
                className="flex-1 py-3 border border-beige-dark/50 rounded-xl text-charcoal-light hover:bg-beige"
              >
                취소
              </button>
              <button
                onClick={handleAddDeck}
                disabled={saving || !newDeckName.trim()}
                className="flex-1 py-3 bg-charcoal text-ivory rounded-xl hover:bg-brown-dark disabled:opacity-50"
              >
                {saving ? '저장 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Deck Modal */}
      {editingDeck && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
          <div className="bg-warm-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-semibold text-charcoal mb-6">덱 이름 수정</h3>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="덱 이름"
              className="w-full px-4 py-3 bg-ivory border border-beige-dark/50 rounded-xl text-charcoal placeholder:text-charcoal-light/50 focus:border-gold"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleEditDeck()}
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setEditingDeck(null);
                  setEditName('');
                }}
                className="flex-1 py-3 border border-beige-dark/50 rounded-xl text-charcoal-light hover:bg-beige"
              >
                취소
              </button>
              <button
                onClick={handleEditDeck}
                disabled={saving || !editName.trim()}
                className="flex-1 py-3 bg-charcoal text-ivory rounded-xl hover:bg-brown-dark disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
