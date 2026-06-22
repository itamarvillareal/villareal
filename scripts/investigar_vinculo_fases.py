#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Investigação fases 0–4: vincular financeiro_lancamento -> imovel (dry-run).

  python3 investigar_vinculo_fases.py --fase 0
  python3 investigar_vinculo_fases.py --fase 1
  python3 investigar_vinculo_fases.py --fase 2
  python3 investigar_vinculo_fases.py --fase 3
  python3 investigar_vinculo_fases.py --fase 4
  python3 investigar_vinculo_fases.py --fase all
"""
import argparse
import csv
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import timedelta

sys.path.insert(0, os.path.dirname(__file__))
from vincular_imoveis import (
    IMOVEL,
    IMOVEL_OVERRIDES,
    IMOVEL_PROCESSO_TABLE,
    LANC,
    LINK_COLUMN,
    connect,
    fetch_imoveis,
    norm,
    parse_date,
    parse_valor,
    resolve_imoveis,
    strip_accents,
)

MIN_SCORE = 0.55
RELATORIO_OVERRIDES = {
    **IMOVEL_OVERRIDES,
    "404 São José": 72,
    "1101-C": 73,
    "1101 C": 73,
    "505-A": 65,
    "101-C": 70,
    "F-18": 8,
    "Executive Privê": 71,
    "103-A": 27,
    "103-C": 47,
    "1204-C": 44,
    "503-A": 79,  # Avenida Parque apenas (não Veredas 62)
    "casa Ana Paula": None,
    "casa Jd Ana": None,
    "casa Sócrates": None,
}
RELATORIO_PATH = "relatorio-pagamentos.csv"
OUTDIR = "."

# Rodadas anteriores (referência histórica)
RODADAS_ANTERIORES = [
    ("Pass1 + manuais", 55),
    ("Pass2", 3),
    ("Varredura processo (5 proc)", 97),
]
TOTAL_VINCULADO_ESPERADO = sum(n for _, n in RODADAS_ANTERIORES)


def norm_tipo(s):
    return norm(s).replace(" ", "")


def tipo_compativel(tipo_hint, descricao, detalhada=""):
    texto = norm(descricao) + " " + norm(detalhada)
    t = norm_tipo(tipo_hint)

    if not t:
        return True  # sem hint — não exige corroboração extra além de valor único

    rules = {
        "agua": ("saneago", "saneamento", "agua", "água"),
        "água": ("saneago", "saneamento", "agua", "água"),
        "energia": ("equatorial", "energia", "celg", "enel", "luz", "cemig", "cpfl"),
        "gas": ("consigaz", "ultragaz", " gás", "gas ", "gás"),
        "gás": ("consigaz", "ultragaz", " gás", "gas ", "gás"),
        "condominio": ("condomin", "cond ", "sindico", "síndico", "taxa cond"),
        "condomínio": ("condomin", "cond ", "sindico", "síndico", "taxa cond"),
        "iptu": ("iptu", "prefeitura", "fazenda", "tsu", "tributo"),
        "aluguel": ("aluguel", "locacao", "locação", "inquilino"),
        "reparo": ("reparo", "marceneiro", "obra", "manutenc", "manutenç"),
    }
    keys = rules.get(t, ())
    if keys:
        return any(k in texto for k in keys)
    # tipo genérico / desconhecido — exige pelo menos token do hint na descrição
    toks = [x for x in re.split(r"[^a-z0-9]+", t) if len(x) >= 3]
    return any(tok in texto for tok in toks) if toks else False


def fase0(conn):
    print("\n=== FASE 0 — Inventário (read-only) ===")
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT COUNT(*) n FROM {LANC['table']} WHERE {LANC['where_extra']}"
        )
        total = cur.fetchone()["n"]
        cur.execute(
            f"SELECT COUNT(*) n FROM {LANC['table']} "
            f"WHERE {LANC['where_extra']} AND {LINK_COLUMN} IS NULL"
        )
        sem = cur.fetchone()["n"]
        cur.execute(
            f"SELECT COUNT(*) n FROM {LANC['table']} "
            f"WHERE {LANC['where_extra']} AND {LINK_COLUMN} IS NOT NULL"
        )
        com = cur.fetchone()["n"]
        cur.execute(
            f"SELECT COUNT(*) n FROM {LANC['table']} "
            f"WHERE {LANC['where_extra']} AND {LINK_COLUMN} IS NULL AND processo_id IS NOT NULL"
        )
        sem_imovel_com_proc = cur.fetchone()["n"]
        cur.execute(
            f"SELECT COUNT(*) n FROM {LANC['table']} "
            f"WHERE {LANC['where_extra']} AND {LINK_COLUMN} IS NULL AND processo_id IS NULL"
        )
        sem_imovel_sem_proc = cur.fetchone()["n"]
        cur.execute(
            f"SELECT {LINK_COLUMN} imovel_id, COUNT(*) n FROM {LANC['table']} "
            f"WHERE {LANC['where_extra']} AND {LINK_COLUMN} IS NOT NULL "
            f"GROUP BY {LINK_COLUMN} ORDER BY {LINK_COLUMN}"
        )
        por_imovel = cur.fetchall()

    print(f"  ATIVO/DEBITO total:           {total:,}")
    print(f"  imovel_id NULL:               {sem:,}")
    print(f"  imovel_id preenchido:         {com:,}")
    print(f"  NULL + processo_id preenchido:{sem_imovel_com_proc:,}")
    print(f"  NULL + processo_id NULL:      {sem_imovel_sem_proc:,}")
    print("\n  Rodadas anteriores (referência):")
    for nome, qtd in RODADAS_ANTERIORES:
        print(f"    {nome}: {qtd}")
    print(f"    Total acumulado: {TOTAL_VINCULADO_ESPERADO} (banco confirma: {com})")
    print("\n  Por imóvel (já vinculados):")
    for row in por_imovel:
        print(f"    imovel_id {row['imovel_id']:>4}: {row['n']}")


def fetch_processo_map(conn):
    """Processos em lançamentos desvinculados -> classificação 1:1 / 0 / N."""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT fl.processo_id,
                   COUNT(*) AS lancamentos,
                   COUNT(DISTINCT CASE WHEN ip.ativo = 1 AND i.ativo = 1
                                       THEN ip.imovel_id END) AS qtd_imoveis,
                   GROUP_CONCAT(DISTINCT CASE WHEN ip.ativo = 1 AND i.ativo = 1
                                              THEN ip.imovel_id END
                              ORDER BY ip.imovel_id) AS imovel_ids
            FROM {LANC['table']} fl
            LEFT JOIN {IMOVEL_PROCESSO_TABLE} ip
                   ON ip.processo_id = fl.processo_id AND ip.ativo = 1
            LEFT JOIN {IMOVEL['table']} i ON i.id = ip.imovel_id AND i.ativo = 1
            WHERE fl.status = 'ATIVO' AND fl.natureza = 'DEBITO'
              AND fl.{LINK_COLUMN} IS NULL AND fl.processo_id IS NOT NULL
            GROUP BY fl.processo_id
            ORDER BY lancamentos DESC, fl.processo_id
            """
        )
        return cur.fetchall()


