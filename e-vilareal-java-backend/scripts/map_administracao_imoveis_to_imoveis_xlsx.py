#!/usr/bin/env python3
"""
Converte o export «Villa Real - Administração de Imóveis - *.xls» para o layout
esperado por ImoveisPlanilhaImportService (1ª aba: linha 1 Excel vazia ou
cabeçalho ignorada; dados a partir da linha 2 Excel = índice POI 1; colunas
A–AZ = índices 0–51).

No ficheiro de administração: cabeçalho na linha Excel 7 (índice 6), dados a
partir da linha Excel 9 (índice 8); coluna 0 extra (ex. «804//1»); colunas
42–44 extra (Telefone, Nome Inquilino, Mensagem) antes de «Dia Repasse».

Dependências: pip install xlrd openpyxl
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("entrada", type=Path, help="Caminho do .xls de administração")
    p.add_argument("saida", type=Path, help="Caminho do .xlsx de saída")
    p.add_argument(
        "--first-data-row-0-based",
        type=int,
        default=8,
        help="Índice 0-based da primeira linha de dados (default 8 = Excel linha 9)",
    )
    args = p.parse_args()

    try:
        import xlrd
        from openpyxl import Workbook
    except ImportError:
        print("Instale: pip install xlrd openpyxl", file=sys.stderr)
        return 1

    if not args.entrada.is_file():
        print(f"Ficheiro não encontrado: {args.entrada}", file=sys.stderr)
        return 1

    book = xlrd.open_workbook(str(args.entrada))
    sh = book.sheet_by_index(0)

    def fmt_cell(r: int, c: int) -> str:
        if c >= sh.ncols:
            return ""
        t = sh.cell_type(r, c)
        v = sh.cell_value(r, c)
        if t == xlrd.XL_CELL_EMPTY:
            return ""
        if t == xlrd.XL_CELL_DATE and v:
            try:
                dt = xlrd.xldate_as_datetime(v, book.datemode)
                return dt.strftime("%d/%m/%Y")
            except Exception:
                return str(v).strip()
        if t == xlrd.XL_CELL_NUMBER:
            if v == int(v):
                return str(int(v))
            return str(v).strip()
        if t == xlrd.XL_CELL_BOOLEAN:
            return "SIM" if v else "NÃO"
        return str(v).strip() if v is not None else ""

    def map_row_strings(r: int) -> list[str]:
        u = [fmt_cell(r, c) for c in range(max(sh.ncols, 56))]

        def g(i: int) -> str:
            return u[i] if i < len(u) else ""

        j = [""] * 52
        for jc in range(41):
            j[jc] = g(1 + jc)
        for k in range(11):
            j[41 + k] = g(45 + k)
        return j

    def linha_sem_codigo(j: list[str]) -> bool:
        return not (j[0] or "").strip()

    wb = Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.append([""] * 52)

    out = 0
    for r in range(args.first_data_row_0_based, sh.nrows):
        j = map_row_strings(r)
        if linha_sem_codigo(j):
            continue
        if not any(x.strip() for x in j[1:8]):
            continue
        ws.append(j)
        out += 1

    args.saida.parent.mkdir(parents=True, exist_ok=True)
    wb.save(str(args.saida))
    print(f"Linhas de dados gravadas: {out} -> {args.saida}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
