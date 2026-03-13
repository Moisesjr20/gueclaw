#!/usr/bin/env python3
import sys
import json
import urllib.request
import ssl

def send_message(token, number, text):
    url = "https://kyrius.uazapi.com/send/text"
    
    payload = {
        "number": number,
        "text": text
    }
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "token": token
    }
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(payload).encode('utf-8'), 
        headers=headers, 
        method='POST'
    )
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as response:
            result = json.loads(response.read().decode())
            return True, result
    except urllib.error.HTTPError as e:
        return False, f"HTTP Error {e.code}: {e.read().decode()}"
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Uso: python3 uazapi_sender.py <token> <numero> <texto>")
        sys.exit(1)
        
    token = sys.argv[1]
    number = sys.argv[2]
    text = sys.argv[3]
    
    success, result = send_message(token, number, text)
    if success:
        print(f"✅ Sucesso: {result}")
    else:
        print(f"❌ Erro: {result}")
        sys.exit(1)
