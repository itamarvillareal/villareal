#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply 6 cross-ref UNICO + dry-run unidade explícita em quase_vinculos."""
import csv
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from vinculo_cliente import parse_cc_cli, load_cliente_map, is_placeholder, tipo_conta
from vincular_imoveis import connect, strip_accents, IMOVEL_OVERRIDES

APPLY_MAP = {
    166011: 21,
    216268: 21,
    216269: 21,
    216170: 6,
    216171: 6,
    216172: 6,
}

OVERRIDES = {
    **IMOVEL_OVERRIDES,
    "505-A": 65, "505 A": 65, "101-C": 70, "101 C": 70,
    "1101-C": 73, "1101 C": 73, "503-A": 79, "503 A": 62,
    "404-A": 72, "404 A": 72, "403-A": None,  # duplicata cadastro — desempate cliente
    "403 A": None,
}


def norm(s):
    return strip_accents(str(s or "")).lower()


def extract_unit_codes(text):
    """Retorna set de chaves 'NNN-L' encontradas explicitamente."""
    codes = set()
    t = text
    tn = norm(text)
    patterns = [
        r"\b(?:iptu|agua|água|energia|gas|gás|cond(?:ominio)?|saneamento|taxa|apto|apt|unidade|bloco)\s+(\d{3,4})\s*[- ]?\s*([abc])\b",
        r"\b(\d{3,4})\s*[- ]\s*([abc])\b",
        r"\b(\d{3,4})\s+([abc])\b",
    ]
    for pat in patterns:
        for m in re.finditer(pat, t, re.I):
            codes.add(f"{m.group(1)}-{m.group(2).upper()}")
    # padrões tipo "904 B -" ou "- 904 B -"
    for m in re.finditer(r"(?:^|[\s\-])(\d{3,4})\s+([abc])(?:\s|$|[\-,])", tn):
        codes.add(f"{m.group(1)}-{m.group(2).upper()}")
    for m in re.finditer(r"categoria planilha:\s*(\d{3,4})\s*([abc])\b", tn):
        codes.add(f"{m.group(1)}-{m.group(2).upper()}")
    return codes


def imovel_keys_from_record(im):
    keys = set()
    for f in ("unidade", "titulo", "condominio", "endereco_completo"):
        txt = norm(im.get(f) or "")
        for m in re.finditer(r"\b(\d{3,4})\s*[- ]?\s*([abc])\b", txt):
            keys.add(f"{m.group(1)}-{m.group(2).upper()}")
    return keys


def build_unit_index(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, cliente_id, unidade, condominio, titulo, endereco_completo, ativo
            FROM imovel WHERE ativo = 1
            """
        )
        imoveis = cur.fetchall()
    by_code = defaultdict(list)
    by_id = {}
    for im in imoveis:
        if is_placeholder(im):
            continue
        by_id[im["id"]] = im
        for k in imovel_keys_from_record(im):
            by_code[k].append(im["id"])
    for k in by_code:
        by_code[k] = sorted(set(by_code[k]))
    return by_code, by_id


def resolve_cliente_id(row, cc_to_cliente):
    cliente_col = (row.get("cliente") or "").strip().split()
    if cliente_col and cliente_col[0].isdigit():
        return int(cliente_col[0])
    cc = row.get("cc_cli") or ""
    if str(cc).isdigit():
        return cc_to_cliente.get(int(cc))
    return None


def propose_imovel(codes, cliente_id, by_code, by_id):
    if not codes:
        return "", "", "SEM_CODIGO", ""
    if len(codes) > 1:
        return "", ";".join(sorted(codes)), "REVISAR", "multiplos codigos na descricao"

    code = next(iter(codes))
    candidates = by_code.get(code, [])

    if not candidates:
        label_space = code.replace("-", " ")
        ov = OVERRIDES.get(code) or OVERRIDES.get(label_space)
        if ov is not None:
            return str(ov), str(ov), "ALTA", f"override {code} (sem index cadastro)"
        return "", code, "SEM_CODIGO", "codigo sem imovel real no cadastro"

    if len(candidates) == 1:
        return str(candidates[0]), str(candidates[0]), "ALTA", f"unico cadastro {code}"

    poss = ";".join(str(x) for x in candidates)
    if cliente_id:
        owned = [i for i in candidates if by_id[i].get("cliente_id") == cliente_id]
        if len(owned) == 1:
            return str(owned[0]), poss, "ALTA", f"desempate cliente {cliente_id} para {code}"
        if len(owned) >= 2:
            return "", poss, "REVISAR", f"duplicata cadastro {code}; cliente possui {len(owned)}"
    return "", poss, "REVISAR", f"duplicata cadastro {code} ({len(candidates)} imoveis)"


def apply_six(conn):
    with conn.cursor() as cur:
        cur.execute("START TRANSACTION")
        n = 0
        for lid, iid in APPLY_MAP.items():
            cur.execute(
                """
                UPDATE financeiro_lancamento SET imovel_id = %s
                WHERE id = %s AND imovel_id IS NULL
                  AND status = 'ATIVO' AND natureza = 'DEBITO'
                """,
                (iid, lid),
            )
            n += cur.rowcount
        cur.execute("COMMIT")
    return n


def remove_from_quase(outdir, remove_ids):
    path = os.path.join(outdir, "quase_vinculos.csv")
    remove = set(remove_ids)
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        fieldnames = reader.fieldnames
        for row in reader:
            if int(row["id"]) not in remove:
                rows.append(row)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";")
        w.writeheader()
        w.writerows(rows)
    return path, len(remove)


def write_apply_log(conn, outdir):
    path = os.path.join(outdir, "cross_ref_6_aplicado.csv")
    ids = list(APPLY_MAP.keys())
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, valor, data_lancamento, imovel_id, LEFT(descricao_detalhada,100) det
            FROM financeiro_lancamento WHERE id IN ({','.join(map(str, ids))})
            ORDER BY imovel_id, id
            """
        )
        rows = cur.fetchall()
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["lancamento_id", "imovel_id", "valor", "data", "detalhada"])
        for r in rows:
            w.writerow([r["id"], r["imovel_id"], r["valor"], r["data_lancamento"], r["det"] or ""])
    return path, rows


