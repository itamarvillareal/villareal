#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Checagem exatidão 171 ALTA + apply limpos + cadastro_pendencias."""
import csv
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from unidade_explicita import extract_unit_codes, norm
from vincular_imoveis import connect

# Padrões com contexto explícito de unidade
RE_KEYWORD = re.compile(
    r"\b(?:iptu|agua|água|energia|gas|gás|cond(?:ominio)?|saneamento|taxa|apto|apt|unidade|bloco|veredas|parque|bosque)\s+(\d{3,4})\s*[- ]?\s*([abc])\b",
    re.I,
)
RE_PLANILHA = re.compile(r"categoria planilha:\s*(\d{3,4})\s*([abc])\b", re.I)
RE_EXPLICIT = re.compile(r"\b(\d{3,4})\s*[- ]\s*([abc])\b", re.I)
RE_SPACE = re.compile(r"(?:^|[\s\-])(\d{3,4})\s+([abc])(?:\s|$|[\-,])", re.I)


def code_from_unidade_field(unidade):
    """Único código NNN-L derivado SOMENTE de imovel.unidade."""
    if not (unidade or "").strip():
        return None
    m = re.search(r"\b(\d{3,4})\s*[- ]?\s*([abc])\b", norm(unidade), re.I)
    if not m:
        return None
    return f"{m.group(1)}-{m.group(2).upper()}"


def extract_with_sources(text):
    """Retorna lista (code, source) — source indica proveniência."""
    found = []
    tn = norm(text)
    seen = set()

    def add(code, src, start, end):
        c = f"{code[0]}-{code[1].upper()}"
        key = (c, src, start)
        if key in seen:
            return
        seen.add(key)
        found.append((c, src, start, end))

    for m in RE_KEYWORD.finditer(text):
        add((m.group(1), m.group(2)), "KEYWORD", m.start(), m.end())
    for m in RE_PLANILHA.finditer(tn):
        add((m.group(1), m.group(2)), "PLANILHA", m.start(), m.end())
    for m in RE_EXPLICIT.finditer(text):
        add((m.group(1), m.group(2)), "EXPLICIT_DASH", m.start(), m.end())
    for m in RE_SPACE.finditer(tn):
        add((m.group(1), m.group(2)), "SPACE", m.start(), m.end())
    return found


def is_non_unit_source(text, code, sources_for_code, valor_str):
    flags = []
    all_codes = {s[0] for s in sources_for_code}
    if len(all_codes) > 1:
        flags.append("multi_codigo_descricao")

    srcs = [s for s in sources_for_code if s[0] == code]
    good = any(s[1] in ("KEYWORD", "PLANILHA", "EXPLICIT_DASH") for s in srcs)
    if not good:
        # SPACE/loose: exige palavra de contexto imobiliário num raio de 25 chars
        for _, src, start, end in srcs:
            if src == "SPACE":
                ctx = norm(text[max(0, start - 25): end + 10])
                if not re.search(
                    r"\b(veredas|parque|bosque|energia|iptu|agua|gas|cond|unidade|apto|apt|bloco|aloisio|gilberto|taxa)\b",
                    ctx,
                ):
                    flags.append("fonte_loose_sem_contexto")

    # número do código embutido em decimal do valor (ex. valor 503,78 + código 503-A sem contexto)
    num = code.split("-")[0]
    if valor_str:
        vs = str(valor_str).replace(",", ".")
        if re.search(rf"\b{num}\.\d{{2}}\b", vs) and "fonte_loose_sem_contexto" in flags:
            flags.append("codigo_de_valor")

    # ID interno tipo "6503 ·" — dígitos antes de ·
    if re.search(rf"\b{num}\d?\s*·", text) and not good:
        flags.append("codigo_de_id_interno")

    return flags


def load_quase_by_id(outdir):
    path = os.path.join(outdir, "quase_vinculos.csv")
    by_id = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter=";"):
            by_id[row["id"]] = row
    return by_id


