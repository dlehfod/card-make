'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Deck, Card, CardStatus, STATUS_LABELS, STATUS_COLORS } from '@/lib/types';

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.id as string;
  const cardId = params.cardId as string;

  const [deck, setDeck] = useState<Deck | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editMeaning, setEditMeaning] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [editOneLine, setEditOneLine] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editImageFeedback, setEditImageFeedback] = useState('');
  const [editStatus, setEditStatus] = useState<CardStatus>('todo');
  const [editImages, setEditImages] = useState<(File | null)[]>([null, null, null]);
  const [editImagePreviews, setEditImagePreviews] = useState<(string | null)[]>([null, null, null]);

  const fetchData = async () => {
    setLoading(true);
    const [deckRes, cardRes] = await Promise.all([
      supabase.from('decks').select('*').eq('id', deckId).single(),
      supabase.from('cards').select('*').eq('id', cardId).single(),
    ]);

    if (deckRes.data) setDeck(deckRes.data);
    if (cardRes.data) {
      setCard(cardRes.data);
      populateEditForm(cardRes.data);
    }
    setLoading(false);
  };

  const populateEditForm = (c: Card) => {
    setEditName(c.name);
    setEditMeaning(c.meaning || '');
    setEditKeywords(c.keywords || '');
    setEditOneLine(c.one_line || '');
    setEditNotes(c.notes || '');
    setEditImageFeedback(c.image_feedback || '');
    setEditStatus(c.status);
    setEditImagePreviews([c.image_url, c.image_url_2, c.image_url_3]);
    setEditImages([null, null, null]);
  };

  useEffect(() => {
    fetchData();
  }, [deckId, cardId]);

  const handleImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('JPG, PNG, WEBP 파일만 업로드할 수 있습니다.');
      return;
    }

    const newFiles = [...editImages];
    newFiles[index] = file;
    setEditImages(newFiles);

    const newPreviews = [...editImagePreviews];
    newPreviews[index] = URL.createObjectURL(file);
    setEditImagePreviews(newPreviews);
  };

  const handleRemoveEditImage = (index: number) => {
    const newFiles = [...editImages];
    newFiles[index] = null;
    setEditImages(newFiles);

    const newPreviews = [...editImagePreviews];
    // Revoke if it's a blob URL
    if (newPreviews[index]?.startsWith('blob:')) URL.revokeObjectURL(newPreviews[index]!);
    newPreviews[index] = null;
    setEditImagePreviews(newPreviews);
  };


  const handleSave = async () => {
    if (!card) return;
    setSaving(true);

    const imageUrlFields = ['image_url', 'image_url_2', 'image_url_3'] as const;
    const imageUrls: (string | null)[] = [card.image_url, card.image_url_2, card.image_url_3];

    // Upload new images and update removed ones
    for (let i = 0; i < 3; i++) {
      if (editImages[i]) {
        // New file selected for this slot
        const file = editImages[i]!;
        const ext = file.name.split('.').pop();
        const fileName = `${deckId}/${cardId}_${i + 1}_${Date.now()}.${ext}`;

        const { error } = await supabase.storage
          .from('card-images')
          .upload(fileName, file, { upsert: true });

        if (error) {
          console.error(`Image ${i + 1} upload error:`, error);
          alert(`이미지 ${i + 1} 업로드에 실패했습니다.`);
          setSaving(false);
          return;
        }

        const { data } = supabase.storage
          .from('card-images')
          .getPublicUrl(fileName);

        imageUrls[i] = data.publicUrl;
      } else if (editImagePreviews[i] === null) {
        // Image was removed
        imageUrls[i] = null;
      }
      // else: keep existing URL
    }

    const { error } = await supabase
      .from('cards')
      .update({
        name: editName.trim(),
        meaning: editMeaning.trim() || null,
        keywords: editKeywords.trim() || null,
        one_line: editOneLine.trim() || null,
        notes: editNotes.trim() || null,
        image_feedback: editImageFeedback.trim() || null,
        status: editStatus,
        image_url: imageUrls[0],
        image_url_2: imageUrls[1],
        image_url_3: imageUrls[2],
      })
      .eq('id', cardId);

    if (error) {
      console.error('Error saving card:', error);
      alert(`저장에 실패했습니다: ${error.message}`);
      setSaving(false);
      return;
    }
    setIsEditing(false);
    setEditImages([null, null, null]);
    await fetchData();
    setSaving(false);
  };

  const handleFeedbackReadRequest = async (editor: 'doyoung' | 'hyojae') => {
    if (!card) return;
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
      setCard({ ...card, ...updateData } as Card);
    }
  };

  const handleFeedbackReadConfirm = async (reader: 'doyoung' | 'hyojae') => {
    if (!card) return;
    const fieldName = reader === 'doyoung' ? 'feedback_read_by_doyoung' : 'feedback_read_by_hyojae';
    const { error } = await supabase
      .from('cards')
      .update({ [fieldName]: true })
      .eq('id', cardId);
    if (!error) {
      setCard({ ...card, [fieldName]: true } as Card);
    }
  };

  const handleNotesReadRequest = async (editor: 'doyoung' | 'hyojae') => {
    if (!card) return;
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
      setCard({ ...card, ...updateData } as Card);
    }
  };

  const handleNotesReadConfirm = async (reader: 'doyoung' | 'hyojae') => {
    if (!card) return;
    const fieldName = reader === 'doyoung' ? 'notes_read_by_doyoung' : 'notes_read_by_hyojae';
    const { error } = await supabase
      .from('cards')
      .update({ [fieldName]: true })
      .eq('id', cardId);
    if (!error) {
      setCard({ ...card, [fieldName]: true } as Card);
    }
  };

  const handleDelete = async () => {
    if (!card) return;
    const confirmed = window.confirm(`"${card.name}" 카드를 삭제하시겠습니까?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', cardId);

    if (error) {
      console.error('Error deleting card:', error);
      alert('삭제에 실패했습니다.');
    } else {
      router.push(`/deck/${deckId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-charcoal-light">
        불러오는 중...
      </div>
    );
  }

  if (!card || !deck) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-charcoal-light gap-4">
        <p>카드를 찾을 수 없습니다.</p>
        <Link href={`/deck/${deckId}`} className="text-brown hover:underline">← 돌아가기</Link>
      </div>
    );
  }

  // View mode
  if (!isEditing) {
    return (
      <main className="flex-1">
        <header className="border-b border-beige-dark/50 bg-warm-white">
          <div className="max-w-2xl mx-auto px-6 py-6">
            <Link
              href={`/deck/${deckId}`}
              className="inline-flex items-center text-sm text-charcoal-light hover:text-brown"
            >
              ← {deck.name}
            </Link>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Card Images */}
          {(card.image_url || card.image_url_2 || card.image_url_3) && (
            <div className="mb-8">
              <div className={`grid gap-3 ${[card.image_url, card.image_url_2, card.image_url_3].filter(Boolean).length === 1 ? 'grid-cols-1 max-w-sm mx-auto' : [card.image_url, card.image_url_2, card.image_url_3].filter(Boolean).length === 2 ? 'grid-cols-2 max-w-lg mx-auto' : 'grid-cols-3 max-w-2xl mx-auto'}`}>
                {[card.image_url, card.image_url_2, card.image_url_3].map((url, idx) =>
                  url ? (
                    <div key={idx} className="rounded-2xl overflow-hidden shadow-lg bg-warm-white border border-beige-dark/30">
                      <img
                        src={url}
                        alt={`${card.name} ${idx + 1}`}
                        className="w-full h-auto object-contain"
                      />
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Image Feedback (View Mode) */}
          {card.image_feedback && (
            <div className="mb-8 bg-gradient-to-br from-[#EBF5FF] to-[#E1F0FF] p-4 rounded-2xl border-2 border-blue-200 shadow-xs">
              <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <span>💬 그림 피드백</span>
              </h3>
              <p className="text-charcoal font-medium leading-relaxed whitespace-pre-wrap">
                {card.image_feedback}
              </p>
            </div>
          )}

          {/* Card Info */}
          <div className="space-y-8">
            {/* Number and Name */}
            <div>
              <p className="text-sm font-mono text-charcoal-light">{card.card_number}</p>
              <h1 className="text-2xl md:text-3xl font-bold text-charcoal mt-1">
                {card.name}
              </h1>
            </div>

            {/* Meaning */}
            {card.meaning && (
              <div>
                <h3 className="text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
                  카드의 뜻
                </h3>
                <p className="text-charcoal leading-relaxed whitespace-pre-wrap">
                  {card.meaning}
                </p>
              </div>
            )}

            {/* Keywords */}
            {card.keywords && (
              <div>
                <h3 className="text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
                  키워드
                </h3>
                <p className="text-charcoal">
                  {card.keywords}
                </p>
              </div>
            )}

            {/* One Line */}
            {/* Notes (Image Description) */}
            {card.notes && (
              <div className="bg-gradient-to-br from-[#FAF7EE] to-[#F5EEE6] p-4 rounded-2xl border-2 border-brown/30 shadow-xs">
                <h3 className="text-xs font-bold text-brown-dark uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span>🖼️ 카드 이미지 설명</span>
                  <span className="text-[10px] font-normal text-brown/70">(프롬프트 / 비주얼 묘사)</span>
                </h3>
                <p className="text-charcoal font-medium leading-relaxed whitespace-pre-wrap">
                  {card.notes}
                </p>
              </div>
            )}

            {/* Status */}
            <div>
              <h3 className="text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
                상태
              </h3>
              <span className={`inline-block text-sm px-3 py-1.5 rounded-full font-medium ${STATUS_COLORS[card.status]}`}>
                {STATUS_LABELS[card.status]}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-beige-dark/30">
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 py-3 bg-charcoal text-ivory rounded-xl hover:bg-brown-dark font-medium"
              >
                수정
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-3 border border-red-200 text-red-500 rounded-xl hover:bg-red-50 font-medium"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Edit mode
  return (
    <main className="flex-1">
      <header className="border-b border-beige-dark/50 bg-warm-white">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <button
            onClick={() => {
              setIsEditing(false);
              if (card) populateEditForm(card);
            }}
            className="inline-flex items-center text-sm text-charcoal-light hover:text-brown"
          >
            ← 취소
          </button>
          <h2 className="text-xl font-bold text-charcoal mt-2">카드 수정</h2>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Card Name */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              카드명
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-3 bg-warm-white border border-beige-dark/50 rounded-xl text-charcoal"
            />
          </div>

          {/* Images (up to 3) */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              카드 이미지 (최대 3장)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="relative">
                  {editImagePreviews[index] ? (
                    <div className="relative group">
                      <div className="rounded-xl overflow-hidden border border-beige-dark/30 bg-warm-white">
                        <img src={editImagePreviews[index]!} alt={`preview ${index + 1}`} className="w-full h-auto aspect-[2/3] object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEditImage(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                      >
                        ✕
                      </button>
                      <label className="absolute bottom-1 left-1 bg-charcoal/70 hover:bg-charcoal/90 text-white text-[10px] px-1.5 py-0.5 rounded-md cursor-pointer transition-colors">
                        🔄
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp"
                          className="hidden"
                          onChange={(e) => handleImageChange(index, e)}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center aspect-[2/3] border-2 border-dashed border-beige-dark/50 hover:border-brown rounded-xl bg-warm-white hover:bg-beige/30 cursor-pointer transition-all group">
                      <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">📷</div>
                      <span className="text-[10px] text-charcoal-light font-medium">사진 {index + 1}</span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={(e) => handleImageChange(index, e)}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Image Feedback */}
          <div className="bg-[#F0F7FF] p-4 rounded-xl border-2 border-blue-200 shadow-2xs">
            <label className="block text-xs font-bold text-blue-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span>💬 그림 피드백</span>
              <span className="text-[10px] font-normal text-blue-600/70">(수정 사항 / 피드백 의견)</span>
            </label>
            <textarea
              value={editImageFeedback}
              onChange={(e) => setEditImageFeedback(e.target.value)}
              rows={4}
              placeholder="생성된 이미지에 대한 피드백이나 수정 요청 사항을 적어주세요..."
              className="w-full px-4 py-3 bg-white border border-blue-200 focus:border-blue-500 rounded-xl text-charcoal resize-y placeholder:text-charcoal-light/40 leading-relaxed font-medium"
            />
          </div>

          {/* Meaning */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              카드의 뜻
            </label>
            <textarea
              value={editMeaning}
              onChange={(e) => setEditMeaning(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-warm-white border border-beige-dark/50 rounded-xl text-charcoal resize-y"
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              키워드
            </label>
            <input
              type="text"
              value={editKeywords}
              onChange={(e) => setEditKeywords(e.target.value)}
              placeholder="안정, 신뢰, 집착"
              className="w-full px-4 py-3 bg-warm-white border border-beige-dark/50 rounded-xl text-charcoal placeholder:text-charcoal-light/40"
            />
          </div>

          {/* Image Description (Notes) */}
          <div className="bg-[#FAF8F5] p-4 rounded-xl border-2 border-brown/30 shadow-2xs">
            <label className="block text-xs font-bold text-brown-dark uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span>🖼️ 카드 이미지 설명</span>
              <span className="text-[10px] font-normal text-charcoal-light/70">(프롬프트 / 비주얼 묘사)</span>
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={6}
              placeholder="카드의 비주얼, 배경, 인물, 색감, 상징물 등 생성할 이미지에 대한 상세 설명을 적어두세요..."
              className="w-full px-4 py-3 bg-white border border-brown/30 focus:border-brown-dark rounded-xl text-charcoal resize-y placeholder:text-charcoal-light/40 leading-relaxed font-medium"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              상태
            </label>
            <div className="flex gap-2">
              {(['todo', 'working', 'done'] as CardStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setEditStatus(s)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium border ${
                    editStatus === s
                      ? s === 'todo'
                        ? 'bg-gray-200 text-gray-700 border-gray-400'
                        : s === 'working'
                        ? 'bg-amber-100 text-amber-800 border-amber-400'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-400'
                      : 'bg-warm-white text-charcoal-light border-beige-dark/50 hover:bg-beige'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsEditing(false);
                if (card) populateEditForm(card);
              }}
              className="flex-1 py-3 border border-beige-dark/50 rounded-xl text-charcoal-light hover:bg-beige font-medium"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editName.trim()}
              className="flex-1 py-3 bg-charcoal text-ivory rounded-xl hover:bg-brown-dark disabled:opacity-50 font-medium"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
