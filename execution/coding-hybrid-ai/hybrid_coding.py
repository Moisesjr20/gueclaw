#!/usr/bin/env python3
"""
Coding Hybrid AI - Fluxo completo DeepSeek + Kimi
Fase 1: Kimi filtra contexto
Fase 2: DeepSeek gera código
Fase 3: Kimi valida
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import asyncio
import aiohttp
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Config:
    """Configurações da skill"""
    kimi_api_key: str
    deepseek_api_key: str
    kimi_model: str = "moonshot-v1-128k"
    deepseek_model: str = "deepseek-coder"
    kimi_max_tokens: int = 4000
    deepseek_max_tokens: int = 8000
    temperature_kimi: float = 0.3
    temperature_deepseek: float = 0.2
    max_retries_kimi: int = 3
    max_retries_deepseek: int = 2
    timeout_kimi: int = 60
    timeout_deepseek: int = 30


class RateLimiter:
    """Rate limiter simples para respeitar limites de API"""
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window = window_seconds
        self.requests = []
    
    async def acquire(self):
        now = time.time()
        # Remove requisições antigas
        self.requests = [t for t in self.requests if now - t < self.window]
        
        if len(self.requests) >= self.max_requests:
            sleep_time = self.window - (now - self.requests[0])
            if sleep_time > 0:
                print(f"⏳ Rate limit: aguardando {sleep_time:.1f}s...")
                await asyncio.sleep(sleep_time)
        
        self.requests.append(time.time())


class KimiClient:
    """Cliente para API Moonshot (Kimi)"""
    
    BASE_URL = "https://api.moonshot.cn/v1"
    
    def __init__(self, config: Config):
        self.config = config
        self.rate_limiter = RateLimiter(max_requests=60, window_seconds=60)
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        retry_count: int = 0
    ) -> str:
        """Faz chamada à API do Kimi com retry"""
        
        await self.rate_limiter.acquire()
        
        headers = {
            "Authorization": f"Bearer {self.config.kimi_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.config.kimi_model,
            "messages": messages,
            "max_tokens": max_tokens or self.config.kimi_max_tokens,
            "temperature": temperature or self.config.temperature_kimi
        }
        
        try:
            async with self.session.post(
                f"{self.BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=self.config.timeout_kimi)
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Kimi API error: {response.status} - {error_text}")
                
                data = await response.json()
                return data["choices"][0]["message"]["content"]
                
        except asyncio.TimeoutError:
            if retry_count < self.config.max_retries_kimi:
                wait = 2 ** retry_count
                print(f"⚠️ Kimi timeout, retrying in {wait}s...")
                await asyncio.sleep(wait)
                return await self.chat_completion(
                    messages, max_tokens, temperature, retry_count + 1
                )
            raise
        
        except Exception as e:
            if retry_count < self.config.max_retries_kimi:
                wait = 2 ** retry_count
                print(f"⚠️ Kimi error: {e}, retrying in {wait}s...")
                await asyncio.sleep(wait)
                return await self.chat_completion(
                    messages, max_tokens, temperature, retry_count + 1
                )
            raise


class DeepSeekClient:
    """Cliente para API DeepSeek"""
    
    BASE_URL = "https://api.deepseek.com/v1"
    
    def __init__(self, config: Config):
        self.config = config
        self.rate_limiter = RateLimiter(max_requests=30, window_seconds=60)
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        retry_count: int = 0
    ) -> str:
        """Faz chamada à API do DeepSeek com retry"""
        
        await self.rate_limiter.acquire()
        
        headers = {
            "Authorization": f"Bearer {self.config.deepseek_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.config.deepseek_model,
            "messages": messages,
            "max_tokens": max_tokens or self.config.deepseek_max_tokens,
            "temperature": temperature or self.config.temperature_deepseek
        }
        
        try:
            async with self.session.post(
                f"{self.BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=self.config.timeout_deepseek)
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"DeepSeek API error: {response.status} - {error_text}")
                
                data = await response.json()
                return data["choices"][0]["message"]["content"]
                
        except asyncio.TimeoutError:
            if retry_count < self.config.max_retries_deepseek:
                wait = 2 ** retry_count
                print(f"⚠️ DeepSeek timeout, retrying in {wait}s...")
                await asyncio.sleep(wait)
                return await self.chat_completion(
                    messages, max_tokens, temperature, retry_count + 1
                )
            raise
        
        except Exception as e:
            if retry_count < self.config.max_retries_deepseek:
                wait = 2 ** retry_count
                print(f"⚠️ DeepSeek error: {e}, retrying in {wait}s...")
                await asyncio.sleep(wait)
                return await self.chat_completion(
                    messages, max_tokens, temperature, retry_count + 1
                )
            raise


class CodebaseCollector:
    """Coleta e processa arquivos do codebase"""
    
    def __init__(self, context_dir: str, include_patterns: List[str] = None, exclude_patterns: List[str] = None):
        self.context_dir = Path(context_dir)
        self.include = include_patterns or ["*.py", "*.js", "*.ts", "*.java", "*.go", "*.rs", "*.cpp", "*.c", "*.h", "*.hpp"]
        self.exclude = exclude_patterns or ["*test*", "*__pycache__*", "*.pyc", "node_modules", ".git", "dist", "build", "*.min.js", "*.min.css"]
    
    def collect(self) -> str:
        """Coleta todo o código em uma string"""
        files_content = []
        total_size = 0
        max_size = 100000  # ~100KB de código
        
        for pattern in self.include:
            for file_path in self.context_dir.rglob(pattern):
                # Verifica exclusões
                if any(excl in str(file_path) for excl in self.exclude):
                    continue
                
                try:
                    content = file_path.read_text(encoding='utf-8', errors='ignore')
                    rel_path = file_path.relative_to(self.context_dir)
                    
                    file_entry = f"\n{'='*60}\n# Arquivo: {rel_path}\n{'='*60}\n{content}\n"
                    
                    if total_size + len(file_entry) > max_size:
                        files_content.append(f"\n# [Truncado: limite de {max_size} caracteres atingido]")
                        break
                    
                    files_content.append(file_entry)
                    total_size += len(file_entry)
                    
                except Exception as e:
                    print(f"⚠️ Erro ao ler {file_path}: {e}")
        
        return "".join(files_content)


class HybridCodingPipeline:
    """Pipeline completo de codificação híbrida"""
    
    def __init__(self, config: Config):
        self.config = config
    
    async def run(self, user_query: str, codebase_context: str) -> Tuple[str, Dict]:
        """
        Executa o fluxo completo
        
        Returns:
            (output_final, metadados)
        """
        results = {
            "phase1": None,
            "phase2": None,
            "phase3": None,
            "errors": []
        }
        
        async with KimiClient(self.config) as kimi, DeepSeekClient(self.config) as deepseek:
            
            # ========== FASE 1: Kimi - Filtro de Contexto ==========
            print("🔍 FASE 1: Analisando contexto com Kimi...")
            try:
                context_summary = await self._phase1_filter(kimi, user_query, codebase_context)
                results["phase1"] = context_summary
                print(f"✅ Contexto filtrado: {len(context_summary)} caracteres")
            except Exception as e:
                print(f"❌ FASE 1 falhou: {e}")
                results["errors"].append(f"Phase 1: {e}")
                # Fallback: tentar com contexto reduzido
                print("🔄 Fallback: tentando com contexto reduzido...")
                context_summary = await self._fallback_context(kimi, user_query, codebase_context)
                results["phase1"] = context_summary
            
            # ========== FASE 2: DeepSeek - Geração ==========
            print("⚡ FASE 2: Gerando código com DeepSeek...")
            try:
                generated_code = await self._phase2_generate(deepseek, user_query, context_summary)
                results["phase2"] = generated_code
                print(f"✅ Código gerado: {len(generated_code)} caracteres")
            except Exception as e:
                print(f"❌ FASE 2 falhou: {e}")
                results["errors"].append(f"Phase 2: {e}")
                raise
            
            # ========== FASE 3: Kimi - Validação ==========
            print("✓ FASE 3: Validando com Kimi...")
            try:
                final_output = await self._phase3_validate(kimi, generated_code, codebase_context)
                results["phase3"] = final_output
                print("✅ Validação completa")
            except Exception as e:
                print(f"⚠️ FASE 3 falhou: {e}")
                results["errors"].append(f"Phase 3: {e}")
                # Se validação falhar, retorna o código gerado mesmo assim
                final_output = generated_code
            
            return final_output, results
    
    async def _phase1_filter(self, kimi: KimiClient, query: str, context: str) -> str:
        """Fase 1: Kimi filtra contexto"""
        
        prompt = f"""Você é um arquiteto de software sênior. Analise o seguinte codebase e identifique quais arquivos, classes e funções são diretamente afetados por esta solicitação.