def run_unidade_dry_run(outdir, conn):
    _, cc_to_cliente, _, _ = load_cliente_map(conn)
    by_code, by_id = build_unit_index(conn)

    qv_path = os.path.join(outdir, "quase_vinculos.csv")
    out_path = os.path.join(outdir, "unidade_explicita_proposta.csv")
    stats = Counter()

    with open(qv_path, newline="", encoding="utf-8") as f:
        qv_rows = list(csv.DictReader(f, delimiter=";"))

    out_rows = []
    for row in qv_rows:
        texto = f"{row.get('descricao') or ''} {row.get('detalhada') or ''}"
        codes = extract_unit_codes(texto)
        cid = resolve_cliente_id(row, cc_to_cliente)
        prop, poss, conf, nota = propose_imovel(codes, cid, by_code, by_id)
        stats["total"] += 1
        stats[conf] += 1
        if codes:
            stats["com_codigo"] += 1
        out_rows.append(dict(
            conta_id=row["id"],
            valor=row["valor"],
            tipo=row.get("tipo_conta") or tipo_conta(row.get("descricao"), row.get("detalhada")),
            codigo_na_descricao=";".join(sorted(codes)) if codes else "",
            imovel_proposto=prop,
            imoveis_possiveis=poss if poss and prop != poss else (poss if conf == "REVISAR" else ""),
            cliente=row.get("cliente") or "",
            confianca=conf,
            nota=nota,
        ))

    cols = ["conta_id", "valor", "tipo", "codigo_na_descricao", "imovel_proposto",
            "imoveis_possiveis", "cliente", "confianca", "nota"]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";")
        w.writeheader()
        w.writerows(out_rows)

    return out_path, stats, len(qv_rows)


def main():
    outdir = os.path.dirname(__file__) or "."
    conn = connect()

    n = apply_six(conn)
    log_path, applied = write_apply_log(conn, outdir)
    qv_path, removed = remove_from_quase(outdir, APPLY_MAP.keys())

    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) c FROM financeiro_lancamento "
            "WHERE imovel_id IS NOT NULL AND status='ATIVO' AND natureza='DEBITO'"
        )
        total = cur.fetchone()["c"]
        cur.execute(
            "SELECT imovel_id, COUNT(*) c FROM financeiro_lancamento "
            "WHERE id IN (%s) GROUP BY imovel_id"
            % ",".join(map(str, APPLY_MAP.keys()))
        )
        by_im = {r["imovel_id"]: r["c"] for r in cur.fetchall()}

    unit_path, stats, qv_total = run_unidade_dry_run(outdir, conn)
    conn.close()

    print(f"=== APPLY 6 cross-ref ===")
    print(f"  Atualizados: {n} (esperado 6)")
    print(f"  imovel 6: {by_im.get(6, 0)} | imovel 21: {by_im.get(21, 0)}")
    print(f"  total com imovel: {total} (esperado 184)")
    print(f"  removidos quase_vinculos: {removed}")
    print(f"  log: {log_path}")
    print(f"=== DRY-RUN unidade explícita ({qv_total} linhas quase_vinculos) ===")
    print(f"  com codigo explicito: {stats.get('com_codigo', 0)}")
    print(f"  ALTA (1 imovel): {stats.get('ALTA', 0)}")
    print(f"  REVISAR (duplicata/ambiguo): {stats.get('REVISAR', 0)}")
    print(f"  SEM_CODIGO: {stats.get('SEM_CODIGO', 0)}")
    print(f"  proposta: {unit_path}")


if __name__ == "__main__":
    main()
