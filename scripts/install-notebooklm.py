#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de instalacao e verificacao do NotebookLM para GueClaw

Uso: python install-notebooklm.py [check|install|test]
"""

import subprocess
import sys
import json


def run_command(cmd, capture_output=True):
    """Executa um comando e retorna o resultado"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=capture_output,
            text=True,
            timeout=60
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)


def check_python():
    """Verifica se Python está instalado"""
    success, stdout, stderr = run_command("python --version")
    if success:
        print(f"[OK] Python encontrado: {stdout.strip()}")
        return True
    else:
        success, stdout, stderr = run_command("python3 --version")
        if success:
            print(f"[OK] Python encontrado: {stdout.strip()}")
            return True
    print("[ERRO] Python não encontrado. Instale Python 3.8+")
    return False


def check_pip():
    """Verifica se pip está instalado"""
    success, stdout, stderr = run_command("pip --version")
    if success:
        print(f"[OK] pip encontrado: {stdout.strip().split()[1]}")
        return True
    print("[ERRO] pip não encontrado")
    return False


def check_notebooklm():
    """Verifica se notebooklm-py está instalado"""
    success, stdout, stderr = run_command("pip show notebooklm-py")
    if success:
        version = None
        for line in stdout.split('\n'):
            if line.startswith('Version:'):
                version = line.split(':')[1].strip()
                break
        print(f"[OK] notebooklm-py instalado (versão: {version})")
        return True
    print("[ERRO] notebooklm-py não instalado")
    return False


def install_notebooklm():
    """Instala o notebooklm-py"""
    print("[INSTALAR] Instalando notebooklm-py...")
    success, stdout, stderr = run_command("pip install notebooklm-py")
    if success:
        print("[OK] notebooklm-py instalado com sucesso!")
        print("[INFO] Para autenticação via browser, execute também:")
        print("   pip install notebooklm-py[browser]")
        print("   playwright install chromium")
        return True
    else:
        print(f"[ERRO] Erro na instalação: {stderr}")
        return False


def test_wrapper():
    """Testa o wrapper Python"""
    import os
    wrapper_path = os.path.join(os.path.dirname(__file__), 'notebooklm', 'notebooklm_wrapper.py')

    if not os.path.exists(wrapper_path):
        print(f"[ERRO] Wrapper não encontrado: {wrapper_path}")
        return False

    print(f"[OK] Wrapper encontrado: {wrapper_path}")

    # Testa execução do wrapper
    success, stdout, stderr = run_command(f"python {wrapper_path}")
    if success:
        try:
            result = json.loads(stdout)
            print("[OK] Wrapper Python funcionando")
            print(f"   Ações disponíveis: {', '.join(result.get('available_actions', []))}")
            return True
        except json.JSONDecodeError:
            print("[AVISO]  Wrapper retornou resposta não-JSON (pode ser OK)")
            return True
    else:
        print(f"[AVISO]  Wrapper retornou erro: {stderr}")
        return False


def main():
    if len(sys.argv) < 2:
        print("Uso: python install-notebooklm.py [check|install|test]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "check":
        print("[BUSCA] Verificando instalação...\n")
        python_ok = check_python()
        pip_ok = check_pip()
        notebooklm_ok = check_notebooklm()

        if python_ok and pip_ok and notebooklm_ok:
            print("\n[OK] Tudo pronto para usar o NotebookLM no GueClaw!")
            print("\n[INFO] Próximos passos:")
            print("   1. Faça login: notebooklm login")
            print("   2. Teste: python install-notebooklm.py test")
            sys.exit(0)
        else:
            print("\n[ERRO] Alguns componentes estão faltando")
            print("   Execute: python install-notebooklm.py install")
            sys.exit(1)

    elif command == "install":
        if not check_python():
            sys.exit(1)
        if not check_pip():
            sys.exit(1)

        if check_notebooklm():
            print("\n[OK] notebooklm-py já está instalado")
        else:
            if install_notebooklm():
                print("\n[INFO] Agora faça login executando:")
                print("   notebooklm login")
            else:
                sys.exit(1)

    elif command == "test":
        print("[TESTE] Testando integração...\n")
        if not check_notebooklm():
            print("[ERRO] notebooklm-py não instalado")
            sys.exit(1)

        test_wrapper()

    else:
        print(f"Comando desconhecido: {command}")
        print("Uso: python install-notebooklm.py [check|install|test]")
        sys.exit(1)


if __name__ == "__main__":
    main()
