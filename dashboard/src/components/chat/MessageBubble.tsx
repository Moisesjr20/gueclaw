// 💬 Componente de MessageBubble para GueClaw Dashboard
// Baseado em: dvace/web/components/chat/MessageBubble.tsx
// Adaptado para a stack GueClaw (Next.js + Tailwind + ReactMarkdown)

import { Bot, User, Copy, Check, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  tool_calls?: string[];
  skill_used?: string;
  is_streaming?: boolean;
  is_error?: boolean;
}

export interface MessageBubbleProps {
  message: Message;
  conversationId?: string;
}

export function MessageBubble({ message, conversationId: _conversationId }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isError = message.is_error;
  const isStreaming = message.is_streaming;

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API não disponível
    }
  }, [message.content]);

  // System messages: centered pill
  if (isSystem) {
    return (
      <div className="flex justify-center py-2" role="note">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/10">
          <AlertCircle className="w-3.5 h-3.5 text-[#5c7a9e]" aria-hidden />
          <span className="text-xs text-[#5c7a9e]">{message.content}</span>
        </div>
      </div>
    );
  }

  // User message: right-aligned, blue
  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="flex-1">
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-2xl rounded-br-sm px-4 py-3 text-sm text-[#e2eaf7]">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
            <div className="flex items-center justify-end gap-2 mt-1 px-2">
              <span className="text-xs text-[#5c7a9e]">
                {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-white/[0.05] text-[#5c7a9e] hover:text-blue-400 transition-colors"
                aria-label="Copiar mensagem"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-blue-400" aria-hidden />
          </div>
        </div>
      </div>
    );
  }

  // Assistant message: left-aligned, with markdown & tools
  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start gap-3 max-w-[80%]">
        <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-green-400" aria-hidden />
        </div>
        <div className="flex-1">
          <div
            className={`rounded-2xl rounded-tl-sm px-4 py-3 text-sm ${
              isError
                ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                : 'glass border border-white/10 text-[#e2eaf7]'
            }`}
          >
            <ReactMarkdown
              components={{
                code({ node: _node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-lg text-xs my-2"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code
                      className="bg-white/5 border border-white/10 px-1 py-0.5 rounded text-xs text-blue-300 font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span
                aria-hidden="true"
                className="inline-block w-1.5 h-4 bg-green-400 ml-1 animate-pulse"
              />
            )}
          </div>

          {/* Tool calls display */}
          {message.tool_calls && message.tool_calls.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.tool_calls.map((tool, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs"
                >
                  <Zap className="w-3 h-3 text-purple-400" aria-hidden />
                  <span className="text-purple-300 font-mono">{tool}</span>
                </div>
              ))}
            </div>
          )}

          {/* Skill badge */}
          {message.skill_used && (
            <div className="mt-2 flex items-center gap-2 px-3 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs w-fit">
              <CheckCircle2 className="w-3 h-3 text-yellow-400" aria-hidden />
              <span className="text-yellow-300">Skill: {message.skill_used}</span>
            </div>
          )}

          <div className="flex items-center justify-between mt-1 px-2">
            <span className="text-xs text-[#5c7a9e]">
              {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-white/[0.05] text-[#5c7a9e] hover:text-green-400 transition-colors"
              aria-label="Copiar mensagem"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
