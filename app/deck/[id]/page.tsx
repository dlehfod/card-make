'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Deck, Card, CardStatus, STATUS_LABELS, STATUS_COLORS } from '@/lib/types';

export default function DeckPage() {
  const params = useParams();
  const deckId = params.id as string;

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Accordion: which card is currently expanded (or null)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    card_number: string;
    name: string;
    meaning: string;
    keywords: string;
    one_line: string;
    notes: string;
    image_feedback: string;
    status: CardStatus;
    read_request_by: 'doyoung' | 'hyojae' | null;
  }>({
    card_number: '',
    name: '',
    meaning: '',
    keywords: '',
    one_line: '',
    notes: '',
    image_feedback: '',
    status: 'todo',
    read_request_by: null,
  });
  const [savingCard, setSavingCard] = useState(false);

  // New Card Form Toggle
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({
    card_number: '',
    name: '',
    meaning: '',
    keywords: '',
    one_line: '',
    notes: '',
    image_feedback: '',
    status: 'todo' as CardStatus,
  });
  const [creatingCard, setCreatingCard] = useState(false);
  const [uploadingCardId, setUploadingCardId] = useState<string | null>(null);

  // Upload card image to specific slot (0, 1, 2)
  const handleUploadCardImage = async (cardId: string, file: File, slot: number = 0) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('JPG, PNG, WEBP, GIF 이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    const imageUrlFields = ['image_url', 'image_url_2', 'image_url_3'] as const;
    const fieldName = imageUrlFields[slot];

    setUploadingCardId(cardId);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `${deckId}/${cardId}_${slot + 1}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('card-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Image upload error:', uploadError);
        alert('이미지 업로드 실패: ' + uploadError.message);
        setUploadingCardId(null);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('card-images')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Update card in database
      const { error: updateError } = await supabase
        .from('cards')
        .update({ [fieldName]: publicUrl })
        .eq('id', cardId);

      if (updateError) {
        alert('카드 정보 업데이트에 실패했습니다.');
      } else {
        setCards((prev) =>
          prev.map((c) => (c.id === cardId ? { ...c, [fieldName]: publicUrl } : c))
        );
      }
    } catch (err) {
      console.error(err);
      alert('업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadingCardId(null);
    }
  };

  // Remove card image from specific slot
  const handleRemoveCardImage = async (cardId: string, slot: number = 0) => {
    if (!window.confirm('등록된 이미지를 삭제하시겠습니까?')) return;
    const imageUrlFields = ['image_url', 'image_url_2', 'image_url_3'] as const;
    const fieldName = imageUrlFields[slot];
    const { error } = await supabase
      .from('cards')
      .update({ [fieldName]: null })
      .eq('id', cardId);

    if (!error) {
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, [fieldName]: null } : c))
      );
    }
  };

  const fetchDeck = async () => {
    const { data } = await supabase
      .from('decks')
      .select('*')
      .eq('id', deckId)
      .single();
    if (data) setDeck(data);
  };

  const fetchCards = async () => {
    const { data } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .order('card_number', { ascending: true });
    setCards(data || []);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchDeck(), fetchCards()]);
      setLoading(false);
    };
    load();
  }, [deckId]);

  // Toggle Accordion
  const toggleExpand = (card: Card) => {
    if (expandedCardId === card.id) {
      setExpandedCardId(null);
      setEditingCardId(null);
    } else {
      setExpandedCardId(card.id);
      setEditingCardId(null);
    }
  };

  // Start Editing a Card
  const startEdit = (card: Card) => {
    setEditingCardId(card.id);
    setEditForm({
      card_number: card.card_number,
      name: card.name,
      meaning: card.meaning || '',
      keywords: card.keywords || '',
      one_line: card.one_line || '',
      notes: card.notes || '',
      image_feedback: card.image_feedback || '',
      status: card.status,
      read_request_by: null,
    });
  };

  // Save Card Edit
  const handleSaveEdit = async (cardId: string) => {
    setSavingCard(true);

    const updateData: Record<string, unknown> = {
      card_number: editForm.card_number.trim(),
      name: editForm.name.trim(),
      meaning: editForm.meaning.trim() || null,
      keywords: editForm.keywords.trim() || null,
      one_line: editForm.one_line.trim() || null,
      notes: editForm.notes.trim() || null,
      image_feedback: editForm.image_feedback.trim() || null,
      status: editForm.status,
    };

    if (editForm.read_request_by) {
      const editor = editForm.read_request_by;
      updateData.notes_last_editor = editor;
      updateData.feedback_last_editor = editor;
      if (editor === 'doyoung') {
        updateData.notes_read_by_doyoung = true;
        updateData.notes_read_by_hyojae = false;
        updateData.feedback_read_by_doyoung = true;
        updateData.feedback_read_by_hyojae = false;
      } else {
        updateData.notes_read_by_doyoung = false;
        updateData.notes_read_by_hyojae = true;
        updateData.feedback_read_by_doyoung = false;
        updateData.feedback_read_by_hyojae = true;
      }
    }

    const result = await supabase
      .from('cards')
      .update(updateData)
      .eq('id', cardId);

    if (result.error && result.error.message) {
      console.error('Save error:', JSON.stringify(result.error, null, 2));
      alert(`저장 실패: ${result.error.message}`);
      setSavingCard(false);
      return;
    }
    setEditingCardId(null);
    setExpandedCardId(null);
    setSavingCard(false);
    await fetchCards();
  };

  // Quick Status Change directly from view
  const handleQuickStatusChange = async (card: Card, newStatus: CardStatus) => {
    const { error } = await supabase
      .from('cards')
      .update({ status: newStatus })
      .eq('id', card.id);

    if (!error) {
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, status: newStatus } : c))
      );
    }
  };

  // Feedback: 읽음요청 (내가 수정했으니 상대방에게 읽어달라고 알림)
  const handleFeedbackReadRequest = async (cardId: string, editor: 'doyoung' | 'hyojae') => {
    const updateData: Record<string, unknown> = {
      feedback_last_editor: editor,
    };
    if (editor === 'doyoung') {
      updateData.feedback_read_by_hyojae = false;
      updateData.feedback_read_by_doyoung = true;
    } else {
      updateData.feedback_read_by_doyoung = false;
      updateData.feedback_read_by_hyojae = true;
    }

    const { error } = await supabase
      .from('cards')
      .update(updateData)
      .eq('id', cardId);

    if (!error) {
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, ...updateData } as Card : c))
      );
    }
  };

  // Feedback: 읽음확인 (내가 읽었다고 표시)
  const handleFeedbackReadConfirm = async (cardId: string, reader: 'doyoung' | 'hyojae') => {
    const fieldName = reader === 'doyoung' ? 'feedback_read_by_doyoung' : 'feedback_read_by_hyojae';

    const { error } = await supabase
      .from('cards')
      .update({ [fieldName]: true })
      .eq('id', cardId);

    if (!error) {
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, [fieldName]: true } as Card : c))
      );
    }
  };

  // Notes(이미지 설명): 읽음요청
  const handleNotesReadRequest = async (cardId: string, editor: 'doyoung' | 'hyojae') => {
    const updateData: Record<string, unknown> = {
      notes_last_editor: editor,
    };
    if (editor === 'doyoung') {
      updateData.notes_read_by_hyojae = false;
      updateData.notes_read_by_doyoung = true;
    } else {
      updateData.notes_read_by_doyoung = false;
      updateData.notes_read_by_hyojae = true;
    }

    const { error } = await supabase
      .from('cards')
      .update(updateData)
      .eq('id', cardId);

    if (!error) {
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, ...updateData } as Card : c))
      );
    }
  };

  // Notes(이미지 설명): 읽음확인
  const handleNotesReadConfirm = async (cardId: string, reader: 'doyoung' | 'hyojae') => {
    const fieldName = reader === 'doyoung' ? 'notes_read_by_doyoung' : 'notes_read_by_hyojae';

    const { error } = await supabase
      .from('cards')
      .update({ [fieldName]: true })
      .eq('id', cardId);

    if (!error) {
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, [fieldName]: true } as Card : c))
      );
    }
  };

  // Delete Card
  const handleDeleteCard = async (card: Card) => {
    if (!window.confirm(`"${card.name}" 카드를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('cards').delete().eq('id', card.id);
    if (!error) {
      setExpandedCardId(null);
      await fetchCards();
    }
  };

  // Create New Card
  const handleCreateCard = async () => {
    if (!newCard.card_number.trim() || !newCard.name.trim()) {
      alert('카드 번호와 카드명은 필수입니다.');
      return;
    }
    setCreatingCard(true);

    const { data: created, error } = await supabase
      .from('cards')
      .insert({
        deck_id: deckId,
        card_number: newCard.card_number.trim(),
        name: newCard.name.trim(),
        meaning: newCard.meaning.trim() || null,
        keywords: newCard.keywords.trim() || null,
        one_line: newCard.one_line.trim() || null,
        notes: newCard.notes.trim() || null,
        image_feedback: newCard.image_feedback.trim() || null,
        status: newCard.status,
      })
      .select()
      .single();

    if (error || !created) {
      alert('카드 추가에 실패했습니다.');
      setCreatingCard(false);
      return;
    }

    // Reset Form
    setNewCard({
      card_number: '',
      name: '',
      meaning: '',
      keywords: '',
      one_line: '',
      notes: '',
      image_feedback: '',
      status: 'todo',
    });
    setShowAddCard(false);
    await fetchCards();
    setExpandedCardId(created.id); // Auto expand newly created card
    setCreatingCard(false);
  };

  // TXT Download Helper
  const downloadTextFile = (filename: string, text: string) => {
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Export Entire Deck as TXT
  const handleExportDeckTxt = () => {
    if (!deck) return;
    const now = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    let content = '';
    content += `=================================================================\n`;
    content += `TAROT LAB — [${deck.name}]\n`;
    content += `작성일시: ${now}\n`;
    content += `총 카드 수: ${cards.length}장\n`;
    content += `=================================================================\n\n`;

    if (cards.length === 0) {
      content += `(등록된 카드가 없습니다.)\n`;
    } else {
      cards.forEach((card, index) => {
        content += `-----------------------------------------------------------------\n`;
        content += `[${card.card_number || `${index + 1}`}] ${card.name}  (상태: ${STATUS_LABELS[card.status]})\n`;
        content += `-----------------------------------------------------------------\n`;
        if (card.meaning) {
          content += `■ 카드의 뜻:\n${card.meaning}\n\n`;
        }
        if (card.keywords) {
          content += `■ 키워드:\n${card.keywords}\n\n`;
        }
        if (card.one_line) {
          content += `■ 한 줄 해석:\n${card.one_line}\n\n`;
        }
        if (card.notes) {
          content += `■ 카드 이미지 설명:\n${card.notes}\n\n`;
        }
        if (card.image_feedback) {
          content += `■ 그림 피드백:\n${card.image_feedback}\n\n`;
        }
        content += `\n`;
      });
    }

    const safeDeckName = deck.name.replace(/[/\\?%*:|"<>]/g, '_');
    downloadTextFile(`${safeDeckName}_전체카드_정리노트.txt`, content);
  };

  const filteredCards = cards.filter((card) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      card.name.toLowerCase().includes(q) ||
      card.card_number.toLowerCase().includes(q) ||
      (card.meaning && card.meaning.toLowerCase().includes(q)) ||
      (card.keywords && card.keywords.toLowerCase().includes(q)) ||
      (card.one_line && card.one_line.toLowerCase().includes(q)) ||
      (card.notes && card.notes.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-charcoal-light py-20">
        불러오는 중...
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-charcoal-light gap-4 py-20">
        <p>덱을 찾을 수 없습니다.</p>
        <Link href="/#deck-list" className="text-brown hover:underline">← 덱 목록으로 돌아가기</Link>
      </div>
    );
  }

  return (
    <main className="flex-1 pb-16">
      {/* Header */}
      <header className="border-b border-beige-dark/50 bg-warm-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <Link
            href="/#deck-list"
            className="inline-flex items-center text-xs text-charcoal-light hover:text-brown font-medium tracking-wider mb-2"
          >
            ← 덱 목록
          </Link>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-charcoal">
                {deck.name}
              </h1>
              <p className="text-xs text-charcoal-light mt-0.5">
                총 {cards.length}장의 카드
              </p>
            </div>

            {/* TXT Export Button */}
            <button
              onClick={handleExportDeckTxt}
              title="현재 덱의 모든 카드 정보를 TXT 파일로 다운로드합니다"
              className="flex items-center gap-1.5 px-4 py-2 bg-beige border border-beige-dark/60 rounded-xl text-xs font-semibold text-charcoal hover:bg-beige-dark hover:shadow-xs transition-all shrink-0"
            >
              <span>📥</span>
              <span>전체 카드 다운로드</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 pt-6">
        {/* Top Actions: Add Card Button & Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button
            onClick={() => setShowAddCard(!showAddCard)}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-xs ${showAddCard
                ? 'bg-beige-dark text-charcoal'
                : 'bg-charcoal text-ivory hover:bg-brown-dark'
              }`}
          >
            {showAddCard ? '✕ 입력창 닫기' : '+ 카드 추가'}
          </button>
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-light/60 text-xs">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="카드명, 뜻, 키워드, 메모 검색..."
              className="w-full pl-9 pr-4 py-2 bg-warm-white border border-beige-dark/60 rounded-xl text-charcoal placeholder:text-charcoal-light/40 text-sm focus:border-gold"
            />
          </div>
        </div>

        {/* Inline New Card Form (Collapsible) */}
        {showAddCard && (
          <div className="bg-warm-white border-2 border-gold/40 rounded-2xl p-6 mb-6 shadow-md animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-beige-dark/30">
              <h2 className="text-base font-bold text-charcoal">✨ 새 카드 등록</h2>
              <span className="text-xs text-charcoal-light">바로 등록 후 목록에 펼쳐집니다</span>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[11px] font-semibold text-charcoal-light mb-1">번호 *</label>
                  <input
                    type="text"
                    value={newCard.card_number}
                    onChange={(e) => setNewCard({ ...newCard, card_number: e.target.value })}
                    placeholder="01"
                    className="w-full px-3 py-2 bg-ivory border border-beige-dark/60 rounded-lg text-sm text-charcoal"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-charcoal-light mb-1">카드명 *</label>
                  <input
                    type="text"
                    value={newCard.name}
                    onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                    placeholder="예: 딥 브라운, 바보, 여황제"
                    className="w-full px-3 py-2 bg-ivory border border-beige-dark/60 rounded-lg text-sm text-charcoal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-charcoal-light mb-1">카드의 뜻</label>
                <textarea
                  value={newCard.meaning}
                  onChange={(e) => setNewCard({ ...newCard, meaning: e.target.value })}
                  rows={3}
                  placeholder="카드의 기본 상징과 의미..."
                  className="w-full px-3 py-2 bg-ivory border border-beige-dark/60 rounded-lg text-sm text-charcoal leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-charcoal-light mb-1">키워드</label>
                <input
                  type="text"
                  value={newCard.keywords}
                  onChange={(e) => setNewCard({ ...newCard, keywords: e.target.value })}
                  placeholder="안정, 신뢰, 집착"
                  className="w-full px-3 py-2 bg-ivory border border-beige-dark/60 rounded-lg text-sm text-charcoal"
                />
              </div>

              <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-brown/30 shadow-2xs">
                <label className="block text-xs font-bold text-brown-dark mb-1.5 flex items-center gap-1.5">
                  <span>🖼️ 카드 이미지 설명</span>
                  <span className="text-[10px] font-normal text-charcoal-light/70">(프롬프트 / 비주얼 묘사)</span>
                </label>
                <textarea
                  value={newCard.notes}
                  onChange={(e) => setNewCard({ ...newCard, notes: e.target.value })}
                  rows={4}
                  placeholder="카드의 비주얼, 배경, 인물, 색감, 상징물 등 생성할 이미지에 대한 상세 설명을 적어두세요..."
                  className="w-full px-3 py-2 bg-white border border-brown/30 focus:border-brown-dark rounded-lg text-sm text-charcoal leading-relaxed placeholder:text-charcoal-light/40"
                />
              </div>

              <div className="bg-[#F0F7FF] p-3.5 rounded-xl border border-blue-200 shadow-2xs">
                <label className="block text-xs font-bold text-blue-800 mb-1.5 flex items-center gap-1.5">
                  <span>💬 그림 피드백</span>
                  <span className="text-[10px] font-normal text-blue-600/70">(수정 사항 / 피드백 의견)</span>
                </label>
                <textarea
                  value={newCard.image_feedback}
                  onChange={(e) => setNewCard({ ...newCard, image_feedback: e.target.value })}
                  rows={3}
                  placeholder="생성된 이미지에 대한 피드백이나 수정 요청 사항을 적어주세요..."
                  className="w-full px-3 py-2 bg-white border border-blue-200 focus:border-blue-500 rounded-lg text-sm text-charcoal leading-relaxed placeholder:text-charcoal-light/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-charcoal-light mb-1">작업 상태</label>
                <div className="flex gap-2">
                  {(['todo', 'working', 'done'] as CardStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNewCard({ ...newCard, status: s })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${newCard.status === s
                          ? s === 'todo'
                            ? 'bg-gray-200 text-gray-800 border-gray-400 font-bold'
                            : s === 'working'
                              ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold'
                          : 'bg-warm-white text-charcoal-light border-beige-dark/50'
                        }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCard(false)}
                  className="flex-1 py-2.5 border border-beige-dark/60 rounded-xl text-xs text-charcoal-light hover:bg-beige"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleCreateCard}
                  disabled={creatingCard || !newCard.name.trim()}
                  className="flex-1 py-2.5 bg-charcoal text-ivory rounded-xl text-xs font-medium hover:bg-brown-dark disabled:opacity-50"
                >
                  {creatingCard ? '저장 중...' : '카드 등록'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Accordion Card List */}
        {filteredCards.length === 0 ? (
          <div className="text-center py-16 bg-warm-white border border-dashed border-beige-dark/50 rounded-2xl p-8">
            <p className="text-charcoal-light text-sm mb-4">
              {searchQuery ? '검색 결과가 없습니다.' : '아직 등록된 카드가 없습니다.'}
            </p>
            {!searchQuery && !showAddCard && (
              <button
                onClick={() => setShowAddCard(true)}
                className="px-5 py-2.5 bg-charcoal text-ivory rounded-xl text-xs font-medium hover:bg-brown-dark"
              >
                + 첫 번째 카드 추가하기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCards.map((card) => {
              const isExpanded = expandedCardId === card.id;
              const isEditing = editingCardId === card.id;

              return (
                <div
                  key={card.id}
                  className={`bg-warm-white border rounded-2xl transition-all duration-200 overflow-hidden ${isExpanded
                      ? 'border-brown/50 shadow-md ring-1 ring-brown/20'
                      : 'border-beige-dark/40 hover:border-brown/30 shadow-xs'
                    }`}
                >
                  {/* Card Row Header (Click to Expand / Collapse) */}
                  <div
                    onClick={() => toggleExpand(card)}
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none hover:bg-ivory/50 transition-colors"
                  >
                    {/* Number Badge or Thumbnail */}
                    {card.image_url ? (
                      <div className="w-9 h-9 rounded-lg overflow-hidden border border-brown/30 shadow-2xs shrink-0 bg-charcoal">
                        <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <span className="w-9 h-9 rounded-lg bg-beige/80 border border-beige-dark/40 flex items-center justify-center text-xs font-mono font-bold text-charcoal shrink-0">
                        {card.card_number || '•'}
                      </span>
                    )}

                    {/* Name & Quick keywords snippet */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {card.image_url && card.card_number && (
                          <span className="text-[11px] font-mono font-bold text-brown px-1.5 py-0.5 bg-beige/60 rounded">
                            #{card.card_number}
                          </span>
                        )}
                        <span className="text-sm font-bold text-charcoal truncate">
                          {card.name}
                        </span>
                      </div>
                      {card.keywords && !isExpanded && (
                        <p className="text-xs text-charcoal-light/70 truncate mt-0.5">
                          {card.keywords}
                        </p>
                      )}
                    </div>

                    {/* 읽어주세요 뱃지 */}
                    {(
                      (card.notes && (!card.notes_read_by_doyoung || !card.notes_read_by_hyojae)) ||
                      (card.image_feedback && (!card.feedback_read_by_doyoung || !card.feedback_read_by_hyojae))
                    ) && (
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-red-500 text-white shrink-0 animate-pulse shadow-sm">
                        📢 읽어주세요!
                      </span>
                    )}

                    {/* Status badge */}
                    <span
                      onClick={(e) => e.stopPropagation()}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0 ${STATUS_COLORS[card.status]}`}
                    >
                      {STATUS_LABELS[card.status]}
                    </span>

                    {/* Expand/Collapse Arrow */}
                    <span className="text-xs text-charcoal-light/60 shrink-0 ml-1 transition-transform duration-200">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* Expanded Content: In-place View or Edit */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 border-t border-beige-dark/20 bg-warm-white animate-in fade-in duration-150">
                      {!isEditing ? (
                        /* VIEW MODE */
                        <div className="space-y-4">
                          {/* Meaning */}
                          {card.meaning && (
                            <div>
                              <h4 className="text-[11px] font-bold text-charcoal-light tracking-wider uppercase mb-1">
                                📖 카드의 뜻
                              </h4>
                              <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap bg-ivory/60 p-3 rounded-xl border border-beige-dark/20">
                                {card.meaning}
                              </p>
                            </div>
                          )}

                          {/* Keywords */}
                          {card.keywords && (
                            <div>
                              <h4 className="text-[11px] font-bold text-charcoal-light tracking-wider uppercase mb-1">
                                🏷️ 키워드
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {card.keywords.split(/[,·\s]+/).filter(Boolean).map((kw, i) => (
                                  <span
                                    key={i}
                                    className="text-xs bg-beige px-2.5 py-1 rounded-md text-charcoal font-medium"
                                  >
                                    #{kw}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Notes (Image Description) - Always Show */}
                          <div className="bg-gradient-to-br from-[#FAF7EE] to-[#F5EEE6] p-4 rounded-2xl border-2 border-brown/30 shadow-xs">
                            <h4 className="text-xs font-bold text-brown-dark tracking-wide mb-1.5 flex items-center gap-1.5">
                              <span>🖼️ 카드 이미지 설명</span>
                              <span className="text-[10px] font-normal text-brown/70">(비주얼 / 프롬프트)</span>
                            </h4>
                            {card.notes ? (
                              <p className="text-sm text-charcoal font-medium leading-relaxed whitespace-pre-wrap">
                                {card.notes}
                              </p>
                            ) : (
                              <p className="text-xs text-charcoal-light/60 italic">
                                작성된 설명이 없습니다. (수정 버튼을 눌러 작성해주세요)
                              </p>
                            )}

                            {card.notes_last_editor && (!card.notes_read_by_doyoung || !card.notes_read_by_hyojae) && (
                              <div className="mt-2 flex gap-2">
                                {!card.notes_read_by_doyoung && (
                                  <button
                                    type="button"
                                    onClick={() => handleNotesReadConfirm(card.id, 'doyoung')}
                                    className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                  >
                                    ✅ 점술신 읽었어요
                                  </button>
                                )}
                                {!card.notes_read_by_hyojae && (
                                  <button
                                    type="button"
                                    onClick={() => handleNotesReadConfirm(card.id, 'hyojae')}
                                    className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                  >
                                    ✅ 로율 읽었어요
                                  </button>
                                )}
                              </div>
                            )}

                          </div>

                          {/* Image Section (Upload & Preview) - 최대 3장 */}
                          <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-brown/30 shadow-2xs space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-brown-dark tracking-wide flex items-center gap-1.5">
                                <span>🎨 카드 이미지 (최대 3장)</span>
                                {(() => {
                                  const count = [card.image_url, card.image_url_2, card.image_url_3].filter(Boolean).length;
                                  return count > 0 ? (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                      {count}장 등록
                                    </span>
                                  ) : null;
                                })()}
                              </h4>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { url: card.image_url, slot: 0 },
                                { url: card.image_url_2, slot: 1 },
                                { url: card.image_url_3, slot: 2 },
                              ].map(({ url, slot }) => (
                                <div key={slot} className="relative">
                                  {url ? (
                                    <div className="space-y-2">
                                      <div className="rounded-xl overflow-hidden border-2 border-brown/30 shadow-md bg-warm-white">
                                        <img
                                          src={url}
                                          alt={`${card.name} ${slot + 1}`}
                                          className="w-full h-auto object-contain max-h-48"
                                        />
                                      </div>
                                      <div className="flex items-center justify-center gap-1">
                                        <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 bg-beige hover:bg-beige-dark text-charcoal rounded-lg text-[10px] font-semibold border border-beige-dark/60 transition-colors">
                                          <span>🔄</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            disabled={uploadingCardId === card.id}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) handleUploadCardImage(card.id, file, slot);
                                            }}
                                          />
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveCardImage(card.id, slot)}
                                          className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg text-[10px] font-semibold border border-red-200 transition-colors"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <label className="flex flex-col items-center justify-center aspect-[2/3] border-2 border-dashed border-brown/30 hover:border-brown rounded-xl bg-white hover:bg-ivory/60 cursor-pointer transition-all group">
                                      {uploadingCardId === card.id ? (
                                        <div className="flex items-center gap-1 text-brown-dark font-medium text-[10px]">
                                          <span className="animate-spin text-sm">⏳</span>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="text-xl mb-1 group-hover:scale-110 transition-transform">📷</div>
                                          <span className="text-[10px] font-bold text-charcoal group-hover:text-brown-dark">
                                            사진 {slot + 1}
                                          </span>
                                        </>
                                      )}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        disabled={uploadingCardId === card.id}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleUploadCardImage(card.id, file, slot);
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Image Feedback - Always Show under Images */}
                          <div className="bg-[#F0F7FF] p-4 rounded-2xl border-2 border-blue-200 shadow-xs">
                            <h4 className="text-xs font-bold text-blue-800 tracking-wide mb-1.5 flex items-center gap-1.5">
                              <span>💬 그림 피드백</span>
                              <span className="text-[10px] font-normal text-blue-600/70">(수정 사항 / 피드백 의견)</span>
                            </h4>
                            {card.image_feedback ? (
                              <p className="text-sm text-charcoal font-medium leading-relaxed whitespace-pre-wrap">
                                {card.image_feedback}
                              </p>
                            ) : (
                              <p className="text-xs text-charcoal-light/60 italic">
                                작성된 피드백이 없습니다. (수정 버튼을 눌러 작성해주세요)
                              </p>
                            )}

                            {card.feedback_last_editor && (!card.feedback_read_by_doyoung || !card.feedback_read_by_hyojae) && (
                              <div className="mt-2 flex gap-2">
                                {!card.feedback_read_by_doyoung && (
                                  <button
                                    type="button"
                                    onClick={() => handleFeedbackReadConfirm(card.id, 'doyoung')}
                                    className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                  >
                                    ✅ 점술신 읽었어요
                                  </button>
                                )}
                                {!card.feedback_read_by_hyojae && (
                                  <button
                                    type="button"
                                    onClick={() => handleFeedbackReadConfirm(card.id, 'hyojae')}
                                    className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                  >
                                    ✅ 로율 읽었어요
                                  </button>
                                )}
                              </div>
                            )}

                          </div>

                          {/* Status quick toggle */}
                          <div>
                            <h4 className="text-[11px] font-bold text-charcoal-light tracking-wider uppercase mb-1.5">
                              상태 변경
                            </h4>
                            <div className="flex gap-2">
                              {(['todo', 'working', 'done'] as CardStatus[]).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => handleQuickStatusChange(card, s)}
                                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${card.status === s
                                      ? s === 'todo'
                                        ? 'bg-gray-200 text-gray-800 border-gray-400 font-bold'
                                        : s === 'working'
                                          ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold'
                                          : 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold'
                                      : 'bg-warm-white text-charcoal-light border-beige-dark/50 hover:bg-beige'
                                    }`}
                                >
                                  {STATUS_LABELS[s]}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Action Buttons: Edit & Delete */}
                          <div className="flex gap-2 pt-3 border-t border-beige-dark/30">
                            <button
                              onClick={() => startEdit(card)}
                              className="flex-1 py-2 bg-charcoal text-ivory rounded-xl text-xs font-medium hover:bg-brown-dark"
                            >
                              ✏️ 카드 내용 수정
                            </button>
                            <button
                              onClick={() => handleDeleteCard(card)}
                              className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-medium hover:bg-red-50"
                            >
                              🗑️ 삭제
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* EDIT MODE (Inline) */
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between pb-2 border-b border-beige-dark/30">
                            <span className="text-xs font-bold text-charcoal">✏️ 카드 내용 수정</span>
                            <button
                              onClick={() => setEditingCardId(null)}
                              className="text-xs text-charcoal-light hover:text-charcoal"
                            >
                              취소
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-charcoal-light mb-1">번호</label>
                              <input
                                type="text"
                                value={editForm.card_number}
                                onChange={(e) => setEditForm({ ...editForm, card_number: e.target.value })}
                                className="w-full px-3 py-2 bg-ivory border border-beige-dark/60 rounded-lg text-sm text-charcoal"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[11px] font-semibold text-charcoal-light mb-1">카드명</label>
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="w-full px-3 py-2 bg-ivory border border-beige-dark/60 rounded-lg text-sm text-charcoal"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-charcoal-light mb-1">카드의 뜻</label>
                            <textarea
                              value={editForm.meaning}
                              onChange={(e) => setEditForm({ ...editForm, meaning: e.target.value })}
                              rows={3}
                              className="w-full px-3 py-2 bg-ivory border border-beige-dark/60 rounded-lg text-sm text-charcoal"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-charcoal-light mb-1">키워드</label>
                            <input
                              type="text"
                              value={editForm.keywords}
                              onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })}
                              placeholder="안정, 신뢰, 집착"
                              className="w-full px-3 py-2 bg-ivory border border-beige-dark/60 rounded-lg text-sm text-charcoal"
                            />
                          </div>

                          <div className="bg-[#FAF8F5] p-3.5 rounded-xl border-2 border-brown/30 shadow-2xs">
                            <label className="block text-xs font-bold text-brown-dark mb-1.5 flex items-center gap-1.5">
                              <span>🖼️ 카드 이미지 설명</span>
                              <span className="text-[10px] font-normal text-charcoal-light/70">(프롬프트 / 비주얼 묘사)</span>
                            </label>
                            <textarea
                              value={editForm.notes}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                              rows={4}
                              placeholder="카드의 비주얼, 배경, 인물, 색감, 상징물 등 생성할 이미지에 대한 상세 설명을 적어두세요..."
                              className="w-full px-3 py-2 bg-white border border-brown/30 focus:border-brown-dark rounded-lg text-sm text-charcoal leading-relaxed placeholder:text-charcoal-light/40"
                            />
                            
                            {/* Image Upload in Edit Mode - 최대 3장 */}
                            <div className="mt-4 pt-4 border-t border-brown/20">
                              <label className="block text-xs font-bold text-brown-dark mb-2">🎨 카드 이미지 업로드 (최대 3장)</label>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { url: card.image_url, slot: 0 },
                                  { url: card.image_url_2, slot: 1 },
                                  { url: card.image_url_3, slot: 2 },
                                ].map(({ url, slot }) => (
                                  <div key={slot} className="relative">
                                    {url ? (
                                      <div className="space-y-1">
                                        <div className="rounded-lg overflow-hidden border-2 border-brown/30">
                                          <img src={url} alt={`preview ${slot + 1}`} className="w-full h-auto" />
                                        </div>
                                        <div className="flex items-center justify-center gap-1">
                                          <label className="cursor-pointer inline-flex items-center gap-1 px-1.5 py-0.5 bg-white hover:bg-beige-dark text-charcoal rounded-md text-[10px] font-semibold border border-beige-dark/60 transition-colors">
                                            <span>🔄</span>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              disabled={uploadingCardId === card.id}
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleUploadCardImage(card.id, file, slot);
                                              }}
                                            />
                                          </label>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveCardImage(card.id, slot)}
                                            className="px-1.5 py-0.5 text-red-600 hover:bg-red-50 rounded-md text-[10px] font-semibold border border-red-200 transition-colors"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <label className="flex flex-col items-center justify-center aspect-[2/3] border-2 border-dashed border-brown/30 hover:border-brown rounded-lg bg-white cursor-pointer transition-all group">
                                        {uploadingCardId === card.id ? (
                                          <span className="text-[10px] font-medium text-brown-dark">⏳</span>
                                        ) : (
                                          <>
                                            <span className="text-lg group-hover:scale-110 transition-transform">📷</span>
                                            <span className="text-[9px] font-bold text-charcoal mt-0.5">사진 {slot + 1}</span>
                                          </>
                                        )}
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          disabled={uploadingCardId === card.id}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleUploadCardImage(card.id, file, slot);
                                          }}
                                        />
                                      </label>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="bg-[#F0F7FF] p-3.5 rounded-xl border-2 border-blue-200 shadow-2xs">
                            <label className="block text-xs font-bold text-blue-800 mb-1.5 flex items-center gap-1.5">
                              <span>💬 그림 피드백</span>
                              <span className="text-[10px] font-normal text-blue-600/70">(수정 사항 / 피드백 의견)</span>
                            </label>
                            <textarea
                              value={editForm.image_feedback}
                              onChange={(e) => setEditForm({ ...editForm, image_feedback: e.target.value })}
                              rows={4}
                              placeholder="생성된 이미지에 대한 피드백이나 수정 요청 사항을 적어주세요..."
                              className="w-full px-3 py-2 bg-white border border-blue-200 focus:border-blue-500 rounded-lg text-sm text-charcoal leading-relaxed placeholder:text-charcoal-light/40"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-charcoal-light mb-1">상태</label>
                            <div className="flex gap-2">
                              {(['todo', 'working', 'done'] as CardStatus[]).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setEditForm({ ...editForm, status: s })}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${editForm.status === s
                                      ? s === 'todo'
                                        ? 'bg-gray-200 text-gray-800 border-gray-400 font-bold'
                                        : s === 'working'
                                          ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold'
                                          : 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold'
                                      : 'bg-warm-white text-charcoal-light border-beige-dark/50'
                                    }`}
                                >
                                  {STATUS_LABELS[s]}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 읽음요청 - 저장 시 누가 수정했는지 선택 */}
                          <div className="bg-gradient-to-r from-amber-50 to-blue-50 p-3 rounded-xl border border-amber-200/60">
                            <label className="block text-[11px] font-bold text-charcoal mb-2">
                              📢 읽음요청 (저장할 때 상대방에게 알림)
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setEditForm({ ...editForm, read_request_by: editForm.read_request_by === 'doyoung' ? null : 'doyoung' })}
                                className={`flex-1 py-2 text-[11px] font-semibold rounded-lg border transition-colors ${
                                  editForm.read_request_by === 'doyoung'
                                    ? 'bg-amber-100 text-amber-900 border-amber-400 ring-2 ring-amber-300'
                                    : 'bg-white text-charcoal-light border-beige-dark/50 hover:bg-beige'
                                }`}
                              >
                                {editForm.read_request_by === 'doyoung' ? '✅ ' : ''}점술신이 수정함
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditForm({ ...editForm, read_request_by: editForm.read_request_by === 'hyojae' ? null : 'hyojae' })}
                                className={`flex-1 py-2 text-[11px] font-semibold rounded-lg border transition-colors ${
                                  editForm.read_request_by === 'hyojae'
                                    ? 'bg-amber-100 text-amber-900 border-amber-400 ring-2 ring-amber-300'
                                    : 'bg-white text-charcoal-light border-beige-dark/50 hover:bg-beige'
                                }`}
                              >
                                {editForm.read_request_by === 'hyojae' ? '✅ ' : ''}로율이 수정함
                              </button>
                            </div>
                            {editForm.read_request_by && (
                              <p className="text-[10px] text-amber-700 mt-1.5 font-medium">
                                저장하면 카드 목록에 📢 읽어주세요! 표시가 뜹니다
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setEditingCardId(null)}
                              className="flex-1 py-2 border border-beige-dark/60 rounded-xl text-xs text-charcoal-light hover:bg-beige"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(card.id)}
                              disabled={savingCard || !editForm.name.trim()}
                              className="flex-1 py-2 bg-charcoal text-ivory rounded-xl text-xs font-medium hover:bg-brown-dark disabled:opacity-50"
                            >
                              {savingCard ? '저장 중...' : '저장 완료'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
