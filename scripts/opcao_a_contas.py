#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Opção A: manter só CONTAS das varreduras por processo."""
import argparse
import csv
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from vincular_imoveis import connect, strip_accents

FASE2_EXCLUDED = {13300, 5360, 13051, 12799, 1865}
EXCLUDE_REVERT_IDS = {171586}
CONTA_TOKENS = (
    "saneago", "saneamento", "agua", "equatorial", "celg", "enel", "energia",
    "gas", "consigaz", "condominio", "iptu", "tsu",
)
CONTA_PHRASE = "sispag concessionaria"


def norm_text(s):
    s = strip_accents(str(s or "")).lower()
    s = re.sub(r"\s+", " ", s).strip()
    return s


def is_conta(descricao, detalhada=""):
    t = norm_text(descricao) + " " + norm_text(detalhada)
    if CONTA_PHRASE in t:
        return True
    return any(re.search(rf"\b{re.escape(tok)}\b", t) for tok in CONTA_TOKENS)


def load_varredura_rows(base):
    rows = []
    seen = set()

    path1 = os.path.join(base, "vinculo_processo.csv")
    with open(path1, encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter=";"):
            lid = int(r["lancamento_id"])
            if lid in seen:
                continue
            seen.add(lid)
            rows.append(dict(
                lancamento_id=lid,
                processo_id=int(r["processo_id"]),
                imovel_id=int(r["imovel_id"]),
                origem="varredura_5proc",
                descricao_csv=r.get("descricao", ""),
            ))

    path2 = os.path.join(base, "vinculo_fase2.csv")
    with open(path2, encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter=";"):
            pid = int(r["processo_id"])
            if pid in FASE2_EXCLUDED:
                continue
            lid = int(r["lancamento_id"])
            if lid in seen:
                continue
            seen.add(lid)
            rows.append(dict(
                lancamento_id=lid,
                processo_id=pid,
                imovel_id=int(r["imovel_id"]),
                origem="fase2",
                descricao_csv=r.get("descricao", ""),
            ))
    return rows


