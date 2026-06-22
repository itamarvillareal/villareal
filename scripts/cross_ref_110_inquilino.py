#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cross-ref quase_vinculos CC_CLI cliente N por inquilino em contrato_locacao (dry-run)."""
import csv
import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from vinculo_cliente import is_placeholder, parse_cc_cli, load_cliente_map
from vincular_imoveis import connect, strip_accents

MOTIVO_N = "CC_CLI cliente multi-imóvel (N)"
MIN_TENANT_LEN = 10  # nomes curtos demais -> ambíguo
SHORT_NAMES = {"pedro", "felipe", "paulo", "joao", "jose", "maria", "ana", "luiz", "carlos"}


def norm(s):
    return strip_accents(str(s or "")).lower().strip()


def extract_counterparties(text):
    """Retorna lista de nomes de contraparte/inquilino após ' x '."""
    t = re.sub(r"\[CC_CLI:\d+\]", "", text, flags=re.I)
    t = re.sub(r"\s*-\s*\d{2}/\d{4}.*$", "", t)
    t = re.sub(r"\s*-\s*\d{2}/\d{2}.*$", "", t)
    if " · " in t:
        t = t.split(" · ", 1)[-1]
    if " x " not in t.lower():
        parts = re.split(r"\bx\b", t, maxsplit=1, flags=re.I)
        if len(parts) < 2:
            return []
        right = parts[1]
    else:
        idx = t.lower().rfind(" x ")
        right = t[idx + 3 :]
    right = re.sub(r"\s*-\s*IPTU.*$", "", right, flags=re.I)
    right = re.sub(r"\s*-\s*G[aá]s.*$", "", right, flags=re.I)
    right = re.sub(r"\s*-\s*Saneago.*$", "", right, flags=re.I)
    right = re.sub(r"\s*-\s*Energia.*$", "", right, flags=re.I)
    right = re.sub(r"\s*-\s*Condom[ií]nio.*$", "", right, flags=re.I)
    right = re.sub(r"\s*-\s*Diferenca:.*$", "", right, flags=re.I)
    right = re.sub(r"\s*-\s*\.\s*.*$", "", right)
    names = []
    for chunk in re.split(r"\s+e\s+", right, flags=re.I):
        chunk = chunk.strip(" .-")
        if chunk and not re.match(r"^(condominio|condomínio|saneago|energia|iptu|gas|gás|agua|água)\b", norm(chunk)):
            names.append(chunk.strip())
    return names


def name_too_short(name):
    n = norm(name)
    if len(n) < MIN_TENANT_LEN:
        return True
    first = n.split()[0] if n.split() else n
    if first in SHORT_NAMES and len(n.split()) < 2:
        return True
    return False


def tenant_matches(inquilino_norm, tenant_norm):
    if not inquilino_norm or not tenant_norm:
        return False
    if tenant_norm in inquilino_norm or inquilino_norm in tenant_norm:
        return True
    tt = set(tenant_norm.split())
    it = set(inquilino_norm.split())
    if len(tt) >= 2 and len(tt & it) >= 2:
        return True
    if len(tt) >= 3 and len(tt & it) >= 3:
        return True
    return False


def locador_matches(locador_norm, owner_hints):
    if not locador_norm:
        return False
    for h in owner_hints:
        hn = norm(h)
        if hn and (hn in locador_norm or locador_norm in hn):
            return True
        hl = set(hn.split())
        if len(hl & set(locador_norm.split())) >= 2:
            return True
    return False


def load_client_imoveis(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, cliente_id, unidade, condominio, titulo
            FROM imovel WHERE ativo = 1 AND cliente_id IS NOT NULL
            """
        )
        rows = cur.fetchall()
    by_client = defaultdict(list)
    by_id = {}
    for r in rows:
        if is_placeholder(r):
            continue
        by_client[r["cliente_id"]].append(r)
        by_id[r["id"]] = r
    return by_client, by_id


def load_contracts(conn, imovel_ids):
    if not imovel_ids:
        return []
    ph = ",".join(map(str, imovel_ids))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT cl.id, cl.imovel_id, cl.status, i.unidade, i.condominio,
                   pl.nome locador, pi.nome inquilino
            FROM contrato_locacao cl
            JOIN imovel i ON i.id = cl.imovel_id
            LEFT JOIN pessoa pl ON pl.id = cl.locador_pessoa_id
            LEFT JOIN pessoa pi ON pi.id = cl.inquilino_pessoa_id
            WHERE cl.imovel_id IN ({ph})
            """
        )
        return cur.fetchall()


def owner_hints_from_text(text, cliente_nome):
    hints = []
    if cliente_nome:
        hints.append(cliente_nome)
    t = re.sub(r"\[CC_CLI:\d+\]", "", text, flags=re.I)
    if " x " in t.lower():
        idx = t.lower().rfind(" x ")
        left = t[:idx]
        if " · " in left:
            left = left.split(" · ", 1)[-1]
        left = left.strip(" .-")
        if left and not re.match(r"^(condominio|itamar)", norm(left)):
            hints.append(left)
    return hints


