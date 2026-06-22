#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Revert +28 varredura conta; re-vincular 200881; integridade."""
import csv
import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from vincular_imoveis import connect, fetch_imoveis, resolve_imoveis, IMOVEL_OVERRIDES, strip_accents

NUCLEO = {8, 65, 70, 71, 72, 73}
CONTA_CSV = "vinculo_conta_filtrada.csv"
INTEGRIDADE_CSV = "integridade_imovel_conflitos.csv"
SUGESTOES_CSV = "revinculo_sugestoes.csv"

UNIT_PATTERNS = [
    re.compile(r"\b(\d{3,4})\s*[- ]?\s*([ABC])\b", re.I),
    re.compile(r"\bunidade\s+(\d{3,4})\s*([ABC])\b", re.I),
    re.compile(r"\bapt(?:o|amento)?\.?\s*(\d{3,4})\s*[- ]?\s*([ABC])\b", re.I),
    re.compile(r"\b(\d{3,4})\s+([ABC])\b", re.I),
    re.compile(r"\b505\s*[- ]?A\b", re.I),
    re.compile(r"\b101\s*[- ]?C\b", re.I),
    re.compile(r"\b1101\s*[- ]?C\b", re.I),
    re.compile(r"\b404\b.*sao\s*jose", re.I),
    re.compile(r"\bexecutive\s*prive\b", re.I),
    re.compile(r"\bf\s*[- ]?18\b", re.I),
]


def norm(s):
    return strip_accents(str(s or "")).lower()


def full_text(desc, det):
    return norm(desc) + " " + norm(det)


def extract_unit_labels(text):
    """Retorna rótulos normalizados extraídos (ex.: '505-A', '1803 A')."""
    labels = set()
    t = norm(text)
    for pat in UNIT_PATTERNS:
        for m in pat.finditer(t):
            if m.lastindex and m.lastindex >= 2:
                num, bl = m.group(1), m.group(2).upper()
                labels.add(f"{num}-{bl}")
                labels.add(f"{num} {bl}")
            elif "505" in pat.pattern and "505" in m.group(0):
                labels.add("505-A")
            elif "101" in pat.pattern and "101" in m.group(0):
                labels.add("101-C")
            elif "1101" in pat.pattern:
                labels.add("1101-C")
            elif "404" in pat.pattern:
                labels.add("404 São José")
            elif "executive" in pat.pattern:
                labels.add("Executive Privê")
            elif "f" in pat.pattern and "18" in m.group(0):
                labels.add("F-18")
    # padrão genérico NNN-L
    for m in re.finditer(r"\b(\d{3,4})\s*[- ]\s*([ABC])\b", t, re.I):
        labels.add(f"{m.group(1)}-{m.group(2).upper()}")
    for m in re.finditer(r"\biptu\s+(\d{3,4})\s*([ABC])\b", t, re.I):
        labels.add(f"{m.group(1)}-{m.group(2).upper()}")
    for m in re.finditer(r"\b(\d{3,4})\s*([ABC])\b", t, re.I):
        labels.add(f"{m.group(1)}-{m.group(2).upper()}")
    return sorted(labels)


def build_imovel_index(imoveis):
    """unidade normalizada -> [imovel_ids]"""
    idx = defaultdict(list)
    for im in imoveis:
        iid = im["id"]
        parts = [im.get("unidade") or "", im.get("titulo") or ""]
        for p in parts:
            n = norm(p)
            if not n:
                continue
            idx[n].append(iid)
            m = re.search(r"(\d{3,4})\s*[- ]?\s*([abc])", n, re.I)
            if m:
                key = f"{m.group(1)}-{m.group(2).upper()}"
                idx[key].append(iid)
                idx[f"{m.group(1)} {m.group(2).upper()}"].append(iid)
    return idx


def suggest_imovel(labels, imoveis, overrides):
    if not labels:
        return None, []
    mapping = resolve_imoveis(list(set(labels)), imoveis, overrides)
    candidates = []
    for lb in labels:
        m = mapping.get(lb)
        if m and (m.get("manual") or m.get("score", 0) >= 0.55):
            candidates.append((lb, m["imovel_id"], m.get("score", 0)))
    if len(set(c for _, c, _ in candidates)) == 1 and candidates:
        return candidates[0][1], candidates
    return (candidates[0][1] if len(candidates) == 1 else None), candidates


