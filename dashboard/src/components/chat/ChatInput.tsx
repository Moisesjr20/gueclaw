// 📝 Componente de ChatInput para GueClaw Dashboard
// Baseado em: dvace/web/components/chat/ChatInput.tsx
// Adaptado com upload de arquivos, drag & drop, e melhor UX

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, Square, Loader2 } from 'lucide-react';
import { FileAttachment } from './FileAttachment';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

export interface ChatInputProps {
  onSend: (message: string, files: File[]) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  isLoading = false,
  placeholder = 'Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)',
  disabled = false,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    if (isLoading || disabled) return;

    try {
      await onSend(text, attachments);
      setInput('');
      setAttachments([]);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.focus();
        }
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [input, attachments, isLoading, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        alert(`❌ Arquivo "${file.name}" excede o tamanho máximo de 10MB`);
        return false;
      }
      return true;
    });

    setAttachments((prev) => {
      const newFiles = [...prev, ...validFiles];
      if (newFiles.length > MAX_FILES) {
        alert(`⚠️ Máximo de ${MAX_FILES} arquivos permitidos`);
        return prev;
      }
      return newFiles;
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const removeFile = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStop = useCallback(() => {
    // TODO: Implementar abort controller se suportar streaming
    console.log('Stop requested');
  }, []);

  const charCount = input.length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;
  const canSend = (input.trim() || attachments.length > 0) && !isLoading && !disabled && !isOverLimit;

  return (
    <div className="relative">
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 rounded-xl bg-blue-500/20 border-2 border-dashed border-blue-500 flex items-center justify-center">
          <div className="text-center">
            <Paperclip className="w-12 h-12 text-blue-400 mx-auto mb-2" />
            <p className="text-sm text-blue-300 font-medium">Solte os arquivos aqui</p>
          </div>
        </div>
      )}

      {/* Attachments display */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-2 glass rounded-lg border border-white/10">
          {attachments.map((file, idx) => (
            <FileAttachment key={idx} file={file} onRemove={() => removeFile(idx)} />
          ))}
        </div>
      )}

      {/* Input area */}
      <div
        className={`relative glass rounded-xl border ${
          isDragOver
            ? 'border-blue-500/50'
            : isOverLimit
            ? 'border-red-500/50'
            : 'border-white/10'
        } transition-colors`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className="w-full px-4 py-3 bg-transparent text-[#e2eaf7] text-sm placeholder-[#5c7a9e] resize-none focus:outline-none pr-24"
          style={{ maxHeight: '200px' }}
        />

        {/* Character count */}
        {charCount > MAX_MESSAGE_LENGTH * 0.8 && (
          <div className="absolute bottom-2 left-3 text-xs">
            <span className={isOverLimit ? 'text-red-400' : 'text-[#5c7a9e]'}>
              {charCount}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          {/* File upload button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            accept="image/*,text/*,application/pdf,.doc,.docx,.txt,.md,.json,.csv"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isLoading || attachments.length >= MAX_FILES}
            className="p-2 rounded-lg text-[#5c7a9e] hover:text-blue-400 hover:bg-white/[0.05] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Anexar arquivo"
            title={`Anexar arquivo (máx ${MAX_FILES})`}
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Send/Stop button */}
          {isLoading ? (
            <button
              onClick={handleStop}
              className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
              aria-label="Parar geração"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className={`p-2 rounded-lg transition-all ${
                canSend
                  ? 'text-blue-400 hover:bg-blue-500/20 hover:scale-105'
                  : 'text-[#5c7a9e] cursor-not-allowed opacity-50'
              }`}
              aria-label="Enviar mensagem"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Helper text */}
      <div className="flex items-center justify-between mt-1 px-1">
        <span className="text-xs text-[#5c7a9e]">
          {attachments.length > 0 && `${attachments.length} arquivo(s) anexado(s)`}
        </span>
        <span className="text-xs text-[#5c7a9e]">
          Enter para enviar • Shift+Enter para nova linha
        </span>
      </div>
    </div>
  );
}
