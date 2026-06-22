#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recuperação por CC_CLI + integridade + quase_vinculos.

  python3 vinculo_cliente.py --fase A
  python3 vinculo_cliente.py --fase B          # dry-run
  python3 vinculo_cliente.py --fase B --apply
  python3 vinculo_cliente.py --fase C --apply
  python3 vinculo_cliente.py --fase D
  python3 vinculo_cliente.py --fase all        # A + B dry + D (sem apply)
"""
import argparse
import csv
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from opcao_a_contas import is_conta, CONTA_TOKENS, CONTA_PHRASE
from vincular_imoveis import connect, strip_accents, parse_valor, resolve_imoveis, fetch_imoveis, IMOVEL_OVERRIDES

CC_CLI_RE = re.compile(r"\[CC_CLI:(\d+)\]", re.I)
INTEGRITY_FIXES = {
    171049: (14, 40),
    171058: (100, 60),
    171062: (100, 60),
}
FASE3_REVISAR_VALORES = [
    ("17.05", "404 São José", "água"),
    ("17,05", "404 São José", "água"),
    ("453.95", "101-C", "água"),
    ("453,95", "101-C", "água"),
    ("159.73", "503-A", "IPTU"),
    ("159,73", "503-A", "IPTU"),
]


def norm(s):
    return strip_accents(str(s or "")).lower()


def parse_cc_cli(text):
    m = CC_CLI_RE.search(text or "")
    return int(m.group(1)) if m else None


def tipo_conta(desc, det):
    t = norm(desc) + " " + norm(det)
    if CONTA_PHRASE in t.replace("  ", " "):
        return "concessionaria"
    for tok in ("saneago", "saneamento", "agua", "equatorial", "celg", "enel", "energia"):
        if re.search(rf"\b{tok}\b", t):
            return tok
    for tok in ("consigaz", "gas"):
        if re.search(rf"\b{tok}\b", t):
            return "gas"
    if re.search(r"\bcondominio\b", t):
        return "condominio"
    if re.search(r"\biptu\b", t):
        return "iptu"
    if re.search(r"\btsu\b", t):
        return "tsu"
    return "conta"


def is_placeholder(im):
    return not any([
        (im.get("unidade") or "").strip(),
        (im.get("condominio") or "").strip(),
        (im.get("titulo") or "").strip(),
        (im.get("endereco_completo") or "").strip(),
    ])


def load_cliente_map(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.id AS cliente_id, c.codigo_cliente, c.nome_referencia,
                   CAST(c.codigo_cliente AS UNSIGNED) AS cc_cli_num
            FROM cliente c WHERE c.inativo = 0
            """
        )
        clientes = {r["cliente_id"]: r for r in cur.fetchall()}
        cc_to_cliente = {}
        for r in clientes.values():
            cc_to_cliente[r["cc_cli_num"]] = r["cliente_id"]

        cur.execute(
            """
            SELECT id, cliente_id, unidade, condominio, titulo, endereco_completo
            FROM imovel WHERE ativo = 1 AND cliente_id IS NOT NULL
            """
        )
        imoveis_por_cliente = defaultdict(list)
        for r in cur.fetchall():
            imoveis_por_cliente[r["cliente_id"]].append(r)

    classificacao = {}
    for cid, imoveis in imoveis_por_cliente.items():
        real = [im for im in imoveis if not is_placeholder(im)]
        placeholders = [im for im in imoveis if is_placeholder(im)]
        if len(real) == 1:
            classificacao[cid] = dict(tipo="1:1", imovel_id=real[0]["id"], qtd=len(imoveis), real=len(real))
        elif len(real) == 0 and len(imoveis) == 1 and placeholders:
            classificacao[cid] = dict(tipo="placeholder", imovel_id=None, qtd=1, real=0)
        elif len(real) == 0:
            classificacao[cid] = dict(tipo="sem_imovel_real", imovel_id=None, qtd=len(imoveis), real=0)
        else:
            classificacao[cid] = dict(tipo="N", imovel_id=None, qtd=len(real), real=len(real))

    return clientes, cc_to_cliente, classificacao, imoveis_por_cliente