def enrich_from_db(conn, rows):
    ids = [r["lancamento_id"] for r in rows]
    ph = ", ".join(["%s"] * len(ids))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, imovel_id, processo_id, valor, data_lancamento,
                   descricao, descricao_detalhada, status, natureza
            FROM financeiro_lancamento WHERE id IN ({ph})
            """,
            ids,
        )
        by_id = {r["id"]: r for r in cur.fetchall()}
    for row in rows:
        db = by_id.get(row["lancamento_id"])
        if not db:
            row["db_missing"] = True
            continue
        row["db_missing"] = False
        row["imovel_id_atual"] = db["imovel_id"]
        row["processo_id_atual"] = db["processo_id"]
        row["descricao"] = db["descricao"] or ""
        row["detalhada"] = db.get("descricao_detalhada") or ""
        row["valor"] = db["valor"]
        row["data_lancamento"] = db["data_lancamento"]
        row["conta"] = is_conta(row["descricao"], row["detalhada"])
        row["reverter"] = (not row["conta"]
                           and row["lancamento_id"] not in EXCLUDE_REVERT_IDS)


def dry_run(conn, outdir):
    rows = load_varredura_rows(outdir)
    enrich_from_db(conn, rows)

    missing = [r for r in rows if r.get("db_missing")]
    mismatch = [r for r in rows if not r.get("db_missing")
                  and r["imovel_id_atual"] != r["imovel_id"]]
    other_origin = [r for r in rows if not r.get("db_missing")
                    and r["imovel_id_atual"] is not None
                    and r["imovel_id_atual"] != r["imovel_id"]]

    by_imovel = defaultdict(lambda: {"conta": 0, "reverter": 0, "manter": 0})
    revert_rows = []
    for r in rows:
        if r.get("db_missing"):
            continue
        iid = r["imovel_id"]
        if r["conta"] or r["lancamento_id"] in EXCLUDE_REVERT_IDS:
            by_imovel[iid]["conta" if r["conta"] else "manter"] += 1
        else:
            by_imovel[iid]["reverter"] += 1
            revert_rows.append(r)

    total_conta = sum(1 for r in rows if not r.get("db_missing") and r["conta"])
    total_manter_excl = sum(1 for r in rows if not r.get("db_missing")
                            and not r["conta"] and r["lancamento_id"] in EXCLUDE_REVERT_IDS)
    total_revert = len(revert_rows)

    rev_path = os.path.join(outdir, "revert_candidatos.csv")
    cols = ["lancamento_id", "processo_id", "imovel_id_esperado", "imovel_id_atual",
            "valor", "data_lancamento", "origem", "descricao", "descricao_detalhada"]
    with open(rev_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for r in revert_rows:
            w.writerow(dict(
                lancamento_id=r["lancamento_id"],
                processo_id=r["processo_id"],
                imovel_id_esperado=r["imovel_id"],
                imovel_id_atual=r["imovel_id_atual"],
                valor=r["valor"],
                data_lancamento=r["data_lancamento"],
                origem=r["origem"],
                descricao=(r["descricao"] or "")[:120],
                descricao_detalhada=(r["detalhada"] or "")[:120],
            ))

    print("\n=== OPÇÃO A — DRY-RUN (varreduras processo) ===")
    print(f"  Total ids varredura: {len(rows)} (97 + 936 = {97+936})")
    print(f"  CONTA (manter):      {total_conta}")
    print(f"  Manter manual 171586: {total_manter_excl}")
    print(f"  NÃO-CONTA (reverter): {total_revert}")
    print(f"  revert_candidatos.csv: {rev_path}")

    print("\n  Por imóvel (conta | reverter | manter manual):")
    for iid in sorted(by_imovel, key=lambda x: -(by_imovel[x]["conta"] + by_imovel[x]["reverter"])):
        b = by_imovel[iid]
        m = b.get("manter", 0)
        print(f"    imovel {iid:>3}: conta {b['conta']:>3} | reverter {b['reverter']:>3}"
              + (f" | manual {m}" if m else ""))

    print("\n=== VERIFICAÇÃO (read-only) ===")
    print(f"  ids ausentes no banco: {len(missing)}")
    print(f"  imovel_id != valor varredura: {len(mismatch)}")
    if mismatch:
        for r in mismatch[:10]:
            print(f"    {r['lancamento_id']}: esperado {r['imovel_id']} atual {r['imovel_id_atual']}")
    else:
        print("  OK: zero linhas com vínculo de outra origem.")

    null_now = sum(1 for r in rows if not r.get("db_missing") and r["imovel_id_atual"] is None)
    print(f"  imovel_id NULL entre ids varredura: {null_now}")

    return rows, revert_rows, mismatch


def apply_revert(conn, revert_rows, expected=973):
    with conn.cursor() as cur:
        cur.execute("START TRANSACTION")
        n = 0
        for r in revert_rows:
            cur.execute(
                """
                UPDATE financeiro_lancamento
                SET imovel_id = NULL
                WHERE id = %s AND imovel_id = %s
                  AND status = 'ATIVO' AND natureza = 'DEBITO'
                """,
                (r["lancamento_id"], r["imovel_id"]),
            )
            n += cur.rowcount
        if n != expected:
            cur.execute("ROLLBACK")
            raise RuntimeError(f"Revert: esperado {expected} updates, obteve {n}")
        cur.execute(
            "SELECT imovel_id FROM financeiro_lancamento WHERE id = 171586"
        )
        row = cur.fetchone()
        if not row or row["imovel_id"] != 45:
            cur.execute("ROLLBACK")
            raise RuntimeError(f"171586 deve permanecer imovel_id=45, atual={row}")
        cur.execute("COMMIT")
    return n


def conta_sql_predicate(alias="fl"):
    """SQL expression for conta rule on descricao + descricao_detalhada."""
    cols = f"LOWER(CONCAT(COALESCE({alias}.descricao,''), ' ', COALESCE({alias}.descricao_detalhada,'')))"
    tokens = CONTA_TOKENS
    parts = [f"{cols} LIKE '%sispag concessionaria%'"]
    for tok in tokens:
        parts.append(f"{cols} REGEXP '[[:<:]]{tok}[[:>:]]'")
    return "(" + " OR ".join(parts) + ")"


def dry_run_varredura_conta(conn, outdir):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT fl.id, fl.processo_id, ip.imovel_id, fl.valor, fl.data_lancamento,
                   fl.descricao, fl.descricao_detalhada
            FROM financeiro_lancamento fl
            JOIN imovel_processo ip ON ip.processo_id = fl.processo_id AND ip.ativo = 1
            JOIN imovel i ON i.id = ip.imovel_id AND i.ativo = 1
            WHERE fl.status = 'ATIVO' AND fl.natureza = 'DEBITO'
              AND fl.imovel_id IS NULL AND fl.processo_id IS NOT NULL
              AND fl.processo_id IN (
                SELECT processo_id FROM (
                  SELECT fl2.processo_id
                  FROM financeiro_lancamento fl2
                  JOIN imovel_processo ip2 ON ip2.processo_id = fl2.processo_id AND ip2.ativo = 1
                  JOIN imovel i2 ON i2.id = ip2.imovel_id AND i2.ativo = 1
                  WHERE fl2.status = 'ATIVO' AND fl2.natureza = 'DEBITO'
                    AND fl2.imovel_id IS NULL AND fl2.processo_id IS NOT NULL
                  GROUP BY fl2.processo_id
                  HAVING COUNT(DISTINCT ip2.imovel_id) = 1
                ) eligible
              )
            ORDER BY ip.imovel_id, fl.processo_id, fl.data_lancamento, fl.id
            """
        )
        all_rows = cur.fetchall()

    lanc = [r for r in all_rows if is_conta(r["descricao"], r.get("descricao_detalhada"))]

    by_imovel = Counter(r["imovel_id"] for r in lanc)
    by_proc = Counter(r["processo_id"] for r in lanc)

    csv_path = os.path.join(outdir, "vinculo_conta_filtrada.csv")
    sql_path = os.path.join(outdir, "vinculo_conta_filtrada.sql")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["lancamento_id", "processo_id", "imovel_id", "data", "valor", "descricao"])
        for r in lanc:
            w.writerow([r["id"], r["processo_id"], r["imovel_id"],
                        r["data_lancamento"], r["valor"], (r["descricao"] or "")[:80]])

    proc_imovel = {}
    for r in lanc:
        proc_imovel[r["processo_id"]] = r["imovel_id"]

    with open(sql_path, "w", encoding="utf-8") as f:
        f.write("-- Varredura FILTRADA por CONTA (1:1, inclui 5 proc excluidos antes). DRY-RUN.\n")
        f.write(f"-- Lançamentos: {len(lanc)} | Processos: {len(proc_imovel)}\n")
        f.write("-- Aplicar via: python3 opcao_a_contas.py --apply-conta\n")
        f.write("START TRANSACTION;\n")
        for r in lanc:
            f.write(
                f"UPDATE financeiro_lancamento SET imovel_id = {r['imovel_id']} "
                f"WHERE id = {r['id']} AND imovel_id IS NULL "
                f"AND status = 'ATIVO' AND natureza = 'DEBITO';  "
                f"-- proc {r['processo_id']}\n"
            )
        f.write("-- COMMIT;\n")

    print("\n=== VARREDURA FILTRADA POR CONTA (dry-run) ===")
    print(f"  Elegíveis: {len(lanc)} lançamentos em {len(proc_imovel)} processos")
    print(f"  CSV: {csv_path}")
    print(f"  SQL: {sql_path}")
    print("  Por imóvel:")
    for iid, n in sorted(by_imovel.items(), key=lambda x: (-x[1], x[0])):
        print(f"    imovel {iid:>3}: {n}")
    excl = {13300, 5360, 13051, 12799, 1865}
    excl_n = sum(by_proc[p] for p in excl if p in by_proc)
    print(f"  Dos 5 proc antes excluídos: {excl_n} contas")
    return lanc


