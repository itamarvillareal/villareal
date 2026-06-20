#!/usr/bin/env python3
"""
Gera SQL para substituir lançamentos de UM cartão (financeiro_lancamento_cartao) na VPS.
Entrada: TSV (mysql -B) via stdin — primeira linha = nomes das colunas.
Saída: SQL com DELETE de vínculos + lançamentos do cartão e INSERTs (sem coluna id).
"""
from __future__ import annotations

import csv
import io
import sys


def sql_escape_string(s: str) -> str:
    s = s.encode("utf-8", errors="surrogatepass").decode("utf-8", errors="replace")
    return "'" + s.replace("\\", "\\\\").replace("'", "''") + "'"


def sql_value(raw: str, col: str) -> str:
    if raw == "\\N" or raw == "":
        return "NULL"
    if col in (
        "cartao_id",
        "conta_contabil_id",
        "cliente_id",
        "pessoa_ref_id",
        "processo_id",
    ):
        try:
            return str(int(raw))
        except ValueError:
            return "NULL"
    if col in ("valor",):
        return raw.replace(",", ".")
    if col in ("data_lancamento", "data_competencia"):
        return sql_escape_string(raw[:10])
    return sql_escape_string(raw)


def main() -> int:
    if len(sys.argv) != 4:
        print(
            "Uso: sync-cartao-lancamentos-sql.py <vps_cartao_id> <cartao_nome> <out.sql>",
            file=sys.stderr,
        )
        return 2

    vps_cartao_id = int(sys.argv[1])
    cartao_nome = sys.argv[2]
    out_path = sys.argv[3]

    text = sys.stdin.read()
    if not text.strip():
        print("Erro: stdin vazio (nenhum lançamento local).", file=sys.stderr)
        return 1

    text = text.encode("utf-8", errors="surrogatepass").decode("utf-8", errors="replace")

    reader = csv.reader(io.StringIO(text), delimiter="\t")
    header = next(reader)
    if "cartao_id" not in header:
        print("Erro: TSV sem coluna cartao_id.", file=sys.stderr)
        return 1

    skip_cols = {"id", "created_at", "updated_at"}
    insert_cols = [c for c in header if c not in skip_cols]
    cartao_idx = header.index("cartao_id")

    rows = list(reader)
    if not rows:
        print("Erro: nenhuma linha de dados.", file=sys.stderr)
        return 1

    lines = [
        f"-- Sync seletivo: financeiro_lancamento_cartao → cartão «{cartao_nome}» (cartao_id VPS={vps_cartao_id})",
        "-- Não altera lançamentos de outros cartões nem extratos bancários.",
        "SET NAMES utf8mb4;",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "START TRANSACTION;",
        "",
        f"-- Remove vínculos pagamento-fatura que apontam para lançamentos deste cartão",
        "DELETE fpfv FROM financeiro_pagamento_fatura_vinculo fpfv",
        "INNER JOIN financeiro_lancamento_cartao flc ON flc.id = fpfv.lancamento_cartao_id",
        f"WHERE flc.cartao_id = {vps_cartao_id};",
        "",
        f"DELETE FROM financeiro_lancamento_cartao WHERE cartao_id = {vps_cartao_id};",
        "",
    ]

    col_list = ", ".join(f"`{c}`" for c in insert_cols)
    for row in rows:
        if len(row) != len(header):
            print(f"Erro: linha com {len(row)} colunas, esperado {len(header)}.", file=sys.stderr)
            return 1
        data = dict(zip(header, row))
        data["cartao_id"] = str(vps_cartao_id)
        vals = ", ".join(sql_value(data[c], c) for c in insert_cols)
        lines.append(f"INSERT INTO `financeiro_lancamento_cartao` ({col_list}) VALUES ({vals});")

    lines.extend(["", "COMMIT;", "SET FOREIGN_KEY_CHECKS = 1;", ""])
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(len(rows), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
