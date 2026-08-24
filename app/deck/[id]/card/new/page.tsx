'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Deck, CardStatus, STATUS_LABELS } from '@/lib/types';

export default function NewCardPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.id as string;

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [cardNumber, setCardNumber] = useState('');
  const [name, setName] = useState('');
  const [meaning, setMeaning] = useState('');
  const [keywords, setKeywords] = useState('');
  const [oneLine, setOneLine] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<CardStatus>('todo');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeck = async () => {
      const { data } = await supabase
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .single();
      setDeck(data);
      setLoading(false);
    };
    fetchDeck();
  }, [deckId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('JPG, PNG, WEBP 파일만 업로드할 수 있습니다.');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!cardNumber.trim() || !name.trim()) {
      alert('카드 번호와 카드명은 필수입니다.');
      return;
    }

    setSaving(true);

    // First insert the card to get its ID
    const { data: newCard, error: insertError } = await supabase
      .from('cards')
      .insert({
        deck_id: deckId,
        card_number: cardNumber.trim(),
        name: name.trim(),
        meaning: meaning.trim() || null,
        keywords: keywords.trim() || null,
        one_line: oneLine.trim() || null,
        notes: notes.trim() || null,
        status,
      })
      .select()
      .single();

    if (insertError || !newCard) {
      console.error('Error creating card:', insertError);
      alert('카드 생성에 실패했습니다.');
      setSaving(false);
      return;
    }

    // Upload image if provided
    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const fileName = `${deckId}/${newCard.id}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('card-images')
        .upload(fileName, imageFile);

      if (uploadError) {
        console.error('Image upload error:', uploadError);
        // Card is created but image failed - continue anyway
      } else {
        const { data: urlData } = supabase.storage
          .from('card-images')
          .getPublicUrl(fileName);

        // Update card with image URL
        await supabase
          .from('cards')
          .update({ image_url: urlData.publicUrl })
          .eq('id', newCard.id);
      }
    }

    router.push(`/deck/${deckId}`);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-charcoal-light">
        불러오는 중...
      </div>
    );
  }

  return (
    <main className="flex-1">
      <header className="border-b border-beige-dark/50 bg-warm-white">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <Link
            href={`/deck/${deckId}`}
            className="inline-flex items-center text-sm text-charcoal-light hover:text-brown"
          >
            ← {deck?.name || '뒤로'}
          </Link>
          <h2 className="text-xl font-bold text-charcoal mt-2">새 카드 추가</h2>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Card Number */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              카드 번호
            </label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="01"
              className="w-full px-4 py-3 bg-warm-white border border-beige-dark/50 rounded-xl text-charcoal placeholder:text-charcoal-light/40"
              autoFocus
            />
          </div>

          {/* Card Name */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              카드명
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="딥 브라운"
              className="w-full px-4 py-3 bg-warm-white border border-beige-dark/50 rounded-xl text-charcoal placeholder:text-charcoal-light/40"
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              카드 이미지
            </label>
            {imagePreview && (
              <div className="mb-3 w-40 rounded-xl overflow-hidden border border-beige-dark/30">
                <img src={imagePreview} alt="preview" className="w-full h-auto" />
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
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              rows={4}
              placeholder="안정, 현실, 깊이..."
              className="w-full px-4 py-3 bg-warm-white border border-beige-dark/50 rounded-xl text-charcoal resize-y placeholder:text-charcoal-light/40"
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              키워드
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium border ${
                    status === s
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
            <Link
              href={`/deck/${deckId}`}
              className="flex-1 py-3 border border-beige-dark/50 rounded-xl text-charcoal-light hover:bg-beige font-medium text-center"
            >
              취소
            </Link>
            <button
              onClick={handleSave}
              disabled={saving || !cardNumber.trim() || !name.trim()}
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
