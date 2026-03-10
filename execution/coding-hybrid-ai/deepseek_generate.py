#!/usr/bin/env python3
"""
Fase 2 isolada: DeepSeek Generate
Gera código baseado em contexto resumido
"""

import os
import sys
import argparse
from pathlib import Path
import asyncio

import sys
sys.path.insert(0, str(Path(__file__).parent))
from hybrid_coding import Config, DeepSeekClient


async def main():
    parser = argparse.ArgumentParser(description="DeepSeek Generate - Fase 2 do pipeline híbrido")
    parser.add_argument("--query", "-q", required=True, help="Solicitação do usuário")
    parser.add_argument("--context-file", "-f", required=True, help="Arquivo com resumo do contexto (gerado na Fase 1)")
    parser.add_argument("--output", "-o", default="generated_code.md", help="Arquivo de saída")
    
    args = parser.parse_args()
    
    config = Config(kimi_api_key="", deepseek_api_key=os.getenv("DEEPSEEK_API_KEY"))
    
    if not config.deepseek_api_key:
        print("❌ Erro: Defina DEEPSEEK_API_KEY")
        sys.exit(1)
    
    print(f"⚡ Fase 2: Gerando código com DeepSeek...")
    print(f"   Query: {args.query[:60]}...")
    
    # Lê contexto
    context_path = Path(args.context_file)
    if not context_path.exists():
        print(f"❌ Arquivo não encontrado: {context_path}")
        sys.exit(1)
    
    context_summary = context_path.read_text(encoding='utf-8')
    print(f"📄 Contexto carregado: {len(context_summary)} caracteres")
    
    # Prompt para DeepSeek
    prompt = f"""Você é um engenheiro de software especialista em performance. Gere o código final baseado no contexto técnico fornecido + a solicitação original.

SOLICITAÇÃO ORIGINAL: {args.query}

CONTEXTO TÉCNICO (filtrado pelo arquiteto):
{context_summary}

REQUISITOS:
1. Gere APENAS o código final, pronto para uso
2. Foque em performance e lógica pura
3. Inclua imports necessários
4. Adicione comentários explicativos apenas onde necessário
5. Siga as convenções do projeto existente

FORMATO DE SAÍDA:
```python
# arquivo: src/caminho/arquivo.py
<código aqui>
```
"""
    
    async with DeepSeekClient(config) as deepseek:
        messages = [
            {"role": "system", "content": "Você é um engenheiro de software especialista em performance e código otimizado. Gere código limpo, eficiente e pronto para produção."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            result = await deepseek.chat_completion(messages)
            
            # Salva resultado
            output_path = Path(args.output)
            output_path.write_text(result, encoding='utf-8')
            print(f"✅ Código gerado: {len(result)} caracteres")
            print(f"💾 Salvo em: {output_path}")
            
        except Exception as e:
            print(f"❌ Erro: {e}")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
