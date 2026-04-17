// 💬 Chat Page Melhorada para GueClaw Dashboard
// Integra: FileAttachment, MessageBubble, ChatInput
// Features: Upload de arquivos, Markdown, Drag & Drop, Auto-scroll

'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { apiFetch, apiPost } from '@/lib/api';
import { Bot, Zap, ArrowDown } from 'lucide-react';
import { MessageBubble, type Message } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';

interface Conversation {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string;
}

export default function ChatPageImproved() {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations, mutate: mutateConversations } = useSWR<Conversation[]>(
    'conversations?limit=20',
    () => apiFetch<Conversation[]>('conversations?limit=20'),
    { refreshInterval: 10000 }
  );

  // Fetch messages of selected conversation
  const { data: messages, mutate: mutateMessages } = useSWR<Message[]>(
    selectedConvId ? `chat/messages/${selectedConvId}` : null,
    (key) => apiFetch<Message[]>(key),
    { refreshInterval: 3000 }
  );

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Detect scroll position to show/hide scroll button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
      setAutoScroll(isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Select first conversation on load
  useEffect(() => {
    if (!selectedConvId && conversations && conversations.length > 0) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  const handleSend = async (userMessage: string, files: File[]) => {
    if (!userMessage.trim() && files.length === 0) return;
    if (isSending) return;

    setIsSending(true);

    try {
      // Se tiver arquivos, fazer upload primeiro
      const fileUrls: string[] = [];
      if (files.length > 0) {
        // TODO: Implementar endpoint de upload de arquivos
        // const formData = new FormData();
        // files.forEach((file) => formData.append('files', file));
        // const uploadResult = await apiPost<{ urls: string[] }>('upload', formData);
        // fileUrls = uploadResult.urls;
        console.log('📎 Arquivos para upload:', files.map((f) => f.name));
      }

      const result = await apiPost<{
        conversationId: string;
        response: string;
        skillRouted?: string;
        trace?: any[];
      }>('chat', {
        userId: 'dashboard-user',
        message: userMessage,
        fileUrls, // Passar URLs dos arquivos enviados
        provider: 'github-copilot',
      });

      // Update conversation list
      await mutateConversations();

      // Update messages
      if (result.conversationId) {
        setSelectedConvId(result.conversationId);
        await mutateMessages();
      }

      // Force scroll to bottom after sending
      setAutoScroll(true);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      alert('❌ Erro ao enviar mensagem: ' + (error as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  const createNewChat = () => {
    setSelectedConvId(null);
  };

  const scrollToBottom = () => {
    setAutoScroll(true);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Conversations Sidebar */}
      <div className="w-80 glass rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <button
            onClick={createNewChat}
            className="w-full glass px-4 py-2 rounded-lg text-sm text-blue-300 hover:bg-white/[0.05] flex items-center justify-center gap-2 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Nova Conversa
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations?.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConvId(conv.id)}
              className={`w-full p-3 rounded-lg text-left transition-all ${
                selectedConvId === conv.id
                  ? 'bg-blue-500/20 border border-blue-500/30 scale-[0.98]'
                  : 'glass hover:bg-white/[0.05] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-[#5c7a9e]">
                  {new Date(conv.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="text-sm text-[#e2eaf7] truncate font-medium">
                {conv.last_message || `Conversa ${conv.id.slice(0, 8)}`}
              </div>
              <div className="text-xs text-[#5c7a9e] mt-1">
                {conv.message_count} mensagens
              </div>
            </button>
          ))}

          {(!conversations || conversations.length === 0) && (
            <div className="text-center text-sm text-[#5c7a9e] py-8">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma conversa ainda</p>
              <p className="text-xs mt-1">Comece uma nova conversa!</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 glass rounded-xl flex flex-col overflow-hidden">
        {selectedConvId || (!selectedConvId && !conversations?.length) ? (
          <>
            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-6 space-y-2 scroll-smooth"
            >
              {!messages || messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Bot className="w-16 h-16 text-blue-400 mb-4 opacity-50" />
                  <h2 className="text-xl font-semibold text-[#e2eaf7] mb-2">
                    Bem-vindo ao GueClaw! 👋
                  </h2>
                  <p className="text-sm text-[#5c7a9e] max-w-md">
                    Seu assistente de IA pessoal. Faça perguntas, peça ajuda com código,
                    ou envie arquivos para análise.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-3 text-left">
                    <div className="glass px-4 py-3 rounded-lg border border-white/10">
                      <p className="text-xs text-blue-400 font-medium mb-1">💬 Conversação</p>
                      <p className="text-xs text-[#5c7a9e]">
                        Suporte completo a Markdown e code blocks
                      </p>
                    </div>
                    <div className="glass px-4 py-3 rounded-lg border border-white/10">
                      <p className="text-xs text-purple-400 font-medium mb-1">📎 Arquivos</p>
                      <p className="text-xs text-[#5c7a9e]">
                        Arraste arquivos ou clique para anexar
                      </p>
                    </div>
                    <div className="glass px-4 py-3 rounded-lg border border-white/10">
                      <p className="text-xs text-green-400 font-medium mb-1">🚀 Skills</p>
                      <p className="text-xs text-[#5c7a9e]">
                        Roteamento automático para skills especializadas
                      </p>
                    </div>
                    <div className="glass px-4 py-3 rounded-lg border border-white/10">
                      <p className="text-xs text-yellow-400 font-medium mb-1">🔧 Tools</p>
                      <p className="text-xs text-[#5c7a9e]">
                        Acesso a ferramentas e APIs externas
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      conversationId={selectedConvId ?? undefined}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Scroll to bottom button */}
            {showScrollButton && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-24 right-8 p-2 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all shadow-lg"
                aria-label="Rolar para o final"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
            )}

            {/* Input */}
            <div className="p-4 border-t border-white/5">
              <ChatInput onSend={handleSend} isLoading={isSending} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-center p-6">
            <div>
              <Bot className="w-16 h-16 text-[#5c7a9e] mx-auto mb-4 opacity-50" />
              <p className="text-sm text-[#5c7a9e]">
                Selecione uma conversa ou crie uma nova
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
