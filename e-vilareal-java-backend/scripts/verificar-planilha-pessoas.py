#!/usr/bin/env python3
"""
Pré e pós-verificação da planilha Cadastro Pessoas (.xls).

- Pré: conta linhas preenchidas, detecta bloqueios (nome vazio, CPF inválido) e compara com snapshot da última importação.
- Pós: confere se todas as linhas importáveis constam no relatório CSV com sucesso.

Uso:
  verificar-planilha-pessoas.py --preflight PLANILHA.xls --snapshot-out /tmp/snapshot.json
  verificar-planilha-pessoas.py --preflight PLANILHA.xls --compare-with scripts/import-pessoas-last-snapshot.json
  verificar-planilha-pessoas.py --postflight PLANILHA.xls --snapshot-in /tmp/snapshot.json --report import-pessoas-report.csv
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import xlrd
except ImportError:
    print("Dependência ausente: pip install xlrd", file=sys.stderr)
    sys.exit(2)

HEADER_ROW_1 = 9
FIRST_DATA_ROW_1 = 11
DATA_START_0 = FIRST_DATA_ROW_1 - 1

SUCCESS_TYPES = frozenset({"UPDATE", "INSERT", "RECONCILE_BY_CPF"})


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def digits_only(s: str) -> str:
    return "".join(c for c in s if c.isdigit())


def cpf_status(raw: str) -> str:
    d = digits_only(raw or "")
    if not d:
        return "ausente"
    if len(d) in (11, 14):
        return "valido"
    return "invalido"


def cell_str(cell) -> str:
    if cell.ctype == xlrd.XL_CELL_EMPTY:
        return ""
    if cell.ctype == xlrd.XL_CELL_TEXT:
        return (cell.value or "").strip()
    if cell.ctype == xlrd.XL_CELL_NUMBER:
        v = cell.value
        if v == int(v):
            return str(int(v))
        return str(v).strip()
    return str(cell.value or "").strip()


def read_id(sh, row0: int) -> int | None:
    if sh.ncols < 1:
        return None
    raw = cell_str(sh.cell(row0, 0))
    if not raw:
        return None
    try:
        pid = int(float(raw))
    except ValueError:
        return None
    if pid < 1:
        return None
    return pid


def row_fingerprint(pid: int, nome: str, cpf_raw: str, email: str) -> str:
    nome_n = " ".join((nome or "").upper().split())
    cpf_n = digits_only(cpf_raw or "")
    email_n = (email or "").strip().lower()
    payload = f"{pid}|{nome_n}|{cpf_n}|{email_n}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def scan_planilha(path: Path) -> dict:
    wb = xlrd.open_workbook(str(path))
    sh = wb.sheet_by_index(0)

    last_row0 = DATA_START_0
    for r in range(sh.nrows - 1, DATA_START_0 - 1, -1):
        pid = read_id(sh, r)
        nome = cell_str(sh.cell(r, 1)) if sh.ncols > 1 else ""
        if pid is not None or nome:
            last_row0 = r
            break

    rows_com_id = 0
    rows_importaveis = 0
    bloqueios: list[dict] = []
    registros: dict[str, dict] = {}

    for r in range(DATA_START_0, last_row0 + 1):
        excel_row = r + 1
        pid = read_id(sh, r)
        if pid is None:
            continue
        rows_com_id += 1
        nome = cell_str(sh.cell(r, 1)) if sh.ncols > 1 else ""
        cpf_raw = cell_str(sh.cell(r, 3)) if sh.ncols > 3 else ""
        email = cell_str(sh.cell(r, 12)) if sh.ncols > 12 else ""

        if not nome:
            bloqueios.append(
                {
                    "planilha_id": pid,
                    "excel_row": excel_row,
                    "motivo": "nome_vazio",
                    "detalhe": "Coluna NOME vazia — corrija na planilha antes de importar",
                }
            )
            continue

        st = cpf_status(cpf_raw)
        if st == "invalido":
            bloqueios.append(
                {
                    "planilha_id": pid,
                    "excel_row": excel_row,
                    "motivo": "cpf_invalido",
                    "detalhe": f"CPF/CNPJ inválido: {cpf_raw!r}",
                }
            )
            continue

        rows_importaveis += 1
        registros[str(pid)] = {
            "planilha_id": pid,
            "excel_row": excel_row,
            "fingerprint": row_fingerprint(pid, nome, cpf_raw, email),
            "nome": nome,
        }

    st = path.stat()
    return {
        "planilha": str(path.resolve()),
        "planilha_sha256": sha256_file(path),
        "planilha_mtime": int(st.st_mtime),
        "planilha_size": st.st_size,
        "header_row": HEADER_ROW_1,
        "first_data_row": FIRST_DATA_ROW_1,
        "ultima_linha_excel": last_row0 + 1,
        "linhas_com_id": rows_com_id,
        "linhas_importaveis": rows_importaveis,
        "bloqueios": bloqueios,
        "registros": registros,
        "gerado_em": datetime.now(timezone.utc).isoformat(),
    }


def diff_snapshots(anterior: dict, atual: dict) -> dict:
    prev_regs = anterior.get("registros") or {}
    cur_regs = atual.get("registros") or {}
    prev_ids = set(prev_regs)
    cur_ids = set(cur_regs)

    ids_novos = sorted(int(i) for i in cur_ids - prev_ids)
    ids_removidos = sorted(int(i) for i in prev_ids - cur_ids)
    ids_alterados = []
    for i in sorted(cur_ids & prev_ids):
        if prev_regs[i].get("fingerprint") != cur_regs[i].get("fingerprint"):
            ids_alterados.append(
                {
                    "planilha_id": int(i),
                    "excel_row": cur_regs[i].get("excel_row"),
                    "nome": cur_regs[i].get("nome"),
                }
            )

    planilha_mudou = (
        anterior.get("planilha_sha256") != atual.get("planilha_sha256")
        or anterior.get("planilha_mtime") != atual.get("planilha_mtime")
    )

    return {
        "planilha_mudou": planilha_mudou,
        "sha256_anterior": anterior.get("planilha_sha256"),
        "sha256_atual": atual.get("planilha_sha256"),
        "ids_novos": ids_novos,
        "ids_removidos": ids_removidos,
        "ids_alterados": ids_alterados,
        "total_alterados": len(ids_alterados),
        "total_novos": len(ids_novos),
        "total_removidos": len(ids_removidos),
        "houve_alteracoes": planilha_mudou
        or bool(ids_novos or ids_removidos or ids_alterados),
    }


def load_snapshot(path: Path) -> dict | None:
    if not path.is_file():
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save_snapshot(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def postflight_verify(snapshot: dict, report_path: Path) -> dict:
    importaveis = set((snapshot.get("registros") or {}).keys())
    sucesso: set[str] = set()
    falhas: list[dict] = []

    with report_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tipo = (row.get("tipo") or "").strip()
            pid = (row.get("planilha_id") or "").strip()
            if tipo in SUCCESS_TYPES and pid:
                sucesso.add(pid)
            elif pid and tipo in ("SKIP", "ERROR"):
                falhas.append(
                    {
                        "planilha_id": pid,
                        "excel_row": row.get("excel_row"),
                        "tipo": tipo,
                        "mensagem": row.get("mensagem"),
                    }
                )

    nao_importados = sorted(int(i) for i in importaveis - sucesso)
    extras = sorted(int(i) for i in sucesso - importaveis)

    return {
        "linhas_importaveis": len(importaveis),
        "linhas_com_sucesso_no_relatorio": len(sucesso),
        "ids_nao_importados": nao_importados,
        "ids_extras_no_relatorio": extras,
        "falhas_relatorio": falhas[:50],
        "ok": len(nao_importados) == 0,
    }


def print_preflight(atual: dict, diff: dict | None) -> int:
    print("=== Pré-verificação Cadastro Pessoas ===")
    print(f"Planilha: {atual['planilha']}")
    print(f"SHA-256: {atual['planilha_sha256'][:16]}…")
    print(f"Última linha Excel com dados: {atual['ultima_linha_excel']}")
    print(f"Linhas com ID: {atual['linhas_com_id']}")
    print(f"Linhas importáveis (ID + nome + CPF ok): {atual['linhas_importaveis']}")
    bloqueios = atual.get("bloqueios") or []
    if bloqueios:
        print(f"Bloqueios: {len(bloqueios)}")
        for b in bloqueios[:15]:
            print(f"  - id {b['planilha_id']} (linha Excel {b['excel_row']}): {b['motivo']} — {b['detalhe']}")
        if len(bloqueios) > 15:
            print(f"  … e mais {len(bloqueios) - 15}")

    if diff:
        print("--- Comparação com última importação ---")
        if not diff.get("houve_alteracoes"):
            print("Nenhuma alteração detectada em relação ao snapshot anterior.")
        else:
            print(f"Planilha mudou (ficheiro): {diff.get('planilha_mudou')}")
            print(f"IDs novos: {diff.get('total_novos')}")
            print(f"IDs removidos: {diff.get('total_removidos')}")
            print(f"IDs alterados (conteúdo): {diff.get('total_alterados')}")
            if diff.get("ids_alterados"):
                for item in diff["ids_alterados"][:10]:
                    print(f"  ~ id {item['planilha_id']} linha {item['excel_row']}: {item.get('nome', '')[:60]}")
                if diff["total_alterados"] > 10:
                    print(f"  … e mais {diff['total_alterados'] - 10} alterados")

    return 1 if bloqueios else 0


def print_postflight(result: dict) -> int:
    print("=== Pós-verificação (relatório vs planilha) ===")
    print(f"Importáveis: {result['linhas_importaveis']}")
    print(f"Sucesso no relatório: {result['linhas_com_sucesso_no_relatorio']}")
    if result["ok"]:
        print("OK — todas as linhas importáveis constam no relatório com sucesso.")
        return 0
    print(f"FALHA — {len(result['ids_nao_importados'])} id(s) importável(is) sem sucesso no relatório:")
    for pid in result["ids_nao_importados"][:20]:
        print(f"  - id {pid}")
    if len(result["ids_nao_importados"]) > 20:
        print(f"  … e mais {len(result['ids_nao_importados']) - 20}")
    return 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Verificação planilha Cadastro Pessoas")
    ap.add_argument("planilha", type=Path, nargs="?", help="Caminho do .xls")
    ap.add_argument("--preflight", action="store_true", help="Análise antes do import")
    ap.add_argument("--postflight", action="store_true", help="Conferir relatório após import")
    ap.add_argument("--snapshot-out", type=Path, help="Gravar snapshot JSON")
    ap.add_argument("--snapshot-in", type=Path, help="Snapshot usado na pós-verificação")
    ap.add_argument("--compare-with", type=Path, help="Snapshot da última importação")
    ap.add_argument("--report", type=Path, help="import-pessoas-report.csv")
    ap.add_argument("--json", action="store_true", help="Imprimir JSON no stdout")
    args = ap.parse_args()

    if not args.preflight and not args.postflight:
        args.preflight = True

    if args.postflight:
        if not args.report or not args.report.is_file():
            print("Pós-verificação requer --report com CSV existente", file=sys.stderr)
            return 2
        snap_path = args.snapshot_in
        if snap_path is None:
            print("Pós-verificação requer --snapshot-in", file=sys.stderr)
            return 2
        if not snap_path.is_file():
            print(f"Snapshot não encontrado: {snap_path}", file=sys.stderr)
            return 2
        snap = load_snapshot(snap_path)
        result = postflight_verify(snap, args.report)
        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        return print_postflight(result)

    if not args.planilha or not args.planilha.is_file():
        print("Informe o caminho da planilha .xls", file=sys.stderr)
        return 2

    atual = scan_planilha(args.planilha)
    diff = None
    anterior = None
    if args.compare_with:
        anterior = load_snapshot(args.compare_with)
        if anterior:
            diff = diff_snapshots(anterior, atual)
            atual["diff_ultima_importacao"] = diff
        else:
            atual["diff_ultima_importacao"] = {"primeira_execucao": True, "houve_alteracoes": True}

    if args.snapshot_out:
        save_snapshot(args.snapshot_out, atual)

    if args.json:
        print(json.dumps(atual, ensure_ascii=False, indent=2))
        return 0

    code = print_preflight(atual, diff)
    if diff and diff.get("houve_alteracoes"):
        print("(Há alterações em relação à última importação — será aplicada atualização.)")
    return code


if __name__ == "__main__":
    sys.exit(main())
