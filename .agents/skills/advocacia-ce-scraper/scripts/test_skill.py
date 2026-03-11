#!/usr/bin/env python3
"""
Testes da skill advocacia-ce-scraper
Verifica estrutura, dependências e configurações
"""

import os
import sys
import json

class AdvocaciaScraperTester:
    def __init__(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def test(self, name, func):
        try:
            print(f"🧪 TESTE: {name}")
            result = func()
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
    
    def test_structure(self):
        """Verifica estrutura de diretórios"""
        required_dirs = ['scripts', 'config', 'database', 'references']
        for d in required_dirs:
            path = os.path.join(self.base_dir, d)
            if not os.path.exists(path):
                print(f"   ❌ Diretório não encontrado: {d}")
                return False
        return True
    
    def test_skill_md(self):
        """Verifica se SKILL.md existe"""
        path = os.path.join(self.base_dir, 'SKILL.md')
        if not os.path.exists(path):
            return False
        
        content = open(path).read()
        checks = [
            'advocacia-ce-scraper' in content,
            'Apify' in content,
            'Google Maps' in content
        ]
        return all(checks)
    
    def test_scripts_exist(self):
        """Verifica se scripts principais existem"""
        scripts = [
            'busca_apify.py',
            'scrape_websites.py',
            'valida_emails.py',
            'pipeline_completo.py'
        ]
        
        for script in scripts:
            path = os.path.join(self.base_dir, 'scripts', script)
            if not os.path.exists(path):
                print(f"   ❌ Script não encontrado: {script}")
                return False
        return True
    
    def test_database_schema(self):
        """Verifica se schema.sql existe"""
        path = os.path.join(self.base_dir, 'database', 'schema.sql')
        if not os.path.exists(path):
            return False
        
        content = open(path).read()
        checks = [
            'CREATE TABLE escritorios_advocacia' in content,
            'email' in content,
            'cidade' in content
        ]
        return all(checks)
    
    def test_config_apify(self):
        """Verifica configuração do Apify"""
        path = os.path.join(self.base_dir, 'config', 'apify_config.json')
        if not os.path.exists(path):
            return False
        
        try:
            with open(path) as f:
                config = json.load(f)
            
            checks = [
                'actorId' in config,
                'google-maps-scraper' in config.get('actorId', ''),
                'campos_extraidos' in config
            ]
            return all(checks)
        except:
            return False
    
    def test_env_vars(self):
        """Verifica se variáveis de ambiente estão configuradas"""
        vars_required = ['APIFY_API_KEY']
        vars_optional = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']
        
        configured = 0
        for var in vars_required:
            if os.getenv(var):
                configured += 1
            else:
                print(f"   ⚠️  {var} não configurada (obrigatória para uso)")
        
        for var in vars_optional:
            if os.getenv(var):
                configured += 1
        
        # Retorna True mesmo sem vars, apenas avisa
        print(f"   ℹ️  {configured}/{len(vars_required) + len(vars_optional)} variáveis configuradas")
        return True
    
    def test_imports(self):
        """Testa se imports principais estão disponíveis"""
        try:
            import requests
            from bs4 import BeautifulSoup
            print("   ✅ requests e beautifulsoup4 disponíveis")
        except ImportError as e:
            print(f"   ⚠️  {e} (instale com: pip install requests beautifulsoup4)")
        
        try:
            from apify_client import ApifyClient
            print("   ✅ apify-client disponível")
        except ImportError:
            print("   ⚠️  apify-client não instalado (pip install apify-client)")
        
        return True  # Não falha, apenas avisa
    
    def run_all_tests(self):
        print("="*60)
        print("🧪 TESTES DA SKILL ADVOCACIA-CE-SCRAPER")
        print("="*60)
        print()
        
        self.test("Estrutura de diretórios", self.test_structure)
        self.test("SKILL.md existe e válido", self.test_skill_md)
        self.test("Scripts principais existem", self.test_scripts_exist)
        self.test("Database schema existe", self.test_database_schema)
        self.test("Configuração Apify", self.test_config_apify)
        self.test("Variáveis de ambiente", self.test_env_vars)
        self.test("Dependências Python", self.test_imports)
        
        print("="*60)
        print("📊 RESUMO DOS TESTES")
        print("="*60)
        print(f"✅ Passaram: {self.passed}")
        print(f"❌ Falharam: {self.failed}")
        
        if self.errors:
            print("\n🚨 Erros:")
            for e in self.errors:
                print(f"   - {e}")
        
        print()
        print("💡 Próximo passo:")
        print("   1. Configure APIFY_API_KEY")
        print("   2. Instale dependências: pip install -r requirements.txt")
        print("   3. Execute: python scripts/pipeline_completo.py")
        
        return self.failed == 0


def main():
    tester = AdvocaciaScraperTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
