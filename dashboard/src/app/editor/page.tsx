'use client';

import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import useSWR from 'swr';
import { apiFetch, apiPost } from '@/lib/api';
import { Save, Play, FileCode, Terminal, Sparkles } from 'lucide-react';

interface SkillFile {
  name: string;
  path: string;
  content: string;
  language: string;
}

const EXAMPLE_PROMPTS = [
  { name: 'proposal-generator', language: 'markdown' },
  { name: 'code-reviewer', language: 'markdown' },
  { name: 'documentation-generator', language: 'markdown' },
];

export default function EditorPage() {
  const [selectedFile, setSelectedFile] = useState<string>('proposal-generator');
  const [editorContent, setEditorContent] = useState<string>('');
  const [language, setLanguage] = useState<string>('markdown');
  const [isSaving, setIsSaving] = useState(false);
  const [output, setOutput] = useState<string>('');

  // Buscar conteúdo da skill selecionada
  const fetcher = async (key: string) => {
    try {
      return await apiFetch<SkillFile>(key);
    } catch {
      return {
        name: selectedFile,
        path: `.agents/skills/${selectedFile}/SKILL.md`,
        content: `# Skill: ${selectedFile}\n\nCarregue o conteúdo da skill aqui...`,
        language: 'markdown',
      };
    }
  };
  
  const { data: skillContent, isLoading } = useSWR<SkillFile>(
    selectedFile ? `skills/files/${selectedFile}` : null,
    fetcher,
  );

  useEffect(() => {
    if (skillContent) {
      setEditorContent(skillContent.content);
      setLanguage(skillContent.language || 'markdown');
    }
  }, [skillContent]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiPost(`skills/files/${selectedFile}`, { content: editorContent });
      alert('✅ Skill salva com sucesso!');
    } catch (error) {
      alert('❌ Erro ao salvar: ' + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setOutput('🚀 Executando skill...\n\n');
    try {
      const result = await apiPost(`skills/execute`, {
        skill: selectedFile,
        input: 'Teste via dashboard',
      });
      setOutput((prev) => prev + '✅ Resultado:\n\n' + JSON.stringify(result, null, 2));
    } catch (error) {
      setOutput((prev) => prev + '❌ Erro:\n\n' + (error as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e2eaf7]">Editor de Skills</h1>
          <p className="text-sm text-[#5c7a9e] mt-0.5">
            Edite prompts, código e configurações das skills
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            className="glass px-4 py-2 rounded-lg text-sm text-green-400 hover:bg-white/[0.05] flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Testar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="glass px-4 py-2 rounded-lg text-sm text-blue-400 hover:bg-white/[0.05] flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* File Selector */}
      <div className="glass p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <FileCode className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-[#5c7a9e]">Selecione uma skill:</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt.name}
              onClick={() => setSelectedFile(prompt.name)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                selectedFile === prompt.name
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'glass text-[#5c7a9e] hover:bg-white/[0.05]'
              }`}
            >
              {prompt.name}
            </button>
          ))}
        </div>
      </div>

      {/* Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monaco Editor */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="bg-[#0a1628] px-4 py-2 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-[#e2eaf7] font-mono">
                {skillContent?.path || 'SKILL.md'}
              </span>
            </div>
            <span className="text-xs text-[#5c7a9e] uppercase">{language}</span>
          </div>
          <Editor
            height="600px"
            defaultLanguage={language}
            language={language}
            value={editorContent}
            onChange={(value) => setEditorContent(value || '')}
            theme="vs-dark"
            loading={isLoading ? 'Carregando...' : undefined}
            options={{
              fontSize: 14,
              minimap: { enabled: true },
              wordWrap: 'on',
              lineNumbers: 'on',
              folding: true,
              renderWhitespace: 'boundary',
              bracketPairColorization: { enabled: true },
              formatOnPaste: true,
              formatOnType: true,
            }}
          />
        </div>

        {/* Output Terminal */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="bg-[#0a1628] px-4 py-2 border-b border-white/5 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-green-400" />
            <span className="text-sm text-[#e2eaf7]">Output</span>
          </div>
          <div className="p-4 font-mono text-sm text-[#c5d5e8] whitespace-pre-wrap overflow-y-auto h-[600px] bg-black/20">
            {output || '// Clique em "Testar" para executar a skill...'}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass p-4 rounded-lg">
        <div className="text-sm text-[#5c7a9e] mb-3">⚡ Ações Rápidas:</div>
        <div className="flex gap-2 flex-wrap">
          <QuickAction label="Ver Logs" onClick={() => (window.location.href = '/logs')} />
          <QuickAction
            label="Executar via Telegram"
            onClick={() => alert('Envie /skill ' + selectedFile + ' no Telegram')}
          />
          <QuickAction label="Ver Estatísticas" onClick={() => (window.location.href = '/overview')} />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass px-3 py-1.5 rounded text-xs text-[#5c7a9e] hover:bg-white/[0.05] hover:text-blue-300 transition-colors"
    >
      {label}
    </button>
  );
}
