[10/03/2026 17:32] @gueclaw_bot: Entendo! Você configurou minhas variáveis de ambiente com credenciais SSH para acessar sua VPS. Vou usar essas informações para me conectar e analisar todos os projetos Docker. Primeiro, vou verificar o arquivo `.env` e então executar uma análise completa.

Vou criar e executar um script de análise SSH:

```bash
#!/bin/bash
echo "🚀 CONECTANDO À VPS VIA SSH E ANALISANDO DOCKER..."
echo ""

# Verificar se .env existe e carregar variáveis
if [ -f .env ]; then
    source .env
    echo "✅ Arquivo .env carregado"
else
    echo "❌ Arquivo .env não encontrado"
    exit 1
fi

# Verificar variáveis necessárias
if [ -z "$VPS_HOST" ] || [ -z "$VPS_USER" ] || [ -z "$VPS_PASSWORD" ] && [ -z "$VPS_SSH_KEY" ]; then
    echo "❌ Variáveis SSH não configuradas no .env"
    echo "Configure no .env:"
    echo "VPS_HOST=seu_ip"
    echo "VPS_USER=seu_usuario"
    echo "VPS_PASSWORD=sua_senha (opcional)"
    echo "VPS_SSH_KEY=caminho/para/chave (opcional)"
    exit 1
fi

# Configurar conexão SSH
SSH_CMD="ssh"
if [ ! -z "$VPS_SSH_KEY" ]; then
    SSH_CMD="$SSH_CMD -i $VPS_SSH_KEY"
fi
if [ ! -z "$VPS_PASSWORD" ]; then
    # Nota: Para senha, precisaria de sshpass instalado
    SSH_CMD="sshpass -p '$VPS_PASSWORD' ssh"
fi

# Comando remoto para análise
REMOTE_COMMAND=$(cat << 'EOF'
#!/bin/bash
echo "======================================================"
echo "       ANÁLISE COMPLETA DA VPS - DOCKER"
echo "======================================================"
echo "Host: $(hostname)"
echo "IP: $(hostname -I 2>/dev/null || curl -s ifconfig.me)"
echo "Data: $(date)"
echo "Uptime: $(uptime -p)"
echo "======================================================"
echo ""

# 1. SISTEMA
echo "1. 🖥️  INFORMAÇÕES DO SISTEMA:"
echo "--------------------------------"
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"')"
echo "Kernel: $(uname -r)"
echo "Arquitetura: $(uname -m)"
echo ""

# 2. DOCKER SERVICE
echo "2. 🐳 STATUS DO DOCKER:"
echo "--------------------------------"
if systemctl is-active docker >/dev/null 2>&1; then
    echo "✅ Docker está rodando"
    echo "Versão: $(docker --version 2>/dev/null || echo 'Docker não instalado')"
else
    echo "❌ Docker NÃO está rodando"
fi
echo ""

# 3. TODOS OS CONTAINERS
echo "3. 📦 CONTAINERS DOCKER:"
echo "--------------------------------"
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}" 2>/dev/null || echo "Docker não disponível"
echo ""

# 4. CONTAINERS ATIVOS
echo "4. 🔵 CONTAINERS EM EXECUÇÃO:"
echo "--------------------------------"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}" 2>/dev/null || echo "Nenhum container ativo"
echo ""

# 5. IMAGENS
echo "5. 🏷️  IMAGENS DOCKER:"
echo "--------------------------------"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}" 2>/dev/null | head -15
echo ""

# 6. REDES
echo "6. 🌐 REDES DOCKER:"
echo "--------------------------------"
docker network ls 2>/dev/null || echo "Não há redes"
echo ""

# 7. VOLUMES
echo "7. 💾 VOLUMES DOCKER:"
echo "--------------------------------"
docker volume ls 2>/dev/null || echo "Não há volumes"
echo ""

# 8. DOCKER COMPOSE
echo "8. 📄 ARQUIVOS DOCKER-COMPOSE:"
echo "--------------------------------"
find / -name "docker-compose*.yml" -o -name "docker-compose*.yaml" 2>/dev/null | head -10 || echo "Não encontrado"
echo ""

# 9. ANÁLISE DE CADA CONTAINER
echo "9. 🔍 DETALHES DOS PROJETOS:"
echo "=========================================="
for container in $(docker ps -a --format "{{.Names}}" 2>/dev/null); do
    echo ""
    echo "📦 Container: $container"
    echo "   └─ Imagem: $(docker inspect --format '{{.Config.Image}}' $container 2>/dev/null)"
    echo "   └─ Status: $(docker inspect --format '{{.State.Status}}' $container 2>/dev/null)"
    
    # Portas
    ports=$(docker inspect --format='{{range $p, $conf := .NetworkSettings.Ports}}{{if $conf}}{{$p}} {{end}}{{end}}' $container 2>/dev/null)
[10/03/2026 17:32] @gueclaw_bot: if [ ! -z "$ports" ]; then
        echo "   └─ Portas: $ports"
    fi
    
    # Volumes
    volumes=$(docker inspect --format='{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}' $container 2>/dev/null)
    if [ ! -z "$volumes" ] && [ "$volumes" != " " ]; then
        echo "   └─ Volumes:"
        for vol in $volumes; do
            echo "        • $vol"
        done
    fi
    
    # Tipo de projeto (baseado na imagem)
    image=$(docker inspect --format='{{.Config.Image}}' $container 2>/dev/null | tr '[:upper:]' '[:lower:]')
    if [[ $image == *"node"* ]] || [[ $image == *"npm"* ]]; then
        echo "   └─ Tipo: Aplicação Node.js"
        # Tentar encontrar package.json
        pkg=$(docker exec $container sh -c 'find / -name "package.json" 2>/dev/null | head -1' 2>/dev/null)
        if [ ! -z "$pkg" ]; then
            name=$(docker exec $container sh -c "cat $pkg 2>/dev/null | grep '\"name\"' | head -1 | cut -d':' -f2 | tr -d '\", '" 2>/dev/null)
            if [ ! -z "$name" ]; then
                echo "   └─ Nome do projeto: $name"
            fi
        fi
    elif [[ $image == *"python"* ]]; then
        echo "   └─ Tipo: Aplicação Python"
    elif [[ $image == *"php"* ]]; then
        echo "   └─ Tipo: Aplicação PHP"
    elif [[ $image == *"mysql"* ]] || [[ $image == *"mariadb"* ]]; then
        echo "   └─ Tipo: Banco de dados MySQL"
    elif [[ $image == *"postgres"* ]]; then
        echo "   └─ Tipo: Banco de dados PostgreSQL"
    elif [[ $image == *"nginx"* ]] || [[ $image == *"apache"* ]]; then
        echo "   └─ Tipo: Servidor Web"
    elif [[ $image == *"redis"* ]]; then
        echo "   └─ Tipo: Redis Cache"
    elif [[ $image == *"mongo"* ]]; then
        echo "   └─ Tipo: MongoDB"
    fi
done

# 10. BUSCA ESPECÍFICA POR FLUXOHUB
echo ""
echo "10. 🔎 BUSCA POR 'FLUXOHUB':"
echo "--------------------------------"
echo "Em containers:"
docker ps -a --format "{{.Names}}" 2>/dev/null | grep -i fluxohub || echo "   Nenhum container com 'fluxohub'"
echo ""
echo "Em imagens:"
docker images --format "{{.Repository}}" 2>/dev/null | grep -i fluxohub || echo "   Nenhuma imagem com 'fluxohub'"
echo ""
echo "Em volumes:"
docker volume ls --format "{{.Name}}" 2>/dev/null | grep -i fluxohub || echo "   Nenhum volume com 'fluxohub'"
echo ""
echo "No sistema de arquivos:"
find /home /var/www /opt /srv -type d -name "*fluxohub*" 2>/dev/null | head -5 || echo "   Não encontrado em diretórios comuns"

# 11. RECURSOS
echo ""
echo "11. 📊 USO DE RECURSOS:"
echo "--------------------------------"
echo "Memória Docker:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null || echo "   Nenhum container ativo"
echo ""
echo "Uso de disco por volumes:"
du -sh /var/lib/docker/volumes/* 2>/dev/null | sort -hr | head -10 || echo "   Não foi possível verificar"
EOF
)

# Executar análise remota
echo "📡 Conectando a $VPS_USER@$VPS_HOST..."
echo ""

# Executar comando remoto e salvar resultado
$SSH_CMD $VPS_USER@$VPS_HOST "$REMOTE_COMMAND" | tee relatorio_vps_completo_$(date +%Y%m%d_%H%M%S).txt

echo ""
echo "======================================================"
echo "✅ ANÁLISE CONCLUÍDA!"
echo "📄 Relatório salvo em: relatorio_vps_completo_*.txt"
echo "======================================================"
```

