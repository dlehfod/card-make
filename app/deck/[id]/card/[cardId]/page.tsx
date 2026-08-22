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
  const [editStatus, setEditStatus] = useState<CardStatus>('todo');
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

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
    setEditStatus(c.status);
    setEditImagePreview(c.image_url);
  };

  useEffect(() => {
    fetchData();
  }, [deckId, cardId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('JPG, PNG, WEBP 파일만 업로드할 수 있습니다.');
      return;
    }

    setEditImage(file);
    setEditImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const fileName = `${deckId}/${cardId}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('card-images')
      .upload(fileName, file, { upsert: true });

    if (error) {
      console.error('Image upload error:', error);
      return null;
    }

    const { data } = supabase.storage
      .from('card-images')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!card) return;
    setSaving(true);

    let imageUrl = card.image_url;

    if (editImage) {
      const uploaded = await uploadImage(editImage);
      if (uploaded) {
        imageUrl = uploaded;
      } else {
        alert('이미지 업로드에 실패했습니다.');
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase
      .from('cards')
      .update({
        name: editName.trim(),
        meaning: editMeaning.trim() || null,
        keywords: editKeywords.trim() || null,
        one_line: editOneLine.trim() || null,
        notes: editNotes.trim() || null,
        status: editStatus,
        image_url: imageUrl,
      })
      .eq('id', cardId);

    if (error) {
      console.error('Error saving card:', error);
      alert('저장에 실패했습니다.');
    } else {
      setIsEditing(false);
      setEditImage(null);
      await fetchData();
    }
    setSaving(false);
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
          {/* Card Image */}
          {card.image_url && (
            <div className="mb-8 flex justify-center">
              <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-lg bg-warm-white border border-beige-dark/30">
                <img
                  src={card.image_url}
                  alt={card.name}
                  className="w-full h-auto object-contain"
                />
              </div>
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
            {card.one_line && (
              <div>
                <h3 className="text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
                  한 줄 해석
                </h3>
                <p className="text-charcoal italic">
                  {card.one_line}
                </p>
              </div>
            )}

            {/* Notes */}
            {card.notes && (
              <div>
                <h3 className="text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
                  메모
                </h3>
                <p className="text-charcoal leading-relaxed whitespace-pre-wrap">
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

          {/* Image */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              카드 이미지
            </label>
            {editImagePreview && (
              <div className="mb-3 w-40 rounded-xl overflow-hidden border border-beige-dark/30">
                <img src={editImagePreview} alt="preview" className="w-full h-auto" />
              </div>
            )}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={handleImageChange}
              className="text-sm text-charcoal-light file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-beige file:text-charcoal file:font-medium file:cursor-pointer hover:file:bg-beige-dark"
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

          {/* One Line */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              한 줄 해석
            </label>
            <input
              type="text"
              value={editOneLine}
              onChange={(e) => setEditOneLine(e.target.value)}
              className="w-full px-4 py-3 bg-warm-white border border-beige-dark/50 rounded-xl text-charcoal"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              메모
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 bg-warm-white border border-beige-dark/50 rounded-xl text-charcoal resize-y"
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
