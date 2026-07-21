#!/usr/bin/env python3
"""CLI do pipeline RAG de processos jurídicos."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .pipeline import (
    Estrategia,
    atualizar_resumo,
    buscar,
    conectar,
    criar_schema,
    fonte_id_drive,
    indexar_arquivo_local,
    ingerir_incremental,
    ingerir_processo,
    perguntar,
)


def _carregar_env():
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        chave, _, valor = line.partition("=")
        import os

        os.environ.setdefault(chave.strip(), valor.strip())


def cmd_init(_args):
    conn = conectar()
    criar_schema(conn)
    print("[OK] Schema criado.")


def cmd_ingerir(args):
    conn = conectar()
    criar_schema(conn)
    ingerir_processo(
        conn,
        args.cnj,
        args.pdf,
        Estrategia(
            cliente=args.cliente,
            tipo_acao=args.tipo_acao,
            objetivo=args.objetivo,
            chance_exito=args.chance_exito,
            prioridade=args.prioridade,
            estrategia=args.estrategia,
            tatica_prazo=args.tatica_prazo,
        ),
        reindexar=args.reindexar,
    )


def cmd_perguntar(args):
    conn = conectar()
    print(perguntar(conn, args.cnj, args.pergunta, k=args.k, modelo=args.modelo))


def cmd_buscar(args):
    conn = conectar()
    for item in buscar(conn, args.cnj, args.pergunta, k=args.k):
        print(f"[{item['similaridade']}] chunk #{item['id']} — {item['tipo_peca']}")
        print(item["texto"][:500])
        print("---")


def cmd_resumo(args):
    conn = conectar()
    texto = Path(args.texto).read_text(encoding="utf-8")
    novo = atualizar_resumo(conn, args.cnj, texto, modelo=args.modelo)
    import json

    print(json.dumps(novo, ensure_ascii=False, indent=2))


def cmd_incremental(args):
    conn = conectar()
    texto = Path(args.texto).read_text(encoding="utf-8")
    ingerir_incremental(
        conn,
        args.cnj,
        texto,
        args.tipo,
        args.data_mov,
        fonte_id=args.fonte_id,
    )


def cmd_indexar_arquivo(args):
    ok = indexar_arquivo_local(
        args.cnj,
        args.pdf,
        args.tipo,
        fonte_id=args.fonte_id or fonte_id_drive(args.drive_file_id),
        data_mov=args.data_mov,
    )
    if not ok:
        print("[OK] já indexado (idempotente).")


def main(argv: list[str] | None = None) -> int:
    _carregar_env()
    parser = argparse.ArgumentParser(description="RAG de processos — Villa Real")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init", help="Cria extensão pgvector e tabelas")

    p_ing = sub.add_parser("ingerir", help="Indexa PDF completo do processo")
    p_ing.add_argument("cnj")
    p_ing.add_argument("pdf")
    p_ing.add_argument("--cliente", default="")
    p_ing.add_argument("--tipo-acao", default="")
    p_ing.add_argument("--objetivo", default="")
    p_ing.add_argument("--chance-exito", default="media")
    p_ing.add_argument("--prioridade", default="normal")
    p_ing.add_argument("--estrategia", default="ritmo_normal")
    p_ing.add_argument("--tatica-prazo", default="")
    p_ing.add_argument(
        "--reindexar",
        action="store_true",
        help="Gera nova versão de chunks (marca a antiga como inativa; nada é apagado)",
    )
    p_ing.set_defaults(func=cmd_ingerir)

    p_perg = sub.add_parser("perguntar", help="Pergunta com RAG + contexto interno")
    p_perg.add_argument("cnj")
    p_perg.add_argument("pergunta")
    p_perg.add_argument("-k", type=int, default=8)
    p_perg.add_argument(
        "--modelo",
        help="Sobrepõe ANTHROPIC_MODEL só nesta chamada (ex.: claude-opus-4-8 para análise crítica)",
    )
    p_perg.set_defaults(func=cmd_perguntar)

    p_bus = sub.add_parser("buscar", help="Só busca vetorial (sem LLM)")
    p_bus.add_argument("cnj")
    p_bus.add_argument("pergunta")
    p_bus.add_argument("-k", type=int, default=5)
    p_bus.set_defaults(func=cmd_buscar)

    p_res = sub.add_parser("resumo", help="Atualiza resumo executivo JSONB")
    p_res.add_argument("cnj")
    p_res.add_argument("texto", help="Arquivo .txt com texto da peça nova")
    p_res.add_argument(
        "--modelo",
        help="Sobrepõe ANTHROPIC_MODEL só nesta chamada (ex.: claude-opus-4-8)",
    )
    p_res.set_defaults(func=cmd_resumo)

    p_inc = sub.add_parser("incremental", help="Indexa só uma peça nova")
    p_inc.add_argument("cnj")
    p_inc.add_argument("tipo")
    p_inc.add_argument("texto", help="Arquivo .txt com texto da peça")
    p_inc.add_argument("--data-mov")
    p_inc.add_argument("--fonte-id", help="Chave de idempotência (ex.: drive:1AbC...)")
    p_inc.set_defaults(func=cmd_incremental)

    p_idx = sub.add_parser(
        "indexar-arquivo",
        help="Indexa PDF local baixado do Drive (gancho Java)",
    )
    p_idx.add_argument("cnj")
    p_idx.add_argument("pdf", help="Caminho do PDF temporário")
    p_idx.add_argument("--tipo", required=True, help="Tipo de peça (ex.: Despacho)")
    p_idx.add_argument(
        "--drive-file-id",
        required=True,
        help="ID do arquivo no Google Drive (gera fonte_id=drive:...)",
    )
    p_idx.add_argument("--fonte-id", help="Sobrepõe fonte_id (opcional)")
    p_idx.add_argument("--data-mov", help="Data ISO YYYY-MM-DD")
    p_idx.set_defaults(func=cmd_indexar_arquivo)

    args = parser.parse_args(argv)
    try:
        args.func(args)
    except KeyError as exc:
        print(f"[ERRO] variável de ambiente ausente: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"[ERRO] {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
