#!/usr/bin/env python3
"""
send_campaign.py
Envia mensagem de prospecção para o próximo lead que:
  - Tem has_whatsapp = 1 no SQLite
  - Tem sent_at IS NULL e skip = 0

Modos:
  python3 send_campaign.py            → envia 1 mensagem (usado pelo worker)
  python3 send_campaign.py --force    → idem, sem verificar limite diário
  python3 send_campaign.py --status   → mostra resumo da campanha, não envia nada

O controle de "enviados hoje" é feito via worker_state.json.
"""
import os
import sys
import json
import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
from uazapi_helper import send_text
from db_manager import init_db, get_conn, get_next_to_send, mark_sent, get_stats

SKILL_DIR  = os.path.dirname(SCRIPT_DIR)
STATE_PATH = os.path.join(SKILL_DIR, "data", "worker_state.json")

DAILY_LIMIT = 4  # disparos máximos por dia

MESSAGE_TEMPLATE = """\
Olá, Doutor(a). Seu escritório {title} ainda perde horas decifrando planilhas financeiras e lidando com laudos periciais e processos confusos?

Como assistente técnico, eu uno Contabilidade com Inteligência Artificial para varrer gigabytes de dados e entregar provas visuais e matemáticas irrefutáveis em tempo recorde. Nós cuidamos dos dados complexos; você foca na tese jurídica.

Conheça nossa metodologia e blinde seus processos:
👉 https://periciajudicial.kyrius.com.br/"""


def load_state():
    if os.path.exists(STATE_PATH):
        try:
            with open(STATE_PATH) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_state(state):
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)


def get_today():
    return datetime.date.today().isoformat()


def sent_today(state):
    today = get_today()
    return state.get("date") == today and state.get("sent_count", 0) or 0


def increment_today(state):
    today = get_today()
    if state.get("date") != today:
        state["date"] = today
        state["sent_count"] = 0
        state["sent_slots"] = []
    state["sent_count"] = state.get("sent_count", 0) + 1
    return state


def print_status():
    init_db()
    with get_conn() as conn:
        stats = get_stats(conn)

    state = load_state()
    today_count = sent_today(state)
    slots_fired = state.get("sent_slots", []) if state.get("date") == get_today() else []

    print("📊 STATUS DA CAMPANHA")
    print(f"   Total de leads:        {stats['total']}")
    print(f"   ✅ Têm WhatsApp:        {stats['has_wpp']}")
    print(f"   ❌ Sem WhatsApp:        {stats['no_wpp']}")
    print(f"   ❓ Não verificados:     {stats['not_checked']}")
    print(f"   📬 Já enviados:         {stats['sent_total']}")
    print(f"   ⏳ Fila pendente:       {stats['pending']}")
    print(f"   📅 Enviados hoje:        {today_count} / {DAILY_LIMIT}")
    if slots_fired:
        print(f"   Slots disparados hoje: {slots_fired}")


def send_one(force=False):
    init_db()
    state = load_state()

    if not force:
        count = sent_today(state)
        if count >= DAILY_LIMIT:
            print(f"⏸️  Limite diário atingido ({DAILY_LIMIT} disparos). Tente amanhã.")
            sys.exit(0)

    with get_conn() as conn:
        next_lead = get_next_to_send(conn)

        if next_lead is None:
            print("⏸️  Nenhum lead pendente na fila. Campanha concluída ou verifique WhatsApp primeiro.")
            sys.exit(2)  # exit 2 = sem leads (worker não conta como envio bem-sucedido)

        number = next_lead["whatsapp_number"]
        title  = (next_lead["title"] or "Desconhecido").strip()
        lead_id = next_lead["id"]

        message = MESSAGE_TEMPLATE.format(title=title)
        print(f"📤 Enviando para: {number} ({title})")

        success, response = send_text(number, message)

        if success:
            sent_at = datetime.datetime.now().isoformat(timespec="seconds")
            mark_sent(conn, lead_id, sent_at)
            conn.commit()

            state = increment_today(state)
            save_state(state)

            pending = conn.execute(
                "SELECT COUNT(*) FROM leads WHERE has_whatsapp = 1 AND sent_at IS NULL AND skip = 0"
            ).fetchone()[0]

            print(f"✅ Mensagem enviada com sucesso! ({sent_at})")
            print(f"📊 Enviados hoje: {sent_today(state)} / {DAILY_LIMIT} | Restantes na fila: {pending}")
        else:
            err = response.get("error", str(response))
            print(f"❌ Falha ao enviar para {number}: {err}")
            sys.exit(1)


if __name__ == "__main__":
    if "--status" in sys.argv:
        print_status()
    elif "--force" in sys.argv:
        send_one(force=True)
    else:
        send_one(force=False)
