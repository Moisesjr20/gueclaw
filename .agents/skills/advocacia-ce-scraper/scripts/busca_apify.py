#!/usr/bin/env python3
"""
Fase 1: Busca no Google Maps via Apify
Extrai escritórios de advocacia no Ceará
"""

import os
import json
import time
import argparse
from apify_client import ApifyClient

# Configuração
APIFY_API_KEY = os.getenv("APIFY_API_KEY", "")
ACTOR_ID = "compass~google-maps-scraper"  # Actor oficial


def buscar_escritorios(cidade="Fortaleza", quantidade=100, termo_busca="escritório de advocacia"):
    """
    Busca escritórios de advocacia no Google Maps via Apify
    
    Args:
        cidade: Cidade para buscar (ex: Fortaleza, Caucaia, Maracanaú)
        quantidade: Número máximo de resultados
        termo_busca: Termo de busca (padrão: escritório de advocacia)
    
    Returns:
        Lista de dicionários com dados dos escritórios
    """
    
    if not APIFY_API_KEY:
        print("❌ Erro: APIFY_API_KEY não configurado")
        print("   export APIFY_API_KEY='apify_api_...'")
        return []
    
    client = ApifyClient(APIFY_API_KEY)
    
    # Configurar input do actor
    run_input = {
        "searchStringsArray": [f"{termo_busca} {cidade} CE"],
        "locationQuery": f"{cidade}, Ceará, Brasil",
        "maxCrawledPlaces": quantidade,
        "maxImages": 0,  # Não precisamos de imagens
        "maxReviews": 0,  # Não precisamos de reviews
        "language": "pt",
        "countryCode": "BR",
    }
    
    print(f"🔍 Buscando: '{termo_busca}' em {cidade}, CE")
    print(f"   Quantidade máxima: {quantidade}")
    print(f"   Actor: {ACTOR_ID}")
    print()
    
    try:
        # Iniciar actor
        print("⏳ Iniciando actor Apify...")
        run = client.actor(ACTOR_ID).call(run_input=run_input)
        
        run_id = run["id"]
        print(f"   Run ID: {run_id}")
        print(f"   Status: {run['status']}")
        print()
        
        # Aguardar conclusão (polling)
        print("⏳ Aguardando conclusão...")
        while True:
            run_status = client.run(run_id).get()
            status = run_status["status"]
            
            if status in ["SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"]:
                break
            
            print(f"   Status: {status}...")
            time.sleep(5)
        
        if status != "SUCCEEDED":
            print(f"❌ Actor falhou com status: {status}")
            return []
        
        # Obter resultados
        print("📥 Obtendo resultados...")
        dataset_items = []
        
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            # Extrair dados relevantes
            escritorio = {
                "nome": item.get("title", ""),
                "endereco": item.get("address", ""),
                "telefone": item.get("phone", ""),
                "website": item.get("website", ""),
                "email_maps": item.get("email", ""),  # Email do Google Maps (raro)
                "google_maps_url": item.get("url", ""),
                "categoria": item.get("categoryName", ""),
                "cidade": cidade,
                "estado": "CE",
                "fonte": "google_maps",
                "data_coleta": time.strftime("%Y-%m-%d")
            }
            dataset_items.append(escritorio)
        
        print(f"✅ Encontrados {len(dataset_items)} escritórios")
        return dataset_items
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        return []


def salvar_resultados(dados, output_file):
    """Salva resultados em JSON"""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    print(f"💾 Salvos em: {output_file}")


def main():
    parser = argparse.ArgumentParser(description="Busca escritórios de advocacia no Google Maps")
    parser.add_argument("--cidade", "-c", default="Fortaleza", help="Cidade para buscar")
    parser.add_argument("--quantidade", "-q", type=int, default=100, help="Número máximo de resultados")
    parser.add_argument("--termo", "-t", default="escritório de advocacia", help="Termo de busca")
    parser.add_argument("--output", "-o", default="resultados_fase1.json", help="Arquivo de saída")
    
    args = parser.parse_args()
    
    print("="*60)
    print("🔍 FASE 1: BUSCA NO GOOGLE MAPS (APIFY)")
    print("="*60)
    print()
    
    # Buscar
    resultados = buscar_escritorios(
        cidade=args.cidade,
        quantidade=args.quantidade,
        termo_busca=args.termo
    )
    
    if resultados:
        salvar_resultados(resultados, args.output)
        print()
        print("📊 Resumo:")
        print(f"   Total encontrado: {len(resultados)}")
        print(f"   Com website: {sum(1 for r in resultados if r['website'])}")
        print(f"   Com telefone: {sum(1 for r in resultados if r['telefone'])}")
    else:
        print("❌ Nenhum resultado encontrado")


if __name__ == "__main__":
    main()
