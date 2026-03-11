#!/usr/bin/env python3
"""
Testes da skill supabase-fluxohub
Framework DOE: Execution Phase
"""

import json
import urllib.request
import urllib.error
import ssl
import sys

# Credenciais
SUPABASE_URL = "https://pzzmmaachshasiijopbw.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6em1tYWFjaHNoYXNpaWpvcGJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMjUwMiwiZXhwIjoyMDg2OTA4NTAyfQ._L2zZUn2lpBsQJetGaVx2GcE2Poi0ZEhQkJk602OgMc"

class SupabaseTester:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def test(self, name, func):
        """Executa um teste"""
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
    
    def supabase_request(self, endpoint, method="GET", data=None):
        """Faz request para Supabase"""
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"
        }
        
        req = urllib.request.Request(url, headers=headers, method=method)
        if data:
            req.data = json.dumps(data).encode()
        
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        with urllib.request.urlopen(req, context=ctx, timeout=30) as response:
            return json.loads(response.read().decode())
    
    def run_all_tests(self):
        """Executa todos os testes"""
        print("="*60)
        print("🧪 TESTES DA SKILL SUPABASE-FLUXOHUB")
        print("="*60)
        print()
        
        # Teste 1: Conexão básica
        self.test("Conexão com Supabase", self.test_connection)
        
        # Teste 2: Listar workflows
        self.test("Listar workflows", self.test_list_workflows)
        
        # Teste 3: Buscar workflow específico
        self.test("Buscar workflow de contratos", self.test_find_contract_workflow)
        
        # Teste 4: Listar nós
        self.test("Listar nós do workflow", self.test_list_nodes)
        
        # Teste 5: Verificar schema de configs
        self.test("Verificar schema workflow_document_configs", self.test_document_config_schema)
        
        # Teste 6: Verificar email configs
        self.test("Verificar schema workflow_email_configs", self.test_email_config_schema)
        
        # Teste 7: Verificar execuções
        self.test("Verificar tabela executions", self.test_executions_schema)
        
        # Resumo
        print("="*60)
        print("📊 RESUMO DOS TESTES")
        print("="*60)
        print(f"✅ Passaram: {self.passed}")
        print(f"❌ Falharam: {self.failed}")
        
        if self.errors:
            print("\n🚨 Erros encontrados:")
            for error in self.errors:
                print(f"   - {error}")
        
        print()
        return self.failed == 0
    
    def test_connection(self):
        """Testa conexão básica"""
        result = self.supabase_request("workflows?limit=1")
        return isinstance(result, list)
    
    def test_list_workflows(self):
        """Testa listar workflows"""
        result = self.supabase_request("workflows?select=id,name&limit=5")
        return len(result) > 0 and "id" in result[0] and "name" in result[0]
    
    def test_find_contract_workflow(self):
        """Busca workflow específico"""
        result = self.supabase_request(
            "workflows?id=eq.0a6a8134-7631-40bb-a560-8f31db32356a&select=id,name,is_active"
        )
        return len(result) == 1 and result[0].get("is_active") == True
    
    def test_list_nodes(self):
        """Lista nós do workflow"""
        result = self.supabase_request(
            "nodes?workflow_id=eq.0a6a8134-7631-40bb-a560-8f31db32356a&select=id,label,node_type"
        )
        return len(result) >= 4  # Espera pelo menos 4 nós
    
    def test_document_config_schema(self):
        """Verifica schema de document configs"""
        result = self.supabase_request(
            "workflow_document_configs?limit=1"
        )
        if not result:
            return True  # Tabela vazia é OK
        
        required_fields = ["workflow_id", "template_document_id", "history_folder_id"]
        return all(field in result[0] for field in required_fields)
    
    def test_email_config_schema(self):
        """Verifica schema de email configs"""
        result = self.supabase_request(
            "workflow_email_configs?limit=1"
        )
        if not result:
            return True  # Tabela vazia é OK
        
        required_fields = ["workflow_id", "recipient_emails", "subject_template"]
        return all(field in result[0] for field in required_fields)
    
    def test_executions_schema(self):
        """Verifica schema de executions"""
        result = self.supabase_request(
            "executions?limit=1"
        )
        if not result:
            return True  # Tabela vazia é OK
        
        required_fields = ["id", "workflow_id", "status"]
        return all(field in result[0] for field in required_fields)


if __name__ == "__main__":
    tester = SupabaseTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
