# Arquitetura e Guia do FluxoHub (Orquestrador Code-First)

Este documento foi criado para que **qualquer Inteligência Artificial** (Agente) entenda perfeitamente a estrutura de negócio, regras do framework e a base de código técnica do projeto **FluxoHub** antes de realizar qualquer modificação ou criar novos fluxos automáticos.

## 1. O Framework D.O.E.
Todo o ecossistema obedece rigidamente ao **Framework DOE (Directive, Orchestration, Execution)**. LLMs são probabilísticos; lógica de negócios *deve* ser determinística.

* **Layer 1: Directive (O Que Fazer):** Guias em markdown e prompts de sistema (`prompt.md`, `DOE/agents.md`). Definem o comportamento do agente.
* **Layer 2: Orchestration (Você, o Agente):** Identifica necessidades, analisa o banco e o código, e chama `tools` (ferramentas) ou os scripts determinísticos da camada 3. Você deve debugar, ler logs e corrigir, atualizando o conhecimento sem reclamar e sem se desculpar exageradamente.
* **Layer 3: Execution (Como Fazer):** Scripts em Python criados na raiz da pasta `execution/`. Se precisa inspecionar o Supabase, injetar logs pesados, ou raspar dados de forma segura, crie um script local e o execute via terminal local.

## 2. A Stack Tecnológica Real (Monorepo Node.js)
Apesar do escopo original focar apenas em Edge Functions do Supabase, o FluxoHub foi escalado como um **Monorepo (npm workspaces)** em TypeScript para suportar execução robusta e descentralizada usando filas e Docker (Containers isolados). 

### Estrutura de Pacotes (`packages/`)
* **`api` (Fastify):** Recebe os webhooks e envios de formulários web. Ela inicializa no banco de dados a `execution` de um workflow. Contém funções vitais como `server.ts` e integrações robustas (ex: geração dinâmica de Google Docs, disparos de email via Gmail API para Agentes Comerciais e Aditivos).
* **`frontend` (HTML/JS Puro / ReactFlow planejado):** Contém páginas públicas de captura (`formulario-aditivo.html`, `formulario-contrato.html`, etc.) que disparam payloads via `POST` diretamente para a `api`.
* **`execution-queue`:** Mapeia a fila usando **BullMQ e Redis**.
* **`orchestrator-core`:** O "cérebro" da execução. Avalia o DAG (Directed Acyclic Graph) dos Nós, enfileirando as próximas dependências e marcando sucessos ou falhas.
* **`worker`:** Puxa trabalhos da fila do BullMQ e executa os nós do workflow em background.
* **`sandbox`:** Responsável por executar scripts Javascript/Typescript do usuário (criados pela IA) de forma isolada de acessos perigosos. *Nota: Se a lógica requerer bibliotecas gigantes, tokens críticos e segredos de sistema complexos, muitas integrações foram convertidas para rodar "nativamente" na `api` ao invés de no `sandbox`, priorizando o sucesso da operação em produção.*

### Persistência de Dados (Supabase PostgREST)
* **`workflows`:** Tabela com os fluxos de trabalho gerais.
* **`workflow_nodes` e `workflow_edges`:** Armazena os componentes visuais dos blocos lógicos. A lógica de código de cada nó fica salva na coluna `code` dentro da tabela de nós.
* **`executions` e `execution_logs`:** Quando um workflow dispara, um registro é criado aqui. Os logs detalhados do que aconteceu em cada passo ficam salvos e atrelados a um UUID de execução.

## 3. Como Debugar e Criar Novos Workflows
Se for designado a resolver um erro num workflow (Ex: `fetch failed` ou erro `400 Bad Request` na API), siga rigorosamente esse fluxo:

### A. Diagnóstico de Execução Localmente (A Regra de Ouro)
Sempre que uma ID de execução falhar, NUNCA presuma o erro. Sempre vá para a pasta `execution/` e use (ou crie) um script em Pytho chamado `check_execution_[id].py` para baixar o `input_payload`, as `meta` infos de erro na base de dados (`execution_logs`) usando as chaves contidas no `.env`.
Exemplo de comando vital: `python execution/check_execution_xxxxx.py {UUID}`

### B. Compreensão do Payload e Roteamento  
A API nativa (`server.ts`) sofre mutações pontuais para absorver workflows completos caso estes fiquem muito complexos de serem executados graficamente no n8n ou no motor de JS Sandbox do sistema (exemplo: Geração pesada de Contratos Docs, E-mails robustos). Se precisar modificar lógica de negócio vital, adicione na `api` com a rota coerente, manipule e molde os dados ali para despachar o email ou requisição web nativamente no TypeScript.

### C. Integrações Nativas de IA
O `server.ts` e pacotes em `api/src/gemini-service.ts` possuem pontes unificadas com a inteligência artificial para limpar textos de cláusulas ("Rewrite Clause"), análise de execuções ou gerar nós de Javascript na interface. Valide campos nulos antes de mandar para a IA!

### D. Submissão para a "Main" Branch
Quando você consertar algo e testar localmente, você deve sempre "Buildar e Subir" para produção. O Git branch é o `main`.
Comandos obrigatórios de CI/CD: 
`git add . && git commit -m "fix(escopo): descricao limpa" && git push origin main`.
*(Alerte ao usuário para aguardar 1 a 2 minutos para o deploy via Easypanel terminar seu processamento e subida web).*

---

## 4. Filosofia Diária e Ética de Operador 
1. **Verifique ferramentas antes de construir**: `ls execution/` primeiro. 
2. **Arquivos temporários**: lixo descartável de logs e scrapes massivos devem ir para o `.tmp/`.
3. **Não crie formulários cegos**: Todo HTML Frontend precisa enviar um JSON completo que represente fidedignamente os campos da API.
4. **Sem respostas e desculpas verbosas**: Se um script Python no Docker estiver quebrando por biblioteca faltante, não responda "Desculpe pelo erro, farei de outro jeito". Instale a biblioteca, rode de volta, leia o log. Ao terminar e obter sucesso, *aí sim* reporte a vitória concisa ao humano.
