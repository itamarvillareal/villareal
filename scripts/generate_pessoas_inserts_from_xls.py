#!/usr/bin/env python3
"""Gera SQL de INSERT (pessoa, pessoa_complementar, pessoa_endereco) a partir da planilha."""
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("Instale: pip install pandas xlrd", file=sys.stderr)
    sys.exit(1)

XLS = Path("/Users/itamarvillarealjunior/Downloads/Cadastro Pessoas - Itamar.xls")
OUT = Path(__file__).resolve().parent / "import_cadastro_pessoas_itamar.sql"


def only_digits(s):
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    return re.sub(r"\D", "", str(s))


def sql_str(s, maxlen=None):
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return "NULL"
    t = str(s).strip()
    if not t:
        return "NULL"
    if maxlen:
        t = t[:maxlen]
    return "'" + t.replace("'", "''").replace("\\", "\\\\") + "'"


def parse_date(v):
    if pd.isna(v):
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    s = str(v).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:19], fmt).date().isoformat()
        except ValueError:
            continue
    return None


def main():
    df = pd.read_excel(XLS, sheet_name="Plan1", header=None, engine="xlrd")
    data = df.iloc[10:]
    rows = []
    for _, row in data.iterrows():
        rid = row[0]
        if pd.isna(rid) or str(rid).strip() == "":
            continue
        try:
            pid = int(float(rid))
        except (ValueError, TypeError):
            continue
        nome = str(row[1]).strip() if pd.notna(row[1]) else ""
        if not nome:
            continue
        doc = only_digits(row[3])
        if not doc:
            continue
        if len(doc) > 14:
            doc = doc[:14]
        email = str(row[12]).strip() if pd.notna(row[12]) else ""
        email = email if email else None
        tel = ""
        for c in (18, 20, 22, 24):
            if c < len(row) and pd.notna(row[c]) and str(row[c]).strip():
                tel = re.sub(r"\s+", " ", str(row[c]).strip())[:40]
                break
        dn = parse_date(row[8])
        gen = str(row[2]).strip().upper()[:8] if pd.notna(row[2]) else ""
        genero = gen if gen else None
        rg = str(row[6]).strip()[:40] if pd.notna(row[6]) else None
        if rg == "":
            rg = None
        oe = str(row[7]).strip()[:120] if pd.notna(row[7]) else None
        if oe == "":
            oe = None
        prof = str(row[11]).strip()[:255] if pd.notna(row[11]) else None
        if prof == "":
            prof = None
        nac = str(row[9]).strip()[:120] if pd.notna(row[9]) else None
        if nac == "":
            nac = None
        ec = str(row[10]).strip()[:40] if pd.notna(row[10]) else None
        if ec == "":
            ec = None
        rua = str(row[17]).strip()[:255] if pd.notna(row[17]) else ""
        if not rua:
            rua = "S/N"
        bairro = str(row[13]).strip()[:120] if pd.notna(row[13]) else None
        if bairro == "":
            bairro = None
        uf = str(row[14]).strip()[:2].upper() if pd.notna(row[14]) else None
        if uf == "":
            uf = None
        cidade = str(row[15]).strip()[:120] if pd.notna(row[15]) else None
        if cidade == "":
            cidade = None
        cep_raw = only_digits(row[16])
        cep = cep_raw[:8] if cep_raw else None
        rows.append(
            {
                "pid": pid,
                "nome": nome[:255],
                "doc": doc,
                "email": email,
                "tel": tel,
                "dn": dn,
                "genero": genero,
                "rg": rg,
                "oe": oe,
                "prof": prof,
                "nac": nac,
                "ec": ec,
                "rua": rua,
                "bairro": bairro,
                "uf": uf,
                "cidade": cidade,
                "cep": cep,
            }
        )

    by_doc = defaultdict(list)
    for r in rows:
        by_doc[r["doc"]].append(r)
    for lst in by_doc.values():
        lst.sort(key=lambda x: x["pid"])

    seen_email = set()
    lines = [
        "-- Importação manual: Cadastro Pessoas - Itamar.xls (Plan1)",
        "-- Gera: INSERT em pessoa, pessoa_complementar, pessoa_endereco",
        "--",
        "-- ATENÇÃO: a planilha usa id=1..N. Se já existir pessoa id=1 (ex.: vínculo ao usuário),",
        "-- faça backup, apague/atualize conflitos ou edite os IDs antes de executar.",
        "--",
        "-- Coluna cpf: CPF/CNPJ apenas dígitos (até 14). E-mails repetidos viram NULL na 2ª ocorrência.",
        "-- CPF/CNPJ duplicado na planilha: só a linha com menor ID é importada.",
        "",
        "SET NAMES utf8mb4;",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "",
    ]

    now = "CURRENT_TIMESTAMP"
    kept = 0
    for r in rows:
        siblings = by_doc[r["doc"]]
        if r["pid"] != siblings[0]["pid"]:
            continue
        em = r["email"]
        if em:
            el = em.strip().lower()
            if el in seen_email:
                em = None
            else:
                seen_email.add(el)
        email_sql = sql_str(em, 255) if em else "NULL"
        tel_sql = sql_str(r["tel"], 40) if r["tel"] else "NULL"
        dn_sql = sql_str(r["dn"], 10) if r["dn"] else "NULL"  # 'YYYY-MM-DD' para coluna DATE
        lines.append(
            f"INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at) VALUES "
            f"({r['pid']}, {sql_str(r['nome'], 255)}, {sql_str(r['doc'], 14)}, {email_sql}, {tel_sql}, {dn_sql}, TRUE, FALSE, NULL, {now}, {now});"
        )
        lines.append(
            f"INSERT INTO pessoa_complementar (pessoa_id, rg, orgao_expedidor, profissao, nacionalidade, estado_civil, genero) VALUES "
            f"({r['pid']}, {sql_str(r['rg'], 40)}, {sql_str(r['oe'], 120)}, {sql_str(r['prof'], 255)}, "
            f"{sql_str(r['nac'], 120)}, {sql_str(r['ec'], 40)}, {sql_str(r['genero'], 8)});"
        )
        cep_sql = sql_str(r["cep"], 8) if r["cep"] else "NULL"
        lines.append(
            f"INSERT INTO pessoa_endereco (pessoa_id, numero_ordem, rua, bairro, estado, cidade, cep, auto_preenchido) VALUES "
            f"({r['pid']}, 1, {sql_str(r['rua'], 255)}, {sql_str(r['bairro'], 120)}, {sql_str(r['uf'], 2)}, "
            f"{sql_str(r['cidade'], 120)}, {cep_sql}, FALSE);"
        )
        lines.append("")
        kept += 1

    lines.append("SET FOREIGN_KEY_CHECKS = 1;")
    lines.append("")
    lines.append(f"-- Total de registros INSERT (1 por CPF/CNPJ, menor id da planilha): {kept}")
    dup = sum(1 for v in by_doc.values() if len(v) > 1)
    lines.append(f"-- Grupos de documento duplicado na planilha (demais linhas ignoradas): {dup}")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Escrito: {OUT} ({len(lines)} linhas)")


if __name__ == "__main__":
    main()
