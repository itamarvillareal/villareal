#!/usr/bin/env python3
"""Gera SQL de INSERT (pessoa, pessoa_complementar, pessoa_endereco) a partir da planilha.

Copia a planilha de origem para um ficheiro temporário dentro de `scripts/`, processa e remove
a cópia ao terminar (sucesso ou erro), para não depender do caminho externo durante a leitura.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
WORK_COPY_XLS = SCRIPT_DIR / ".cadastro_pessoas_import_work.xls"

try:
    import pandas as pd
except ImportError:
    print("Instale: pip install pandas xlrd", file=sys.stderr)
    sys.exit(1)

# Caminhos por defeito (sobrepostos por --xls / env VILAREAL_CADASTRO_PESSOAS_XLS)
_DEFAULT_XLS_CANDIDATES = (
    os.environ.get("VILAREAL_CADASTRO_PESSOAS_XLS"),
    "/Users/itamar/Dropbox/sistema/Cadastro Pessoas - Itamar.xls",
    "/Users/itamarvillarealjunior/Downloads/Cadastro Pessoas - Itamar.xls",
)


def default_xls_path() -> Path | None:
    for p in _DEFAULT_XLS_CANDIDATES:
        if not p:
            continue
        q = Path(p).expanduser()
        if q.is_file():
            return q.resolve()
    return None


_CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def normalize_text(s: str) -> str:
    if not s:
        return ""
    t = unicodedata.normalize("NFC", s)
    t = _CTRL_RE.sub("", t)
    return t.strip()


def cell_str(val) -> str:
    """Converte célula Excel/pandas para texto sem artefactos (.0 em IDs, espaços)."""
    if val is None:
        return ""
    if isinstance(val, pd.Timestamp):
        if pd.isna(val):
            return ""
        return normalize_text(val.strftime("%Y-%m-%d %H:%M:%S"))
    if isinstance(val, datetime):
        return normalize_text(val.strftime("%Y-%m-%d %H:%M:%S"))
    if isinstance(val, float):
        if pd.isna(val):
            return ""
        if val == int(val) and abs(val) < 1e15:
            return str(int(val))
        s = repr(val) if "e" in str(val).lower() else str(val).rstrip("0").rstrip(".")
        return normalize_text(s)
    if isinstance(val, int):
        return str(val)
    return normalize_text(str(val))


def only_digits(s) -> str:
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    return re.sub(r"\D", "", cell_str(s))


def sql_str(s, maxlen=None):
    if s is None:
        return "NULL"
    if isinstance(s, float) and pd.isna(s):
        return "NULL"
    t = normalize_text(s) if isinstance(s, str) else normalize_text(cell_str(s))
    if not t:
        return "NULL"
    if maxlen:
        t = t[:maxlen]
    return "'" + t.replace("\\", "\\\\").replace("'", "''") + "'"


def parse_date(v):
    if pd.isna(v):
        return None
    if isinstance(v, pd.Timestamp):
        return None if pd.isna(v) else v.date().isoformat()
    if isinstance(v, datetime):
        return v.date().isoformat()
    s = cell_str(v)
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:19], fmt).date().isoformat()
        except ValueError:
            continue
    return None


def normalize_uf(raw) -> str | None:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    s = normalize_text(cell_str(raw)).upper().replace(" ", "")
    if len(s) == 2 and s.isalpha():
        return s
    letters = "".join(c for c in s if "A" <= c <= "Z")
    if len(letters) >= 2:
        return letters[:2]
    return None


def open_xls_book(path: Path, encoding_override: str | None):
    import xlrd

    kw = {"formatting_info": False}
    if encoding_override:
        kw["encoding_override"] = encoding_override
    return xlrd.open_workbook(str(path), **kw)


def read_sheet(path: Path, sheet: str, encoding_override: str | None) -> pd.DataFrame:
    """Com --encoding-override abre o livro xlrd antes (codepage Windows); senão delega ao pandas."""
    io = open_xls_book(path, encoding_override) if encoding_override else path
    try:
        return pd.read_excel(io, sheet_name=sheet, header=None, engine="xlrd")
    except Exception:
        return pd.read_excel(io, sheet_name=0, header=None, engine="xlrd")


def row_get(row, idx: int):
    if idx >= len(row):
        return None
    return row.iloc[idx]


def prepare_local_copy(src: Path) -> tuple[Path, bool]:
    """Devolve (caminho_a_ler, apagar_no_finally). Se já for o ficheiro de trabalho, não copia nem apaga."""
    src_r = src.resolve()
    work_r = WORK_COPY_XLS.resolve()
    if src_r == work_r:
        return src, False
    shutil.copy2(src, WORK_COPY_XLS)
    return WORK_COPY_XLS, True


def main():
    ap = argparse.ArgumentParser(description="Gera SQL INSERT para cadastro de pessoas (.xls).")
    ap.add_argument(
        "--xls",
        type=Path,
        default=None,
        help="Caminho do .xls (senão VILAREAL_CADASTRO_PESSOAS_XLS ou caminhos conhecidos)",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent / "import_cadastro_pessoas_itamar.sql",
        help="Ficheiro SQL de saída",
    )
    ap.add_argument("--sheet", default="Plan1", help="Nome da aba (tenta índice 0 se falhar)")
    ap.add_argument(
        "--encoding-override",
        metavar="ENC",
        default=os.environ.get("VILAREAL_XLS_ENCODING_OVERRIDE"),
        help="Ex.: cp1252 — repassa ao xlrd para .xls com codepage Windows",
    )
    ap.add_argument(
        "--no-copy",
        action="store_true",
        help="Lê o .xls diretamente no caminho indicado (sem copiar para scripts/ nem apagar)",
    )
    args = ap.parse_args()

    xls_path = args.xls
    if xls_path is None:
        xls_path = default_xls_path()
    else:
        xls_path = xls_path.expanduser().resolve()

    if xls_path is None or not xls_path.is_file():
        print(
            "Erro: planilha não encontrada. Defina --xls ou VILAREAL_CADASTRO_PESSOAS_XLS.",
            file=sys.stderr,
        )
        sys.exit(1)

    enc = args.encoding_override.strip() if args.encoding_override else None

    path_read = xls_path
    cleanup_copy = False
    if not args.no_copy:
        path_read, cleanup_copy = prepare_local_copy(xls_path)
        if cleanup_copy:
            print(f"Cópia local: {WORK_COPY_XLS}", file=sys.stderr)

    try:
        df = read_sheet(path_read, args.sheet, enc)
        data = df.iloc[10:]
        rows = []
        for _, row in data.iterrows():
            rid = row_get(row, 0)
            if rid is None or pd.isna(rid):
                continue
            if cell_str(rid) == "":
                continue
            try:
                pid = int(float(cell_str(rid)))
            except (ValueError, TypeError):
                continue
            nome = normalize_text(cell_str(row_get(row, 1)))
            if not nome:
                continue
            doc = only_digits(row_get(row, 3))
            if not doc:
                continue
            if len(doc) > 14:
                doc = doc[:14]
            email_raw = row_get(row, 12)
            email = normalize_text(cell_str(email_raw)) if pd.notna(email_raw) else ""
            email = email if email else None
            tel = ""
            for c in (18, 20, 22, 24):
                if c < len(row) and pd.notna(row.iloc[c]) and cell_str(row.iloc[c]):
                    tel = re.sub(r"\s+", " ", normalize_text(cell_str(row.iloc[c])))[:40]
                    break
            dn = parse_date(row_get(row, 8))
            gen_raw = row_get(row, 2)
            gen = normalize_text(cell_str(gen_raw)).upper()[:8] if pd.notna(gen_raw) else ""
            genero = gen if gen else None
            rg_raw = row_get(row, 6)
            rg = normalize_text(cell_str(rg_raw))[:40] if pd.notna(rg_raw) else None
            if rg == "":
                rg = None
            oe_raw = row_get(row, 7)
            oe = normalize_text(cell_str(oe_raw))[:120] if pd.notna(oe_raw) else None
            if oe == "":
                oe = None
            prof_raw = row_get(row, 11)
            prof = normalize_text(cell_str(prof_raw))[:255] if pd.notna(prof_raw) else None
            if prof == "":
                prof = None
            nac_raw = row_get(row, 9)
            nac = normalize_text(cell_str(nac_raw))[:120] if pd.notna(nac_raw) else None
            if nac == "":
                nac = None
            ec_raw = row_get(row, 10)
            ec = normalize_text(cell_str(ec_raw))[:40] if pd.notna(ec_raw) else None
            if ec == "":
                ec = None
            rua_raw = row_get(row, 17)
            rua = normalize_text(cell_str(rua_raw))[:255] if pd.notna(rua_raw) else ""
            if not rua:
                rua = "S/N"
            bairro_raw = row_get(row, 13)
            bairro = normalize_text(cell_str(bairro_raw))[:120] if pd.notna(bairro_raw) else None
            if bairro == "":
                bairro = None
            uf = normalize_uf(row_get(row, 14))
            cidade_raw = row_get(row, 15)
            cidade = normalize_text(cell_str(cidade_raw))[:120] if pd.notna(cidade_raw) else None
            if cidade == "":
                cidade = None
            cep_raw = only_digits(row_get(row, 16))
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

        lines = [
            f"-- Importação manual: {xls_path.name} ({args.sheet})",
            "-- Gera: INSERT em pessoa, pessoa_complementar, pessoa_endereco",
            "--",
            "-- ATENÇÃO: a planilha usa id=1..N. Se já existir pessoa id=1 (ex.: vínculo ao usuário),",
            "-- faça backup, apague/atualize conflitos ou edite os IDs antes de executar.",
            "--",
            "-- Coluna cpf: CPF/CNPJ apenas dígitos (até 14). O mesmo e-mail pode repetir em várias pessoas.",
            "-- CPF/CNPJ duplicado na planilha: só a linha com menor ID é importada.",
            "-- Texto: NFC + remoção de caracteres de controlo; opcional --encoding-override para xlrd.",
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
            email_sql = sql_str(em, 255) if em else "NULL"
            tel_sql = sql_str(r["tel"], 40) if r["tel"] else "NULL"
            dn_sql = sql_str(r["dn"], 10) if r["dn"] else "NULL"
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

        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text("\n".join(lines), encoding="utf-8")
        print(f"Escrito: {args.out} ({len(lines)} linhas, {kept} pessoas)")
    finally:
        if cleanup_copy:
            try:
                WORK_COPY_XLS.unlink(missing_ok=True)
            except OSError:
                pass


if __name__ == "__main__":
    main()
