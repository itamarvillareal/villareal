#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fase 1: investigação dos 8 imóveis-placeholder (read-only)."""
import csv
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from opcao_a_contas import is_conta
from vincular_imoveis import connect, strip_accents, resolve_imoveis, fetch_imoveis, IMOVEL_OVERRIDES
from vinculo_cliente import parse_cc_cli, load_cliente_map, is_placeholder

PLACEHOLDER_CLIENTS = [493, 693, 718, 728, 763, 809, 915, 934]

OVERRIDES = {
    **IMOVEL_OVERRIDES,
    "505-A": 65, "505 A": 65, "101-C": 70, "1101-C": 73,
    "404 São José": 72, "503-A": 79, "503 A": 62,
}


def norm(s):
    return strip_accents(str(s or "")).lower()


def extract_hints(text):
    t = text
    tn = norm(text)
    hints = dict(unidades=set(), condominios=set(), nomes=set(), enderecos=set())
    for m in re.finditer(
        r"\b(?:iptu|agua|água|energia|gas|gás|cond(?:ominio)?|saneamento)\s+(\d{3,4})\s*[- ]?\s*([ABC])\b",
        t, re.I,
    ):
        hints["unidades"].add(f"{m.group(1)}-{m.group(2).upper()}")
    for m in re.finditer(r"\b(\d{3,4})\s*[- ]\s*([ABC])\b", t, re.I):
        hints["unidades"].add(f"{m.group(1)}-{m.group(2).upper()}")
    if re.search(r"\b505\s*[- ]?a\b", tn):
        hints["unidades"].add("505-A")
    if re.search(r"\bveredas\b", tn):
        hints["condominios"].add("Veredas do Bosque")
    if re.search(r"\bavenida\s*parque\b", tn) or "av parque" in tn:
        hints["condominios"].add("Avenida Parque")
    if re.search(r"\bsao\s*jose\b", tn):
        hints["condominios"].add("São José")
    if re.search(r"\bexecutive\s*prive\b", tn):
        hints["condominios"].add("Executive Privê")
    return hints


def imovel_unit_key(im):
    keys = set()
    for f in ("unidade", "titulo"):
        for m in re.finditer(r"\b(\d{3,4})\s*[- ]?\s*([abc])\b", norm(im.get(f) or ""), re.I):
            keys.add(f"{m.group(1)}-{m.group(2).upper()}")
    return keys


def build_real_index(imoveis):
    """unidade-key -> [imovel ids reais]"""
    by_unit = defaultdict(list)
    by_id = {}
    for im in imoveis:
        if is_placeholder(im):
            continue
        by_id[im["id"]] = im
        for k in imovel_unit_key(im):
            by_unit[k].append(im["id"])
    return by_unit, by_id


def resolve_units_to_imoveis(units, imoveis):
    if not units:
        return []
    labels = list(units)
    mapping = resolve_imoveis(labels, imoveis, OVERRIDES)
    ids = []
    for lb in labels:
        m = mapping.get(lb)
        if m and (m.get("manual") or m.get("score", 0) >= 0.55):
            im = next((x for x in imoveis if x["id"] == m["imovel_id"]), None)
            if im and not is_placeholder(im):
                ids.append(m["imovel_id"])
    return sorted(set(ids))


def classify_client(contas, imoveis, placeholder_id):
    all_hints = dict(unidades=set(), condominios=set())
    evidencias = []
    for c in contas:
        texto = f"{c['descricao']} | {c.get('descricao_detalhada') or ''}"
        h = extract_hints(texto)
        all_hints["unidades"].update(h["unidades"])
        all_hints["condominios"].update(h["condominios"])
        if h["unidades"] or h["condominios"]:
            evidencias.append(f"{c['id']}: {texto[:120]}")

    by_unit, by_id = build_real_index(imoveis)
    destinos = resolve_units_to_imoveis(all_hints["unidades"], imoveis)

    # também checar match direto na index
    for u in all_hints["unidades"]:
        for iid in by_unit.get(u, []):
            if iid != placeholder_id and iid not in destinos:
                destinos.append(iid)
    destinos = sorted(set(destinos))

    unidade_sug = "; ".join(sorted(all_hints["unidades"])) or ""
    cond_sug = "; ".join(sorted(all_hints["condominios"])) or ""

    if destinos:
        if len(destinos) == 1:
            real = by_id.get(destinos[0], {})
            cls = "DUPLICADO/LIXO"
            dest = destinos[0]
            ev = "; ".join(evidencias[:3]) or f"unidade {unidade_sug} -> imovel {dest} ({real.get('unidade')}/{real.get('condominio')})"
        else:
            cls = "INDETERMINADO"
            dest = ""
            ev = f"múltiplos imóveis reais candidatos: {destinos}; " + "; ".join(evidencias[:2])
    elif unidade_sug or cond_sug:
        cls = "REAL INCOMPLETO"
        dest = ""
        ev = "; ".join(evidencias[:3]) or f"pistas: {unidade_sug} {cond_sug}"
    else:
        cls = "INDETERMINADO"
        dest = ""
        ev = "; ".join(c["descricao"][:60] for c in contas[:2]) or "sem pistas nas contas"

    return dict(
        classificacao=cls,
        unidade_sugerida=unidade_sug,
        condominio_sugerido=cond_sug,
        imovel_real_destino=dest,
        evidencia=ev[:500],
        qtd_contas=len(contas),
        destinos_candidatos=";".join(str(x) for x in destinos),
    )