def fase1(conn, outdir):
    print("\n=== FASE 1 — Mapa processo -> imóvel (read-only) ===")
    rows = fetch_processo_map(conn)
    um_um, zero, multi = [], [], []
    for r in rows:
        q = r["qtd_imoveis"] or 0
        if q == 1:
            r["classificacao"] = "1:1"
            r["imovel_id"] = int(r["imovel_ids"])
            um_um.append(r)
        elif q == 0:
            r["classificacao"] = "0"
            r["imovel_id"] = ""
            zero.append(r)
        else:
            r["classificacao"] = "N"
            r["imovel_id"] = r["imovel_ids"]
            multi.append(r)

    csv_path = os.path.join(outdir, "vinculo_fase1_processo_map.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["processo_id", "classificacao", "imovel_id", "lancamentos_desvinculados"])
        for r in rows:
            w.writerow([r["processo_id"], r["classificacao"], r.get("imovel_id", ""), r["lancamentos"]])

    print(f"  Processos distintos: {len(rows)}")
    print(f"    1:1 (entram na Fase 2): {len(um_um)} processos, "
          f"{sum(r['lancamentos'] for r in um_um)} lançamentos")
    print(f"    0   (processo não-imóvel): {len(zero)} processos, "
          f"{sum(r['lancamentos'] for r in zero)} lançamentos")
    print(f"    N   (2+ imóveis): {len(multi)} processos, "
          f"{sum(r['lancamentos'] for r in multi) if multi else 0} lançamentos")
    if multi:
        print("\n  Processos N (excluídos da varredura):")
        for r in multi:
            print(f"    proc {r['processo_id']}: imoveis [{r['imovel_ids']}] — {r['lancamentos']} lanc.")
    print(f"\n  Tabela completa: {csv_path}")
    print("\n  Top 20 processos 1:1 por volume:")
    for r in um_um[:20]:
        print(f"    proc {r['processo_id']:>5} -> imovel {r['imovel_id']:>4}: {r['lancamentos']} lanc.")
    return um_um


def fase2(conn, outdir, ok_procs):
    print("\n=== FASE 2 — Varredura por processo 1:1 (DRY-RUN) ===")
    if not ok_procs:
        print("  Nenhum processo 1:1.")
        return

    ok_map = {r["processo_id"]: r["imovel_id"] for r in ok_procs}
    placeholders = ", ".join(["%s"] * len(ok_map))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT fl.id, fl.processo_id, fl.valor, fl.data_lancamento,
                   LEFT(fl.descricao, 120) AS descricao
            FROM {LANC['table']} fl
            WHERE fl.status = 'ATIVO' AND fl.natureza = 'DEBITO'
              AND fl.{LINK_COLUMN} IS NULL
              AND fl.processo_id IN ({placeholders})
            ORDER BY fl.processo_id, fl.data_lancamento, fl.id
            """,
            list(ok_map.keys()),
        )
        lanc_rows = cur.fetchall()

    csv_path = os.path.join(outdir, "vinculo_fase2.csv")
    sql_path = os.path.join(outdir, "vinculo_fase2.sql")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["lancamento_id", "processo_id", "imovel_id", "data_lancamento", "valor", "descricao"])
        for r in lanc_rows:
            w.writerow([
                r["id"], r["processo_id"], ok_map[r["processo_id"]],
                r["data_lancamento"], r["valor"], r["descricao"],
            ])

    by_proc = Counter(r["processo_id"] for r in lanc_rows)
    by_imovel = Counter(ok_map[r["processo_id"]] for r in lanc_rows)

    with open(sql_path, "w", encoding="utf-8") as f:
        f.write("-- Fase 2: varredura processo 1:1. DRY-RUN — aguardando OK.\n")
        f.write(f"-- Lançamentos: {len(lanc_rows)} | Processos: {len(ok_map)}\n")
        f.write("START TRANSACTION;\n")
        for pid in sorted(ok_map):
            imovel_id = ok_map[pid]
            n = by_proc.get(pid, 0)
            f.write(
                f"UPDATE {LANC['table']} SET {LINK_COLUMN} = {imovel_id} "
                f"WHERE processo_id = {pid} AND {LINK_COLUMN} IS NULL "
                f"AND {LANC['where_extra']};  -- {n} lanc.\n"
            )
        f.write("-- COMMIT;\n")

    resumo_path = os.path.join(outdir, "vinculo_fase2_resumo.csv")
    with open(resumo_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["processo_id", "imovel_id", "lancamentos"])
        for pid in sorted(ok_map):
            w.writerow([pid, ok_map[pid], by_proc.get(pid, 0)])

    print(f"  Lançamentos elegíveis: {len(lanc_rows)}")
    print(f"  CSV:   {csv_path}")
    print(f"  SQL:   {sql_path}")
    print(f"  Resumo:{resumo_path}")
    print("\n  Resumo por imóvel (NÃO aplicado):")
    for imovel_id, n in sorted(by_imovel.items()):
        print(f"    imovel_id {imovel_id:>4}: {n} lançamentos")
    print(f"\n  Total processos 1:1 com lançamentos: {len(by_proc)}")


def load_relatorio_sim(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter=";"):
            if (r.get("alvo_vinculo") or "").strip().lower() != "sim":
                continue
            flag = (r.get("valor_flag") or "").strip().lower()
            if flag in ("aprox", "faixa"):
                continue
            valor = parse_valor(r.get("valor"))
            if valor is None:
                continue
            rows.append(dict(
                data=parse_date(r.get("data")),
                valor=valor,
                tipo_hint=(r.get("tipo_hint") or "").strip(),
                imovel_hint=(r.get("imovel_hint") or "").strip(),
                descricao=(r.get("descricao") or "").strip(),
            ))
    return rows


def buscar_debitos_valor(conn, valor):
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, valor, data_lancamento, processo_id, imovel_id,
                   descricao, descricao_detalhada
            FROM {LANC['table']}
            WHERE status = 'ATIVO' AND natureza = 'DEBITO'
              AND {LINK_COLUMN} IS NULL AND valor = %s
            ORDER BY data_lancamento, id
            """,
            (str(valor),),
        )
        return cur.fetchall()


