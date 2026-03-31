#!/usr/bin/env python3
"""Import CSV financial data to GueClaw via Telegram."""
import requests
import json
import os
import csv
from pathlib import Path

def load_env():
    """Load environment variables from .env file."""
    env_path = Path(__file__).parent.parent / '.env'
    env = {}
    with open(env_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env[key.strip()] = value.strip()
    return env

def parse_csv(csv_path):
    """Parse CSV file and convert to JSON array."""
    transactions = []
    with open(csv_path, encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            # Normalize keys
            normalized = {
                'data': row.get('data', '').strip(),
                'valor': row.get('valor', '').strip(),
                'descricao': row.get('descrição', '').strip() or row.get('descricao', '').strip(),
                'tipo': row.get('Tipo', '').strip(),
                'centroDeCusto': row.get('centro de custo', '').strip(),
                'status': row.get('status', '').strip(),
                'tipoDeMovimentacao': row.get('tipo de movimentação', '').strip() or row.get('tipo de movimentacao', '').strip(),
                'parcela': row.get('Parcela', '').strip()
            }
            transactions.append(normalized)
    return transactions

def send_to_telegram(bot_token, chat_id, csv_data):
    """Send CSV data to Telegram bot."""
    url = f'https://api.telegram.org/bot{bot_token}/sendMessage'
    
    # Format message with markers
    csv_json = json.dumps(csv_data, ensure_ascii=False)
    message = f"Importar transações financeiras:\n\n[CSV_JSON_DATA]\n{csv_json}\n[/CSV_JSON_DATA]"
    
    payload = {
        'chat_id': chat_id,
        'text': message
    }
    
    print(f'📤 Sending {len(csv_data)} transactions to bot...')
    response = requests.post(url, json=payload, timeout=30)
    
    if response.status_code == 200:
        print('✅ Message sent successfully')
        return True
    else:
        print(f'❌ Failed to send message: {response.status_code}')
        print(response.text)
        return False

def main():
    env = load_env()
    bot_token = env.get('TELEGRAM_BOT_TOKEN')
    chat_id = env.get('TELEGRAM_USER_CHAT_ID')
    
    if not bot_token or not chat_id:
        print('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_USER_CHAT_ID in .env')
        return
    
    csv_path = Path(__file__).parent.parent / 'tmp' / 'fin.csv'
    
    if not csv_path.exists():
        print(f'❌ CSV not found: {csv_path}')
        return
    
    print(f'📂 Reading CSV from: {csv_path}')
    transactions = parse_csv(csv_path)
    print(f'📊 Found {len(transactions)} transactions')
    
    # Show sample
    if transactions:
        print('\n📋 Sample (first 3):')
        for t in transactions[:3]:
            print(f'  {t["data"]} | {t["descricao"]} | R$ {t["valor"]}')
    
    # Send to bot
    success = send_to_telegram(bot_token, chat_id, transactions)
    
    if success:
        print('\n✅ Import request sent to GueClaw bot')
        print('⏳ Check Telegram for confirmation')

if __name__ == '__main__':
    main()