def load_imoveis(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT id, unidade, condominio FROM imovel WHERE ativo = 1")
        return {r["id"]: r for r in cur.fetchall()}


def validate_and_apply(outdir, apply=True):
    prop_path = os.path.join(outdir, "unidade_explicita_proposta.csv")
    qv = load_quase_by_id(outdir)
    conn = connect()
    imoveis = load_imoveis(conn)

    alta_rows = []
    with open(prop_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter=";"):
            if row["confianca"] == "ALTA" and row["imovel_proposto"]:
                alta_rows.append(row)

    checks = []
    limpos = []
    flagados = []

    for prop in alta_rows:
        lid = prop["conta_id"]
        qrow = qv.get(lid, {})
        texto = f"{qrow.get('descricao') or ''} {qrow.get('detalhada') or ''}"
        code = prop["codigo_na_descricao"]
        iid = int(prop["imovel_proposto"])
        im = imoveis.get(iid, {})
        unidade_campo = im.get("unidade") or ""
        code_unidade = code_from_unidade_field(unidade_campo)

        sources = extract_with_sources(texto)
        src_codes = extract_unit_codes(texto)
        flags = []

        if len(src_codes) > 1:
            flags.append("multi_codigo_descricao")
        if code_unidade != code:
            flags.append("codigo!=imovel.unidade")
        flags.extend(is_non_unit_source(texto, code, sources, prop.get("valor")))

        flags = sorted(set(flags))
        status = "LIMPO" if not flags else "FLAGADO"
        rec = dict(
            conta_id=lid,
            codigo=code,
            imovel_id=iid,
            imovel_unidade=unidade_campo,
            code_unidade_campo=code_unidade or "",
            flags=";".join(flags),
            status=status,
            valor=prop["valor"],
            nota=prop.get("nota") or "",
        )
        checks.append(rec)
        if status == "LIMPO":
            limpos.append(rec)
        else:
            flagados.append(rec)

    # Orphans SEM_CODIGO (código sem imóvel real)
    orphans = []
    with open(prop_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter=";"):
            if row["confianca"] != "SEM_CODIGO":
                continue
            qrow = qv.get(row["conta_id"], {})
            texto = f"{qrow.get('descricao') or ''} {qrow.get('detalhada') or ''}"
            codes = extract_unit_codes(texto)
            if not codes:
                continue
            for c in sorted(codes):
                orphans.append(dict(
                    conta_id=row["conta_id"],
                    codigo=c,
                    valor=row["valor"],
                    cliente=row.get("cliente") or "",
                    detalhada=(qrow.get("detalhada") or "")[:140],
                    motivo="unidade citada sem imovel real no cadastro",
                ))

    check_path = os.path.join(outdir, "unidade_alta_checagem.csv")
    cols = ["conta_id", "codigo", "imovel_id", "imovel_unidade", "code_unidade_campo", "flags", "status", "valor", "nota"]
    with open(check_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";")
        w.writeheader()
        w.writerows(checks)

    flag_path = os.path.join(outdir, "unidade_alta_flagados.csv")
    with open(flag_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";")
        w.writeheader()
        w.writerows(flagados)

    pend_path = os.path.join(outdir, "cadastro_pendencias.csv")
    pend_cols = ["conta_id", "codigo", "valor", "cliente", "detalhada", "motivo"]
    with open(pend_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=pend_cols, delimiter=";")
        w.writeheader()
        w.writerows(orphans)

    applied = 0
    already_linked = 0
    by_imovel = Counter()
    applied_records = []
    if apply and limpos:
        with conn.cursor() as cur:
            cur.execute("START TRANSACTION")
            for rec in limpos:
                cur.execute(
                    """
                    UPDATE financeiro_lancamento SET imovel_id = %s
                    WHERE id = %s AND imovel_id IS NULL
                      AND status = 'ATIVO' AND natureza = 'DEBITO'
                    """,
                    (rec["imovel_id"], rec["conta_id"]),
                )
                if cur.rowcount:
                    applied += 1
                    by_imovel[rec["imovel_id"]] += 1
                    applied_records.append(rec)
                else:
                    cur.execute(
                        "SELECT imovel_id FROM financeiro_lancamento WHERE id=%s",
                        (rec["conta_id"],),
                    )
                    ex = cur.fetchone()
                    if ex and ex["imovel_id"] == rec["imovel_id"]:
                        already_linked += 1
            cur.execute("COMMIT")

        # remove limpos from quase_vinculos (todos validados, aplicados ou já corretos)
        remove_ids = {int(r["conta_id"]) for r in limpos}
        qv_path = os.path.join(outdir, "quase_vinculos.csv")
        kept = []
        with open(qv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=";")
            fn = reader.fieldnames
            for row in reader:
                if int(row["id"]) not in remove_ids:
                    kept.append(row)
        with open(qv_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fn, delimiter=";")
            w.writeheader()
            w.writerows(kept)

        log_path = os.path.join(outdir, "unidade_alta_aplicado.csv")
        with open(log_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["conta_id", "imovel_id", "codigo", "acao"], delimiter=";")
            w.writeheader()
            for rec in applied_records:
                w.writerow(dict(conta_id=rec["conta_id"], imovel_id=rec["imovel_id"], codigo=rec["codigo"], acao="UPDATE"))
            for rec in limpos:
                if rec not in applied_records:
                    w.writerow(dict(conta_id=rec["conta_id"], imovel_id=rec["imovel_id"], codigo=rec["codigo"], acao="JA_VINCULADO"))
    else:
        log_path = ""

    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) c FROM financeiro_lancamento "
            "WHERE imovel_id IS NOT NULL AND status='ATIVO' AND natureza='DEBITO'"
        )
        total_vinc = cur.fetchone()["c"]

    conn.close()

    return dict(
        alta=len(alta_rows),
        limpos=len(limpos),
        flagados=len(flagados),
        applied=applied,
        already_linked=already_linked,
        by_imovel=dict(by_imovel),
        total_vinc=total_vinc,
        orphans=len(orphans),
        check_path=check_path,
        flag_path=flag_path,
        pend_path=pend_path,
        log_path=log_path,
        checks=checks,
        flagados_list=flagados,
    )


