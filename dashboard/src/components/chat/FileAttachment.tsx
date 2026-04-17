// 📎 Componente de FileAttachment para GueClaw Dashboard
// Baseado em: dvace/web/components/chat/FileAttachment.tsx
// Adaptado para a stack GueClaw (Next.js + Tailwind)

import { X, File, Image, FileText, FileCode, FileArchive, FileSpreadsheet } from 'lucide-react';

export interface FileAttachmentProps {
  file: File;
  onRemove: () => void;
  className?: string;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  if (type.startsWith('text/')) return FileText;
  if (
    type.includes('javascript') ||
    type.includes('typescript') ||
    type.includes('json') ||
    type.includes('xml') ||
    type.includes('python') ||
    type.includes('java')
  ) {
    return FileCode;
  }
  if (type.includes('zip') || type.includes('tar') || type.includes('rar')) {
    return FileArchive;
  }
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) {
    return FileSpreadsheet;
  }
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileTypeColor(type: string): string {
  if (type.startsWith('image/')) return 'text-purple-400';
  if (type.startsWith('text/')) return 'text-blue-400';
  if (type.includes('javascript') || type.includes('typescript')) return 'text-yellow-400';
  if (type.includes('python')) return 'text-green-400';
  if (type.includes('json')) return 'text-orange-400';
  if (type.includes('zip') || type.includes('tar')) return 'text-red-400';
  return 'text-gray-400';
}

export function FileAttachment({ file, onRemove, className = '' }: FileAttachmentProps) {
  const Icon = getFileIcon(file.type);
  const isImage = file.type.startsWith('image/');
  const colorClass = getFileTypeColor(file.type);

  return (
    <div
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg glass border border-white/10 text-sm max-w-xs hover:border-blue-500/30 hover:bg-white/[0.05] transition-all ${className}`}
    >
      <Icon className={`w-4 h-4 ${colorClass} flex-shrink-0`} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#e2eaf7] truncate font-medium">{file.name}</p>
        {!isImage && (
          <p className="text-xs text-[#5c7a9e]">{formatFileSize(file.size)}</p>
        )}
      </div>
      <button
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-[#5c7a9e] hover:text-red-400 hover:bg-red-500/10 transition-all"
      >
        <X className="w-3.5 h-3.5" aria-hidden />
      </button>
    </div>
  );
}
