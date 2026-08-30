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
  const [imageFeedback, setImageFeedback] = useState('');
  const [status, setStatus] = useState<CardStatus>('todo');
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null]);

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

  const handleImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('JPG, PNG, WEBP 파일만 업로드할 수 있습니다.');
      return;
    }

    const newFiles = [...imageFiles];
    newFiles[index] = file;
    setImageFiles(newFiles);

    const newPreviews = [...imagePreviews];
    newPreviews[index] = URL.createObjectURL(file);
    setImagePreviews(newPreviews);
  };

  const handleRemoveImage = (index: number) => {
    const newFiles = [...imageFiles];
    newFiles[index] = null;
    setImageFiles(newFiles);

    const newPreviews = [...imagePreviews];
    if (newPreviews[index]) URL.revokeObjectURL(newPreviews[index]!);
    newPreviews[index] = null;
    setImagePreviews(newPreviews);
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
        image_feedback: imageFeedback.trim() || null,
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

    // Upload images if provided (up to 3)
    const imageUrlFields = ['image_url', 'image_url_2', 'image_url_3'] as const;
    const uploadedUrls: Record<string, string> = {};

    for (let i = 0; i < 3; i++) {
      const file = imageFiles[i];
      if (!file) continue;

      const ext = file.name.split('.').pop();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileName = `${deckId}/${newCard.id}_${i + 1}_${Date.now()}_${randomSuffix}.${ext}`;

      console.log(`Uploading image ${i + 1}: ${fileName}, size: ${file.size}, type: ${file.type}`);

      const { error: uploadError } = await supabase.storage
        .from('card-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error(`Image ${i + 1} upload error:`, uploadError);
        alert(`이미지 ${i + 1} 업로드 실패: ${uploadError.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('card-images')
        .getPublicUrl(fileName);

      uploadedUrls[imageUrlFields[i]] = urlData.publicUrl;
      console.log(`Image ${i + 1} uploaded successfully: ${urlData.publicUrl}`);
    }

    if (Object.keys(uploadedUrls).length > 0) {
      await supabase
        .from('cards')
        .update(uploadedUrls)
        .eq('id', newCard.id);
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

          {/* Images (up to 3) */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-light uppercase tracking-widest mb-2">
              카드 이미지 (최대 3장)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="relative">
                  {imagePreviews[index] ? (
                    <div className="relative group">
                      <div className="rounded-xl overflow-hidden border border-beige-dark/30 bg-warm-white">
                        <img src={imagePreviews[index]!} alt={`preview ${index + 1}`} className="w-full h-auto aspect-[2/3] object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                      >
                        ✕
                      </button>
                      <span className="absolute bottom-1 left-1 bg-charcoal/70 text-white text-[10px] px-1.5 py-0.5 rounded-md">
                        {index + 1}
                      </span>
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
              value={imageFeedback}
              onChange={(e) => setImageFeedback(e.target.value)}
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