def resolve_cliente_from_lanc(lanc, cc_to_cliente):
    cc = parse_cc_cli(lanc.get("descricao_detalhada") or "")
    if cc is not None and cc in cc_to_cliente:
        return cc_to_cliente[cc], cc
    if lanc.get("cliente_id"):
        return lanc["cliente_id"], cc
    return None, cc


def fetch_unlinked_debitos(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, cliente_id, valor, data_lancamento, processo_id,
                   descricao, descricao_detalhada
            FROM financeiro_lancamento
            WHERE status = 'ATIVO' AND natureza = 'DEBITO' AND imovel_id IS NULL
            """
        )
        return cur.fetchall()


def fase_a(conn, outdir):
    clientes, cc_to_cliente, classificacao, _ = load_cliente_map(conn)
    deb = fetch_unlinked_debitos(conn)

    clientes_11 = {cid for cid, c in classificacao.items() if c["tipo"] == "1:1"}
    clientes_n = {cid for cid, c in classificacao.items() if c["tipo"] == "N"}
    clientes_ph = {cid for cid, c in classificacao.items() if c["tipo"] == "placeholder"}

    stats = Counter()
    lanc_stats = Counter()
    for l in deb:
        if not is_conta(l["descricao"], l.get("descricao_detalhada")):
            continue
        stats["conta_desvinculado_total"] += 1
        cid, cc = resolve_cliente_from_lanc(l, cc_to_cliente)
        if cid is None:
            lanc_stats["sem_cc_cli"] += 1
            continue
        cls = classificacao.get(cid, {}).get("tipo", "sem_imovel_cadastro")
        if cls == "1:1":
            lanc_stats["cliente_1_1"] += 1
        elif cls == "N":
            lanc_stats["cliente_N"] += 1
        elif cls == "placeholder":
            lanc_stats["cliente_placeholder"] += 1
        else:
            lanc_stats["cliente_sem_imovel"] += 1

    print("\n=== FASE A — mapa CC_CLI -> imóvel (read-only) ===")
    print("  Ligação confirmada: [CC_CLI:N] = CAST(cliente.codigo_cliente AS UNSIGNED)")
    print("                      -> cliente.id -> imovel.cliente_id (ativo=1)")
    print(f"  Clientes com imóvel ativo no cadastro: {len(classificacao)}")
    print(f"    1:1 elegível:     {len(clientes_11)} clientes")
    print(f"    N (2+ imóveis):   {len(clientes_n)} clientes")
    print(f"    placeholder:      {len(clientes_ph)} clientes (único imóvel sem cadastro)")
    print(f"  Débitos CONTA desvinculados: {stats['conta_desvinculado_total']}")
    print(f"    CC_CLI cliente 1:1 elegível:  {lanc_stats['cliente_1_1']}")
    print(f"    CC_CLI cliente N:               {lanc_stats['cliente_N']}")
    print(f"    CC_CLI cliente placeholder:     {lanc_stats['cliente_placeholder']}")
    print(f"    CC_CLI sem imóvel real:         {lanc_stats['cliente_sem_imovel']}")
    print(f"    CONTA sem CC_CLI resolvível:    {lanc_stats['sem_cc_cli']}")

    path = os.path.join(outdir, "fase_a_cliente_map.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["cliente_id", "codigo_cliente", "cc_cli_num", "classificacao", "qtd_imoveis_reais", "imovel_id_1_1", "nome"])
        for cid in sorted(classificacao):
            c = classificacao[cid]
            cl = clientes[cid]
            w.writerow([cid, cl["codigo_cliente"], cl["cc_cli_num"], c["tipo"], c.get("real", c["qtd"]),
                        c.get("imovel_id") or "", cl.get("nome_referencia") or ""])
    print(f"  Mapa clientes: {path}")
    return clientes, cc_to_cliente, classificacao


def fase_b(conn, outdir, classificacao, cc_to_cliente, clientes, apply=False):
    deb = fetch_unlinked_debitos(conn)
    propostas = []
    for l in deb:
        if not is_conta(l["descricao"], l.get("descricao_detalhada")):
            continue
        cid, cc = resolve_cliente_from_lanc(l, cc_to_cliente)
        if cid is None:
            continue
        cls = classificacao.get(cid) or {}
        if cls.get("tipo") != "1:1":
            continue
        imovel_id = cls["imovel_id"]
        propostas.append(dict(
            lancamento_id=l["id"],
            imovel_id=imovel_id,
            cliente_id=cid,
            cc_cli=cc or "",
            tipo_conta=tipo_conta(l["descricao"], l.get("descricao_detalhada")),
            valor=l["valor"],
            data_lancamento=l["data_lancamento"],
            processo_id=l["processo_id"] or "",
            descricao=(l["descricao"] or "")[:100],
            detalhada=(l.get("descricao_detalhada") or "")[:120],
        ))

    csv_path = os.path.join(outdir, "vinculo_cliente.csv")
    cols = ["lancamento_id", "imovel_id", "cliente_id", "cc_cli", "tipo_conta",
            "valor", "data_lancamento", "processo_id", "descricao", "detalhada"]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for p in propostas:
            w.writerow(p)

    by_imovel = Counter(p["imovel_id"] for p in propostas)
    by_tipo = Counter(p["tipo_conta"] for p in propostas)

    print(f"\n=== FASE B — vincular CONTA clientes 1:1 ({'APPLY' if apply else 'DRY-RUN'}) ===")
    print(f"  Propostas: {len(propostas)} -> {csv_path}")
    print("  Por imóvel:")
    for iid, n in sorted(by_imovel.items(), key=lambda x: (-x[1], x[0])):
        print(f"    imovel {iid:>3}: {n}")
    print("  Por tipo de conta:")
    for t, n in by_tipo.most_common():
        print(f"    {t:16}: {n}")

    if apply:
        with conn.cursor() as cur:
            cur.execute("START TRANSACTION")
            n = 0
            for p in propostas:
                cur.execute(
                    """
                    UPDATE financeiro_lancamento SET imovel_id = %s
                    WHERE id = %s AND imovel_id IS NULL
                      AND status = 'ATIVO' AND natureza = 'DEBITO'
                    """,
                    (p["imovel_id"], p["lancamento_id"]),
                )
                n += cur.rowcount
            if n != len(propostas):
                cur.execute("ROLLBACK")
                raise RuntimeError(f"Fase B: esperado {len(propostas)}, aplicou {n}")
            cur.execute("COMMIT")
        print(f"  [APLICADO] {n} lançamentos")
    return propostas


def fase_c(conn, apply=False):
    print(f"\n=== FASE C — corrigir 3 conflitos integridade ({'APPLY' if apply else 'DRY-RUN'}) ===")
    with conn.cursor() as cur:
        for lid, (wrong, right) in INTEGRITY_FIXES.items():
            cur.execute(
                "SELECT id, imovel_id, LEFT(descricao_detalhada,80) d FROM financeiro_lancamento WHERE id=%s",
                (lid,),
            )
            r = cur.fetchone()
            print(f"  {lid}: atual={r['imovel_id']} -> {right} | {r['d'][:70] if r else '?'}")

    if not apply:
        return
    with conn.cursor() as cur:
        cur.execute("START TRANSACTION")
        n = 0
        for lid, (wrong, right) in INTEGRITY_FIXES.items():
            cur.execute(
                """
                UPDATE financeiro_lancamento SET imovel_id = %s
                WHERE id = %s AND imovel_id = %s
                  AND status = 'ATIVO' AND natureza = 'DEBITO'
                """,
                (right, lid, wrong),
            )
            n += cur.rowcount
        if n != 3:
            cur.execute("ROLLBACK")
            raise RuntimeError(f"Fase C: esperado 3, obteve {n}")
        cur.execute("COMMIT")
    print(f"  [APLICADO] {n} correções")


def extract_unit_labels(text):
    t = norm(text)
    labels = set()
    for m in re.finditer(r"\b(?:iptu|agua|água|gas|gás|energia|condominio)\s+(\d{3,4})\s*[- ]?\s*([abc])\b", t):
        labels.add(f"{m.group(1)}-{m.group(2).upper()}")
    for m in re.finditer(r"\b(\d{3,4})\s*[- ]\s*([ABC])\b", text, re.I):
        labels.add(f"{m.group(1)}-{m.group(2).upper()}")
    if re.search(r"\b505\s*[- ]?a\b", t):
        labels.add("505-A")
    if re.search(r"\b404\b", t) and "sao jose" in t:
        labels.add("404 São José")
    return labels


def fase_d(conn, outdir, classificacao, cc_to_cliente, clientes):
    imoveis = fetch_imoveis(conn)
    overrides = {**IMOVEL_OVERRIDES, "505-A": 65, "503-A": 79, "101-C": 70, "404 São José": 72}
    deb = fetch_unlinked_debitos(conn)
    rows = []

    for l in deb:
        if not is_conta(l["descricao"], l.get("descricao_detalhada")):
            continue
        cid, cc = resolve_cliente_from_lanc(l, cc_to_cliente)
        cls = classificacao.get(cid, {}) if cid else {}
        qtd_im = cls.get("real", cls.get("qtd", 0)) if cid else ""
        cliente_nome = (clientes.get(cid, {}) or {}).get("nome_referencia") or ""
        labels = extract_unit_labels((l["descricao"] or "") + " " + (l.get("descricao_detalhada") or ""))
        imovel_cand = ""
        motivo = ""

        if cid and cls.get("tipo") == "N":
            motivo = "CC_CLI cliente multi-imóvel (N)"
            imovel_cand = f"{cls.get('real')} imóveis"
        elif cid and cls.get("tipo") == "placeholder":
            motivo = "CC_CLI cliente placeholder (cadastro vazio)"
        elif cid is None:
            if labels:
                mapping = resolve_imoveis(labels, imoveis, overrides)
                ids = {mapping[lb]["imovel_id"] for lb in labels if lb in mapping and mapping[lb].get("score", 0) >= 0.55}
                if len(ids) == 1:
                    imovel_cand = str(next(iter(ids)))
                    motivo = "sem CC_CLI; unidade na descrição mas não vinculado (revisão manual)"
                else:
                    motivo = "sem CC_CLI; unidade ambígua ou não resolvida"
            else:
                motivo = "sem CC_CLI e sem unidade explícita na descrição"
        elif cls.get("tipo") == "1:1":
            continue  # elegível Fase B, não quase-vínculo
        else:
            motivo = "CC_CLI sem imóvel real no cadastro"

        rows.append(dict(
            id=l["id"],
            data=l["data_lancamento"],
            valor=l["valor"],
            tipo_conta=tipo_conta(l["descricao"], l.get("descricao_detalhada")),
            descricao=(l["descricao"] or "")[:100],
            detalhada=(l.get("descricao_detalhada") or "")[:140],
            cc_cli=cc or "",
            cliente=f"{cid or ''} {cliente_nome}".strip(),
            qtd_imoveis_cliente=qtd_im,
            imovel_candidato=imovel_cand,
            motivo_nao_vinculo=motivo,
        ))

    # Fase 3 REVISAR conhecidos (valor exato, descrição não confirmou)
    revisar_extra = [
        (176684, "453.95", "101-C", "176684 proc NULL — água 101-C confirmada manualmente, já vinculado?"),
        (207213, "453.95", "101-C", "207213 valor exato 453,95 — múltiplos candidatos / proc errado"),
    ]
    with conn.cursor() as cur:
        for lid, val, hint, mot in revisar_extra:
            cur.execute(
                "SELECT id, imovel_id, data_lancamento, valor, descricao, descricao_detalhada, cliente_id "
                "FROM financeiro_lancamento WHERE id=%s", (lid,),
            )
            r = cur.fetchone()
            if not r or r["imovel_id"] is not None:
                continue
            cc = parse_cc_cli(r.get("descricao_detalhada") or "")
            rows.append(dict(
                id=r["id"], data=r["data_lancamento"], valor=r["valor"],
                tipo_conta="agua" if "101" in hint else "conta",
                descricao=(r["descricao"] or "")[:100],
                detalhada=(r.get("descricao_detalhada") or "")[:140],
                cc_cli=cc or "", cliente=str(r.get("cliente_id") or ""),
                qtd_imoveis_cliente="", imovel_candidato=hint,
                motivo_nao_vinculo=f"Fase3 REVISAR: {mot}",
            ))

    # relatorio valores conhecidos desvinculados
    for val_str, hint, tipo in FASE3_REVISAR_VALORES:
        v = parse_valor(val_str)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, imovel_id, data_lancamento, valor, descricao, descricao_detalhada, cliente_id
                FROM financeiro_lancamento
                WHERE status='ATIVO' AND natureza='DEBITO' AND imovel_id IS NULL AND valor=%s
                """, (str(v),),
            )
            cands = cur.fetchall()
        if len(cands) == 0:
            continue
        for r in cands:
            if any(x["id"] == r["id"] for x in rows):
                continue
            cc = parse_cc_cli(r.get("descricao_detalhada") or "")
            mot = "Fase3 REVISAR: valor exato sem confirmação descrição"
            if len(cands) >= 2:
                mot += f"; {len(cands)} candidatos"
            rows.append(dict(
                id=r["id"], data=r["data_lancamento"], valor=r["valor"],
                tipo_conta=tipo, descricao=(r["descricao"] or "")[:100],
                detalhada=(r.get("descricao_detalhada") or "")[:140],
                cc_cli=cc or "", cliente=str(r.get("cliente_id") or ""),
                qtd_imoveis_cliente="", imovel_candidato=hint,
                motivo_nao_vinculo=mot,
            ))

    rows.sort(key=lambda r: (str(r["cliente"]), str(r["valor"])))
    path = os.path.join(outdir, "quase_vinculos.csv")
    cols = ["id", "data", "valor", "tipo_conta", "descricao", "detalhada", "cc_cli",
            "cliente", "qtd_imoveis_cliente", "imovel_candidato", "motivo_nao_vinculo"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)

    by_mot = Counter(r["motivo_nao_vinculo"].split(";")[0].strip() for r in rows)
    print(f"\n=== FASE D — quase_vinculos.csv ===")
    print(f"  Linhas: {len(rows)} -> {path}")
    print("  Por motivo_nao_vinculo:")
    for m, n in by_mot.most_common():
        print(f"    {n:5}  {m}")
    return rows, path


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
    print(f"\n=== REPORTE FINAL ===")
    print(f"  Com imóvel: {com}")
    for r in por:
        print(f"    imovel {r['imovel_id']:>3}: {r['n']}")
    return com, por


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fase", default="all", help="A, B, C, D, all, ou all-apply")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--outdir", default=".")
    args = ap.parse_args()
    base = os.path.dirname(__file__) or "."
    outdir = args.outdir if os.path.isabs(args.outdir) else os.path.join(base, args.outdir)

    conn = connect()
    try:
        clientes, cc_to_cliente, classificacao, _ = load_cliente_map(conn)

        if args.fase in ("A", "all", "all-apply"):
            clientes, cc_to_cliente, classificacao = fase_a(conn, outdir)

        if args.fase in ("B", "all", "all-apply"):
            fase_b(conn, outdir, classificacao, cc_to_cliente, clientes,
                   apply=args.apply or args.fase == "all-apply")

        if args.fase in ("C", "all-apply") and (args.apply or args.fase == "all-apply"):
            fase_c(conn, apply=True)
        elif args.fase == "C":
            fase_c(conn, apply=args.apply)

        if args.fase in ("D", "all", "all-apply"):
            fase_d(conn, outdir, classificacao, cc_to_cliente, clientes)

        if args.fase in ("all-apply",) or (args.apply and args.fase in ("B", "C")):
            report_final(conn)
        elif args.fase == "all":
            report_final(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
