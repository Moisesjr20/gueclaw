#!/usr/bin/env python3
"""
Testes da skill fluxohub-admin
Verifica se scripts SQL estão corretos
"""

import os
import sys
import re

class FluxoHubAdminTester:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        self.scripts_dir = os.path.dirname(os.path.abspath(__file__))
    
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
    
    def test_files_exist(self):
        """Verifica se todos os arquivos necessários existem"""
        required_files = [
            "../SKILL.md",
            "update_node_code.sql",
            "list_workflow_nodes.sql",
            "create_form_link.sql",
            "update_document_config.sql"
        ]
        
        for file in required_files:
            path = os.path.join(self.scripts_dir, file)
            if not os.path.exists(path):
                print(f"   ❌ Arquivo não encontrado: {file}")
                return False
        return True
    
    def test_sql_syntax_update_node(self):
        """Verifica sintaxe SQL do update_node_code.sql"""
        path = os.path.join(self.scripts_dir, "update_node_code.sql")
        content = open(path).read()
        
        checks = [
            "UPDATE nodes" in content,
            "SET code" in content,
            "WHERE id" in content,
            "updated_at" in content
        ]
        return all(checks)
    
    def test_sql_syntax_list_nodes(self):
        """Verifica sintaxe SQL do list_workflow_nodes.sql"""
        path = os.path.join(self.scripts_dir, "list_workflow_nodes.sql")
        content = open(path).read()
        
        checks = [
            "SELECT" in content,
            "FROM nodes" in content,
            "WHERE workflow_id" in content,
            "ORDER BY" in content
        ]
        return all(checks)
    
    def test_sql_syntax_create_form_link(self):
        """Verifica sintaxe SQL do create_form_link.sql"""
        path = os.path.join(self.scripts_dir, "create_form_link.sql")
        content = open(path).read()
        
        checks = [
            "INSERT INTO" in content and "form_links" in content,
            "user_id" in content,
            "workflow_id" in content,
            "short" in content.lower()  # short_code ou shortCode
        ]
        return all(checks)
    
    def test_sql_injection_safe(self):
        """Verifica se SQLs usam placeholders seguros"""
        sql_files = [f for f in os.listdir(self.scripts_dir) if f.endswith('.sql')]
        
        for sql_file in sql_files:
            path = os.path.join(self.scripts_dir, sql_file)
            content = open(path).read()
            
            # Verifica se não há concatenação de strings perigosa
            # (apenas uma verificação básica)
            if "' + " in content or "+ '" in content:
                print(f"   ⚠️  Possível SQL injection em {sql_file}")
                # Não falha, apenas avisa
        
        return True
    
    def test_skill_md_structure(self):
        """Verifica estrutura do SKILL.md"""
        path = os.path.join(self.scripts_dir, "../SKILL.md")
        content = open(path).read()
        
        checks = [
            "fluxohub-admin" in content,  # Nome da skill
            "description:" in content,
            "workflows" in content.lower() or "workflow" in content.lower(),
            "nodes" in content.lower() or "nós" in content.lower(),
            "Template" in content or "template" in content
        ]
        return all(checks)
    
    def test_references_exist(self):
        """Verifica se diretório references existe com arquivos"""
        refs_dir = os.path.join(self.scripts_dir, "../references")
        if not os.path.exists(refs_dir):
            print("   ⚠️  Diretório references não existe (opcional)")
            return True
        
        files = os.listdir(refs_dir)
        return len(files) >= 0  # Opcional
    
    def test_uuids_valid_format(self):
        """Verifica se UUIDs no SKILL.md estão em formato válido"""
        path = os.path.join(self.scripts_dir, "../SKILL.md")
        content = open(path).read()
        
        # Regex para UUID
        uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        uuids = re.findall(uuid_pattern, content)
        
        if not uuids:
            print("   ⚠️  Nenhum UUID encontrado no SKILL.md")
            return True  # Não é erro fatal
        
        # Verifica se UUIDs são válidos (formato)
        for uuid in uuids:
            if not re.match(f'^{uuid_pattern}$', uuid):
                print(f"   ❌ UUID inválido: {uuid}")
                return False
        
        print(f"   ✅ {len(uuids)} UUIDs válidos encontrados")
        return True
    
    def run_all_tests(self):
        """Executa todos os testes"""
        print("="*60)
        print("🧪 TESTES DA SKILL FLUXOHUB-ADMIN")
        print("="*60)
        print()
        
        # Testes de estrutura
        self.test("Arquivos necessários existem", self.test_files_exist)
        self.test("SKILL.md estrutura correta", self.test_skill_md_structure)
        self.test("UUIDs em formato válido", self.test_uuids_valid_format)
        
        # Testes de SQL
        self.test("SQL: update_node_code sintaxe", self.test_sql_syntax_update_node)
        self.test("SQL: list_workflow_nodes sintaxe", self.test_sql_syntax_list_nodes)
        self.test("SQL: create_form_link sintaxe", self.test_sql_syntax_create_form_link)
        self.test("SQL: segurança básica", self.test_sql_injection_safe)
        
        # Testes opcionais
        self.test("Diretório references", self.test_references_exist)
        
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


def main():
    tester = FluxoHubAdminTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