def main():
    outdir = os.path.dirname(__file__) or "."
    r = validate_and_apply(outdir, apply=True)

    print("=== CHECAGEM 171 ALTA ===")
    print(f"  LIMPO: {r['limpos']}")
    print(f"  FLAGADO: {r['flagados']}")
    print(f"  checagem: {r['check_path']}")
    if r["flagados"]:
        print(f"  flagados: {r['flag_path']}")

    print("\n=== 10 exemplos LIMPO ===")
    limpos_ex = [c for c in r["checks"] if c["status"] == "LIMPO"][:10]
    for ex in limpos_ex:
        print(f"  {ex['conta_id']} | {ex['codigo']} | imovel {ex['imovel_id']} | {ex['imovel_unidade']}")

    if r["flagados_list"]:
        print("\n=== FLAGADOS (amostra) ===")
        for ex in r["flagados_list"][:5]:
            print(f"  {ex['conta_id']} | {ex['codigo']} | imovel {ex['imovel_id']} | flags: {ex['flags']}")

    print(f"\n=== APPLY ===")
    print(f"  limpos validados: {r['limpos']}")
    print(f"  UPDATE novos: {r['applied']}")
    print(f"  ja vinculados (destino correto): {r.get('already_linked', 0)}")
    print(f"  flagados retidos: {r['flagados']}")
    print(f"  total com imovel: {r['total_vinc']}")
    print(f"  por imovel (top): {dict(sorted(r['by_imovel'].items(), key=lambda x: -x[1])[:15])}")
    print(f"  log: {r['log_path']}")

    print(f"\n=== PENDENCIAS ===")
    print(f"  orfaos cadastro: {r['orphans']} -> {r['pend_path']}")
    print("  216314 (503-A): mantido REVISAR em unidade_explicita_proposta.csv")


if __name__ == "__main__":
    main()
