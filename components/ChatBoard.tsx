'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type Sender = 'doyoung' | 'hyojae';

interface ChatMessage {
  id: string;
  sender: Sender;
  message: string;
  is_read: boolean;
  created_at: string;
}

const PROFILE_INFO: Record<Sender, { name: string; nickname: string; image: string }> = {
  doyoung: { name: '이도영', nickname: '점술신', image: '/master_doyoung.jpg' },
  hyojae: { name: '양효재', nickname: '로율', image: '/master_hyojae.jpg' },
};

function getOtherSender(sender: Sender): Sender {
  return sender === 'doyoung' ? 'hyojae' : 'doyoung';
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function isSameDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export default function ChatBoard() {
  const [currentUser, setCurrentUser] = useState<Sender | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 매번 접속 시 사용자 선택 화면 표시 (localStorage 사용 안 함)
  const selectUser = (sender: Sender) => {
    setCurrentUser(sender);
  };

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Failed to fetch messages:', error);
        return;
      }

      setMessages(data || []);
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch messages on mount
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Subscribe to Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel('chat-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as ChatMessage;
            setMessages((prev) => {
              // Prevent duplicates
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as ChatMessage;
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            );
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Calculate unread count for current user
  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }
    const count = messages.filter(
      (m) => m.sender !== currentUser && !m.is_read
    ).length;
    setUnreadCount(count);
  }, [messages, currentUser]);

  // Auto-scroll to bottom when new messages arrive (within chat container only)
  useEffect(() => {
    if (isOpen && chatContainerRef.current) {
      const container = chatContainerRef.current;
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Mark messages as read when chat is open
  const markAsRead = useCallback(async () => {
    if (!currentUser) return;

    const unreadMessages = messages.filter(
      (m) => m.sender !== currentUser && !m.is_read
    );

    if (unreadMessages.length === 0) return;

    // Update all unread messages from the other person
    const ids = unreadMessages.map((m) => m.id);
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .in('id', ids);

    // Optimistically update local state
    setMessages((prev) =>
      prev.map((m) =>
        ids.includes(m.id) ? { ...m, is_read: true } : m
      )
    );
  }, [currentUser, messages]);

  // Auto-mark as read when chat is open and there are unread messages
  useEffect(() => {
    if (isOpen && currentUser && unreadCount > 0) {
      markAsRead();
    }
  }, [isOpen, currentUser, unreadCount, markAsRead]);

  // Send message
  const handleSend = async () => {
    if (!currentUser || !newMessage.trim() || sending) return;

    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const { error } = await supabase.from('chat_messages').insert({
        sender: currentUser,
        message: messageText,
        is_read: false,
      });

      if (error) {
        console.error('Failed to send message:', error);
        setNewMessage(messageText); // Restore message on error
        alert('메시지 전송에 실패했습니다.');
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      setNewMessage(messageText);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  // Handle Enter key (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  // Switch user
  const handleSwitchUser = () => {
    if (window.confirm('사용자를 변경하시겠습니까?')) {
      setCurrentUser(null);
    }
  };

  // ====== RENDER ======

  // User Selection Screen
  if (!currentUser) {
    const totalUnread = messages.filter((m) => !m.is_read).length;
    return (
      <div className="bg-warm-white border border-beige-dark/70 rounded-3xl p-6 shadow-sm relative">
        {totalUnread > 0 && (
          <div className="absolute -top-3 -right-3 z-10">
            <span className="inline-flex items-center justify-center min-w-[36px] h-9 px-3 bg-red-500 text-white text-base font-bold rounded-full shadow-lg animate-pulse">
              💬 {totalUnread}
            </span>
          </div>
        )}
        <div className="text-center py-6">
          <span className="text-3xl mb-3 block">🔮</span>
          <h3 className="text-lg font-serif font-bold text-charcoal tracking-wide mb-1">
            두 타로마스터의 대화방
          </h3>
          {totalUnread > 0 ? (
            <p className="text-xs text-red-500 font-bold mb-6 animate-pulse">
              📢 새로운 메시지 {totalUnread}개가 있어요!
            </p>
          ) : (
            <p className="text-xs text-charcoal-light mb-6">
              먼저 자신이 누구인지 선택해주세요
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
            {(['doyoung', 'hyojae'] as Sender[]).map((sender) => {
              const info = PROFILE_INFO[sender];
              const myUnread = messages.filter(
                (m) => m.sender === sender && !m.is_read
              ).length;
              return (
                <button
                  key={sender}
                  onClick={() => selectUser(sender)}
                  className="group relative flex flex-col items-center gap-3 p-5 bg-gradient-to-b from-[#FAF6EE] to-warm-white border-2 border-beige-dark/40 rounded-2xl hover:border-gold/60 hover:shadow-md transition-all"
                >
                  {myUnread > 0 && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full shadow-md">
                      {myUnread}
                    </span>
                  )}
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gold/40 shadow-sm group-hover:border-gold/80 group-hover:scale-105 transition-all">
                    <img
                      src={info.image}
                      alt={info.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-charcoal">{info.name}</p>
                    <p className="text-[11px] text-brown-dark">({info.nickname})</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const myInfo = PROFILE_INFO[currentUser];
  const otherSender = getOtherSender(currentUser);
  const otherInfo = PROFILE_INFO[otherSender];

  return (
    <div className="bg-warm-white border border-beige-dark/70 rounded-3xl shadow-sm overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer select-none px-6 py-4 border-b border-beige-dark/30"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">💬</span>
          <div>
            <h3 className="text-base font-serif font-bold text-charcoal tracking-wide flex items-center gap-2">
              두 타로마스터의 대화
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 bg-red-500 text-white text-sm font-bold rounded-full shadow-md animate-pulse">
                  {unreadCount}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-charcoal-light">
              {myInfo.name}({myInfo.nickname})으로 접속 중
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSwitchUser();
            }}
            className="text-[10px] bg-beige hover:bg-beige-dark/50 px-2 py-1 rounded-md text-charcoal-light font-medium transition-colors"
            title="사용자 전환"
          >
            👤 전환
          </button>
          <span className="text-xs bg-beige px-2.5 py-1 rounded-md text-charcoal font-medium">
            {isOpen ? '접기 ▲' : '펼치기 ▼'}
          </span>
        </div>
      </div>

      {/* Chat Body */}
      {isOpen && (
        <div className="chat-fade-in">
          {/* Messages Area */}
          <div
            ref={chatContainerRef}
            className="chat-scroll overflow-y-auto px-4 py-4 space-y-1"
            style={{ maxHeight: '420px', minHeight: '200px' }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-12 text-charcoal-light text-sm">
                대화를 불러오는 중...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-charcoal-light">
                <span className="text-4xl mb-3">🔮</span>
                <p className="text-sm font-medium">아직 대화가 없습니다</p>
                <p className="text-xs mt-1">첫 메시지를 보내보세요!</p>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => {
                  const isMe = msg.sender === currentUser;
                  const senderInfo = PROFILE_INFO[msg.sender];
                  const prevMsg = idx > 0 ? messages[idx - 1] : null;

                  // Show date label if date changed
                  const showDateLabel =
                    !prevMsg || !isSameDay(prevMsg.created_at, msg.created_at);

                  // Group consecutive messages from same sender
                  const showProfile =
                    !prevMsg ||
                    prevMsg.sender !== msg.sender ||
                    showDateLabel;

                  // Show time if next msg is from different sender or different minute
                  const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
                  const showTime =
                    !nextMsg ||
                    nextMsg.sender !== msg.sender ||
                    formatTime(nextMsg.created_at) !== formatTime(msg.created_at);

                  return (
                    <div key={msg.id}>
                      {/* Date Divider */}
                      {showDateLabel && (
                        <div className="flex items-center justify-center my-4">
                          <div className="bg-beige/80 text-charcoal-light text-[10px] font-medium px-3 py-1 rounded-full border border-beige-dark/30">
                            {formatDateLabel(msg.created_at)}
                          </div>
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`flex items-end gap-2 ${
                          isMe ? 'flex-row-reverse' : 'flex-row'
                        } ${showProfile ? 'mt-3' : 'mt-0.5'} ${
                          isMe ? 'chat-bubble-right' : 'chat-bubble-left'
                        }`}
                      >
                        {/* Profile Image */}
                        {!isMe && (
                          <div className="shrink-0 self-start">
                            {showProfile ? (
                              <div className="w-9 h-9 rounded-full overflow-hidden border border-beige-dark/50 shadow-xs">
                                <img
                                  src={senderInfo.image}
                                  alt={senderInfo.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-9" />
                            )}
                          </div>
                        )}

                        {/* Bubble Content */}
                        <div
                          className={`flex flex-col ${
                            isMe ? 'items-end' : 'items-start'
                          } max-w-[75%] min-w-0`}
                        >
                          {/* Sender Name */}
                          {showProfile && !isMe && (
                            <span className="text-[11px] font-semibold text-charcoal-light mb-1 ml-1">
                              {senderInfo.name} ({senderInfo.nickname})
                            </span>
                          )}

                          <div
                            className={`flex items-end gap-1.5 ${
                              isMe ? 'flex-row-reverse' : 'flex-row'
                            }`}
                          >
                            {/* Message Bubble */}
                            <div
                              className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words whitespace-pre-wrap ${
                                isMe
                                  ? 'bg-gradient-to-br from-gold/90 to-gold-light/80 text-charcoal rounded-br-md shadow-xs'
                                  : 'bg-white border border-beige-dark/40 text-charcoal rounded-bl-md shadow-xs'
                              }`}
                            >
                              {msg.message}
                            </div>

                            {/* Time + Read Status */}
                            {showTime && (
                              <div
                                className={`flex flex-col shrink-0 ${
                                  isMe ? 'items-end' : 'items-start'
                                }`}
                              >
                                {/* Read status (only for my messages) */}
                                {isMe && (
                                  <span
                                    className={`text-[9px] font-medium ${
                                      msg.is_read
                                        ? 'text-emerald-500'
                                        : 'text-charcoal-light/40'
                                    }`}
                                  >
                                    {msg.is_read ? '읽음' : ''}
                                  </span>
                                )}

                                {/* NEW badge (only for other's unread messages) */}
                                {!isMe && !msg.is_read && (
                                  <span className="new-badge text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-200">
                                    NEW
                                  </span>
                                )}

                                <span className="text-[9px] text-charcoal-light/50 mt-0.5">
                                  {formatTime(msg.created_at)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right side spacer for my messages (no profile) */}
                        {isMe && <div className="w-0" />}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-beige-dark/30 px-4 py-3 bg-gradient-to-t from-ivory to-warm-white">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder={`${otherInfo.name}(${otherInfo.nickname})에게 메시지...`}
                  rows={1}
                  className="w-full px-4 py-2.5 bg-white border border-beige-dark/50 rounded-2xl text-sm text-charcoal resize-none placeholder:text-charcoal-light/40 leading-relaxed focus:border-gold/70 transition-colors"
                  style={{ maxHeight: '120px' }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  newMessage.trim() && !sending
                    ? 'bg-gradient-to-br from-gold to-brown text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95'
                    : 'bg-beige-dark/40 text-charcoal-light/40 cursor-not-allowed'
                }`}
                title="전송"
              >
                {sending ? (
                  <span className="animate-spin text-xs">⏳</span>
                ) : (
                  <span>▶</span>
                )}
              </button>
            </div>
            <p className="text-[9px] text-charcoal-light/40 mt-1.5 text-center">
              Enter로 전송 · Shift+Enter로 줄바꿈
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
