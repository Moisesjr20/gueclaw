# 🔐 Guia Visual: Editar .env com nano na VPS

## 🎯 Objetivo
Adicionar `DASHBOARD_PASSWORD_HASH` no `.env` dentro da VPS usando o editor nano.

---

## 📺 Passo a Passo com Screenshots

### 1️⃣ **Conectar à VPS**

```bash
ssh -i C:\Users\kyriu\.ssh\gueclaw_vps root@147.93.69.211
```

Você verá algo assim:
```
Welcome to Ubuntu 20.04.6 LTS (GNU/Linux 5.4.0-169-generic x86_64)
Last login: Mon Apr 08 10:30:25 2026 from 181.191.169.255
root@vps:~#
```

---

### 2️⃣ **Abrir o arquivo .env com nano**

```bash
nano /opt/gueclaw-agent/.env
```

A tela ficará assim:
```
  GNU nano 4.8    /opt/gueclaw-agent/.env    Modified

# ============================================
# GueClaw Agent Configuration
# ============================================

# ===== Telegram Configuration =====
TELEGRAM_BOT_TOKEN=8699533961:AAHrbwr8VrJFB1n22OakwyYijCWd9RlTRLc
...


^G Get Help  ^O Write Out  ^W Where Is   ^K Cut Text
^X Exit      ^R Read File  ^\ Replace    ^U Paste Text
```

---

### 3️⃣ **Navegar até o final do arquivo**

**Opção A: Usando atalho**
- Pressione: `Alt + /` (vai para o final)

**Opção B: Usando setas**
- Use as setas ↓ até chegar ao final

**Opção C: Buscar pela seção**
- Pressione: `Ctrl + W` (Where Is - buscar)
- Digite: `FILES_REPOSITORY_PATH`
- Pressione: `Enter`

Você verá:
```
# ===== File Repository =====
FILES_REPOSITORY_PATH=/opt/gueclaw-data/files

# ===== Google Calendar Configuration =====  ← Cursor deve estar aqui ou abaixo
...
```

---

### 4️⃣ **Posicionar o cursor**

- Use as setas para colocar o cursor **NO FINAL da linha** `FILES_REPOSITORY_PATH=/opt/gueclaw-data/files`
- Pressione `End` para ir ao final da linha
- Pressione `Enter` DUAS vezes para criar espaço

Ficará assim:
```
FILES_REPOSITORY_PATH=/opt/gueclaw-data/files
<linha em branco>
<cursor aqui>
# ===== Google Calendar Configuration =====
```

---

### 5️⃣ **Digitar a nova configuração**

Digite **exatamente** o seguinte (copie e cole se possível):

```env
# ===== Dashboard Security =====
# Senha para acessar o dashboard (armazenada em base64)
# Para gerar novo hash: node -e "console.log(Buffer.from('SUA_SENHA').toString('base64'))"
# Senha padrão: GueClaw2026@Secure
DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl
```

**IMPORTANTE:** Copie cada linha com atenção! Não pode ter espaços extras ou erros de digitação.

---

### 6️⃣ **Verificar se está correto**

Antes de salvar, revise:

✅ **Checklist:**
- [ ] Comentário `# ===== Dashboard Security =====` presente
- [ ] Linha `DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl` sem espaços extras
- [ ] Hash correto: `R3VlQ2xhdzIwMjZAU2VjdXJl`
- [ ] Sem caracteres estranhos

---

### 7️⃣ **Salvar o arquivo**

1. Pressione: `Ctrl + O` (Write Out - salvar)
   
   Você verá na parte inferior:
   ```
   File Name to Write: /opt/gueclaw-agent/.env
   ```

2. Pressione: `Enter` (confirma o nome)

   Você verá:
   ```
   [ Wrote 145 lines ]
   ```

3. **NÃO SAIA AINDA!** Vamos verificar primeiro.

---

### 8️⃣ **Verificar se salvou corretamente**

Ainda dentro do nano:

1. Pressione: `Ctrl + W` (buscar)
2. Digite: `DASHBOARD_PASSWORD_HASH`
3. Pressione: `Enter`

O cursor deve ir para a linha:
```
DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl
         ↑ cursor aqui
```

Se encontrou, está OK! ✅

---

### 9️⃣ **Sair do nano**

Pressione: `Ctrl + X` (Exit)

Você voltará ao terminal:
```
root@vps:/opt/gueclaw-agent#
```

---

### 🔟 **Confirmar que foi salvo**

Execute este comando para ver se está lá:

```bash
grep DASHBOARD_PASSWORD_HASH /opt/gueclaw-agent/.env
```

**Deve retornar:**
```
DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl
```

✅ **Se apareceu, está PERFEITO!**

