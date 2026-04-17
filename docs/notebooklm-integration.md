# NotebookLM Integration para GueClaw

Integração do Google NotebookLM via `notebooklm-py` para permitir RAG (Retrieval Augmented Generation) completo no GueClaw.

---

## ✅ Instalação

### 1. Instalar Python (se necessário)

```bash
# Verifique se Python 3.8+ está instalado
python --version
# ou
python3 --version
```

### 2. Instalar notebooklm-py

```bash
pip install notebooklm-py

# Para autenticação via browser (recomendado)
pip install notebooklm-py[browser]
playwright install chromium
```

### 3. Login no NotebookLM

```bash
# Faça login na sua conta Google (abre browser)
notebooklm login
```

---

## 🛠️ Ferramentas Disponíveis

A ferramenta `NotebookLM` está disponível com as seguintes ações:

| Ação | Descrição | Parâmetros |
|------|-----------|------------|
| `login` | Verifica/faz login no NotebookLM | - |
| `list_sources` | Lista todas as fontes disponíveis | - |
| `add_source` | Adiciona um documento (PDF, TXT, etc) | `file_path`, `title` (opcional) |
| `delete_source` | Remove uma fonte | `source_id` |
| `generate_audio` | Gera podcast/áudio da fonte | `source_id` |
| `chat` | Conversa RAG com a fonte | `source_id`, `message` |

---

## 💡 Exemplos de Uso

### Adicionar um PDF

```
Usuário: Adicione o arquivo ./documentos/relatorio.pdf ao NotebookLM

Agente: [Executa NotebookLM.add_source]
✅ Fonte 'relatorio.pdf' adicionada com sucesso
ID: abc-123-xyz
```

### Chat RAG

```
Usuário: Pergunte ao NotebookLM sobre o relatório abc-123-xyz: "Quais são as principais conclusões?"

Agente: [Executa NotebookLM.chat]
🤖 Resposta do NotebookLM:
"As principais conclusões do relatório são:
1. Aumento de 25% na receita
2. Expansão para 3 novos mercados
3. Redução de custos operacionais em 15%"
```

### Gerar Podcast

```
Usuário: Gere um podcast do documento abc-123-xyz

Agente: [Executa NotebookLM.generate_audio]
🎧 Podcast gerado!
URL: https://notebooklm.google.com/.../audio
```

### Listar Fontes

```
Usuário: Liste minhas fontes no NotebookLM

Agente: [Executa NotebookLM.list_sources]
📚 Fontes encontradas: 3

1. relatorio.pdf (ID: abc-123)
2. artigo.txt (ID: def-456)
3. manual.md (ID: ghi-789)
```

---

## 🔧 Fluxo de Trabalho Completo

```
1. Adicionar documento
   → NotebookLM.add_source(file_path="./doc.pdf")
   → Retorna source_id

2. Fazer perguntas (RAG)
   → NotebookLM.chat(source_id="...", message="...")
   → Retorna resposta contextualizada

3. Gerar conteúdo
   → NotebookLM.generate_audio(source_id="...")
   → Retorna URL do podcast

4. Limpar (opcional)
   → NotebookLM.delete_source(source_id="...")
   → Remove a fonte
```

---

## ⚠️ Notas Importantes

1. **Autenticação**: O login é feito uma vez via CLI e salvo localmente
2. **Formatos suportados**: PDF, TXT, MD, HTML, DOCX
3. **Limites**: Consulte os limites do NotebookLM no plano Google
4. **Persistência**: As fontes persistem na conta Google

---

## 🐛 Troubleshooting

### "notebooklm-py não instalado"

```bash
pip install notebooklm-py
```

### "Erro no login"

```bash
# Tente fazer login manualmente
notebooklm login

# Depois verifique
notebooklm list
```

### "Arquivo não encontrado"

- Use caminhos absolutos ou relativos ao diretório do GueClaw
- Verifique permissões de leitura

### "Timeout na execução"

- Operações como upload de PDF grandes podem demorar
- O timeout padrão é de 60 segundos

---

## 📚 Recursos

- [Repositório notebooklm-py](https://github.com/teng-lin/notebooklm-py)
- [Documentação NotebookLM](https://notebooklm.google.com)

---

> **Nota**: Esta integração foi adicionada ao GueClaw v2.0.0+
