'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { 
  DocumentIcon, 
  CodeBracketIcon, 
  PhotoIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  FolderIcon,
  CalendarIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface FileItem {
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  modified: string;
  type: 'html' | 'json' | 'txt' | 'md' | 'csv' | 'pdf' | 'png' | 'jpg' | 'other';
  icon: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const getFileIcon = (type: string) => {
  switch (type) {
    case 'html':
    case 'json':
    case 'txt':
    case 'md':
    case 'csv':
      return CodeBracketIcon;
    case 'pdf':
      return DocumentIcon;
    case 'png':
    case 'jpg':
      return PhotoIcon;
    default:
      return DocumentIcon;
  }
};

const getFileColor = (type: string) => {
  switch (type) {
    case 'html': return 'text-orange-500';
    case 'json': return 'text-yellow-500';
    case 'txt': return 'text-gray-500';
    case 'md': return 'text-blue-500';
    case 'csv': return 'text-green-500';
    case 'pdf': return 'text-red-500';
    case 'png':
    case 'jpg': return 'text-purple-500';
    default: return 'text-gray-400';
  }
};

export default function FilesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  const { data: files, error, mutate } = useSWR<FileItem[]>(
    '/api/files',
    fetcher,
    { refreshInterval: 10000 } // Auto-refresh a cada 10s
  );

  const filteredFiles = files?.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || file.type === selectedType;
    return matchesSearch && matchesType;
  }) || [];

  const fileTypes = ['all', 'html', 'json', 'txt', 'md', 'csv', 'pdf', 'png', 'jpg'];

  const handleDownload = async (file: FileItem) => {
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(file.name)}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      alert('Erro ao baixar arquivo. Tente novamente.');
    }
  };

  const handlePreview = (file: FileItem) => {
    window.open(`/api/files/${encodeURIComponent(file.name)}?preview=true`, '_blank');
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">Erro ao carregar arquivos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderIcon className="w-8 h-8 text-cyan-400" />
            Repositório de Arquivos
          </h1>
          <p className="text-gray-400 mt-1">
            Todos os arquivos criados via Telegram ou Web
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg 
                     transition-colors flex items-center gap-2 text-white"
        >
          <ArrowPathIcon className="w-5 h-5" />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <p className="text-gray-400 text-sm">Total de Arquivos</p>
          <p className="text-2xl font-bold text-white mt-1">
            {files?.length || 0}
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <p className="text-gray-400 text-sm">HTML/Páginas</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">
            {files?.filter(f => f.type === 'html').length || 0}
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <p className="text-gray-400 text-sm">JSON/Dados</p>
          <p className="text-2xl font-bold text-yellow-500 mt-1">
            {files?.filter(f => f.type === 'json').length || 0}
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <p className="text-gray-400 text-sm">Imagens</p>
          <p className="text-2xl font-bold text-purple-500 mt-1">
            {files?.filter(f => ['png', 'jpg'].includes(f.type)).length || 0}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar arquivos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg
                       text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                       focus:ring-cyan-500/50"
          />
        </div>

        {/* Type Filter */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white
                     focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          {fileTypes.map(type => (
            <option key={type} value={type} className="bg-gray-900">
              {type === 'all' ? 'Todos os tipos' : `.${type}`}
            </option>
          ))}
        </select>
      </div>

      {/* Files List */}
      {!files ? (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-12 border border-white/10">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          </div>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-12 border border-white/10 text-center">
          <FolderIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">
            {searchTerm || selectedType !== 'all' 
              ? 'Nenhum arquivo encontrado com os filtros selecionados'
              : 'Nenhum arquivo no repositório ainda'}
          </p>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Arquivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Tamanho
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Modificado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredFiles.map((file) => {
                  const Icon = getFileIcon(file.type);
                  const colorClass = getFileColor(file.type);
                  
                  return (
                    <tr 
                      key={file.path}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <Icon className={`w-5  h-5 ${colorClass}`} />
                          <span className="text-white font-medium">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm ${colorClass} font-mono`}>
                          .{file.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm">
                        {file.sizeFormatted}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          {file.modified}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        {['html', 'txt', 'md', 'json'].includes(file.type) && (
                          <button
                            onClick={() => handlePreview(file)}
                            className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 
                                     text-blue-400 rounded-lg transition-colors text-sm"
                          >
                            Visualizar
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(file)}
                          className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 
                                   text-green-400 rounded-lg transition-colors inline-flex 
                                   items-center gap-2 text-sm"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                          Baixar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
