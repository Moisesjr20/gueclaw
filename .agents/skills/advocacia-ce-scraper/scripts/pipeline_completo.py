#!/usr/bin/env python3
"""
Pipeline Completo: Executa todas as fases em sequência
Fase 1: Apify (Google Maps)
Fase 2: Scraping de websites
Fase 3: Validação e exportação
"""

import os
import sys
import json
import argparse

# Adiciona scripts ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from busca_apify import buscar_escritorios, salvar_resultados
from scrape_websites import processar_escritorios
from valida_emails import processar_dados


def run_pipeline(cidade="Fortaleza", quantidade=100, termo="escritório de advocacia", 
                 output_dir="resultados"):
    """
    Executa pipeline completo de busca
    
    Args:
        cidade: Cidade para buscar
        quantidade: Número de resultados
        termo: Termo de busca
        output_dir: Diretório para salvar resultados
    
    Returns:
        dict: Resumo da execução
    """
    
    # Criar diretório de saída
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = __import__('time').strftime("%Y%m%d_%H%M%S")
    
    arquivos = {
        'fase1': os.path.join(output_dir, f'fase1_apify_{timestamp}.json'),
        'fase2': os.path.join(output_dir, f'fase2_websites_{timestamp}.json'),
        'fase3_json': os.path.join(output_dir, f'escritorios_{cidade.lower()}_{timestamp}.json'),
        'fase3_csv': os.path.join(output_dir, f'escritorios_{cidade.lower()}_{timestamp}.csv'),
    }
    
    resultados = {
        'cidade': cidade,
        'quantidade_solicitada': quantidade,
        'timestamp': timestamp,
        'arquivos': arquivos,
        'fases': {}
    }
    
    print("="*60)
    print("🚀 PIPELINE COMPLETO - BUSCA DE ESCRITÓRIOS")
    print("="*60)
    print(f"Cidade: {cidade}")
    print(f"Quantidade: {quantidade}")
    print(f"Termo: {termo}")
    print(f"Saída: {output_dir}")
    print()
    
    # ==================== FASE 1 ====================
    print("\n" + "="*60)
    print("📍 FASE 1: BUSCA NO GOOGLE MAPS")
    print("="*60)
    print()
    
    try:
        escritorios_fase1 = buscar_escritorios(
            cidade=cidade,
            quantidade=quantidade,
            termo_busca=termo
        )
        
        if not escritorios_fase1:
            print("❌ Fase 1 falhou: nenhum resultado")
            return None
        
        salvar_resultados(escritorios_fase1, arquivos['fase1'])
        
        resultados['fases']['fase1'] = {
            'status': 'sucesso',
            'total_encontrado': len(escritorios_fase1),
            'com_website': sum(1 for e in escritorios_fase1 if e.get('website'))
        }
        
    except Exception as e:
        print(f"❌ Erro na Fase 1: {e}")
        resultados['fases']['fase1'] = {'status': 'falha', 'erro': str(e)}
        return resultados
    
    # ==================== FASE 2 ====================
    print("\n" + "="*60)
    print("🌐 FASE 2: SCRAPING DE WEBSITES")
    print("="*60)
    print()
    
    try:
        escritorios_fase2 = processar_escritorios(
            arquivos['fase1'],
            arquivos['fase2']
        )
        
        resultados['fases']['fase2'] = {
            'status': 'sucesso',
            'total_processado': len(escritorios_fase2),
            'com_email': sum(1 for e in escritorios_fase2 if e.get('email'))
        }
        
    except Exception as e:
        print(f"❌ Erro na Fase 2: {e}")
        resultados['fases']['fase2'] = {'status': 'falha', 'erro': str(e)}
        return resultados
    
    # ==================== FASE 3 ====================
    print("\n" + "="*60)
    print("✅ FASE 3: VALIDAÇÃO E EXPORTAÇÃO")
    print("="*60)
    print()
    
    try:
        escritorios_final = processar_dados(
            arquivos['fase2'],
            arquivos['fase3_json'],
            arquivos['fase3_csv']
        )
        
        resultados['fases']['fase3'] = {
            'status': 'sucesso',
            'total_final': len(escritorios_final)
        }
        
    except Exception as e:
        print(f"❌ Erro na Fase 3: {e}")
        resultados['fases']['fase3'] = {'status': 'falha', 'erro': str(e)}
        return resultados
    
    # ==================== RESUMO ====================
    print("\n" + "="*60)
    print("🎉 PIPELINE CONCLUÍDO!")
    print("="*60)
    print()
    print("📁 Arquivos gerados:")
    for nome, caminho in arquivos.items():
        if os.path.exists(caminho):
            tamanho = os.path.getsize(caminho)
            print(f"   ✅ {nome}: {caminho} ({tamanho} bytes)")
    print()
    print("📊 Resumo:")
    print(f"   Cidade: {cidade}")
    print(f"   Encontrados (Fase 1): {resultados['fases']['fase1']['total_encontrado']}")
    print(f"   Com email (Fase 2): {resultados['fases']['fase2']['com_email']}")
    print(f"   Final válidos (Fase 3): {resultados['fases']['fase3']['total_final']}")
    print()
    print(f"📄 Arquivo principal: {arquivos['fase3_csv']}")
    
    # Salvar resumo
    resumo_file = os.path.join(output_dir, f'resumo_{timestamp}.json')
    with open(resumo_file, 'w', encoding='utf-8') as f:
        json.dump(resultados, f, ensure_ascii=False, indent=2)
    
    return resultados


def main():
    parser = argparse.ArgumentParser(description="Pipeline completo de busca de escritórios")
    parser.add_argument("--cidade", "-c", default="Fortaleza", help="Cidade para buscar")
    parser.add_argument("--quantidade", "-q", type=int, default=100, help="Quantidade de resultados")
    parser.add_argument("--termo", "-t", default="escritório de advocacia", help="Termo de busca")
    parser.add_argument("--output", "-o", default="resultados", help="Diretório de saída")
    
    args = parser.parse_args()
    
    # Verificar APIFY_API_KEY
    if not os.getenv("APIFY_API_KEY"):
        print("❌ Erro: APIFY_API_KEY não configurado")
        print("   export APIFY_API_KEY='apify_api_...'")
        sys.exit(1)
    
    # Executar pipeline
    resultado = run_pipeline(
        cidade=args.cidade,
        quantidade=args.quantidade,
        termo=args.termo,
        output_dir=args.output
    )
    
    if resultado:
        print("\n✅ Sucesso!")
        sys.exit(0)
    else:
        print("\n❌ Falha no pipeline")
        sys.exit(1)


if __name__ == "__main__":
    main()
