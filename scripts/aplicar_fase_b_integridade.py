#!/usr/bin/env python3
"""Fase B apply com checagem integridade descricao vs imovel."""
import csv
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from vincular_imoveis import connect, strip_accents

CSV_PATH = "vinculo_cliente.csv"


def norm(s):
    return strip_accents(str(s or "")).lower()


def imovel_unit_keys(im):
    keys = set()
    for field in ("unidade", "titulo", "condominio"):
        t = norm(im.get(field) or "")
        for m in re.finditer(r"\b(\d{3,4})\s*[- ]?\s*([abc])\b", t, re.I):
            keys.add(f"{m.group(1)}-{m.group(2).upper()}")
    return keys


def cited_units(text):
    """Somente códigos explícitos NNN-L / NNN L."""
    t = text  # manter original para regex case
    tn = norm(text)
    found = set()
    patterns = [
        r"\b(?:iptu|agua|água|energia|gas|gás|cond(?:ominio)?|saneamento)\s+(\d{3,4})\s*[- ]?\s*([ABC])\b",
        r"\b(\d{3,4})\s*[- ]\s*([ABC])\b",
        r"\b(\d{3,4})\s+([ABC])\b",
    ]
    for pat in patterns:
        for m in re.finditer(pat, t, re.I):
            found.add(f"{m.group(1)}-{m.group(2).upper()}")
    return found


def imovel_label(im):
    u = im.get("unidade") or im.get("titulo") or "?"
    c = im.get("condominio") or ""
    return f"{u} / {c}".strip(" /")


def main():
    base = os.path.dirname(__file__) or "."
    path = os.path.join(base, CSV_PATH)
    rows = list(csv.DictReader(open(path, encoding="utf-8"), delimiter=";"))

    conn = connect()
    im_cache = {}
    try:
        with conn.cursor() as cur:
            for r in rows:
                iid = int(r["imovel_id"])
                if iid not in im_cache:
                    cur.execute(
                        "SELECT id, unidade, condominio, titulo FROM imovel WHERE id=%s", (iid,)
                    )
                    im_cache[iid] = cur.fetchone()

        retidos = []
        aprovados = []
        for r in rows:
            lid = int(r["lancamento_id"])
            iid = int(r["imovel_id"])
            texto = f"{r.get('descricao','')} | {r.get('detalhada','')}"
            cited = cited_units(texto)
            im = im_cache[iid]
            im_keys = imovel_unit_keys(im)
            if cited and not cited.intersection(im_keys):
                retidos.append(dict(
                    id=lid,
                    texto=texto[:160],
                    imovel_cliente=f"imovel {iid} ({imovel_label(im)})",
                    unidade_citada="; ".join(sorted(cited)),
                ))
            else:
                aprovados.append(r)

        print("=== PASSO 1 — checagem integridade (read-only) ===")
        print(f"  Candidatos: {len(rows)}")
        print(f"  Aprovados:  {len(aprovados)}")
        print(f"  Retidos:    {len(retidos)}")
        if retidos:
            print("\n  Retidos (unidade citada ≠ imóvel do cliente):")
            for x in retidos:
                print(f"    {x['id']} | citado: {x['unidade_citada']} | {x['imovel_cliente']}")
                print(f"      {x['texto'][:120]}")

        with conn.cursor() as cur:
            cur.execute("START TRANSACTION")
            n = 0
            for r in aprovados:
                cur.execute(
                    """
                    UPDATE financeiro_lancamento SET imovel_id = %s
                    WHERE id = %s AND imovel_id IS NULL
                      AND status = 'ATIVO' AND natureza = 'DEBITO'
                    """,
                    (int(r["imovel_id"]), int(r["lancamento_id"])),
                )
                n += cur.rowcount
            if n != len(aprovados):
                cur.execute("ROLLBACK")
                raise RuntimeError(f"Apply: esperado {len(aprovados)}, obteve {n}")
            cur.execute("COMMIT")
        print(f"\n=== PASSO 2 — aplicados: {n} ===")

        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) n FROM financeiro_lancamento "
                "WHERE status='ATIVO' AND natureza='DEBITO' AND imovel_id IS NOT NULL"
            )
            total = cur.fetchone()["n"]
            cur.execute(
                "SELECT imovel_id, COUNT(*) n FROM financeiro_lancamento "
                "WHERE status='ATIVO' AND natureza='DEBITO' AND imovel_id IS NOT NULL "
                "GROUP BY imovel_id ORDER BY n DESC, imovel_id"
            )
            por = cur.fetchall()

        print(f"\n=== PASSO 3 — reporte ===")
        print(f"  Total com imóvel: {total}")
        print("  Por imóvel:")
        for row in por:
            print(f"    imovel {row['imovel_id']:>3}: {row['n']}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