def fase3(conn, outdir, relatorio_path):
    print("\n=== FASE 3 — Gap fill por relatório (DRY-RUN) ===")
    sim_rows = load_relatorio_sim(relatorio_path)
    imoveis = fetch_imoveis(conn)
    hints = sorted({r["imovel_hint"] for r in sim_rows if r["imovel_hint"]})
    # overrides explícitos None = não resolver
    overrides = {k: v for k, v in RELATORIO_OVERRIDES.items() if v is not None}
    mapping = resolve_imoveis(hints, imoveis, overrides)

    map_path = os.path.join(outdir, "vinculo_fase3_rotulo_imovel.csv")
    nao_resolvidos = []
    with open(map_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["rotulo", "imovel_id", "score", "match", "status"])
        for h in hints:
            if h in RELATORIO_OVERRIDES and RELATORIO_OVERRIDES[h] is None:
                w.writerow([h, "", "", "", "NAO_CADASTRADO"])
                nao_resolvidos.append(h)
                continue
            m = mapping.get(h, {})
            iid = m.get("imovel_id", "")
            score = m.get("score", 0)
            manual = m.get("manual", False)
            ok = manual or score >= MIN_SCORE
            status = "OK" if ok else "SCORE_BAIXO"
            if not ok:
                nao_resolvidos.append(h)
            w.writerow([h, iid if ok else "", score, m.get("match", ""), status])

    print(f"  Linhas relatório alvo_vinculo=sim (valor exato): {len(sim_rows)}")
    print(f"  Rótulos únicos: {len(hints)}")
    print(f"  Mapa rótulo->id: {map_path}")
    if nao_resolvidos:
        print(f"  Rótulos NÃO resolvidos / score baixo: {', '.join(nao_resolvidos)}")

    auto = []
    revisar = []
    used_lanc = set()

    for row in sim_rows:
        hint = row["imovel_hint"]
        if hint in RELATORIO_OVERRIDES and RELATORIO_OVERRIDES[hint] is None:
            revisar.append({**row, "decisao": "IMOVEL_NAO_RESOLVIDO",
                            "motivo": "Imóvel fora do cadastro / pendente decisão", "candidatos": ""})
            continue
        m = mapping.get(hint)
        if not m:
            revisar.append({**row, "decisao": "IMOVEL_NAO_RESOLVIDO",
                            "motivo": "Rótulo sem mapeamento", "candidatos": ""})
            continue
        if not m.get("manual") and m.get("score", 0) < MIN_SCORE:
            revisar.append({**row, "decisao": "IMOVEL_NAO_RESOLVIDO",
                            "motivo": f"Score {m['score']} < {MIN_SCORE}", "candidatos": ""})
            continue
        imovel_id = m["imovel_id"]
        cands = buscar_debitos_valor(conn, row["valor"])
        cands = [c for c in cands if c["id"] not in used_lanc]

        base = dict(
            data_relatorio=row["data"] or "",
            valor=str(row["valor"]),
            tipo_hint=row["tipo_hint"],
            imovel_hint=hint,
            imovel_id_resolvido=imovel_id,
            descricao_relatorio=row["descricao"],
        )

        if not cands:
            revisar.append({**base, "decisao": "SEM_CANDIDATO",
                            "motivo": "Nenhum débito ATIVO imovel_id NULL com valor exato",
                            "lancamento_id": "", "data_lancamento": "",
                            "processo_id": "", "descricao_lancamento": "", "candidatos": ""})
            continue

        compat = [c for c in cands if tipo_compativel(
            row["tipo_hint"], c["descricao"], c.get("descricao_detalhada") or "")]
        cand_txt = " | ".join(
            f"{c['id']}@{c['data_lancamento']} proc={c['processo_id'] or 'NULL'} "
            f"{(c['descricao'] or '')[:60]}"
            for c in cands
        )

        if len(cands) == 1 and len(compat) == 1:
            c = cands[0]
            used_lanc.add(c["id"])
            auto.append((c["id"], imovel_id, row))
            revisar.append({**base,
                            "decisao": "AUTO_PROPOSTO",
                            "motivo": "candidato único + tipo compatível",
                            "lancamento_id": c["id"],
                            "data_lancamento": c["data_lancamento"],
                            "processo_id": c["processo_id"] or "",
                            "descricao_lancamento": (c["descricao"] or "")[:120],
                            "candidatos": cand_txt})
        else:
            motivo = []
            if len(cands) >= 2:
                motivo.append(f"{len(cands)} candidatos valor exato")
            if len(compat) == 0:
                motivo.append("nenhum candidato com tipo compatível na descrição")
            elif len(compat) >= 2:
                motivo.append(f"{len(compat)} candidatos compatíveis")
            revisar.append({**base,
                            "decisao": "REVISAR",
                            "motivo": "; ".join(motivo) or "ambiguidade",
                            "lancamento_id": "",
                            "data_lancamento": "",
                            "processo_id": "",
                            "descricao_lancamento": "",
                            "candidatos": cand_txt})

    auto_path = os.path.join(outdir, "vinculo_fase3_auto.sql")
    with open(auto_path, "w", encoding="utf-8") as f:
        f.write("-- Fase 3: gap fill relatório (automáticos). DRY-RUN — aguardando OK.\n")
        f.write(f"-- Propostos: {len(auto)}\n")
        f.write("START TRANSACTION;\n")
        for lid, iid, row in auto:
            f.write(
                f"UPDATE {LANC['table']} SET {LINK_COLUMN} = {iid} "
                f"WHERE id = {lid} AND {LINK_COLUMN} IS NULL;  "
                f"-- {row['imovel_hint']} {row['tipo_hint']} {row['valor']}\n"
            )
        f.write("-- COMMIT;\n")

    rev_cols = ["decisao", "motivo", "data_relatorio", "valor", "tipo_hint", "imovel_hint",
                "imovel_id_resolvido", "lancamento_id", "data_lancamento", "processo_id",
                "descricao_relatorio", "descricao_lancamento", "candidatos"]
    rev_path = os.path.join(outdir, "vinculo_fase3_revisar.csv")
    with open(rev_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=rev_cols, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for r in revisar:
            w.writerow(r)

    print(f"  Auto propostos: {len(auto)} -> {auto_path}")
    print(f"  Revisar:        {len(revisar)} linhas -> {rev_path}")
    auto_by_imovel = Counter(iid for _, iid, _ in auto)
    if auto_by_imovel:
        print("  Auto por imóvel:")
        for iid, n in sorted(auto_by_imovel.items()):
            print(f"    imovel_id {iid:>4}: {n}")


def fase4(conn, outdir, relatorio_path):
    print("\n=== FASE 4 — Sobras e qualidade (read-only) ===")
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT COUNT(*) n FROM {LANC['table']} "
            f"WHERE {LANC['where_extra']} AND {LINK_COLUMN} IS NULL"
        )
        sem_total = cur.fetchone()["n"]
        cur.execute(
            f"SELECT COUNT(*) n FROM {LANC['table']} "
            f"WHERE {LANC['where_extra']} AND {LINK_COLUMN} IS NULL AND processo_id IS NULL"
        )
        sem_proc = cur.fetchone()["n"]
        cur.execute(
            f"SELECT COUNT(*) n FROM {LANC['table']} "
            f"WHERE {LANC['where_extra']} AND {LINK_COLUMN} IS NULL AND processo_id IS NOT NULL"
        )
        com_proc = cur.fetchone()["n"]

    print(f"  ATIVO/DEBITO ainda sem imóvel: {sem_total:,}")
    print(f"    sem processo_id: {sem_proc:,}")
    print(f"    com processo_id (incl. proc 0/N após Fase 2): {com_proc:,}")

    # Casos conhecidos proc NULL / errado
    casos = [
        (176684, "proc NULL — esperado 16025 (101 C)"),
        (207213, "proc 16025 — PIX 453,95"),
    ]
    print("\n  Lançamentos para correção de cadastro (proc NULL/errado):")
    with conn.cursor() as cur:
        for lid, nota in casos:
            cur.execute(
                f"SELECT id, valor, data_lancamento, processo_id, imovel_id, "
                f"LEFT(descricao,100) d FROM {LANC['table']} WHERE id=%s",
                (lid,),
            )
            r = cur.fetchone()
            if r:
                print(f"    {r['id']}: R$ {r['valor']} {r['data_lancamento']} "
                      f"proc={r['processo_id'] or 'NULL'} imovel={r['imovel_id'] or 'NULL'} — {nota}")
                print(f"      {r['d']}")

    # Duplicatas 21xxxx vs 17/18xxxx (critério estrito: valor + descrição + data ±7d)
    print("\n  Duplicatas série 21xxxx (valor + descrição idêntica + data ±7d):")
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT o.id AS id_orig, r.id AS id_reimport,
                   o.valor, o.data_lancamento AS data_orig,
                   r.data_lancamento AS data_reimport,
                   LEFT(TRIM(o.descricao), 80) AS descricao
            FROM financeiro_lancamento o
            JOIN financeiro_lancamento r
              ON r.id BETWEEN 210000 AND 219999
             AND o.id BETWEEN 170000 AND 189999
             AND o.status = 'ATIVO' AND o.natureza = 'DEBITO'
             AND r.status = 'ATIVO' AND r.natureza = 'DEBITO'
             AND o.valor = r.valor
             AND TRIM(COALESCE(o.descricao,'')) = TRIM(COALESCE(r.descricao,''))
             AND ABS(DATEDIFF(o.data_lancamento, r.data_lancamento)) <= 7
            ORDER BY o.id, r.id
            """
        )
        dups = cur.fetchall()
        # Suspeitas: valor+data ±7d mas descrição diverge (reimport com texto diferente)
        cur.execute(
            """
            SELECT o.id AS id_orig, r.id AS id_reimport,
                   o.valor, o.data_lancamento AS data_orig,
                   r.data_lancamento AS data_reimport,
                   LEFT(TRIM(o.descricao), 60) AS desc_orig,
                   LEFT(TRIM(r.descricao), 60) AS desc_reimport
            FROM financeiro_lancamento o
            JOIN financeiro_lancamento r
              ON r.id BETWEEN 210000 AND 219999
             AND o.id BETWEEN 170000 AND 189999
             AND o.status = 'ATIVO' AND o.natureza = 'DEBITO'
             AND r.status = 'ATIVO' AND r.natureza = 'DEBITO'
             AND o.valor = r.valor
             AND TRIM(COALESCE(o.descricao,'')) <> TRIM(COALESCE(r.descricao,''))
             AND ABS(DATEDIFF(o.data_lancamento, r.data_lancamento)) <= 7
             AND (
               LOWER(o.descricao) REGEXP 'saneago|saneamento|equatorial|condomin|consigaz'
               OR LOWER(r.descricao) REGEXP 'saneago|saneamento|equatorial|condomin|consigaz'
             )
            ORDER BY o.valor, o.id, r.id
            LIMIT 500
            """
        )
        suspeitas = cur.fetchall()

    dup_path = os.path.join(outdir, "vinculo_fase4_duplicatas.csv")
    with open(dup_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["id_orig", "id_reimport", "valor", "data_orig", "data_reimport", "descricao"])
        for d in dups:
            w.writerow([d["id_orig"], d["id_reimport"], d["valor"],
                        d["data_orig"], d["data_reimport"], d["descricao"]])
    sus_path = os.path.join(outdir, "vinculo_fase4_duplicatas_suspeitas.csv")
    seen = set()
    sus_unique = []
    for d in suspeitas:
        key = (d["id_orig"], d["id_reimport"])
        if key in seen:
            continue
        seen.add(key)
        sus_unique.append(d)
    with open(sus_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["id_orig", "id_reimport", "valor", "data_orig", "data_reimport",
                    "desc_orig", "desc_reimport"])
        for d in sus_unique:
            w.writerow([d["id_orig"], d["id_reimport"], d["valor"],
                        d["data_orig"], d["data_reimport"],
                        d["desc_orig"], d["desc_reimport"]])
    print(f"    Estrito: {len(dups)} pares -> {dup_path}")
    print(f"    Suspeitas (valor+data, desc diferente, concessionária): "
          f"{len(sus_unique)} pares -> {sus_path}")
    for d in sus_unique[:8]:
        print(f"      {d['id_orig']} x {d['id_reimport']}: R$ {d['valor']} "
              f"({d['data_orig']} / {d['data_reimport']})")

    # Imóveis do relatório sem id
    sim = load_relatorio_sim(relatorio_path)
    hints = sorted({r["imovel_hint"] for r in sim if r["imovel_hint"]})
    imoveis = fetch_imoveis(conn)
    overrides = {k: v for k, v in RELATORIO_OVERRIDES.items() if v is not None}
    mapping = resolve_imoveis(hints, imoveis, overrides)
    fora = []
    for h in hints:
        if h in RELATORIO_OVERRIDES and RELATORIO_OVERRIDES[h] is None:
            fora.append((h, "marcado pendente"))
            continue
        m = mapping.get(h, {})
        if m.get("manual") or m.get("score", 0) >= MIN_SCORE:
            continue
        fora.append((h, f"score {m.get('score', 0)}"))
    print("\n  Imóveis do relatório sem id resolvível:")
    if fora:
        for h, mot in fora:
            print(f"    {h!r}: {mot}")
    else:
        print("    (nenhum — todos os hints do relatório sim resolvem)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fase", default="all",
                    choices=["0", "1", "2", "3", "4", "all"])
    ap.add_argument("--outdir", default=".")
    ap.add_argument("--relatorio", default=RELATORIO_PATH)
    args = ap.parse_args()
    base = os.path.dirname(__file__) or "."
    outdir = args.outdir if os.path.isabs(args.outdir) else os.path.join(base, args.outdir)
    relatorio = args.relatorio if os.path.isabs(args.relatorio) else os.path.join(base, args.relatorio)
    os.makedirs(outdir, exist_ok=True)

    conn = connect()
    try:
        fases = ["0", "1", "2", "3", "4"] if args.fase == "all" else [args.fase]
        ok_procs = None
        if "0" in fases:
            fase0(conn)
        if "1" in fases or "2" in fases:
            ok_procs = fase1(conn, outdir) if "1" in fases else None
        if "2" in fases:
            if ok_procs is None:
                ok_procs = [r for r in fetch_processo_map(conn)
                            if (r["qtd_imoveis"] or 0) == 1]
                for r in ok_procs:
                    r["imovel_id"] = int(r["imovel_ids"])
            fase2(conn, outdir, ok_procs)
        if "3" in fases:
            fase3(conn, outdir, relatorio)
        if "4" in fases:
            fase4(conn, outdir, relatorio)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