SOLICITAÇÃO DO USUÁRIO: {query}

CODEBASE COMPLETO:
{context}

Gere um "Resumo Técnico de Contexto" com:
1. Lista dos arquivos que precisam ser modificados
2. Interfaces/classes relevantes e seus métodos
3. Dependências críticas
4. Estrutura de dados envolvida
5. Possíveis impactos em outras partes do sistema

IMPORTANTE: Máximo 4000 tokens. Seja conciso mas completo.
"""
        
        messages = [
            {"role": "system", "content": "Você é um arquiteto de software especialista em análise de código e dependências."},
            {"role": "user", "content": prompt}
        ]
        
        return await kimi.chat_completion(messages)
    
    async def _fallback_context(self, kimi: KimiClient, query: str, context: str) -> str:
        """Fallback: tenta extrair apenas os arquivos mais relevantes"""
        
        # Limita contexto a ~50KB
        truncated = context[:50000] + "\n\n[Contexto truncado devido a limitações]"
        
        prompt = f"""Analise este código e extraia APENAS as partes mais relevantes para: {query}

CODEBASE (parcial):
{truncated}

Liste os arquivos e funções principais necessários."""
        
        messages = [
            {"role": "user", "content": prompt}
        ]
        
        try:
            return await kimi.chat_completion(messages, max_tokens=2000)
        except:
            # Último fallback: retorna contexto truncado com aviso
            return f"⚠️ Análise automática falhou. Contexto bruto:\n\n{truncated[:10000]}"
    
    async def _phase2_generate(self, deepseek: DeepSeekClient, query: str, context_summary: str) -> str:
        """Fase 2: DeepSeek gera código"""
        
        prompt = f"""Você é um engenheiro de software especialista em performance. Gere o código final baseado no contexto técnico fornecido + a solicitação original.

