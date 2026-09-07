'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface SubGoal {
  id: string;
  text: string;
  completed: boolean;
}

export default function GoalRoadmap() {
  const [mainGoal, setMainGoal] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [subGoals, setSubGoals] = useState<SubGoal[]>([]);
  const [newSubGoalText, setNewSubGoalText] = useState('');
  const [isEditingMain, setIsEditingMain] = useState(false);
  const [tempMainGoal, setTempMainGoal] = useState('');
  const [tempDate, setTempDate] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch roadmap from DB
  const fetchRoadmap = async () => {
    try {
      const { data } = await supabase
        .from('roadmaps')
        .select('*')
        .eq('id', 'main')
        .maybeSingle();

      if (data) {
        setMainGoal(data.main_goal || '타로 덱 완성 및 런칭');
        setTargetDate(data.target_date || '');
        setTempMainGoal(data.main_goal || '타로 덱 완성 및 런칭');
        setTempDate(data.target_date || '');
        setSubGoals(Array.isArray(data.sub_goals) ? data.sub_goals : []);
      } else {
        // Init default
        setMainGoal('타로 덱 78장 완성 및 제작');
        setTempMainGoal('타로 덱 78장 완성 및 제작');
      }
    } catch (e) {
      console.error('Failed to load roadmap:', e);
    }
  };

  useEffect(() => {
    fetchRoadmap();
  }, []);

  // Save to DB
  const saveRoadmapToDb = async (
    newMain: string,
    newDate: string,
    newSubs: SubGoal[]
  ) => {
    setSaving(true);
    try {
      await supabase.from('roadmaps').upsert({
        id: 'main',
        main_goal: newMain,
        target_date: newDate || null,
        sub_goals: newSubs,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  // Calculate D-Day
  const getDDay = (dateStr: string) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'D-DAY 🔥';
    if (diffDays > 0) return `D-${diffDays}`;
    return `D+${Math.abs(diffDays)}`;
  };

  // Save main goal edit
  const handleSaveMain = async () => {
    setMainGoal(tempMainGoal);
    setTargetDate(tempDate);
    setIsEditingMain(false);
    await saveRoadmapToDb(tempMainGoal, tempDate, subGoals);
  };

  // Add new sub goal
  const handleAddSubGoal = async () => {
    if (!newSubGoalText.trim()) return;
    const newItem: SubGoal = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      text: newSubGoalText.trim(),
      completed: false,
    };
    const updated = [...subGoals, newItem];
    setSubGoals(updated);
    setNewSubGoalText('');
    await saveRoadmapToDb(mainGoal, targetDate, updated);
  };

  // Toggle sub goal completed
  const handleToggleSubGoal = async (id: string) => {
    const updated = subGoals.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setSubGoals(updated);
    await saveRoadmapToDb(mainGoal, targetDate, updated);
  };

  // Delete sub goal
  const handleDeleteSubGoal = async (id: string) => {
    const updated = subGoals.filter((item) => item.id !== id);
    setSubGoals(updated);
    await saveRoadmapToDb(mainGoal, targetDate, updated);
  };

  const completedCount = subGoals.filter((g) => g.completed).length;
  const progressPercent =
    subGoals.length > 0 ? Math.round((completedCount / subGoals.length) * 100) : 0;
  const dDayText = getDDay(targetDate);

  return (
    <div className="bg-warm-white border border-beige-dark/70 rounded-3xl p-6 shadow-sm">
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer select-none pb-2"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🎯</span>
          <div>
            <h3 className="text-base font-serif font-bold text-charcoal tracking-wide">
              로드맵 & 목표 달성 스케줄
            </h3>
            <p className="text-[11px] text-charcoal-light">
              게을러지지 않기 위한 D-DAY & 하위 액션플랜
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dDayText && (
            <span className="px-3 py-1 bg-amber-500/15 border border-amber-500/40 text-amber-900 rounded-full font-bold text-xs">
              {dDayText}
            </span>
          )}
          <span className="text-xs bg-beige px-2 py-1 rounded-md text-charcoal font-medium">
            {isOpen ? '접기 ▲' : '펼치기 ▼'}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-beige-dark/30 space-y-5 animate-in fade-in duration-200">
          
          {/* Main Goal Box */}
          <div className="bg-gradient-to-r from-[#FAF6EE] to-ivory border border-brown/30 rounded-2xl p-4 relative">
            {!isEditingMain ? (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] bg-charcoal text-gold-light px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                      FINAL GOAL
                    </span>
                    {targetDate && (
                      <span className="text-xs text-brown-dark font-medium">
                        목표일: {targetDate} ({dDayText})
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-charcoal mt-1 leading-snug">
                    🏆 {mainGoal || '최종 목표를 설정해주세요'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingMain(true)}
                  className="px-2.5 py-1 text-xs border border-beige-dark/70 rounded-lg text-charcoal hover:bg-beige"
                >
                  수정
                </button>
              </div>
            ) : (
              /* Edit Main Goal */
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-charcoal-light mb-1">
                    최종 목표
                  </label>
                  <input
                    type="text"
                    value={tempMainGoal}
                    onChange={(e) => setTempMainGoal(e.target.value)}
                    placeholder="예: 78장 컬러타로 덱 기획 및 제작 완료"
                    className="w-full px-3 py-2 bg-warm-white border border-beige-dark/60 rounded-xl text-sm text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-charcoal-light mb-1">
                    목표 마감일 (D-Day)
                  </label>
                  <input
                    type="date"
                    value={tempDate}
                    onChange={(e) => setTempDate(e.target.value)}
                    className="w-full px-3 py-2 bg-warm-white border border-beige-dark/60 rounded-xl text-sm text-charcoal"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingMain(false)}
                    className="px-3 py-1.5 border border-beige-dark/60 rounded-lg text-xs text-charcoal-light"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMain}
                    className="px-3.5 py-1.5 bg-charcoal text-ivory rounded-lg text-xs font-medium hover:bg-brown-dark"
                  >
                    저장
                  </button>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {subGoals.length > 0 && (
              <div className="mt-4 pt-3 border-t border-beige-dark/30">
                <div className="flex justify-between text-xs font-semibold text-charcoal-light mb-1.5">
                  <span>진행률</span>
                  <span className="text-brown-dark">
                    {completedCount} / {subGoals.length} 완료 ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-beige-dark/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brown to-gold transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sub Goals Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-charcoal-light uppercase tracking-wider flex items-center gap-1.5">
                <span>📋</span>
                <span>하위 실행 목표 ({subGoals.length}개)</span>
              </span>
            </div>

            {/* Sub Goal List */}
            <div className="space-y-2">
              {subGoals.map((sub, idx) => (
                <div
                  key={sub.id}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
                    sub.completed
                      ? 'bg-beige/40 border-beige-dark/30 text-charcoal-light/60'
                      : 'bg-warm-white border-beige-dark/50 text-charcoal shadow-2xs hover:border-brown/30'
                  }`}
                >
                  <div
                    onClick={() => handleToggleSubGoal(sub.id)}
                    className="flex items-center gap-2.5 flex-1 cursor-pointer select-none"
                  >
                    <span className="text-sm">
                      {sub.completed ? '✅' : '⬜'}
                    </span>
                    <span
                      className={`text-xs font-medium leading-tight ${
                        sub.completed ? 'line-through text-charcoal-light/60' : 'text-charcoal'
                      }`}
                    >
                      <span className="text-[10px] text-charcoal-light mr-1 font-mono">
                        #{idx + 1}
                      </span>
                      {sub.text}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSubGoal(sub.id)}
                    className="text-xs text-charcoal-light/50 hover:text-red-500 p-1"
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add Sub Goal Input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newSubGoalText}
                onChange={(e) => setNewSubGoalText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubGoal()}
                placeholder="+ 하위 목표 입력 후 엔터 (예: 1~10번 카드 키워드 확정, 덱 패키징 시안 등)"
                className="flex-1 px-3.5 py-2.5 bg-ivory border border-beige-dark/60 rounded-xl text-xs text-charcoal placeholder:text-charcoal-light/40 focus:bg-warm-white"
              />
              <button
                type="button"
                onClick={handleAddSubGoal}
                disabled={!newSubGoalText.trim()}
                className="px-4 py-2.5 bg-charcoal text-ivory rounded-xl text-xs font-medium hover:bg-brown-dark disabled:opacity-40 shrink-0"
              >
                추가
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
