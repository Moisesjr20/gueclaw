# Implementation Plan — Parte 15 (Gemini Service)

## Objetivo
Implementar integração operacional com Gemini para geração de código de nós no padrão FluxoHub, usando o prompt de sistema definido no projeto.

## Escopo
1. Cliente Gemini no backend API com `fetch` e validação de resposta JSON.
2. Endpoint Fastify para geração de código de nó por texto de instrução.
3. Helper frontend para consumir o endpoint de IA.
4. Testes unitários cobrindo serviço e endpoint.
5. Validação final com `npm run lint:fix`, `npm run test:unit`, `npm run test:e2e`.

## Contrato proposto
- Rota: `POST /ai/generate-node-code`
- Header obrigatório: `x-user-id`
- Body: `{ prompt: string, model?: string }`
- Response: `{ title: string, description: string, code: string, model: string }`

## Regras de segurança
- Timeout HTTP para Gemini.
- Falha explícita se `GEMINI_API_KEY` ausente.
- Sanitização e validação de payload de resposta.
- Sem uso de bibliotecas Node nativas no código gerado (garantido por system prompt).

## Critérios de aceite
- Endpoint retorna JSON estruturado conforme contrato.
- Testes cobrindo sucesso e falha de integração.
- Build/lint/testes sem regressão.
