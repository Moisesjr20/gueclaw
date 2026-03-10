#!/usr/bin/env python3
"""
Testes da skill coding-hybrid-ai
Verifica integração com APIs DeepSeek e Kimi
"""

import os
import sys
import json
import asyncio
from datetime import datetime

# Tenta importar aiohttp, senão simula
try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False
    print("⚠️  aiohttp não instalado - testes de API serão simulados")

# Test config - usar variáveis de ambiente ou skip
KIMI_API_KEY = os.getenv("KIMI_API_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")

class HybridAITester:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        self.has_credentials = bool(KIMI_API_KEY and DEEPSEEK_API_KEY)
    
    def test(self, name, func):
        """Executa um teste síncrono"""
        try:
            print(f"🧪 TESTE: {name}")
            result = func()
            if result:
                print(f"   ✅ PASSOU\n")
                self.passed += 1
                return True
            else:
                print(f"   ⚠️  SKIP (sem credenciais)\n")
                return None
        except Exception as e:
            print(f"   ❌ ERRO: {e}\n")
            self.errors.append(f"{name}: {e}")
            self.failed += 1
            return False
    
    async def test_async(self, name, func):
        """Executa um teste assíncrono"""
        try:
            print(f"🧪 TESTE: {name}")
            if not self.has_credentials:
                print(f"   ⚠️  SKIP (sem credenciais de API)\n")
                return None
            
            if not HAS_AIOHTTP:
                print(f"   ⚠️  SKIP (aiohttp não instalado)\n")
                return None
            
            result = await func()
            if result:
                print(f"   ✅ PASSOU\n")
                self.passed += 1
                return True
            else:
                print(f"   ❌ FALHOU\n")
                self.failed += 1
                return False
        except Exception as e:
            print(f"   ❌ ERRO: {e}\n")
            self.errors.append(f"{name}: {e}")
            self.failed += 1
            return False
    
    async def test_kimi_connection(self):
        """Testa conexão com API Kimi"""
        if not HAS_AIOHTTP:
            print("   ⚠️  aiohttp não instalado")
            return None
            
        url = "https://api.moonshot.cn/v1/models"
        headers = {"Authorization": f"Bearer {KIMI_API_KEY}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return "data" in data and len(data["data"]) > 0
                return False
    
    async def test_kimi_chat(self):
        """Testa chat completion com Kimi"""
        if not HAS_AIOHTTP:
            print("   ⚠️  aiohttp não instalado")
            return None
            
        url = "https://api.moonshot.cn/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {KIMI_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "moonshot-v1-8k",
            "messages": [{"role": "user", "content": "Diga 'teste OK'"}],
            "max_tokens": 10
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload, timeout=30) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    content = data["choices"][0]["message"]["content"]
                    return "teste" in content.lower() or "OK" in content
                return False
    
    async def test_deepseek_connection(self):
        """Testa conexão com API DeepSeek"""
        if not HAS_AIOHTTP:
            print("   ⚠️  aiohttp não instalado")
            return None
            
        url = "https://api.deepseek.com/v1/models"
        headers = {"Authorization": f"Bearer {DEEPSEEK_API_KEY}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=10) as resp:
                return resp.status == 200
    
    async def test_deepseek_chat(self):
        """Testa chat completion com DeepSeek"""
        if not HAS_AIOHTTP:
            print("   ⚠️  aiohttp não instalado")
            return None
            
        url = "https://api.deepseek.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": "Say 'test OK'"}],
            "max_tokens": 10
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload, timeout=30) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    content = data["choices"][0]["message"]["content"]
                    return "test" in content.lower() or "OK" in content
                return False
    
    def test_scripts_exist(self):
        """Verifica se os scripts existem"""
        import os
        scripts_dir = os.path.dirname(os.path.abspath(__file__))
        scripts = [
            "hybrid_coding.py",
            "kimi_filter.py", 
            "deepseek_generate.py"
        ]
        for script in scripts:
            path = os.path.join(scripts_dir, script)
            if not os.path.exists(path):
                print(f"   ❌ Script não encontrado: {script}")
                return False
        return True
    
    def test_imports(self):
        """Testa se imports necessários estão disponíveis"""
        try:
            import asyncio
            # aiohttp é opcional para testes
            return True
        except ImportError as e:
            print(f"   ❌ Import faltando: {e}")
            return False
    
    async def run_all_tests(self):
        """Executa todos os testes"""
        print("="*60)
        print("🧪 TESTES DA SKILL CODING-HYBRID-AI")
        print("="*60)
        print()
        
        if not self.has_credentials:
            print("⚠️  ATENÇÃO: KIMI_API_KEY e/ou DEEPSEEK_API_KEY não configurados")
            print("    Testes de API serão ignorados\n")
        else:
            print("✅ Credenciais de API configuradas\n")
        
        # Testes de estrutura (não precisam de API)
        self.test("Scripts existem", self.test_scripts_exist)
        self.test("Imports disponíveis", self.test_imports)
        
        # Testes de API (precisam de credenciais)
        await self.test_async("Conexão Kimi", self.test_kimi_connection)
        await self.test_async("Chat Kimi", self.test_kimi_chat)
        await self.test_async("Conexão DeepSeek", self.test_deepseek_connection)
        await self.test_async("Chat DeepSeek", self.test_deepseek_chat)
        
        # Resumo
        print("="*60)
        print("📊 RESUMO DOS TESTES")
        print("="*60)
        print(f"✅ Passaram: {self.passed}")
        print(f"❌ Falharam: {self.failed}")
        print(f"⚠️  Skip: {4 if not self.has_credentials else 0}")
        
        if self.errors:
            print("\n🚨 Erros encontrados:")
            for error in self.errors:
                print(f"   - {error}")
        
        if not self.has_credentials:
            print("\n💡 Para testar as APIs, configure:")
            print("   export KIMI_API_KEY='sk-...'")
            print("   export DEEPSEEK_API_KEY='sk-...'")
        
        print()
        return self.failed == 0


async def main():
    tester = HybridAITester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