def apply_conta_from_csv(conn, csv_path):
    rows = []
    with open(csv_path, encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter=";"):
            rows.append(dict(
                lancamento_id=int(r["lancamento_id"]),
                imovel_id=int(r["imovel_id"]),
                processo_id=int(r["processo_id"]),
            ))
    with conn.cursor() as cur:
        cur.execute("START TRANSACTION")
        n = 0
        for r in rows:
            cur.execute(
                """
                UPDATE financeiro_lancamento
                SET imovel_id = %s
                WHERE id = %s AND imovel_id IS NULL
                  AND status = 'ATIVO' AND natureza = 'DEBITO'
                """,
                (r["imovel_id"], r["lancamento_id"]),
            )
            n += cur.rowcount
        if n != len(rows):
            cur.execute("ROLLBACK")
            raise RuntimeError(f"Varredura conta: esperado {len(rows)} updates, obteve {n}")
        cur.execute("COMMIT")
    return n, rows


def report_imovel_sem_unidade(conn, imovel_ids=(85, 99)):
    print("\n=== DESTAQUE imóveis sem unidade no cadastro ===")
    with conn.cursor() as cur:
        for iid in imovel_ids:
            cur.execute(
                "SELECT id, unidade, condominio, titulo, endereco_completo, processo_id "
                "FROM imovel WHERE id = %s",
                (iid,),
            )
            im = cur.fetchone()
            cur.execute(
                """
                SELECT fl.id, fl.valor, fl.data_lancamento, fl.processo_id,
                       LEFT(fl.descricao, 80) AS descricao,
                       LEFT(fl.descricao_detalhada, 120) AS detalhada
                FROM financeiro_lancamento fl
                WHERE fl.status = 'ATIVO' AND fl.natureza = 'DEBITO'
                  AND fl.imovel_id = %s
                ORDER BY fl.data_lancamento, fl.id
                """,
                (iid,),
            )
            lanc = cur.fetchall()
            print(f"\n  imovel_id {iid}: unidade={im.get('unidade') or '(NULL)'} | "
                  f"cond={im.get('condominio') or '(NULL)'} | proc_cadastro={im.get('processo_id')}")
            print(f"  titulo: {im.get('titulo') or '(NULL)'}")
            print(f"  endereco: {(im.get('endereco_completo') or '(NULL)')[:100]}")
            print(f"  lançamentos vinculados: {len(lanc)}")
            for r in lanc:
                ano = r["data_lancamento"].year if r["data_lancamento"] else "?"
                print(f"    {r['id']} | {r['data_lancamento']} ({ano}) | R$ {r['valor']} | "
                      f"proc {r['processo_id'] or 'NULL'}")
                print(f"      {r['descricao']}")
                if r["detalhada"]:
                    print(f"      det: {r['detalhada']}")