---

### **Para executar:**

1. **Certifique-se que seu `.env` tem as variáveis corretas:**
```bash
# Exemplo de .env
VPS_HOST=192.168.1.100  # ou seu_dominio.com
VPS_USER=root
VPS_PASSWORD=sua_senha_se_tiver
# OU
VPS_SSH_KEY=/caminho/para/sua/chave_privada
```

2. **Salve o script acima como `analise_ssh.sh`:**
```bash
nano analise_ssh.sh
# Cole o script acima
chmod +x analise_ssh.sh
```

3. **Execute:**
```bash
./analise_ssh.sh
```

---

### **Se preferir comandos SSH diretos (sem script):**

```bash
# Comandos que vou executar na sua VPS:
ssh $VPS_USER@$VPS_HOST "
echo '=== CONTAINERS ===' &&
[10/03/2026 17:32] @gueclaw_bot: docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' &&
echo '' &&
echo '=== IMAGENS ===' &&
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' &&
echo '' &&
echo '=== BUSCA FLUXOHUB ===' &&
docker ps -a --format '{{.Names}}' | grep -i fluxohub &&
find /home /var/www -type d -name '*fluxohub*' 2>/dev/null
"
```

---

### **Se tiver problemas de conexão SSH, posso ajudar com:**

1. **Verificar configuração SSH:**
```bash
# Testar conexão básica
ssh $VPS_USER@$VPS_HOST "echo 'Conexão SSH funcionando!'"

# Verificar porta (padrão é 22, mas pode ser diferente)
ssh -p 2222 $VPS_USER@$VPS_HOST "echo 'Teste'"
```

2. **Se usar chave SSH:**
```bash
# Verificar permissões da chave
chmod 600 ~/.ssh/id_rsa

# Testar com chave específica
ssh -i /caminho/da/chave $VPS_USER@$VPS_HOST "echo 'Teste'"
```

---

### **Próximos passos:**
Após executar a análise, me informe:
1. Quais containers/projetos foram encontrados
2. Se encontrou o "fluxohub"
3. Se há algum problema específico (containers parados, erros, etc.)

Posso então ajudar com:
- Configuração específica de algum projeto
- Otimização dos containers
- Solução de problemas
- Backup dos projetos

Vamos começar? Execute o script e me mostre o resultado! 🚀