def main():
    outdir = os.path.dirname(__file__) or "."
    conn = connect()
    imoveis = fetch_imoveis(conn)
    clientes, cc_to_cliente, _, _ = load_cliente_map(conn)

    # placeholder imovel por cliente
    ph_by_client = {}
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT i.id, i.cliente_id, c.codigo_cliente, c.nome_referencia
            FROM imovel i JOIN cliente c ON c.id = i.cliente_id
            WHERE i.cliente_id IN (%s) AND i.ativo = 1
            """ % ",".join(map(str, PLACEHOLDER_CLIENTS))
        )
        for r in cur.fetchall():
            ph_by_client[r["cliente_id"]] = r

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, cliente_id, valor, data_lancamento, descricao, descricao_detalhada
            FROM financeiro_lancamento
            WHERE status='ATIVO' AND natureza='DEBITO' AND imovel_id IS NULL
            """
        )
        all_deb = cur.fetchall()

    contas_por_cliente = defaultdict(list)
    for l in all_deb:
        if not is_conta(l["descricao"], l.get("descricao_detalhada")):
            continue
        cc = parse_cc_cli(l.get("descricao_detalhada") or "")
        cid = cc_to_cliente.get(cc) if cc is not None else l.get("cliente_id")
        if cid in PLACEHOLDER_CLIENTS:
            contas_por_cliente[cid].append(l)

    rows = []
    detalhe_path = os.path.join(outdir, "placeholders_contas.csv")
    det_rows = []

    print("\n=== FASE 1 — 8 imóveis-placeholder (read-only) ===\n")
    for cid in PLACEHOLDER_CLIENTS:
        ph = ph_by_client[cid]
        contas = contas_por_cliente.get(cid, [])
        cls = classify_client(contas, imoveis, ph["id"])
        cl = clientes.get(cid, {})
        nome = ph.get("nome_referencia") or cl.get("nome_referencia") or ""
        row = dict(
            imovel_id=ph["id"],
            cliente_id=cid,
            codigo_cliente=ph["codigo_cliente"],
            cliente_nome=nome,
            **cls,
        )
        rows.append(row)

        print(f"--- imovel {ph['id']} | cliente {cid} ({ph['codigo_cliente']}) | {cls['classificacao']} | {len(contas)} contas ---")
        print(f"    destino real: {cls['imovel_real_destino'] or '-'} | unidade: {cls['unidade_sugerida'] or '-'} | cond: {cls['condominio_sugerido'] or '-'}")
        print(f"    evidencia: {cls['evidencia'][:200]}")
        for c in contas:
            det_rows.append(dict(
                imovel_placeholder=ph["id"], cliente_id=cid,
                lancamento_id=c["id"], data=c["data_lancamento"], valor=c["valor"],
                descricao=(c["descricao"] or "")[:100],
                detalhada=(c.get("descricao_detalhada") or "")[:160],
            ))
            print(f"    {c['id']} | {c['data_lancamento']} | {c['valor']} | {(c['descricao'] or '')[:50]}")
            dd = (c.get("descricao_detalhada") or "")[:100]
            if dd:
                print(f"      {dd}")

    prop_path = os.path.join(outdir, "placeholders_proposta.csv")
    cols = ["imovel_id", "cliente_id", "codigo_cliente", "cliente_nome", "classificacao",
            "unidade_sugerida", "condominio_sugerido", "imovel_real_destino",
            "destinos_candidatos", "evidencia", "qtd_contas"]
    with open(prop_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)

    with open(detalhe_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(det_rows[0].keys()) if det_rows else [], delimiter=";")
        if det_rows:
            w.writeheader()
            w.writerows(det_rows)

    by_cls = Counter(r["classificacao"] for r in rows)
    contas_cls = Counter()
    for r in rows:
        contas_cls[r["classificacao"]] += r["qtd_contas"]

    print(f"\n=== RESUMO ===")
    print(f"  Arquivos: {prop_path}")
    print(f"            {detalhe_path}")
    print(f"  Por classificação (imóveis | contas):")
    for k in ("DUPLICADO/LIXO", "REAL INCOMPLETO", "INDETERMINADO"):
        print(f"    {k:20}: {by_cls.get(k,0)} imóveis | {contas_cls.get(k,0)} contas")
    print(f"  Total contas placeholder: {sum(r['qtd_contas'] for r in rows)}")
    conn.close()


if __name__ == "__main__":
    main()
