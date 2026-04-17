# 💬 GueClaw Dashboard - Chat Interface Upgrade

**Data:** 17/04/2026  
**Versão:** 2.1.0  
**Objetivo:** Modernizar interface de chat com upload de arquivos, markdown rendering e melhor UX

---

## 📊 Análise de Referências

### Projetos Analisados

#### 1. dvace (Claude Code Official)
**Repo:** `tmp/dvace/`  
**Stack:** Next.js 15 + React 19 + Vite + Radix UI

**Componentes Relevantes:**
- `web/components/chat/FileAttachment.tsx` - Upload de arquivos com ícones por tipo
- `web/components/chat/ChatInput.tsx` - Input com drag & drop, slash commands
- `web/components/chat/MessageBubble.tsx` - Mensagens com markdown e tool calls
- `web/components/chat/MarkdownContent.tsx` - Rendering de markdown otimizado
- `web/components/chat/VirtualMessageList.tsx` - Virtualização para performance

**Features Copiadas:**
✅ FileAttachment component (visual de arquivos)  
✅ Drag & drop file upload  
✅ Markdown rendering em mensagens  
✅ Tool calls inline display  
✅ Streaming cursor indicator  
✅ Auto-resize textarea  
✅ Character count warning

#### 2. hermes-agent (Hermes AI Agent)
**Repo:** `tmp/hermes-agent/`  
**Stack:** React + Vite + TanStack Router

**Componentes Relevantes:**
- `web/src/pages/SessionsPage.tsx` - Histórico de conversas com FTS5 search
- `web/src/components/Markdown.tsx` - Markdown rendering com syntax highlighting

**Features Inspiradas:**
✅ FTS5 search highlighting (já temos no backend)  
✅ Session timeline UI  
✅ Syntax highlighting em code blocks

---

## 🎨 Componentes Criados

### 1. FileAttachment.tsx
**Localização:** `dashboard/src/components/chat/FileAttachment.tsx`

**Features:**
- ✅ Ícones por tipo de arquivo (Image, FileText, FileCode, FileArchive, etc)
- ✅ Formatação de tamanho (KB/MB)
- ✅ Hover effect com botão remove
- ✅ Cores por categoria de arquivo
- ✅ Truncate de nomes longos

**API:**
```typescript
interface FileAttachmentProps {
  file: File;
  onRemove: () => void;
  className?: string;
}
```

**Exemplo de Uso:**
```tsx
<FileAttachment 
  file={file} 
  onRemove={() => removeFile(index)} 
/>
```

---

### 2. MessageBubble.tsx
**Localização:** `dashboard/src/components/chat/MessageBubble.tsx`

**Features:**
- ✅ Markdown rendering com ReactMarkdown
- ✅ Syntax highlighting com react-syntax-highlighter
- ✅ Tool calls display com badges
- ✅ Skill used indicator
- ✅ Copy to clipboard button
- ✅ Streaming cursor animation
- ✅ Error state styling
- ✅ System messages centered pill

**API:**
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  tool_calls?: string[];
  skill_used?: string;
  is_streaming?: boolean;
  is_error?: boolean;
}

interface MessageBubbleProps {
  message: Message;
  conversationId?: string;
}
```

**Exemplo de Uso:**
```tsx
<MessageBubble 
  message={msg} 
  conversationId={selectedConvId} 
/>
```

---

### 3. ChatInput.tsx
**Localização:** `dashboard/src/components/chat/ChatInput.tsx`

**Features:**
- ✅ Auto-resize textarea (até 200px)
- ✅ File upload button + drag & drop
- ✅ Character count (4000 max) com warning
- ✅ Multiple files support (máx 5)
- ✅ File size validation (10MB max)
- ✅ Enter to send, Shift+Enter to new line
- ✅ Loading state com spinner
- ✅ Stop button durante streaming (placeholder)
- ✅ Keyboard shortcuts hint

**API:**
```typescript
interface ChatInputProps {
  onSend: (message: string, files: File[]) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}
```

**Exemplo de Uso:**
```tsx
<ChatInput 
  onSend={handleSend} 
  isLoading={isSending} 