OVERRIDES = {
    **IMOVEL_OVERRIDES,
    "404 São José": 72,
    "505-A": 65,
    "505 A": 65,
    "101-C": 70,
    "1101-C": 73,
    "1803-A": 21,
    "1803 A": 21,
    "303-C": 12,
    "303 C": 12,
}


def load_conta_csv(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter=";"):
            rows.append(dict(
                lancamento_id=int(r["lancamento_id"]),
                processo_id=int(r["processo_id"]),
                imovel_id=int(r["imovel_id"]),
            ))
    return rows


def revert_conta(conn, rows):
    with conn.cursor() as cur:
        cur.execute("START TRANSACTION")
        n = 0
        for r in rows:
            cur.execute(
                """
                UPDATE financeiro_lancamento SET imovel_id = NULL
                WHERE id = %s AND imovel_id = %s
                  AND status = 'ATIVO' AND natureza = 'DEBITO'
                """,
                (r["lancamento_id"], r["imovel_id"]),
            )
            n += cur.rowcount
        if n != len(rows):
            cur.execute("ROLLBACK")
            raise RuntimeError(f"Revert conta: esperado {len(rows)}, obteve {n}")
        cur.execute("COMMIT")
    return n


def revincular_200881(conn):
    with conn.cursor() as cur:
        cur.execute("START TRANSACTION")
        cur.execute(
            """
            UPDATE financeiro_lancamento SET imovel_id = 65
            WHERE id = 200881 AND imovel_id IS NULL
              AND status = 'ATIVO' AND natureza = 'DEBITO'
            """
        )
        n = cur.rowcount
        if n != 1:
            cur.execute("ROLLBACK")
            raise RuntimeError(f"200881->65: esperado 1, obteve {n}")
        cur.execute("COMMIT")
    return n


