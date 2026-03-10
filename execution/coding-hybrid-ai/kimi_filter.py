#!/usr/bin/env python3
"""
Fase 1 isolada: Kimi Filter
Apenas analisa e resume o contexto
"""

import os
import sys
import argparse
from pathlib import Path
import asyncio

# Reutiliza classes do script principal
import sys
sys.path.insert(0, str(Path(__file__).parent))
from hybrid_coding import Config, KimiClient, CodebaseCollector


async def main():
    parser = argparse.ArgumentParser(description="Kimi Filter - Fase 1 do pipeline híbrido")
    parser.add_argument("--query", "-q", required=True, help="Solicitação do usuário")
    parser.add_argument("--context-dir", "-c", required=True, help="Diretório com o código")
    parser.add_argument("--output", "-o", default="context_summary.md", help="Arquivo de saída")
    parser.add_argument("--include", nargs="+", help="Padrões de inclusão")
    parser.add_argument("--exclude", nargs="+", help="Padrões de exclusão")
    
    args = parser.parse_args()
    
    config = Config(kimi_api_key=os.getenv("KIMI_API_KEY"), deepseek_api_key="")
    
    if not config.kimi_api_key:
        print("❌ Erro: Defina KIMI_API_KEY")
        sys.exit(1)
    
    print(f"🔍 Fase 1: Analisando contexto com Kimi...")
    print(f"   Query: {args.query[:60]}...")
    
    # Coleta contexto
    collector = CodebaseCollector(args.context_dir, args.include, args.exclude)
    codebase = collector.collect()
    print(f"📦 Contexto coletado: {len(codebase)} caracteres")
    
    # Prompt para Kimi
    prompt = f"""Você é um arquiteto de software sênior. Analise o seguinte codebase e identifique quais arquivos, classes e funções são diretamente afetados por esta solicitação.

SOLICITAÇÃO DO USUÁRIO: {args.query}

CODEBASE COMPLETO:
{codebase}

Gere um "Resumo Técnico de Contexto" com:
1. Lista dos arquivos que precisam ser modificados
2. Interfaces/classes relevantes e seus métodos
3. Dependências críticas
4. Estrutura de dados envolvida
5. Possíveis impactos em outras partes do sistema

IMPORTANTE: Máximo 4000 tokens. Seja conciso mas completo.
"""
    
    async with KimiClient(config) as kimi:
        messages = [
            {"role": "system", "content": "Você é um arquiteto de software especialista em análise de código e dependências."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            result = await kimi.chat_completion(messages)
            
            # Salva resultado
            output_path = Path(args.output)
            output_path.write_text(result, encoding='utf-8')
            print(f"✅ Resumo gerado: {len(result)} caracteres")
            print(f"💾 Salvo em: {output_path}")
            
        except Exception as e:
            print(f"❌ Erro: {e}")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