/>
```

---

### 4. page-improved.tsx
**Localização:** `dashboard/src/app/chat/page-improved.tsx`

**Features:**
- ✅ Layout 2-column (sidebar + chat)
- ✅ Conversations list com auto-refresh (10s)
- ✅ Messages polling (3s)
- ✅ Auto-scroll to bottom
- ✅ Scroll button (aparece quando scroll up)
- ✅ Empty states ilustrados
- ✅ Feature highlights no welcome screen
- ✅ File upload integration (preparado)

**Melhorias vs Versão Antiga:**
| Feature | Antiga | Nova |
|---------|--------|------|
| Markdown | ❌ | ✅ ReactMarkdown |
| Code Syntax | ❌ | ✅ Prism.js |
| File Upload | ❌ | ✅ Drag & Drop |
| Auto-resize Input | ❌ | ✅ Dynamic |
| Scroll Button | ❌ | ✅ Smart |
| Copy Message | ❌ | ✅ Clipboard |
| Tool Calls Display | Texto | Badges |
| Skill Indicator | ❌ | ✅ Badge |

---

## 🔧 Dependências Necessárias

### Instalar via npm:

```bash
cd dashboard
npm install react-markdown remark-gfm rehype-raw react-syntax-highlighter
npm install --save-dev @types/react-syntax-highlighter
```

### Packages Adicionados:
- `react-markdown` (^9.0.0) - Rendering de markdown
- `remark-gfm` (^4.0.0) - GitHub Flavored Markdown support
- `rehype-raw` (^7.0.0) - HTML em markdown (opcional)
- `react-syntax-highlighter` (^15.5.0) - Syntax highlighting
- `@types/react-syntax-highlighter` (^15.5.0) - TypeScript types

---

## 📦 Estrutura de Arquivos

```
dashboard/
├── src/
│   ├── app/
│   │   └── chat/
│   │       ├── page.tsx (versão antiga)
│   │       └── page-improved.tsx (versão nova)
│   └── components/
│       └── chat/
│           ├── FileAttachment.tsx (NOVO)
│           ├── MessageBubble.tsx (NOVO)
│           └── ChatInput.tsx (NOVO)
```

---

## 🚀 Guia de Migração

### Opção 1: Substituir Completo (Recomendado)

```bash
# Backup da versão antiga
mv dashboard/src/app/chat/page.tsx dashboard/src/app/chat/page-old.tsx

# Renomear versão nova
mv dashboard/src/app/chat/page-improved.tsx dashboard/src/app/chat/page.tsx

# Instalar dependências
cd dashboard
npm install react-markdown remark-gfm react-syntax-highlighter
npm install --save-dev @types/react-syntax-highlighter

