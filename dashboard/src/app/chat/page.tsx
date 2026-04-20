'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { apiFetch, apiPost } from '@/lib/api';
import { Send, Bot, User, Loader2, Zap, CheckCircle2, ChevronRight, MessageSquare, Plus } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  tool_calls?: string[];
  skill_used?: string;
}

interface Conversation {
  id: string;
  user_id: string;
  provider: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string;
}

type Tab = 'dashboard' | 'telegram';

export default function ChatPage() {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch ALL conversations (limit 100 to cover both types)
  const { data: allConversations, mutate: mutateConversations } = useSWR<Conversation[]>(
    'conversations?limit=100',
    () => apiFetch<Conversation[]>('conversations?limit=100'),
    { refreshInterval: 10000 },
  );

  // Filter by tab
  const conversations = allConversations?.filter((c) =>
    activeTab === 'dashboard'
      ? c.provider === 'dashboard' || c.provider === 'github-copilot'
      : c.provider === 'telegram' || c.provider === 'whatsapp',
  );

  // Fetch messages of selected conversation
  const { data: messages, mutate: mutateMessages } = useSWR<Message[]>(
    selectedConvId ? `chat/messages/${selectedConvId}` : null,
    (key) => apiFetch<Message[]>(key),
    { refreshInterval: 3000 },
  );

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // When tab changes, select first conversation of new tab (or clear)
  useEffect(() => {
    setSelectedConvId(null);
  }, [activeTab]);

  // Auto-select first conversation when list loads/changes
  useEffect(() => {
    if (!selectedConvId && conversations && conversations.length > 0) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userMessage = input.trim();
    setInput('');
    setIsSending(true);

    try {
      const body: Record<string, any> = {
        userId: 'dashboard-user',
        message: userMessage,
        provider: 'github-copilot',
      };

      // If a conversation is selected, continue it; otherwise create new
      if (selectedConvId) {
        body.conversationId = selectedConvId;
      } else {
        body.forceNew = true;
      }

      const result = await apiPost<{
        conversationId: string;
        response: string;
        skillRouted?: string;
        trace?: any[];
      }>('chat', body);

      await mutateConversations();

      if (result.conversationId) {
        setSelectedConvId(result.conversationId);
        await mutateMessages();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('❌ Erro ao enviar mensagem: ' + (error as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const createNewChat = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const conv = await apiPost<{ id: string }>('conversations', {
        userId: 'dashboard-user',
        provider: 'dashboard',
      });
      await mutateConversations();
      setSelectedConvId(conv.id);
      setInput('');
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const telegramCount = allConversations?.filter(
    (c) => c.provider === 'telegram' || c.provider === 'whatsapp',
  ).length ?? 0;

  const dashboardCount = allConversations?.filter(
    (c) => c.provider === 'dashboard' || c.provider === 'github-copilot',
  ).length ?? 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Conversations Sidebar */}
      <div className="w-80 glass rounded-xl flex flex-col">
        {/* Tabs */}
        <div className="p-3 border-b border-white/5 space-y-2">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'text-[#5c7a9e] hover:text-[#e2eaf7]'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              Dashboard
              {dashboardCount > 0 && (
                <span className="bg-blue-500/30 text-blue-300 text-[10px] px-1.5 rounded-full">
                  {dashboardCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('telegram')}
              className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'telegram'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-[#5c7a9e] hover:text-[#e2eaf7]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Telegram
              {telegramCount > 0 && (
                <span className="bg-sky-500/30 text-sky-300 text-[10px] px-1.5 rounded-full">
                  {telegramCount}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'dashboard' && (
            <button
              onClick={createNewChat}
              disabled={isCreating}
              className="w-full glass px-4 py-2 rounded-lg text-sm text-blue-300 hover:bg-white/[0.05] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Nova Conversa
            </button>
          )}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations?.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConvId(conv.id)}
              className={`w-full p-3 rounded-lg text-left transition-colors ${
                selectedConvId === conv.id
                  ? 'bg-blue-500/20 border border-blue-500/30'
                  : 'glass hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {activeTab === 'telegram' ? (
                  <MessageSquare className="w-4 h-4 text-sky-400" />
                ) : (
                  <Bot className="w-4 h-4 text-blue-400" />
                )}
                <span className="text-xs text-[#5c7a9e]">
                  {new Date(conv.updated_at || conv.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="text-sm text-[#e2eaf7] truncate">
                {conv.last_message || `Conversa ${conv.id.slice(0, 8)}`}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-[#5c7a9e]">{conv.message_count} msgs</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  conv.provider === 'telegram' ? 'bg-sky-500/20 text-sky-400' :
                  conv.provider === 'whatsapp' ? 'bg-green-500/20 text-green-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {conv.user_id === 'dashboard-user' ? 'web' : conv.provider}
                </span>
              </div>
            </button>
          ))}

          {(!conversations || conversations.length === 0) && (
            <div className="text-center text-sm text-[#5c7a9e] py-8">
              {activeTab === 'telegram'
                ? 'Nenhuma conversa do Telegram ainda'
                : 'Clique em "Nova Conversa" para começar'}
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 glass rounded-xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              activeTab === 'telegram' ? 'bg-sky-500/20' : 'bg-blue-500/20'
            }`}>
              {activeTab === 'telegram' ? (
                <MessageSquare className="w-5 h-5 text-sky-400" />
              ) : (
                <Bot className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#e2eaf7]">
                {activeTab === 'telegram' ? 'Espelho Telegram' : 'GueClaw Chat'}
              </h2>
              <p className="text-xs text-[#5c7a9e]">
                {selectedConvId
                  ? `Conversa ${selectedConvId.slice(0, 8)}`
                  : activeTab === 'telegram' ? 'Selecione uma conversa' : 'Pronto para ajudar'}
              </p>
            </div>
          </div>

          {isSending && (
            <div className="flex items-center gap-2 text-yellow-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Pensando...</span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const isAtBottom =
              target.scrollHeight - target.scrollTop - target.clientHeight < 50;
            setAutoScroll(isAtBottom);
          }}
        >
          {!selectedConvId && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                {activeTab === 'telegram' ? (
                  <>
                    <MessageSquare className="w-16 h-16 text-sky-400 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold text-[#e2eaf7] mb-2">
                      Espelhos do Telegram
                    </h3>
                    <p className="text-sm text-[#5c7a9e]">
                      Selecione uma conversa do Telegram para visualizar o histórico. <br />
                      Essas conversas são somente leitura.
                    </p>
                  </>
                ) : (
                  <>
                    <Bot className="w-16 h-16 text-blue-400 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold text-[#e2eaf7] mb-2">
                      Bem-vindo ao GueClaw Chat
                    </h3>
                    <p className="text-sm text-[#5c7a9e]">
                      Clique em &quot;Nova Conversa&quot; para começar ou selecione uma existente.
                    </p>
                    <div className="mt-6 text-xs text-[#5c7a9e] space-y-1">
                      <div>💡 Digite sua mensagem abaixo</div>
                      <div>🎯 Use /help para ver comandos</div>
                      <div>⚡ Skills executam automaticamente</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {messages?.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input — only for dashboard tab */}
        {activeTab === 'dashboard' && (
          <div className="p-4 border-t border-white/5">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSending}
                placeholder={
                  selectedConvId
                    ? 'Continue a conversa... (Enter para enviar)'
                    : 'Digite para iniciar nova conversa... (Enter para enviar)'
                }
                className="flex-1 glass px-4 py-3 rounded-lg text-sm text-[#e2eaf7] placeholder-[#5c7a9e] focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                autoComplete="off"
              />
              <button
                onClick={handleSend}
                disabled={isSending || !input.trim()}
                className="glass px-6 py-3 rounded-lg text-sm text-blue-300 hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Enviar
              </button>
            </div>

            <div className="mt-2 flex items-center gap-4 text-xs text-[#5c7a9e]">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Conectado à VPS
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {messages?.filter((m) => m.skill_used).length || 0} skills executadas
              </div>
            </div>
          </div>
        )}

        {/* Telegram read-only notice */}
        {activeTab === 'telegram' && selectedConvId && (
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center justify-center gap-2 text-xs text-sky-400/70 bg-sky-500/5 rounded-lg py-2 px-4">
              <MessageSquare className="w-3.5 h-3.5" />
              Espelho somente leitura — responda pelo Telegram
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="glass px-3 py-1.5 rounded-full text-xs text-[#5c7a9e]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? 'bg-green-500/20' : 'bg-blue-500/20'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-green-400" />
        ) : (
          <Bot className="w-4 h-4 text-blue-400" />
        )}
      </div>

      <div className={`flex-1 max-w-[70%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`glass rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-500/10 border border-blue-500/20'
              : 'bg-white/[0.02] border border-white/5'
          }`}
        >
          <div className="text-sm text-[#e2eaf7] whitespace-pre-wrap break-words">
            {message.content}
          </div>

          {message.skill_used && (
            <div className="mt-2 flex items-center gap-1 text-xs text-purple-300">
              <Zap className="w-3 h-3" />
              Skill: {message.skill_used}
            </div>
          )}

          {message.tool_calls && message.tool_calls.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.tool_calls.map((tool, idx) => (
                <div key={idx} className="flex items-center gap-1 text-xs text-cyan-300">
                  <ChevronRight className="w-3 h-3" />
                  {tool}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-[#5c7a9e] mt-1 px-2">
          {new Date(message.created_at).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
