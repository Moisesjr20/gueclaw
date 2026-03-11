#!/usr/bin/env python3
"""
Fase 3: Validação e limpeza dos dados
Valida emails, remove duplicados, exporta resultados finais
"""

import os
import re
import csv
import json
import argparse
from datetime import datetime


def validar_formato_email(email):
    """Valida formato básico de email"""
    if not email:
        return False
    
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def email_eh_temporario(email):
    """Verifica se é email temporário/descartável"""
    dominios_temp = [
        '10minutemail.com', 'guerrillamail.com', 'tempmail.com',
        'throwawaymail.com', 'yopmail.com', 'mailinator.com',
        'temp-mail.org', 'fakeinbox.com', 'sharklasers.com'
    ]
    
    dominio = email.split('@')[1].lower()
    return any(temp in dominio for temp in dominios_temp)


def email_eh_generico(email):
    """Verifica se é email genérico (não personalizado)"""
    usuarios_genericos = [
        'contato', 'contato1', 'contato2',
        'info', 'information',
        'admin', 'administrador',
        'suporte', 'support',
        'vendas', 'sales', 'comercial',
        'atendimento', 'atendimento1',
        'email', 'mail', 'e-mail',
        'webmaster', 'hostmaster',
        'postmaster', 'root',
        'test', 'teste', 'example', 'exemplo'
    ]
    
    usuario = email.split('@')[0].lower()
    return any(gen in usuario for gen in usuarios_genericos)


def remover_duplicados(escritorios):
    """Remove escritórios duplicados (mesmo email ou nome similar)"""
    
    # Agrupa por email
    por_email = {}
    for esc in escritorios:
        email = esc.get('email', '')
        if email and validar_formato_email(email):
            if email not in por_email:
                por_email[email] = esc
            else:
                # Mantém o mais completo
                atual = por_email[email]
                if len(str(esc.get('telefone', ''))) > len(str(atual.get('telefone', ''))):
                    por_email[email] = esc
    
    # Converte de volta para lista
    unicos = list(por_email.values())
    
    print(f"   📊 Removidos {len(escritorios) - len(unicos)} duplicados")
    return unicos


def classificar_qualidade(escritorio):
    """
    Classifica a qualidade do lead
    ⭐⭐⭐: Email personalizado + telefone + endereço completo
    ⭐⭐: Email válido + telefone OU endereço
    ⭐: Apenas email válido
    """
    
    email = escritorio.get('email', '')
    telefone = escritorio.get('telefone', '')
    endereco = escritorio.get('endereco', '')
    
    # Verifica email
    tem_email_valido = validar_formato_email(email) and not email_eh_temporario(email)
    email_personalizado = tem_email_valido and not email_eh_generico(email)
    
    # Pontuação
    pontos = 0
    if email_personalizado:
        pontos += 3
    elif tem_email_valido:
        pontos += 1
    
    if telefone:
        pontos += 1
    
    if endereco and len(endereco) > 20:
        pontos += 1
    
    # Classificação
    if pontos >= 4:
        return "⭐⭐⭐ Excelente"
    elif pontos >= 2:
        return "⭐⭐ Bom"
    else:
        return "⭐ Regular"


def processar_dados(input_file, output_json, output_csv):
    """Processa e valida todos os dados"""
    
    # Carregar
    with open(input_file, 'r', encoding='utf-8') as f:
        escritorios = json.load(f)
    
    print(f"📋 Processando {len(escritorios)} escritórios...")
    print()
    
    # Validar cada escritório
    validados = []
    
    for esc in escritorios:
        email = esc.get('email', '')
        
        # Validações
        esc['email_valido'] = validar_formato_email(email)
        esc['email_temporario'] = email_eh_temporario(email) if email else False
        esc['email_generico'] = email_eh_generico(email) if email else False
        esc['qualidade'] = classificar_qualidade(esc)
        
        # Só inclui se tiver email válido
        if esc['email_valido'] and not esc['email_temporario']:
            validados.append(esc)
    
    print(f"   ✅ {len(validados)} com email válido")
    
    # Remover duplicados
    unicos = remover_duplicados(validados)
    
    # Ordenar por qualidade
    unicos.sort(key=lambda x: x['qualidade'], reverse=True)
    
    # Salvar JSON
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(unicos, f, ensure_ascii=False, indent=2)
    
    print(f"💾 JSON salvo: {output_json}")
    
    # Exportar CSV
    if output_csv:
        campos_csv = ['nome', 'email', 'telefone', 'endereco', 'cidade', 
                     'website', 'qualidade', 'data_coleta']
        
        with open(output_csv, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=campos_csv, extrasaction='ignore')
            writer.writeheader()
            for esc in unicos:
                writer.writerow(esc)
        
        print(f"💾 CSV salvo: {output_csv}")
    
    # Resumo final
    print()
    print("="*60)
    print("📊 RESULTADO FINAL")
    print("="*60)
    print(f"Total inicial: {len(escritorios)}")
    print(f"Com email válido: {len(validados)}")
    print(f"Após remover duplicados: {len(unicos)}")
    print()
    
    # Por qualidade
    por_qualidade = {}
    for esc in unicos:
        q = esc['qualidade']
        por_qualidade[q] = por_qualidade.get(q, 0) + 1
    
    print("Por qualidade:")
    for qual, count in sorted(por_qualidade.items(), reverse=True):
        print(f"   {qual}: {count}")
    
    # Por cidade
    por_cidade = {}
    for esc in unicos:
        cidade = esc.get('cidade', 'Desconhecida')
        por_cidade[cidade] = por_cidade.get(cidade, 0) + 1
    
    print("\nPor cidade:")
    for cidade, count in sorted(por_cidade.items(), key=lambda x: x[1], reverse=True):
        print(f"   {cidade}: {count}")
    
    return unicos


def main():
    parser = argparse.ArgumentParser(description="Valida e limpa dados dos escritórios")
    parser.add_argument("--input", "-i", default="resultados_fase2.json", help="Arquivo de entrada")
    parser.add_argument("--output-json", "-j", default="escritorios_final.json", help="Arquivo JSON de saída")
    parser.add_argument("--output-csv", "-c", default="escritorios_final.csv", help="Arquivo CSV de saída")
    parser.add_argument("--sem-csv", action="store_true", help="Não exportar CSV")
    
    args = parser.parse_args()
    
    print("="*60)
    print("✅ FASE 3: VALIDAÇÃO E LIMPEZA")
    print("="*60)
    print()
    
    if not os.path.exists(args.input):
        print(f"❌ Arquivo não encontrado: {args.input}")
        return
    
    output_csv = None if args.sem_csv else args.output_csv
    
    processar_dados(args.input, args.output_json, output_csv)


if __name__ == "__main__":
    main()