SOLICITAÇÃO ORIGINAL: {query}

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
        
        messages = [
            {"role": "system", "content": "Você é um engenheiro de software especialista em performance e código otimizado. Gere código limpo, eficiente e pronto para produção."},
            {"role": "user", "content": prompt}
        ]
        
        return await deepseek.chat_completion(messages)
    
    async def _phase3_validate(self, kimi: KimiClient, generated_code: str, original_context: str) -> str:
        """Fase 3: Kimi valida o código"""
        
        prompt = f"""Valide o código gerado contra o contexto original do projeto.

CÓDIGO GERADO:
{generated_code}

CONTEXTO ORIGINAL DO PROJETO (primeiros 20000 caracteres):
{original_context[:20000]}

VERIFIQUE:
1. Todas as importações existem no projeto?
2. Nomes de classes/funções estão consistentes?
3. Paths de arquivos estão corretos?
4. Não há conflitos de nomenclatura?

Se encontrar inconsistências, corrija-as.
Gere o output final em Markdown limpo.
"""
        
        messages = [
            {"role": "system", "content": "Você é um revisor de código. Valide consistência, imports e nomenclatura."},
            {"role": "user", "content": prompt}
        ]
        
        return await kimi.chat_completion(messages, temperature=0.1)


async def main():
    parser = argparse.ArgumentParser(description="Coding Hybrid AI - DeepSeek + Kimi")
    parser.add_argument("--query", "-q", required=True, help="Solicitação do usuário")
    parser.add_argument("--context-dir", "-c", required=True, help="Diretório com o código")
    parser.add_argument("--output", "-o", default="hybrid_output.md", help="Arquivo de saída")
    parser.add_argument("--include", nargs="+", help="Padrões de inclusão (ex: *.py)")
    parser.add_argument("--exclude", nargs="+", help="Padrões de exclusão")
    
    args = parser.parse_args()
    
    # Carrega configurações
    config = Config(
        kimi_api_key=os.getenv("KIMI_API_KEY"),
        deepseek_api_key=os.getenv("DEEPSEEK_API_KEY")
    )
    
    if not config.kimi_api_key or not config.deepseek_api_key:
        print("❌ Erro: Defina KIMI_API_KEY e DEEPSEEK_API_KEY")
        sys.exit(1)
    
    print(f"🚀 Iniciando pipeline híbrido...")
    print(f"   Query: {args.query[:60]}...")
    print(f"   Contexto: {args.context_dir}")
    
    # Coleta contexto
    collector = CodebaseCollector(args.context_dir, args.include, args.exclude)
    codebase = collector.collect()
    print(f"📦 Contexto coletado: {len(codebase)} caracteres")
    
    # Executa pipeline
    pipeline = HybridCodingPipeline(config)
    start_time = time.time()
    
    try:
        output, metadata = await pipeline.run(args.query, codebase)
        
        elapsed = time.time() - start_time
        print(f"\n✅ Pipeline completo em {elapsed:.1f}s")
        
        # Salva resultado
        output_path = Path(args.output)
        output_path.write_text(output, encoding='utf-8')
        print(f"💾 Resultado salvo em: {output_path}")
        
        # Salva metadados
        meta_path = output_path.with_suffix('.json')
        meta_path.write_text(json.dumps(metadata, indent=2, default=str), encoding='utf-8')
        print(f"📊 Metadados salvos em: {meta_path}")
        
    except Exception as e:
        print(f"\n❌ Pipeline falhou: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
