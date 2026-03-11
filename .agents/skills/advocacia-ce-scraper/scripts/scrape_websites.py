#!/usr/bin/env python3
"""
Fase 2: Scraping de websites para extrair emails
Visita sites dos escritórios e busca emails de contato
"""

import os
import re
import json
import time
import argparse
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

# Configuração
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}
TIMEOUT = 10
DELAY = 2  # Segundos entre requisições

# Regex para extrair emails
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')

# Emails para ignorar (genéricos/temporários)
EMAILS_IGNORAR = [
    'contato@gmail.com', 'info@gmail.com', 'admin@gmail.com',
    'email@gmail.com', 'example@gmail.com', 'test@gmail.com',
    'noreply', 'no-reply', 'naoresponder', 'webmaster',
    'suporte', 'support', 'vendas', 'sales'
]


def extrair_emails_pagina(url):
    """
    Visita uma página e extrai todos os emails encontrados
    
    Returns:
        dict: {emails: [], paginas_visitadas: [], sucesso: bool}
    """
    emails_encontrados = set()
    paginas_visitadas = []
    
    # Páginas prioritárias para buscar
    urls_para_buscar = [
        url,
        urljoin(url, '/contato'),
        urljoin(url, '/contact'),
        urljoin(url, '/fale-conosco'),
        urljoin(url, '/escritorio'),
        urljoin(url, '/sobre'),
    ]
    
    for pagina_url in urls_para_buscar:
        try:
            print(f"   🔍 Acessando: {pagina_url}")
            
            response = requests.get(
                pagina_url,
                headers=HEADERS,
                timeout=TIMEOUT,
                allow_redirects=True
            )
            
            if response.status_code != 200:
                continue
            
            paginas_visitadas.append(pagina_url)
            
            # Parse HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove scripts e styles
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Extrai texto
            texto = soup.get_text()
            
            # Busca emails
            emails = EMAIL_REGEX.findall(texto)
            
            for email in emails:
                email = email.lower().strip()
                
                # Ignora emails genéricos
                if any(ign in email for ign in EMAILS_IGNORAR):
                    continue
                
                # Ignora emails temporários
                if any(temp in email for temp in ['10minutemail', 'tempmail', 'guerrillamail']):
                    continue
                
                emails_encontrados.add(email)
            
            # Se encontrou emails, para de buscar
            if emails_encontrados:
                print(f"   ✅ Encontrados {len(emails_encontrados)} emails")
                break
            
            # Delay entre requisições
            time.sleep(DELAY)
            
        except requests.exceptions.Timeout:
            print(f"   ⏱️ Timeout: {pagina_url}")
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Erro: {e}")
        except Exception as e:
            print(f"   ❌ Erro inesperado: {e}")
    
    return {
        "emails": list(emails_encontrados),
        "paginas_visitadas": paginas_visitadas,
        "sucesso": len(emails_encontrados) > 0
    }


def processar_escritorios(input_file, output_file):
    """
    Processa lista de escritórios e extrai emails dos websites
    """
    
    # Carregar entrada
    with open(input_file, 'r', encoding='utf-8') as f:
        escritorios = json.load(f)
    
    print(f"📋 Processando {len(escritorios)} escritórios...")
    print()
    
    resultados = []
    
    for i, escritorio in enumerate(escritorios, 1):
        print(f"[{i}/{len(escritorios)}] {escritorio['nome']}")
        
        website = escritorio.get('website', '')
        
        if not website:
            print("   ⚠️ Sem website, pulando...")
            escritorio['email'] = None
            escritorio['email_fonte'] = None
            resultados.append(escritorio)
            continue
        
        # Garante URL completa
        if not website.startswith('http'):
            website = 'https://' + website
        
        # Extrair emails
        dados_email = extrair_emails_pagina(website)
        
        # Adiciona ao resultado
        escritorio['emails_encontrados'] = dados_email['emails']
        escritorio['email'] = dados_email['emails'][0] if dados_email['emails'] else None
        escritorio['email_fonte'] = 'website' if dados_email['sucesso'] else None
        escritorio['paginas_visitadas'] = dados_email['paginas_visitadas']
        
        resultados.append(escritorio)
        
        print()
    
    # Salvar resultados
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(resultados, f, ensure_ascii=False, indent=2)
    
    print(f"💾 Salvos em: {output_file}")
    
    # Resumo
    com_email = sum(1 for r in resultados if r['email'])
    print()
    print("📊 Resumo:")
    print(f"   Total processado: {len(resultados)}")
    print(f"   Com email: {com_email} ({com_email/len(resultados)*100:.1f}%)")
    
    return resultados


def main():
    parser = argparse.ArgumentParser(description="Extrai emails dos websites dos escritórios")
    parser.add_argument("--input", "-i", default="resultados_fase1.json", help="Arquivo de entrada")
    parser.add_argument("--output", "-o", default="resultados_fase2.json", help="Arquivo de saída")
    
    args = parser.parse_args()
    
    print("="*60)
    print("🌐 FASE 2: SCRAPING DE WEBSITES")
    print("="*60)
    print()
    
    if not os.path.exists(args.input):
        print(f"❌ Arquivo não encontrado: {args.input}")
        return
    
    processar_escritorios(args.input, args.output)


if __name__ == "__main__":
    main()
