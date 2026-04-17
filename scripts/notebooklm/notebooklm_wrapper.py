#!/usr/bin/env python3
"""
NotebookLM Python Wrapper for GueClaw Agent

Este script faz a ponte entre o GueClaw (Node.js) e o notebooklm-py (Python).
Recebe comandos via argumentos JSON e retorna resultados em JSON.

Uso:
    python notebooklm_wrapper.py <action> [args...]

Ações disponíveis:
    - login: Faz login no NotebookLM
    - list_sources: Lista fontes disponíveis
    - add_source <file_path>: Adiciona uma fonte (PDF, texto, etc)
    - delete_source <source_id>: Remove uma fonte
    - generate_audio <source_id>: Gera áudio/podcast da fonte
    - get_source <source_id>: Obtém detalhes de uma fonte
    - chat <source_id> <message>: Chat RAG com uma fonte
"""

import asyncio
import json
import sys
import os
from pathlib import Path

# Adiciona o diretório do usuário ao PATH para encontrar o notebooklm-py
sys.path.insert(0, os.path.expanduser('~/.local/lib/python3.11/site-packages'))
sys.path.insert(0, os.path.expanduser('~/AppData/Local/Packages/PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0/LocalCache/local-packages/Python311/site-packages'))

try:
    from notebooklm import NotebookLMClient
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"notebooklm-py não instalado: {str(e)}"
    }))
    sys.exit(1)


def output_result(result: dict):
    """Retorna resultado em formato JSON para Node.js"""
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result.get("success", False) else 1)


async def login():
    """Faz login no NotebookLM (salva credenciais localmente)"""
    try:
        async with NotebookLMClient.from_storage() as client:
            # O from_storage já faz login automático se houver credenciais
            user_info = await client.get_user_info()
            output_result({
                "success": True,
                "data": {
                    "logged_in": True,
                    "user": user_info
                },
                "message": "Login realizado com sucesso"
            })
    except Exception as e:
        output_result({
            "success": False,
            "error": f"Erro no login: {str(e)}",
            "message": "Tente rodar 'notebooklm login' manualmente primeiro"
        })


async def list_sources():
    """Lista todas as fontes disponíveis"""
    try:
        async with NotebookLMClient.from_storage() as client:
            sources = await client.get_sources()
            output_result({
                "success": True,
                "data": {
                    "sources": [
                        {
                            "id": s.id,
                            "title": s.title,
                            "type": s.type,
                            "created_at": str(s.created_at) if hasattr(s, 'created_at') else None
                        }
                        for s in sources
                    ],
                    "count": len(sources)
                },
                "message": f"Encontradas {len(sources)} fontes"
            })
    except Exception as e:
        output_result({
            "success": False,
            "error": str(e)
        })


async def add_source(file_path: str, title: str = None):
    """Adiciona uma nova fonte (PDF, texto, etc)"""
    try:
        if not os.path.exists(file_path):
            output_result({
                "success": False,
                "error": f"Arquivo não encontrado: {file_path}"
            })
            return

        async with NotebookLMClient.from_storage() as client:
            # Detecta tipo pelo arquivo
            ext = Path(file_path).suffix.lower()

            with open(file_path, 'rb') as f:
                content = f.read()

            # Cria a fonte
            source = await client.create_source(
                title=title or Path(file_path).name,
                content=content,
                mime_type=get_mime_type(ext)
            )

            output_result({
                "success": True,
                "data": {
                    "source_id": source.id,
                    "title": source.title,
                    "type": source.type
                },
                "message": f"Fonte '{source.title}' adicionada com sucesso"
            })
    except Exception as e:
        output_result({
            "success": False,
            "error": str(e)
        })


def get_mime_type(ext: str) -> str:
    """Retorna MIME type baseado na extensão"""
    mime_types = {
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.html': 'text/html',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
    return mime_types.get(ext, 'application/octet-stream')


async def delete_source(source_id: str):
    """Remove uma fonte"""
    try:
        async with NotebookLMClient.from_storage() as client:
            await client.delete_source(source_id)
            output_result({
                "success": True,
                "message": f"Fonte {source_id} removida com sucesso"
            })
    except Exception as e:
        output_result({
            "success": False,
            "error": str(e)
        })


async def generate_audio(source_id: str, format: str = "audio"):
    """Gera áudio/podcast da fonte"""
    try:
        async with NotebookLMClient.from_storage() as client:
            # Gera o áudio (podcast)
            audio = await client.generate_audio(
                source_id=source_id,
                format=format
            )

            output_result({
                "success": True,
                "data": {
                    "audio_url": audio.url if hasattr(audio, 'url') else None,
                    "source_id": source_id,
                    "format": format
                },
                "message": "Áudio gerado com sucesso"
            })
    except Exception as e:
        output_result({
            "success": False,
            "error": str(e)
        })


async def chat(source_id: str, message: str):
    """Chat RAG com uma fonte específica"""
    try:
        async with NotebookLMClient.from_storage() as client:
            # Envia mensagem para o notebook
            response = await client.chat(
                source_id=source_id,
                message=message
            )

            output_result({
                "success": True,
                "data": {
                    "response": response.text if hasattr(response, 'text') else str(response),
                    "source_id": source_id,
                    "citations": response.citations if hasattr(response, 'citations') else []
                },
                "message": "Resposta gerada via RAG"
            })
    except Exception as e:
        output_result({
            "success": False,
            "error": str(e)
        })


async def main():
    if len(sys.argv) < 2:
        output_result({
            "success": False,
            "error": "Uso: python notebooklm_wrapper.py <action> [args...]",
            "available_actions": [
                "login",
                "list_sources",
                "add_source <file_path> [title]",
                "delete_source <source_id>",
                "generate_audio <source_id>",
                "chat <source_id> <message>"
            ]
        })

    action = sys.argv[1]

    if action == "login":
        await login()
    elif action == "list_sources":
        await list_sources()
    elif action == "add_source":
        if len(sys.argv) < 3:
            output_result({
                "success": False,
                "error": "Uso: add_source <file_path> [title]"
            })
        file_path = sys.argv[2]
        title = sys.argv[3] if len(sys.argv) > 3 else None
        await add_source(file_path, title)
    elif action == "delete_source":
        if len(sys.argv) < 3:
            output_result({
                "success": False,
                "error": "Uso: delete_source <source_id>"
            })
        await delete_source(sys.argv[2])
    elif action == "generate_audio":
        if len(sys.argv) < 3:
            output_result({
                "success": False,
                "error": "Uso: generate_audio <source_id>"
            })
        await generate_audio(sys.argv[2])
    elif action == "chat":
        if len(sys.argv) < 4:
            output_result({
                "success": False,
                "error": "Uso: chat <source_id> <message>"
            })
        source_id = sys.argv[2]
        message = " ".join(sys.argv[3:])
        await chat(source_id, message)
    else:
        output_result({
            "success": False,
            "error": f"Ação desconhecida: {action}",
            "available_actions": [
                "login", "list_sources", "add_source",
                "delete_source", "generate_audio", "chat"
            ]
        })


if __name__ == "__main__":
    asyncio.run(main())