❌ **Se não apareceu nada:**
- Volte ao passo 2 e tente novamente
- OU use o método alternativo (echo) abaixo

---

## 🚀 Método Alternativo (Se nano não funcionou)

Se você teve dificuldade com nano, use este comando direto:

```bash
# Backup do .env atual (por segurança)
cp /opt/gueclaw-agent/.env /opt/gueclaw-agent/.env.backup

# Adicionar ao final do arquivo
cat >> /opt/gueclaw-agent/.env << 'EOF'

# ===== Dashboard Security =====
# Senha para acessar o dashboard (armazenada em base64)
# Para gerar novo hash: node -e "console.log(Buffer.from('SUA_SENHA').toString('base64'))"
# Senha padrão: GueClaw2026@Secure
DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl
EOF

# Verificar
tail -10 /opt/gueclaw-agent/.env
```

---

## ⌨️ Resumo dos Comandos Nano

| Tecla | Ação |
|-------|------|
| `Ctrl + O` | **Salvar** (Write Out) |
| `Ctrl + X` | **Sair** |
| `Ctrl + W` | **Buscar** texto |
| `Ctrl + K` | **Recortar** linha inteira |
| `Ctrl + U` | **Colar** |
| `Alt + /` | Ir para **fim do arquivo** |
| `Alt + \` | Ir para **início do arquivo** |
| `Ctrl + G` | **Ajuda** |
| `Ctrl + C` | Ver **posição do cursor** (linha e coluna) |

---

## 🎨 Dicas Visuais

### ✅ Linha CORRETA:
```env
DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl
```

### ❌ Erros comuns:

```env
# ERRO 1: Espaços ao redor do =
DASHBOARD_PASSWORD_HASH = R3VlQ2xhdzIwMjZAU2VjdXJl

# ERRO 2: Hash errado ou incompleto
DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZA

# ERRO 3: Aspas (não use!)
DASHBOARD_PASSWORD_HASH="R3VlQ2xhdzIwMjZAU2VjdXJl"
```

---

## 🔍 Como Verificar se Está Funcionando

Depois de salvar e sair:

```bash
# 1. Verificar se a variável existe
grep DASHBOARD_PASSWORD_HASH /opt/gueclaw-agent/.env

# 2. Ver o contexto completo (10 linhas ao redor)
grep -A 5 -B 5 DASHBOARD_PASSWORD_HASH /opt/gueclaw-agent/.env

# 3. Ver as últimas 20 linhas do arquivo
tail -20 /opt/gueclaw-agent/.env
```

---

## 🆘 Troubleshooting

### Problema: "nano: command not found"

**Solução:**
```bash
# Instalar nano
apt update
apt install nano -y

# OU usar vi (mais complicado)
vi /opt/gueclaw-agent/.env
```

### Problema: Arquivo está em modo somente leitura

**Solução:**
```bash
# Dar permissão de escrita
chmod 644 /opt/gueclaw-agent/.env

# Tentar novamente
nano /opt/gueclaw-agent/.env
```

### Problema: Salvei mas não aparece

**Solução:**
```bash
# Ver o arquivo inteiro
cat /opt/gueclaw-agent/.env

# Contar linhas
wc -l /opt/gueclaw-agent/.env

# Se não salvou, usar método alternativo (cat >> )
```

### Problema: Fechei sem salvar (Ctrl+X sem Ctrl+O)

**Solução:**
```bash
# Reabrir
nano /opt/gueclaw-agent/.env

# Nano pergunta: "Save modified buffer?"
# Pressione: Y (Yes)
# Pressione: Enter
```

---

## 🎓 Para Iniciantes no Linux

Se você nunca usou nano antes:

1. **Nano é como o Bloco de Notas do Windows**, mas no terminal
2. **Não use o mouse** - só funciona com teclado
3. **Ctrl+O salva**, **Ctrl+X sai** - sempre nessa ordem!
4. **Leia a barra inferior** - mostra os comandos disponíveis
5. **^ significa Ctrl** - então ^O = Ctrl+O

---

## 📝 Template Pronto para Copiar/Colar

Se você conseguir copiar/colar no terminal SSH:

```env

# ===== Dashboard Security =====
# Senha para acessar o dashboard (armazenada em base64)
# Para gerar novo hash: node -e "console.log(Buffer.from('SUA_SENHA').toString('base64'))"
# Senha padrão: GueClaw2026@Secure
DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl
```

**Como colar no terminal:**
- **Windows Terminal / PowerShell:** Botão direito do mouse
- **PuTTY:** Botão direito do mouse
- **MobaXterm:** Ctrl+Shift+V

---

**✅ Pronto! Agora você sabe editar o .env na VPS com nano!**