def report_final(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) n FROM financeiro_lancamento "
            "WHERE status='ATIVO' AND natureza='DEBITO' AND imovel_id IS NOT NULL"
        )
        com = cur.fetchone()["n"]
        cur.execute(
            "SELECT COUNT(*) n FROM financeiro_lancamento "
            "WHERE status='ATIVO' AND natureza='DEBITO' AND imovel_id IS NULL"
        )
        sem = cur.fetchone()["n"]
        cur.execute(
            "SELECT imovel_id, COUNT(*) n FROM financeiro_lancamento "
            "WHERE status='ATIVO' AND natureza='DEBITO' AND imovel_id IS NOT NULL "
            "GROUP BY imovel_id ORDER BY n DESC, imovel_id"
        )
        por = cur.fetchall()
    print("\n=== REPORTE FINAL ===")
    print(f"  Com imóvel: {com}")
    print(f"  Sem imóvel: {sem}")
    print("  Por imóvel:")
    for r in por:
        print(f"    imovel {r['imovel_id']:>3}: {r['n']}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", default=True)
    ap.add_argument("--apply-revert", action="store_true")
    ap.add_argument("--apply-conta", action="store_true")
    ap.add_argument("--apply-all", action="store_true",
                    help="Transação 1 revert + transação 2 varredura conta")
    ap.add_argument("--outdir", default=".")
    args = ap.parse_args()
    base = os.path.dirname(__file__) or "."
    outdir = args.outdir if os.path.isabs(args.outdir) else os.path.join(base, args.outdir)

    conn = connect()
    try:
        rows, revert_rows, mismatch = dry_run(conn, outdir)
        if args.apply_revert:
            if mismatch:
                sys.exit("Abortado: há mismatch imovel_id antes do revert.")
            n = apply_revert(conn, revert_rows)
            print(f"\n[APLICADO REVERT] {n} lançamentos -> imovel_id NULL")
            dry_run_varredura_conta(conn, outdir)
            report_final(conn)
        elif args.apply_conta:
            conta_csv = os.path.join(outdir, "vinculo_conta_filtrada.csv")
            n, applied = apply_conta_from_csv(conn, conta_csv)
            by_i = Counter(r["imovel_id"] for r in applied)
            print(f"\n[APLICADO VARREDURA CONTA] {n} lançamentos")
            print("  Por imóvel:")
            for iid, c in sorted(by_i.items()):
                print(f"    imovel {iid:>3}: {c}")
            report_final(conn)
            report_imovel_sem_unidade(conn)
        elif args.apply_all:
            if mismatch:
                sys.exit("Abortado: há mismatch imovel_id antes do revert.")
            n_rev = apply_revert(conn, revert_rows)
            if n_rev != 973:
                print(f"AVISO: revert count {n_rev} != 973")
            print(f"\n[TRANSAÇÃO 1 — REVERT] {n_rev} lançamentos -> imovel_id NULL")
            conta_csv = os.path.join(outdir, "vinculo_conta_filtrada.csv")
            n_conta, applied = apply_conta_from_csv(conn, conta_csv)
            by_i = Counter(r["imovel_id"] for r in applied)
            print(f"\n[TRANSAÇÃO 2 — VARREDURA CONTA] {n_conta} lançamentos")
            print("  Por imóvel:")
            for iid, c in sorted(by_i.items()):
                print(f"    imovel {iid:>3}: {c}")
            report_final(conn)
            report_imovel_sem_unidade(conn)
        else:
            dry_run_varredura_conta(conn, outdir)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