def fetch_lancamentos(conn, ids):
    if not ids:
        return []
    ph = ", ".join(["%s"] * len(ids))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, imovel_id, processo_id, valor, data_lancamento,
                   descricao, descricao_detalhada
            FROM financeiro_lancamento WHERE id IN ({ph})
            """,
            ids,
        )
        return cur.fetchall()


def analisar_27(conn, outdir, ids_27):
    imoveis = fetch_imoveis(conn)
    rows = fetch_lancamentos(conn, ids_27)
    sugestoes = []
    for r in rows:
        texto = (r["descricao"] or "") + " | " + (r.get("descricao_detalhada") or "")
        labels = extract_unit_labels(full_text(r["descricao"], r.get("descricao_detalhada")))
        sug_id, cands = suggest_imovel(labels, imoveis, OVERRIDES)
        sugestoes.append(dict(
            lancamento_id=r["id"],
            valor=r["valor"],
            data=r["data_lancamento"],
            processo_id=r["processo_id"],
            texto=texto[:200],
            rotulos_extraidos="; ".join(labels) or "(nenhum)",
            imovel_sugerido=sug_id or "",
            candidatos="; ".join(f"{lb}->{iid}" for lb, iid, _ in cands) if cands else "",
        ))
    path = os.path.join(outdir, SUGESTOES_CSV)
    cols = ["lancamento_id", "valor", "data", "processo_id", "rotulos_extraidos",
            "imovel_sugerido", "texto", "candidatos"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for s in sugestoes:
            w.writerow(s)
    return sugestoes, path


def integridade_scan(conn, outdir):
    imoveis = fetch_imoveis(conn)
    im_by_id = {im["id"]: im for im in imoveis}
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, imovel_id, processo_id, valor, data_lancamento,
                   descricao, descricao_detalhada
            FROM financeiro_lancamento
            WHERE status = 'ATIVO' AND natureza = 'DEBITO' AND imovel_id IS NOT NULL
            ORDER BY imovel_id, id
            """
        )
        all_lanc = cur.fetchall()

    conflitos = []
    for r in all_lanc:
        iid = r["imovel_id"]
        im = im_by_id.get(iid, {})
        im_unidade = norm(im.get("unidade") or "")
        im_cond = norm(im.get("condominio") or "")
        im_titulo = norm(im.get("titulo") or "")
        texto = full_text(r["descricao"], r.get("descricao_detalhada"))
        labels = extract_unit_labels(texto)
        if not labels:
            continue
        sug_id, cands = suggest_imovel(labels, imoveis, OVERRIDES)
        if sug_id is None:
            continue
        if sug_id != iid:
            conflitos.append(dict(
                lancamento_id=r["id"],
                imovel_id_atual=iid,
                imovel_cadastro=f"{im.get('unidade') or '?'} / {im.get('condominio') or '?'}",
                imovel_sugerido_desc=sug_id,
                imovel_sugerido_cadastro=f"{im_by_id.get(sug_id, {}).get('unidade') or '?'} / "
                                         f"{im_by_id.get(sug_id, {}).get('condominio') or '?'}",
                rotulos="; ".join(labels),
                nucleo="sim" if iid in NUCLEO else "NAO",
                valor=r["valor"],
                data=r["data_lancamento"],
                processo_id=r["processo_id"] or "",
                texto=(r["descricao"] or "")[:80],
                detalhada=(r.get("descricao_detalhada") or "")[:120],
            ))

    path = os.path.join(outdir, INTEGRIDADE_CSV)
    cols = list(conflitos[0].keys()) if conflitos else [
        "lancamento_id", "imovel_id_atual", "imovel_sugerido_desc", "rotulos", "texto"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for c in conflitos:
            w.writerow(c)

    nao_nucleo = [c for c in conflitos if c.get("nucleo") == "NAO"]
    return conflitos, nao_nucleo, path


def report_final(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) n FROM financeiro_lancamento "
            "WHERE status='ATIVO' AND natureza='DEBITO' AND imovel_id IS NOT NULL"
        )
        com = cur.fetchone()["n"]
        cur.execute(
            "SELECT imovel_id, COUNT(*) n FROM financeiro_lancamento "
            "WHERE status='ATIVO' AND natureza='DEBITO' AND imovel_id IS NOT NULL "
            "GROUP BY imovel_id ORDER BY n DESC, imovel_id"
        )
        por = cur.fetchall()
        cur.execute(
            "SELECT COUNT(*) n FROM financeiro_lancamento "
            "WHERE status='ATIVO' AND natureza='DEBITO' AND imovel_id IN (85, 99)"
        )
        o8599 = cur.fetchone()["n"]
    return com, por, o8599


def main():
    base = os.path.dirname(__file__) or "."
    conta_rows = load_conta_csv(os.path.join(base, CONTA_CSV))
    ids_28 = {r["lancamento_id"] for r in conta_rows}
    ids_27 = [r["lancamento_id"] for r in conta_rows if r["lancamento_id"] != 200881]

    conn = connect()
    try:
        n_rev = revert_conta(conn, conta_rows)
        print(f"[TRANSAÇÃO 1] Revertidos: {n_rev} (esperado 28)")

        n_200881 = revincular_200881(conn)
        print(f"[TRANSAÇÃO 2] 200881 -> 65: {n_200881}")

        sugestoes, spath = analisar_27(conn, base, ids_27)
        print(f"\n[SUGESTÕES 27 ids] -> {spath}")
        com_rotulo = [s for s in sugestoes if s["imovel_sugerido"]]
        for s in sugestoes:
            if s["imovel_sugerido"]:
                print(f"  {s['lancamento_id']} | {s['rotulos_extraidos']} -> imovel {s['imovel_sugerido']}")
                print(f"    {s['texto'][:120]}")
        print(f"  Com unidade explícita mapeável: {len(com_rotulo)}")
        print(f"  Sem mapeamento explícito: {len(sugestoes) - len(com_rotulo)}")

        conflitos, nao_nucleo, ipath = integridade_scan(conn, base)
        print(f"\n[INTEGRIDADE] {len(conflitos)} conflitos -> {ipath}")
        print(f"  Fora núcleo (8,65,70,71,72,73): {len(nao_nucleo)}")

        com, por, o8599 = report_final(conn)
        print(f"\n[REPORTE] Com imóvel: {com} | 85+99 vínculos: {o8599}")
        print("  Por imóvel:")
        for r in por:
            print(f"    imovel {r['imovel_id']:>3}: {r['n']}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