def match_account(row, by_client, clientes, contracts_cache):
    cid_s = (row.get("cliente") or "").strip().split()[0]
    if not cid_s.isdigit():
        cc = row.get("cc_cli") or ""
        cid_s = cc  # fallback
    try:
        cid = int(cid_s)
    except ValueError:
        return dict(confianca="ERRO", imovel_proposto="", contrato_match="", nota="cliente_id invalido")

    imoveis = by_client.get(cid, [])
    imovel_ids = [im["id"] for im in imoveis]
    imoveis_label = ";".join(f"{im['id']}:{im.get('unidade') or '?'}" for im in imoveis)

    texto = f"{row.get('descricao') or ''} {row.get('detalhada') or ''}"
    tenants = extract_counterparties(texto)
    cliente_nome = ""
    if cid in clientes:
        cliente_nome = clientes[cid].get("nome_referencia") or ""

    if not tenants:
        return dict(
            confianca="AMBIGUO", imovel_proposto="", contrato_match="",
            nota="sem contraparte extraivel (padrao x)",
            contraparte="", imoveis_do_cliente=imoveis_label,
        )

    valid_tenants = [t for t in tenants if not name_too_short(t)]
    if not valid_tenants:
        return dict(
            confianca="AMBIGUO", imovel_proposto="", contrato_match="",
            nota=f"contraparte curta/ambigua: {' | '.join(tenants[:2])}",
            contraparte=" | ".join(tenants),
            imoveis_do_cliente=imoveis_label,
        )

    cache_key = tuple(sorted(imovel_ids))
    if cache_key not in contracts_cache:
        contracts_cache[cache_key] = load_contracts(conn_global, imovel_ids)

    contracts = contracts_cache[cache_key]
    owner_hints = owner_hints_from_text(texto, cliente_nome)

    matched = []
    for cl in contracts:
        inq_n = norm(cl.get("inquilino"))
        loc_n = norm(cl.get("locador"))
        for tenant in valid_tenants:
            tn = norm(tenant)
            if tenant_matches(inq_n, tn):
                score = 1
                if locador_matches(loc_n, owner_hints):
                    score = 2
                matched.append((cl["id"], cl["imovel_id"], cl.get("unidade"), cl.get("inquilino"), score, tenant))

    uniq_imoveis = {m[1] for m in matched}
    if len(uniq_imoveis) == 1:
        best = max(matched, key=lambda x: x[4])
        return dict(
            confianca="UNICO",
            imovel_proposto=str(best[1]),
            contrato_match=f"cl={best[0]} inq={best[3]}",
            nota=f"match inquilino '{best[5]}'" + (" + locador" if best[4] > 1 else ""),
            contraparte=" | ".join(valid_tenants),
            imoveis_do_cliente=imoveis_label,
        )
    if len(uniq_imoveis) == 0:
        return dict(
            confianca="AMBIGUO", imovel_proposto="", contrato_match="",
            nota="0 contratos com inquilino casando",
            contraparte=" | ".join(valid_tenants),
            imoveis_do_cliente=imoveis_label,
        )
    return dict(
        confianca="AMBIGUO", imovel_proposto="", contrato_match=";".join(f"cl={m[0]}@{m[1]}" for m in matched[:5]),
        nota=f"{len(uniq_imoveis)} imoveis candidatos",
        contraparte=" | ".join(valid_tenants),
        imoveis_do_cliente=imoveis_label,
    )


conn_global = None


def main():
    global conn_global
    outdir = os.path.dirname(__file__) or "."
    qv_path = os.path.join(outdir, "quase_vinculos.csv")

    rows_n = []
    with open(qv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter=";"):
            if MOTIVO_N in (row.get("motivo_nao_vinculo") or ""):
                rows_n.append(row)

    conn = connect()
    conn_global = conn
    clientes, _, _, _ = load_cliente_map(conn)
    by_client, _ = load_client_imoveis(conn)
    contracts_cache = {}

    out_rows = []
    stats = defaultdict(int)
    for row in rows_n:
        m = match_account(row, by_client, clientes, contracts_cache)
        stats[m["confianca"]] += 1
        out_rows.append(dict(
            conta_id=row["id"],
            valor=row["valor"],
            tipo=row.get("tipo_conta") or "",
            contraparte=m.get("contraparte", ""),
            cliente=row.get("cliente") or "",
            cc_cli=row.get("cc_cli") or "",
            imoveis_do_cliente=m.get("imoveis_do_cliente", ""),
            contrato_match=m.get("contrato_match", ""),
            imovel_proposto=m.get("imovel_proposto", ""),
            confianca=m["confianca"],
            nota=m.get("nota", ""),
        ))

    out_path = os.path.join(outdir, "cross_ref_110_proposta.csv")
    cols = [
        "conta_id", "valor", "tipo", "contraparte", "cliente", "cc_cli",
        "imoveis_do_cliente", "contrato_match", "imovel_proposto", "confianca", "nota",
    ]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";")
        w.writeheader()
        w.writerows(out_rows)

    conn.close()
    print(f"Contas CC_CLI N analisadas: {len(rows_n)}")
    print(f"  UNICO (imovel proposto): {stats.get('UNICO', 0)}")
    print(f"  AMBIGUO: {stats.get('AMBIGUO', 0)}")
    print(f"  ERRO: {stats.get('ERRO', 0)}")
    print(f"Arquivo: {out_path}")


if __name__ == "__main__":
    main()