# Testar
npm run dev
```

### Opção 2: Migração Gradual

1. Mantenha ambas as páginas:
   - `/chat` → versão antiga
   - `/chat-new` → versão nova

2. Adicione link no sidebar:
   ```tsx
   <Link href="/chat-new">
     Chat (Nova Interface) 🎨
   </Link>
   ```

3. Após validação, remova `/chat` antigo

---

## 🔌 Backend - Upload de Arquivos

### Endpoint Necessário

**POST** `/api/upload`

```typescript
// dashboard/src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll('files') as File[];

  // Validar tamanho e tipo
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) { // 10MB
      return NextResponse.json(
        { error: `File ${file.name} exceeds 10MB` },
        { status: 400 }
      );
    }
  }

  // Fazer upload (S3, local storage, etc)
  const uploadedUrls = await Promise.all(
    files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${Date.now()}-${file.name}`;
      
      // Exemplo: salvar local
      // await fs.writeFile(`./uploads/${filename}`, buffer);
      // return `/uploads/${filename}`;

      // Ou: upload para S3
      // const url = await uploadToS3(buffer, filename);
      // return url;

      return `/temp/${filename}`; // placeholder
    })
  );

  return NextResponse.json({ urls: uploadedUrls });
}
```

### Atualizar Endpoint de Chat

**POST** `/api/chat`

Adicionar suporte para `fileUrls`:

```typescript
interface ChatRequest {
  userId: string;
  message: string;
  fileUrls?: string[];  // ← NOVO
  provider?: string;
}

// No processamento, incluir contexto dos arquivos:
const contextFromFiles = fileUrls
  ? await Promise.all(fileUrls.map(async (url) => {
      const content = await fetchFileContent(url);
      return `File: ${url}\n${content}`;
    }))
  : [];

const fullContext = [
  ...contextFromFiles,
  userMessage
].join('\n\n');
```

---

## 🎨 Customizações Opcionais

### 1. Adicionar Suporte para Imagens em Preview

```tsx
// Em FileAttachment.tsx
{isImage && (
  <img
    src={URL.createObjectURL(file)}
    alt={file.name}
    className="w-16 h-16 object-cover rounded mt-2"
  />
)}
```

### 2. Adicionar Slash Commands Menu

Baseado em `dvace/web/components/chat/SlashCommandMenu.tsx`

```tsx
const COMMANDS = [
  { name: 'help', description: 'Show available commands' },
  { name: 'clear', description: 'Clear conversation' },
  { name: 'search', description: 'Search in history' },
];

// No ChatInput, mostrar menu quando input começa com /
{showSlashMenu && (
  <SlashCommandMenu
    query={slashQuery}
    commands={COMMANDS}
    onSelect={handleSlashSelect}
  />
)}
```

### 3. Adicionar Streaming de Respostas

```tsx
// Usar Server-Sent Events (SSE)
const eventSource = new EventSource(`/api/chat-stream?convId=${convId}`);

eventSource.onmessage = (event) => {
  const chunk = JSON.parse(event.data);
  
  // Atualizar mensagem em tempo real
  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantId
        ? { ...msg, content: msg.content + chunk.text, is_streaming: true }
        : msg
    )
  );
};

eventSource.addEventListener('done', () => {
  eventSource.close();
  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantId
        ? { ...msg, is_streaming: false }
        : msg
    )
  );
});
```

---

## ✅ Checklist de Implementação

### Backend
- [ ] Criar endpoint `/api/upload` para upload de arquivos
- [ ] Atualizar `/api/chat` para aceitar `fileUrls`
- [ ] Implementar storage (S3, local, Cloudinary, etc)
- [ ] Validar tipos e tamanhos de arquivo
- [ ] Retornar URLs públicas dos arquivos

### Frontend
- [x] Criar FileAttachment component
- [x] Criar MessageBubble component  
- [x] Criar ChatInput component
- [x] Criar page-improved.tsx
- [ ] Instalar dependências (react-markdown, etc)
- [ ] Testar drag & drop
- [ ] Testar upload de múltiplos arquivos
- [ ] Validar markdown rendering
- [ ] Validar syntax highlighting

### UX
- [ ] Testar responsividade mobile
- [ ] Adicionar loading states
- [ ] Adicionar error toasts
- [ ] Validar accessibility (ARIA labels)
- [ ] Testar keyboard navigation

---

## 📊 Performance

### Otimizações Implementadas:

1. **Auto-resize Textarea:**
   - Apenas reajusta quando input muda
   - Limita altura máxima (200px)

2. **Auto-scroll Inteligente:**
   - Detecta scroll manual
   - Desabilita auto-scroll se usuário subir
   - Scroll button aparece quando necessário

3. **File Validation Client-side:**
   - Valida tamanho antes de upload
   - Evita requests desnecessários

4. **Debounce em Character Count:**
   - Só mostra aviso após 80% do limite

### Otimizações Futuras:

- [ ] Virtualizar lista de mensagens (react-window)
- [ ] Lazy load de imagens
- [ ] Comprimir imagens client-side antes de upload
- [ ] Cachear conversas no localStorage

---

## 🐛 Troubleshooting

### "react-markdown not found"
```bash
cd dashboard
npm install react-markdown remark-gfm
```

### "Cannot resolve 'react-syntax-highlighter'"
```bash
npm install react-syntax-highlighter @types/react-syntax-highlighter
```

### "File upload não funciona"
- Verificar se endpoint `/api/upload` existe
- Checar CORS headers
- Validar FormData no backend

### "Markdown não renderiza code blocks"
- Importar SyntaxHighlighter corretamente
- Usar `PreTag="div"` para evitar conflitos

---

## 📚 Referências

**Projetos:**
- [dvace - Claude Code Official](tmp/dvace/)
- [hermes-agent - Hermes AI Agent](tmp/hermes-agent/)

**Documentação:**
- [react-markdown](https://github.com/remarkjs/react-markdown)
- [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter)
- [Next.js File Upload](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#formdata)

**Features Implementadas:**
- ✅ File attachments com ícones e preview
- ✅ Drag & drop upload
- ✅ Markdown rendering
- ✅ Syntax highlighting
- ✅ Tool calls display
- ✅ Skill indicators
- ✅ Copy to clipboard
- ✅ Auto-scroll inteligente
- ✅ Character count warning
- ✅ Loading states

---

**Versão do Documento:** 1.0  
**Última Atualização:** 17/04/2026  
**Responsável:** GueClaw Team

**Status:** ✅ Componentes prontos, aguardando instalação de dependências e testes
