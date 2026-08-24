'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SharedMemoBoard() {
  const [doyoungNote, setDoyoungNote] = useState('');
  const [doyoungReadByHyojae, setDoyoungReadByHyojae] = useState(false);
  const [doyoungReadAt, setDoyoungReadAt] = useState<string | null>(null);

  const [hyojaeNote, setHyojaeNote] = useState('');
  const [hyojaeReadByDoyoung, setHyojaeReadByDoyoung] = useState(false);
  const [hyojaeReadAt, setHyojaeReadAt] = useState<string | null>(null);

  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [savingWho, setSavingWho] = useState<'doyoung' | 'hyojae' | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  // Fetch shared notes
  const fetchNotes = async () => {
    try {
      const { data } = await supabase
        .from('shared_notes')
        .select('*')
        .eq('id', 'main')
        .maybeSingle();

      if (data) {
        setDoyoungNote(data.doyoung_note || '');
        setDoyoungReadByHyojae(Boolean(data.doyoung_read_by_hyojae));
        setDoyoungReadAt(data.doyoung_read_at || null);

        setHyojaeNote(data.hyojae_note || '');
        setHyojaeReadByDoyoung(Boolean(data.hyojae_read_by_doyoung));
        setHyojaeReadAt(data.hyojae_read_at || null);

        if (data.updated_at) {
          const date = new Date(data.updated_at);
          setLastSaved(
            date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          );
        }
      }
    } catch (e) {
      console.error('Failed to load shared notes:', e);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  // Save Doyoung's Note
  const saveDoyoung = async (textToSave?: string) => {
    setSavingWho('doyoung');
    const note = textToSave !== undefined ? textToSave : doyoungNote;
    try {
      const { error } = await supabase
        .from('shared_notes')
        .upsert({
          id: 'main',
          doyoung_note: note,
          doyoung_read_by_hyojae: false,
          doyoung_read_at: null,
          updated_at: new Date().toISOString(),
        });

      if (!error) {
        setDoyoungNote(note);
        setDoyoungReadByHyojae(false);
        setDoyoungReadAt(null);
        setLastSaved('방금 전');
      } else {
        alert('저장에 실패했습니다. Supabase 설정을 확인해주세요.');
      }
    } catch (e) {
      console.error(e);
    }
    setSavingWho(null);
  };

  // Save Hyojae's Note
  const saveHyojae = async (textToSave?: string) => {
    setSavingWho('hyojae');
    const note = textToSave !== undefined ? textToSave : hyojaeNote;
    try {
      const { error } = await supabase
        .from('shared_notes')
        .upsert({
          id: 'main',
          hyojae_note: note,
          hyojae_read_by_doyoung: false,
          hyojae_read_at: null,
          updated_at: new Date().toISOString(),
        });

      if (!error) {
        setHyojaeNote(note);
        setHyojaeReadByDoyoung(false);
        setHyojaeReadAt(null);
        setLastSaved('방금 전');
      } else {
        alert('저장에 실패했습니다. Supabase 설정을 확인해주세요.');
      }
    } catch (e) {
      console.error(e);
    }
    setSavingWho(null);
  };

  // Toggle Hyojae Read status on Doyoung's note
  const toggleHyojaeRead = async () => {
    const newStatus = !doyoungReadByHyojae;
    const nowStr = newStatus ? new Date().toISOString() : null;

    setDoyoungReadByHyojae(newStatus);
    setDoyoungReadAt(nowStr);

    await supabase
      .from('shared_notes')
      .update({
        doyoung_read_by_hyojae: newStatus,
        doyoung_read_at: nowStr,
      })
      .eq('id', 'main');
  };

  // Toggle Doyoung Read status on Hyojae's note
  const toggleDoyoungRead = async () => {
    const newStatus = !hyojaeReadByDoyoung;
    const nowStr = newStatus ? new Date().toISOString() : null;

    setHyojaeReadByDoyoung(newStatus);
    setHyojaeReadAt(nowStr);

    await supabase
      .from('shared_notes')
      .update({
        hyojae_read_by_doyoung: newStatus,
        hyojae_read_at: nowStr,
      })
      .eq('id', 'main');
  };

  // Clear Doyoung note
  const handleClearDoyoung = async () => {
    if (window.confirm('이도영(점술신)의 메모를 지우고 새로 작성하시겠습니까?')) {
      setDoyoungNote('');
      await saveDoyoung('');
    }
  };

  // Clear Hyojae note
  const handleClearHyojae = async () => {
    if (window.confirm('양효재(로율)의 메모를 지우고 새로 작성하시겠습니까?')) {
      setHyojaeNote('');
      await saveHyojae('');
    }
  };

  const formatReadTime = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-warm-white border border-beige-dark/70 rounded-3xl p-6 shadow-sm">
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer select-none pb-2"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🔮</span>
          <div>
            <h3 className="text-base font-serif font-bold text-charcoal tracking-wide">
              두 타로마스터의 소통 메모
            </h3>
            <p className="text-[11px] text-charcoal-light">
              이도영(점술신) & 양효재(로율)의 실시간 남김글
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-charcoal-light">
          {lastSaved && <span>최근 저장: {lastSaved}</span>}
          <span className="text-xs bg-beige px-2.5 py-1 rounded-md text-charcoal font-medium">
            {isOpen ? '접기 ▲' : '펼치기 ▼'}
          </span>
        </div>
      </div>

      {/* Content */}
      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4 pt-4 border-t border-beige-dark/30 animate-in fade-in duration-200">
          
          {/* 1. LEFT: 이도영 (점술신) */}
          <div className="bg-gradient-to-b from-[#FAF6EE] to-warm-white border border-brown/30 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
            <div>
              {/* Profile Header */}
              <div className="flex items-center justify-between mb-3 min-h-[46px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-gold/60 shadow-xs shrink-0 ring-1 ring-brown/20">
                    <img
                      src="/master_doyoung.jpg"
                      alt="이도영(점술신)"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-charcoal">이도영 (점술신)</span>
                    </div>
                    <p className="text-[11px] text-brown-dark font-medium">
                      양효재(로율)에게 남기는 말
                    </p>
                  </div>
                </div>

                {/* Read Status Badge */}
                <div className="shrink-0">
                  {doyoungNote.trim() ? (
                    doyoungReadByHyojae ? (
                      <div className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-lg font-bold flex flex-col items-center text-center leading-tight shadow-2xs whitespace-nowrap">
                        <span>로율 읽음</span>
                        <span className="text-[9px] text-emerald-700/80 font-normal">
                          {doyoungReadAt ? `(${formatReadTime(doyoungReadAt)})` : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded-lg font-bold flex items-center justify-center text-center whitespace-nowrap">
                        <span>로율 미확인</span>
                      </div>
                    )
                  ) : null}
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={doyoungNote}
                onChange={(e) => setDoyoungNote(e.target.value)}
                placeholder="이도영(점술신)님이 양효재(로율)님에게 전할 말을 자유롭게 적어두세요..."
                rows={4}
                className="w-full p-3 bg-white/90 border border-beige-dark/70 rounded-xl text-xs text-charcoal resize-none placeholder:text-charcoal-light/40 leading-relaxed focus:bg-white transition-all shadow-2xs"
              />
            </div>

            {/* Bottom Actions */}
            <div className="mt-3 pt-2.5 border-t border-beige-dark/30 space-y-2">
              {/* Row 1: Check Button */}
              <button
                type="button"
                onClick={toggleHyojaeRead}
                disabled={!doyoungNote.trim()}
                className={`w-full py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  !doyoungNote.trim()
                    ? 'bg-ivory/50 text-charcoal-light/40 border-beige-dark/40 cursor-not-allowed'
                    : doyoungReadByHyojae
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                    : 'bg-warm-white text-charcoal border-beige-dark/70 hover:bg-beige'
                }`}
                title="양효재(로율)님이 이 메모를 확인했는지 누르는 버튼입니다"
              >
                <span>{doyoungReadByHyojae ? '✅ 로율 확인완료' : '⬜ 로율 확인체크'}</span>
              </button>

              {/* Row 2: Clear and Save Buttons */}
              <div className="flex gap-2">
                {doyoungNote.trim() && (
                  <button
                    type="button"
                    onClick={handleClearDoyoung}
                    className="flex-1 py-2 text-charcoal-light/70 hover:text-red-500 text-xs font-medium rounded-xl hover:bg-red-50 border border-beige-dark/50 transition-colors"
                  >
                    지우기
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => saveDoyoung()}
                  disabled={savingWho === 'doyoung'}
                  className="flex-2 py-2 bg-charcoal text-ivory rounded-xl text-xs font-bold hover:bg-brown-dark disabled:opacity-50 transition-colors shadow-xs"
                >
                  {savingWho === 'doyoung' ? '저장 중...' : '이도영 메모 저장'}
                </button>
              </div>
            </div>
          </div>

          {/* 2. RIGHT: 양효재 (로율) */}
          <div className="bg-gradient-to-b from-[#FAF6F0] to-warm-white border border-brown/30 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
            <div>
              {/* Profile Header */}
              <div className="flex items-center justify-between mb-3 min-h-[46px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-gold/60 shadow-xs shrink-0 ring-1 ring-brown/20">
                    <img
                      src="/master_hyojae.jpg"
                      alt="양효재(로율)"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-charcoal">양효재 (로율)</span>
                    </div>
                    <p className="text-[11px] text-brown-dark font-medium">
                      이도영(점술신)에게 남기는 말
                    </p>
                  </div>
                </div>

                {/* Read Status Badge */}
                <div className="shrink-0">
                  {hyojaeNote.trim() ? (
                    hyojaeReadByDoyoung ? (
                      <div className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-lg font-bold flex flex-col items-center text-center leading-tight shadow-2xs whitespace-nowrap">
                        <span>점술신 읽음</span>
                        <span className="text-[9px] text-emerald-700/80 font-normal">
                          {hyojaeReadAt ? `(${formatReadTime(hyojaeReadAt)})` : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded-lg font-bold flex items-center justify-center text-center whitespace-nowrap">
                        <span>점술신 미확인</span>
                      </div>
                    )
                  ) : null}
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={hyojaeNote}
                onChange={(e) => setHyojaeNote(e.target.value)}
                placeholder="양효재(로율)님이 이도영(점술신)님에게 전할 말을 자유롭게 적어두세요..."
                rows={4}
                className="w-full p-3 bg-white/90 border border-beige-dark/70 rounded-xl text-xs text-charcoal resize-none placeholder:text-charcoal-light/40 leading-relaxed focus:bg-white transition-all shadow-2xs"
              />
            </div>

            {/* Bottom Actions */}
            <div className="mt-3 pt-2.5 border-t border-beige-dark/30 space-y-2">
              {/* Row 1: Check Button */}
              <button
                type="button"
                onClick={toggleDoyoungRead}
                disabled={!hyojaeNote.trim()}
                className={`w-full py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  !hyojaeNote.trim()
                    ? 'bg-ivory/50 text-charcoal-light/40 border-beige-dark/40 cursor-not-allowed'
                    : hyojaeReadByDoyoung
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                    : 'bg-warm-white text-charcoal border-beige-dark/70 hover:bg-beige'
                }`}
                title="이도영(점술신)님이 이 메모를 확인했는지 누르는 버튼입니다"
              >
                <span>{hyojaeReadByDoyoung ? '✅ 점술신 확인완료' : '⬜ 점술신 확인체크'}</span>
              </button>

              {/* Row 2: Clear and Save Buttons */}
              <div className="flex gap-2">
                {hyojaeNote.trim() && (
                  <button
                    type="button"
                    onClick={handleClearHyojae}
                    className="flex-1 py-2 text-charcoal-light/70 hover:text-red-500 text-xs font-medium rounded-xl hover:bg-red-50 border border-beige-dark/50 transition-colors"
                  >
                    지우기
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => saveHyojae()}
                  disabled={savingWho === 'hyojae'}
                  className="flex-2 py-2 bg-charcoal text-ivory rounded-xl text-xs font-bold hover:bg-brown-dark disabled:opacity-50 transition-colors shadow-xs"
                >
                  {savingWho === 'hyojae' ? '저장 중...' : '양효재 메모 저장'}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
