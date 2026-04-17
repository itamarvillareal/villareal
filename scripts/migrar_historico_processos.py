#!/usr/bin/env python3
"""
Importa histórico de processos a partir de Excel (.xls) e gera SQL para processo_andamento.

Uso:
  pip install xlrd pymysql  # se necessário
  python3 ~/Downloads/migrar_historico_processos.py

Saída: ~/Downloads/import_historico_processos.sql
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timedelta

EXCEL_PATH = "/Users/itamarvillarealjunior/Dropbox/sistema/Pasta2_-_Copia.xls"
SHEET_INDEX = 1
OUT_SQL_PATH = os.path.expanduser("~/Downloads/import_historico_processos.sql")

MYSQL_HOST = "localhost"
MYSQL_PORT = 3306
MYSQL_USER = "root"
MYSQL_PASSWORD = "root"
MYSQL_DATABASE = "vilareal"

EXCEL_EPOCH = datetime(1899, 12, 30)
BATCH_SIZE = 500


def pad_codigo_cliente(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    digits = "".join(c for c in s if c.isdigit())
    if not digits:
        return None
    n = int(digits)
    if n < 1:
        return None
    return str(n).zfill(8)


def cell_str(row, idx: int) -> str:
    if idx >= len(row):
        return ""
    v = row[idx].value
    if v is None:
        return ""
    return str(v).strip()


def excel_serial_to_mysql_datetime(val) -> str | None:
    if val is None or val == "":
        return None
    try:
        if isinstance(val, (datetime,)):
            return val.strftime("%Y-%m-%d %H:%M:%S")
        f = float(val)
        dt = EXCEL_EPOCH + timedelta(days=f)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except (TypeError, ValueError, OverflowError):
        return None


def sql_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "''")


def truncar_titulo(s: str, max_len: int = 500) -> str:
    t = s.strip()
    if len(t) <= max_len:
        return t
    return t[:max_len]


def main() -> int:
    try:
        import xlrd  # type: ignore
    except ImportError:
        print("Instale xlrd: pip install xlrd", file=sys.stderr)
        return 1
    try:
        import pymysql  # type: ignore
    except ImportError:
        print("Instale pymysql: pip install pymysql", file=sys.stderr)
        return 1

    importacao_id = str(uuid.uuid4())
    print(f"importacao_id: {importacao_id}")

    wb = xlrd.open_workbook(EXCEL_PATH, formatting_info=False)
    sh = wb.sheet_by_index(SHEET_INDEX)
    nrows = sh.nrows

    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )

    sql_processo = (
        "SELECT p.id AS id FROM processo p "
        "INNER JOIN cliente c ON c.pessoa_id = p.pessoa_id "
        "WHERE c.codigo_cliente = %s AND p.numero_interno = %s LIMIT 1"
    )
    sql_dup = (
        "SELECT 1 FROM processo_andamento "
        "WHERE processo_id = %s AND titulo = %s AND movimento_em = %s LIMIT 1"
    )
    sql_user = "SELECT id FROM usuarios WHERE LOWER(TRIM(login)) = LOWER(TRIM(%s)) LIMIT 1"

    total_lidas = 0
    ignoradas_dup = 0
    erros_processo = 0
    avisos_usuario = 0
    linhas_insert = 0

    pending_keys: set[tuple] = set()
    buffer: list[tuple[int, str, str, int | None]] = []

    def flush_buffer(f_out) -> None:
        nonlocal linhas_insert
        if not buffer:
            return
        parts = []
        for processo_id, mov, tit, uid in buffer:
            uid_sql = "NULL" if uid is None else str(int(uid))
            parts.append(
                f"({int(processo_id)}, '{mov}', '{tit}', NULL, 'IMPORTACAO', 0, {uid_sql}, '{sql_escape(importacao_id)}')"
            )
        f_out.write(
            "INSERT INTO processo_andamento "
            "(processo_id, movimento_em, titulo, detalhe, origem, origem_automatica, usuario_id, importacao_id)\nVALUES\n"
        )
        f_out.write(",\n".join(parts))
        f_out.write(";\n\n")
        linhas_insert += len(buffer)
        buffer.clear()

    with conn.cursor() as cur, open(OUT_SQL_PATH, "w", encoding="utf-8") as f_out:
        f_out.write("-- Gerado por migrar_historico_processos.py\n")
        f_out.write(f"-- importacao_id: {importacao_id}\n")
        f_out.write("SET NAMES utf8mb4;\n\n")

        for ri in range(nrows):
            total_lidas += 1
            row = sh.row(ri)
            cod = pad_codigo_cliente(row[0].value if len(row) > 0 else None)
            num_interno = None
            if len(row) > 1 and row[1].value != "" and row[1].value is not None:
                try:
                    num_interno = int(float(row[1].value))
                except (TypeError, ValueError):
                    num_interno = None
            teor = cell_str(row, 3)
            mov_raw = row[4].value if len(row) > 4 else None
            movimento_em = excel_serial_to_mysql_datetime(mov_raw)
            usuario_txt = cell_str(row, 5)

            if not cod or num_interno is None or not teor or not movimento_em:
                continue

            titulo = truncar_titulo(teor)
            titulo_esc = sql_escape(titulo)

            cur.execute(sql_processo, (cod, num_interno))
            pr = cur.fetchone()
            if not pr or pr.get("id") is None:
                erros_processo += 1
                continue
            processo_id = int(pr["id"])

            usuario_id: int | None = None
            if usuario_txt:
                cur.execute(sql_user, (usuario_txt,))
                ur = cur.fetchone()
                if ur and ur.get("id") is not None:
                    usuario_id = int(ur["id"])
                else:
                    avisos_usuario += 1

            dup_key = (processo_id, titulo, movimento_em)
            if dup_key in pending_keys:
                ignoradas_dup += 1
                continue

            cur.execute(sql_dup, (processo_id, titulo, movimento_em))
            if cur.fetchone():
                ignoradas_dup += 1
                continue

            pending_keys.add(dup_key)
            buffer.append((processo_id, movimento_em, titulo_esc, usuario_id))
            if len(buffer) >= BATCH_SIZE:
                flush_buffer(f_out)

        flush_buffer(f_out)

    conn.close()

    inserts_gerados = linhas_insert
    print("--- Relatório ---")
    print(f"Total lidas (linhas da planilha): {total_lidas}")
    print(f"INSERTs gerados (linhas VALUES): {inserts_gerados}")
    print(f"Ignoradas (duplicata): {ignoradas_dup}")
    print(f"Erros (processo não encontrado): {erros_processo}")
    print(f"Avisos (usuário não encontrado — gravado NULL): {avisos_usuario}")
    print(f"importacao_id (reversão): {importacao_id}")
    print(f"SQL escrito em: {OUT_SQL_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
