#!/usr/bin/env python3
"""
Diagnóstico completo do workflow de contratos
Conecta direto ao Supabase do FluxoHub
"""

import os
import sys
import json
from urllib.parse import urljoin
import urllib.request
import urllib.error
import ssl

# Credenciais do FluxoHub (do .env)
SUPABASE_URL = "https://pzzmmaachshasiijopbw.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6em1tYWFjaHNoYXNpaWpvcGJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMjUwMiwiZXhwIjoyMDg2OTA4NTAyfQ._L2zZUn2lpBsQJetGaVx2GcE2Poi0ZEhQkJk602OgMc"

WORKFLOW_ID = "0a6a8134-7631-40bb-a560-8f31db32356a"

def supabase_query(table: str, select: str = "*", filters: dict = None, order: str = None, limit: int = None):
    """Executa query no Supabase via REST API"""
    
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}"
    
    if filters:
        for key, value in filters.items():
            url += f"&{key}=eq.{value}"
    
    if order:
        url += f"&order={order}"
    
    if limit:
        url += f"&limit={limit}"
    
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    
    req = urllib.request.Request(url, headers=headers)
    
    # Ignorar SSL verification para evitar erros
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        print(f"❌ Erro HTTP {e.code}: {e.read().decode()}")
        return None
    except Exception as e:
        print(f"❌ Erro: {e}")
        return None

def main():
    print("="*60)
    print("🔬 DIAGNÓSTICO DO WORKFLOW DE CONTRATOS")
    print(f"   Workflow ID: {WORKFLOW_ID}")
    print("="*60)
    print()
    
    # 1. Info do workflow
    print("📋 1. INFORMAÇÕES DO WORKFLOW")
    print("-"*60)
    workflows = supabase_query("workflows", "*", {"id": WORKFLOW_ID})
    if workflows:
        wf = workflows[0]
        print(f"   Nome: {wf.get('name')}")
        print(f"   Ativo: {wf.get('is_active')}")
        print(f"   Criado: {wf.get('created_at')}")
    else:
        print("   ❌ Workflow não encontrado!")
    print()
    
    # 2. Nós do workflow
    print("📦 2. NÓS DO WORKFLOW")
    print("-"*60)
    nodes = supabase_query("nodes", "id,label,node_type", 
                          filters={"workflow_id": WORKFLOW_ID},
                          order="label")
    if nodes:
        for node in nodes:
            print(f"   • {node.get('label')} ({node.get('node_type')})")
            print(f"     ID: {node.get('id')}")
    else:
        print("   ❌ Nenhum nó encontrado!")
    print()
    
    # 3. Últimas execuções
    print("⚡ 3. ÚLTIMAS 5 EXECUÇÕES")
    print("-"*60)
    executions = supabase_query("executions", 
                               "id,status,error_message,created_at",
                               filters={"workflow_id": WORKFLOW_ID},
                               order="created_at.desc",
                               limit=5)
    if executions:
        for i, ex in enumerate(executions, 1):
            status = ex.get('status', 'unknown')
            status_icon = "✅" if status == "completed" else "❌" if status == "failed" else "⏳"
            print(f"   {i}. {status_icon} {ex.get('id')[:8]}... | {status}")
            if ex.get('error_message'):
                print(f"      Erro: {ex.get('error_message')[:80]}")
            print(f"      Data: {ex.get('created_at')}")
            
            # Se for a primeira execução, mostrar logs
            if i == 1 and ex.get('id'):
                print()
                print("   📄 LOGS DESTA EXECUÇÃO:")
                logs = supabase_query("execution_logs",
                                    "node_id,status,error,created_at",
                                    filters={"execution_id": ex.get('id')},
                                    order="created_at")
                if logs:
                    for log in logs:
                        log_status = log.get('status', 'unknown')
                        icon = "✅" if log_status == "completed" else "❌"
                        print(f"      {icon} {log.get('node_id')[:8]}... | {log_status}")
                        if log.get('error'):
                            print(f"         Erro: {log.get('error')[:60]}")
                else:
                    print("      (sem logs)")
    else:
        print("   ❌ Nenhuma execução encontrada!")
    print()
    
    # 4. Config de documento
    print("📄 4. CONFIGURAÇÃO DE TEMPLATE")
    print("-"*60)
    configs = supabase_query("workflow_document_configs", "*",
                            filters={"workflow_id": WORKFLOW_ID})
    if configs:
        for cfg in configs:
            print(f"   Template ID: {cfg.get('template_id')}")
            print(f"   Folder ID: {cfg.get('folder_id')}")
    else:
        print("   ❌ Configuração de template não encontrada!")
    print()
    
    # 5. Config de email
    print("📧 5. CONFIGURAÇÃO DE EMAIL")
    print("-"*60)
    email_configs = supabase_query("workflow_email_configs", "*",
                                  filters={"workflow_id": WORKFLOW_ID})
    if email_configs:
        for cfg in email_configs:
            print(f"   Destinatários: {cfg.get('recipients')}")
            print(f"   Assunto: {cfg.get('subject_template')}")
    else:
        print("   ❌ Configuração de email não encontrada!")
    print()
    
    # 6. Short links
    print("🔗 6. SHORT LINKS")
    print("-"*60)
    links = supabase_query("form_links", "short_code,form_type,is_active",
                          filters={"workflow_id": WORKFLOW_ID})
    if links:
        for link in links:
            icon = "✅" if link.get('is_active') else "❌"
            print(f"   {icon} /{link.get('short_code')} ({link.get('form_type')})")
    else:
        print("   ❌ Nenhum short link encontrado!")
    print()
    
    print("="*60)
    print("✅ Diagnóstico completo!")
    print("="*60)

if __name__ == "__main__":
    main()
