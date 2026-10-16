'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Button, Input, Label, toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';
import { ReplyDesk } from '@/components/dashboard/reply-desk';
import { Sparkles, MessageSquare } from 'lucide-react';

interface Conversation {
  recipientId: string;
  recipientUsername?: string | null;
  lastMessage: string;
  updatedAt: string;
  instagramAccountId: string;
  instagramAccountUsername: string;
  unreadCount: number;
}

interface Message {
  id: string;
  recipientId: string;
  senderId: string;
  text: string | null;
  mediaUrl: string | null;
  direction: 'INCOMING' | 'OUTGOING';
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  errorMessage: string | null;
  createdAt: string;
}

function renderMessageWithLinks(text: string | null, isIncoming: boolean) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline font-semibold break-all hover:opacity-80 transition-opacity ${
            isIncoming ? 'text-primary' : 'text-white underline-offset-2'
          }`}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all conversation threads
  const fetchConversations = async () => {
    try {
      const data = await apiRequest<Conversation[]>('/instagram/conversations');
      setConversations(data || []);
    } catch (err) {
      console.error('Error loading conversations', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Fetch message history for selected conversation
  const fetchMessages = async (recipientId: string, showLoading = false) => {
    if (showLoading) setLoadingMessages(true);
    try {
      const data = await apiRequest<Message[]>(`/instagram/conversations/${recipientId}/messages`);
      setMessages(data || []);
    } catch (err) {
      console.error('Error loading messages', err);
    } finally {
      if (showLoading) setLoadingMessages(false);
    }
  };

  // Send manual message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedRecipientId) return;

    const selectedConv = conversations.find((c) => c.recipientId === selectedRecipientId);
    if (!selectedConv) return;

    setSendingMessage(true);
    const messageContent = inputText;
    setInputText('');

    try {
      await apiRequest(`/instagram/conversations/${selectedRecipientId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          instagramAccountId: selectedConv.instagramAccountId,
          text: messageContent,
        }),
      });

      // Fetch messages immediately to update the list
      await fetchMessages(selectedRecipientId);
      // Refresh conversations list to update last message preview
      await fetchConversations();
    } catch {
      toast.error('Failed to deliver message');
      setInputText(messageContent); // Restore text on failure
    } finally {
      setSendingMessage(false);
    }
  };

  // Load conversations once on mount
  useEffect(() => {
    fetchConversations();
    // Poll conversations every 10 seconds
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number>(0);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState<boolean>(false);

  // Poll messages every 4 seconds when a conversation is active
  useEffect(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    if (selectedRecipientId) {
      setIsUserScrolledUp(false);
      prevMsgCountRef.current = 0;
      fetchMessages(selectedRecipientId, true);

      pollIntervalRef.current = setInterval(() => {
        fetchMessages(selectedRecipientId, false);
      }, 4000);
    } else {
      setMessages([]);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [selectedRecipientId]);

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    setIsUserScrolledUp(distanceFromBottom > 100);
  };

  useEffect(() => {
    if (messages.length > 0) {
      const isFirstLoad = prevMsgCountRef.current === 0;
      const isNewMessageAdded = messages.length > prevMsgCountRef.current;
      prevMsgCountRef.current = messages.length;

      if (isFirstLoad || (!isUserScrolledUp && isNewMessageAdded)) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, isUserScrolledUp]);

  // Filter conversations by search query
  const filteredConversations = conversations.filter(
    (c) =>
      c.recipientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.recipientUsername?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.instagramAccountUsername.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const activeConversation = conversations.find((c) => c.recipientId === selectedRecipientId);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-140px)] space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 shrink-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Direct Messages Inbox
            </h1>
            <p className="text-xs text-slate-500">
              Live direct message chat threads with followers, leads, and keyword automation
              recipients.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Conversations List */}
          <div className="md:col-span-4 flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden h-full min-h-0">
            <div className="p-3 border-b border-slate-100 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search user..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchQuery(e.target.value)
                  }
                  className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <svg
                  className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
              {loadingConversations ? (
                <div className="p-4 text-center text-xs text-slate-500">Loading threads...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No active threads found.
                </div>
              ) : (
                filteredConversations.map((c) => {
                  const isActive = c.recipientId === selectedRecipientId;
                  return (
                    <button
                      key={c.recipientId}
                      onClick={() => setSelectedRecipientId(c.recipientId)}
                      className={`w-full p-4 flex items-start gap-3 hover:bg-slate-50 text-left transition-colors cursor-pointer ${
                        isActive ? 'bg-emerald-50/80 border-l-3 border-emerald-600' : ''
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs">
                        {(c.recipientUsername || c.recipientId).substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className="text-xs font-bold text-slate-900 truncate block max-w-[140px]"
                            title={c.recipientUsername || c.recipientId}
                          >
                            {c.recipientUsername
                              ? `@${c.recipientUsername}`
                              : `ID: ${c.recipientId}`}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(c.updatedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                          {c.lastMessage || 'Shared a post / attachment'}
                        </p>
                        <span className="inline-block bg-slate-100 text-[10px] font-semibold text-slate-700 px-2 py-0.5 rounded border border-slate-200 mt-1">
                          @{c.instagramAccountUsername}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Middle Column: Chat Window */}
          <div className="md:col-span-8 flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden h-full min-h-0">
            {selectedRecipientId ? (
              <>
                {/* Chat Header - Fixed at Top */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs">
                      {(activeConversation?.recipientUsername || selectedRecipientId)
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <h4
                        className="text-xs font-bold text-slate-900 truncate max-w-[200px]"
                        title={activeConversation?.recipientUsername || selectedRecipientId}
                      >
                        {activeConversation?.recipientUsername
                          ? `@${activeConversation.recipientUsername}`
                          : `ID: ${selectedRecipientId}`}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Connected through page: @{activeConversation?.instagramAccountUsername}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      Automation Active
                    </span>
                  </div>
                </div>

                {/* Message Log - Scrollable Center Area with Light Background */}
                <div
                  ref={chatContainerRef}
                  onScroll={handleChatScroll}
                  className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70 relative min-h-0"
                >
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full text-xs text-slate-500">
                      Loading chat history...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <p className="text-xs text-slate-500">
                        No message logs recorded for this user yet.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isIncoming = msg.direction === 'INCOMING';
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}
                        >
                          <div className={`max-w-[70%] space-y-1`}>
                            <div
                              className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                                isIncoming
                                  ? 'bg-white text-slate-900 rounded-tl-none border border-slate-200/90 shadow-xs'
                                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-tr-none shadow-xs font-medium'
                              }`}
                            >
                              {msg.mediaUrl && (
                                <div className="mb-2.5 overflow-hidden rounded-xl border border-slate-200/70 max-w-xs shadow-2xs bg-slate-100">
                                  <img
                                    src={msg.mediaUrl}
                                    alt="Shared attachment thumbnail"
                                    className="w-full max-h-56 object-cover"
                                    onError={(e) => {
                                      (e.currentTarget.parentElement as HTMLElement).style.display =
                                        'none';
                                    }}
                                  />
                                </div>
                              )}
                              <p className="whitespace-pre-wrap break-words">
                                {renderMessageWithLinks(msg.text, isIncoming)}
                              </p>
                            </div>
                            <div
                              className={`flex items-center gap-1 text-[10px] text-slate-400 px-1 ${
                                isIncoming ? 'justify-start' : 'justify-end'
                              }`}
                            >
                              <span>
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {!isIncoming && (
                                <span
                                  className={
                                    msg.status === 'FAILED'
                                      ? 'text-rose-600 font-bold'
                                      : 'text-emerald-700 font-bold'
                                  }
                                >
                                  • {msg.status.toLowerCase()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />

                  {/* Floating Scroll to Bottom Button */}
                  {isUserScrolledUp && (
                    <button
                      onClick={() => {
                        setIsUserScrolledUp(false);
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="sticky bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-md hover:scale-105 transition-all flex items-center gap-1.5 z-20 cursor-pointer"
                    >
                      <span>↓ Scroll to Latest Messages</span>
                    </button>
                  )}
                </div>

                {/* Chat Input Footer - Always Fixed at Bottom */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 border-t border-slate-100 bg-white flex gap-2 shrink-0"
                >
                  <Input
                    placeholder="Type a message..."
                    value={inputText}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setInputText(e.target.value)
                    }
                    className="flex-1 bg-slate-50 border-slate-200 text-slate-900 text-xs h-10 placeholder-slate-400 focus:bg-white focus:outline-none"
                    disabled={sendingMessage}
                  />
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs h-10 px-5 shrink-0 font-bold shadow-xs cursor-pointer"
                    disabled={sendingMessage || !inputText.trim()}
                  >
                    {sendingMessage ? 'Sending...' : 'Send'}
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 p-8 text-center bg-slate-50/40">
                <div className="h-12 w-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-xs">
                  <svg
                    className="h-6 w-6 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900">No Conversation Selected</h3>
                <p className="text-xs text-slate-500 max-w-[280px] mt-1">
                  Select a user thread from the sidebar to inspect logs and send direct replies.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
