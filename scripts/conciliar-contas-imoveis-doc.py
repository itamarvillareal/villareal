#!/usr/bin/env python3
"""
Concilia documento manual de contas de imóveis (água/energia/condomínio/gás)
com registros no banco — somente SELECT.

Busca em:
  1. pagamento (contas a pagar operacionais — chave codigo_barras)
  2. financeiro_lancamento (extrato legado — dígitos em descricao/descricao_detalhada)

Uso:
  python3 scripts/conciliar-contas-imoveis-doc.py caminho/do/documento.txt
  python3 scripts/conciliar-contas-imoveis-doc.py --csv planilha.csv

Variáveis de ambiente (opcional):
  MYSQL_HOST (default 127.0.0.1)
  MYSQL_PORT (default 3307)
  MYSQL_USER (default root)
  MYSQL_PASSWORD (default root)
  MYSQL_DATABASE (default vilareal)
  MYSQL_DOCKER_CONTAINER — se definido, usa `docker exec` em vez de cliente mysql local
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Iterable

TOLERANCIA_DIAS = 7
TOLERANCIA_VALOR = Decimal("0.02")

HEADER_ALIASES = {
    "imovel": {"imovel", "imóvel", "unidade", "apt", "apto", "identificacao", "identificação"},
    "tipo": {"tipo", "conta", "categoria", "tipo_conta", "tipo conta"},
    "referencia": {"referencia", "referência", "ref", "competencia", "competência", "mes", "mês"},
    "vencimento": {"vencimento", "venc", "data_vencimento", "data vencimento", "vencto"},
    "valor": {"valor", "valor_r$", "valor rs", "r$"},
    "linha_digitavel": {
        "linha_digitavel",
        "linha digitável",
        "linha digitavel",
        "codigo_barras",
        "codigo barras",
        "código de barras",
        "cod barras",
        "barcode",
    },
    "status_doc": {"status", "status_doc", "obs", "observacao", "observação", "situação", "situacao"},
}

TIPO_MAP = {
    "agua": "AGUA",
    "água": "AGUA",
    "energia": "ENERGIA",
    "luz": "ENERGIA",
    "condominio": "CONDOMINIO",
    "condomínio": "CONDOMINIO",
    "cond": "CONDOMINIO",
    "gas": "GAS",
    "gás": "GAS",
}


@dataclass
class LancamentoDoc:
    imovel: str
    tipo: str
    referencia: str
    vencimento: str
    vencimento_iso: str | None
    valor: Decimal | None
    linha_digitavel: str
    linha_digitavel_norm: str
    status_doc: str
    linha_origem: int | None = None


@dataclass
class MatchDb:
    tabela: str
    id: int
    valor: Decimal | None
    data_ref: str | None
    status: str | None
    descricao: str | None
    metodo: str
    imovel_db: str | None = None


@dataclass
class ResultadoLinha:
    doc: LancamentoDoc
    matches: list[MatchDb] = field(default_factory=list)
    observacao: str = ""


def normalizar_digitos(texto: str | None) -> str:
    if not texto:
        return ""
    return re.sub(r"\D", "", texto)


def parse_valor_br(raw: str) -> Decimal | None:
    s = raw.strip()
    if not s:
        return None
    s = re.sub(r"^R\$\s*", "", s, flags=re.I).strip()
    s = s.replace(" ", "")
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return Decimal(s).quantize(Decimal("0.01"))
    except InvalidOperation:
        return None


def parse_data_br(raw: str, ano_padrao: int | None = None) -> tuple[str, str | None]:
    """Retorna (texto original normalizado, ISO YYYY-MM-DD ou None)."""
    s = raw.strip()
    if not s:
        return s, None
    ano = ano_padrao or date.today().year
    m = re.match(r"^(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?$", s)
    if not m:
        return s, None
    d, mes, y = int(m.group(1)), int(m.group(2)), m.group(3)
    if y:
        y = int(y)
        if y < 100:
            y += 2000
    else:
        y = ano
    try:
        return s, date(y, mes, d).isoformat()
    except ValueError:
        return s, None


def parse_referencia(raw: str) -> str:
    s = raw.strip()
    m = re.match(r"^(\d{1,2})[/\-](\d{2,4})$", s)
    if m:
        mes, ano = int(m.group(1)), int(m.group(2))
        if ano < 100:
            ano += 2000
        return f"{mes:02d}/{ano}"
    return s


def normalizar_tipo(raw: str) -> str:
    k = raw.strip().lower()
    return TIPO_MAP.get(k, raw.strip().upper())


def parse_status_doc(texto: str) -> str:
    t = texto.strip()
    tl = t.lower()
    if "incluído" in tl or "incluido" in tl:
        return t
    if "não foi debitado" in tl or "nao foi debitado" in tl:
        return t
    if "a incluir" in tl or re.search(r"\bincluir\b", tl):
        return t
    return t


def detectar_status_em_linha(linha: str) -> str:
    if re.search(r"\(\*?\s*inclu[ií]do", linha, re.I):
        m = re.search(r"\(\*?\s*inclu[ií]do[^)]*\)", linha, re.I)
        return m.group(0) if m else linha.strip()
    if re.search(r"n[aã]o foi debitado", linha, re.I):
        return "não foi debitado"
    if re.search(r"\ba incluir\b", linha, re.I):
        return "a incluir"
    return ""


def mapear_cabecalho(row: list[str]) -> dict[str, int]:
    idx: dict[str, int] = {}
    for i, col in enumerate(row):
        chave = col.strip().lower().replace("_", " ")
        for canon, aliases in HEADER_ALIASES.items():
            if chave in aliases or chave.replace(" ", "_") in aliases:
                idx[canon] = i
                break
    return idx


def ler_csv(path: str) -> list[LancamentoDoc]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        sample = f.read(4096)
        f.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        reader = csv.reader(f, dialect)
        header = next(reader)
        idx = mapear_cabecalho(header)
        if "valor" not in idx:
            raise ValueError(f"Cabeçalho CSV não reconhecido: {header}")

        out: list[LancamentoDoc] = []
        for n, row in enumerate(reader, start=2):
            if not any(cell.strip() for cell in row):
                continue
            get = lambda k, default="": row[idx[k]].strip() if k in idx and idx[k] < len(row) else default
            valor = parse_valor_br(get("valor"))
            linha = get("linha_digitavel")
            venc_txt, venc_iso = parse_data_br(get("vencimento"))
            out.append(
                LancamentoDoc(
                    imovel=get("imovel"),
                    tipo=normalizar_tipo(get("tipo")),
                    referencia=parse_referencia(get("referencia")),
                    vencimento=venc_txt,
                    vencimento_iso=venc_iso,
                    valor=valor,
                    linha_digitavel=linha,
                    linha_digitavel_norm=normalizar_digitos(linha),
                    status_doc=parse_status_doc(get("status_doc")),
                    linha_origem=n,
                )
            )
        return out


def extrair_linha_digitavel(texto: str) -> str:
    """Pega a maior sequência de dígitos (com pontuação opcional) na linha."""
    candidatos = re.findall(
        r"(?:\d[\d.\s\-]{30,}\d|\d{40,})",
        texto,
    )
    if not candidatos:
        return ""
    melhor = max(candidatos, key=lambda x: len(normalizar_digitos(x)))
    return melhor.strip()


def ler_texto_livre(path: str) -> list[LancamentoDoc]:
    with open(path, encoding="utf-8-sig") as f:
        linhas = [ln.rstrip() for ln in f.readlines()]

    blocos: list[list[str]] = []
    atual: list[str] = []
    for ln in linhas:
        if not ln.strip():
            if atual:
                blocos.append(atual)
                atual = []
            continue
        atual.append(ln)
    if atual:
        blocos.append(atual)

    out: list[LancamentoDoc] = []
    for bi, bloco in enumerate(blocos, start=1):
        texto_bloco = "\n".join(bloco)
        status = ""
        for ln in bloco:
            st = detectar_status_em_linha(ln)
            if st:
                status = st
                break

        valor: Decimal | None = None
        for ln in bloco:
            m = re.search(r"R\$\s*([\d.,]+)", ln, re.I)
            if m:
                valor = parse_valor_br(m.group(1))
                break
            m2 = re.search(r"(?<!\d)([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})(?!\d)", ln)
            if m2 and valor is None:
                valor = parse_valor_br(m2.group(1))

        linha_dig = ""
        for ln in bloco:
            cand = extrair_linha_digitavel(ln)
            if len(normalizar_digitos(cand)) >= 40:
                linha_dig = cand
                break

        referencia = ""
        venc_txt = ""
        venc_iso = None
        for ln in bloco:
            mr = re.search(r"(?:ref(?:er[eê]ncia)?|comp(?:et[eê]ncia)?)\s*[:\-]?\s*(\d{1,2}/\d{2,4})", ln, re.I)
            if mr:
                referencia = parse_referencia(mr.group(1))
            mv = re.search(r"(?:venc(?:imento)?|vencto)\s*[:\-]?\s*(\d{1,2}/\d{1,2}(?:/\d{2,4})?)", ln, re.I)
            if mv:
                venc_txt, venc_iso = parse_data_br(mv.group(1))
            if not referencia:
                mr2 = re.match(r"^\s*(\d{2}/\d{4})\s*$", ln)
                if mr2:
                    referencia = parse_referencia(mr2.group(1))

        tipo = ""
        imovel = ""
        for ln in bloco:
            tl = ln.lower()
            for chave in TIPO_MAP:
                if re.search(rf"\b{re.escape(chave)}\b", tl):
                    tipo = normalizar_tipo(chave)
                    break
            if tipo:
                break

        if not imovel:
            for ln in bloco:
                if re.search(r"\b(água|agua|energia|luz|condom|gás|gas)\b", ln, re.I):
                    continue
                if re.search(r"R\$|\d{40,}|inclu[ií]do|incluir|debitado", ln, re.I):
                    continue
                if re.search(r"ref|venc|compet", ln, re.I):
                    continue
                if ln.strip():
                    imovel = ln.strip()
                    break

        if not (imovel or tipo or valor or linha_dig):
            continue

        out.append(
            LancamentoDoc(
                imovel=imovel,
                tipo=tipo,
                referencia=referencia,
                vencimento=venc_txt,
                vencimento_iso=venc_iso,
                valor=valor,
                linha_digitavel=linha_dig,
                linha_digitavel_norm=normalizar_digitos(linha_dig),
                status_doc=status,
                linha_origem=bi,
            )
        )
    return out


class MysqlClient:
    def __init__(self) -> None:
        self.container = os.environ.get("MYSQL_DOCKER_CONTAINER", "vilareal-db")
        self.host = os.environ.get("MYSQL_HOST", "127.0.0.1")
        self.port = os.environ.get("MYSQL_PORT", "3307")
        self.user = os.environ.get("MYSQL_USER", "root")
        self.password = os.environ.get("MYSQL_PASSWORD", "root")
        self.database = os.environ.get("MYSQL_DATABASE", "vilareal")

    def query(self, sql: str) -> list[dict[str, str]]:
        if os.environ.get("MYSQL_DOCKER_CONTAINER") or self._docker_available():
            cmd = [
                "docker",
                "exec",
                self.container,
                "mysql",
                f"-u{self.user}",
                f"-p{self.password}",
                "-B",
                "-N",
                self.database,
                "-e",
                sql,
            ]
        else:
            cmd = [
                "mysql",
                f"-h{self.host}",
                f"-P{self.port}",
                f"-u{self.user}",
                f"-p{self.password}",
                "-B",
                "-N",
                self.database,
                "-e",
                sql,
            ]
        proc = subprocess.run(cmd, capture_output=True)
        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", errors="replace").strip()
            out = proc.stdout.decode("utf-8", errors="replace").strip()
            raise RuntimeError(err or out)
        stdout = proc.stdout.decode("utf-8", errors="replace")
        if not stdout.strip():
            return []
        reader = csv.reader(io.StringIO(stdout), delimiter="\t")
        rows = list(reader)
        if not rows:
            return []
        # mysql -B -N não traz cabeçalho; inferir pelas colunas do SELECT
        return [{"c{}".format(i): (row[i] if i < len(row) else "") for i in range(len(row))} for row in rows]

    @staticmethod
    def _docker_available() -> bool:
        try:
            subprocess.run(["docker", "info"], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False


SQL_PAGAMENTOS = """
SELECT
    p.id,
    p.codigo_barras,
    p.valor,
    p.data_vencimento,
    p.data_agendamento,
    p.data_pagamento_efetivo,
    p.mes_referencia,
    p.conta_referencia,
    p.categoria,
    p.status,
    p.descricao,
    p.imovel_id,
    COALESCE(i.unidade, ''),
    COALESCE(i.condominio, ''),
    COALESCE(i.titulo, ''),
    COALESCE(i.endereco_completo, '')
FROM pagamento p
LEFT JOIN imovel i ON i.id = p.imovel_id
WHERE p.tipo = 'PAGAR'
  AND p.status NOT IN ('CANCELADO', 'SUBSTITUIDO')
"""

SQL_FINANCEIRO = """
SELECT
    fl.id,
    fl.valor,
    fl.data_lancamento,
    fl.data_competencia,
    fl.descricao,
    fl.descricao_detalhada,
    fl.processo_id,
    fl.status,
    COALESCE(i.unidade, ''),
    COALESCE(i.condominio, ''),
    COALESCE(i.titulo, '')
FROM financeiro_lancamento fl
LEFT JOIN processo pr ON pr.id = fl.processo_id
LEFT JOIN imovel i ON i.processo_id = pr.id AND i.ativo = 1
WHERE fl.status = 'ATIVO'
  AND fl.natureza = 'DEBITO'
"""


def carregar_pagamentos(db: MysqlClient, data_min: str | None, data_max: str | None) -> list[dict]:
    sql = SQL_PAGAMENTOS
    if data_min and data_max:
        sql += f"\n  AND p.data_vencimento BETWEEN '{data_min}' AND '{data_max}'"
    rows = db.query(sql)
    keys = [
        "id",
        "codigo_barras",
        "valor",
        "data_vencimento",
        "data_agendamento",
        "data_pagamento_efetivo",
        "mes_referencia",
        "conta_referencia",
        "categoria",
        "status",
        "descricao",
        "imovel_id",
        "unidade",
        "condominio",
        "titulo",
        "endereco",
    ]
    return [_row_dict(r, keys) for r in rows]


def carregar_financeiro(db: MysqlClient, data_min: str | None, data_max: str | None) -> list[dict]:
    sql = SQL_FINANCEIRO
    if data_min and data_max:
        sql += f"\n  AND fl.data_lancamento BETWEEN '{data_min}' AND '{data_max}'"
    rows = db.query(sql)
    keys = [
        "id",
        "valor",
        "data_lancamento",
        "data_competencia",
        "descricao",
        "descricao_detalhada",
        "processo_id",
        "status",
        "unidade",
        "condominio",
        "titulo",
    ]
    return [_row_dict(r, keys) for r in rows]


def _row_dict(raw: dict[str, str], keys: list[str]) -> dict[str, str]:
    return {k: raw.get(f"c{i}", "") for i, k in enumerate(keys)}


def dec(raw: str | None) -> Decimal | None:
    if raw is None or raw == "" or raw == "NULL":
        return None
    try:
        return Decimal(str(raw).replace(",", ".")).quantize(Decimal("0.01"))
    except InvalidOperation:
        return None


def dias_entre(a: str | None, b: str | None) -> int | None:
    if not a or not b:
        return None
    try:
        da = datetime.strptime(a[:10], "%Y-%m-%d").date()
        db_ = datetime.strptime(b[:10], "%Y-%m-%d").date()
        return abs((da - db_).days)
    except ValueError:
        return None


def imovel_label(row: dict) -> str:
    parts = [row.get("unidade", ""), row.get("condominio", ""), row.get("titulo", "")]
    return " ".join(p for p in parts if p).strip()


def imovel_match(doc_imovel: str, db_label: str, descricao: str = "") -> bool:
    if not doc_imovel.strip():
        return True
    alvo = doc_imovel.lower()
    texto = f"{db_label} {descricao}".lower()
    tokens = [t for t in re.split(r"[\s,/\-]+", alvo) if len(t) >= 2]
    if not tokens:
        return alvo in texto
    hits = sum(1 for t in tokens if t in texto)
    return hits >= max(1, len(tokens) // 2)


def indexar_pagamentos(rows: list[dict]) -> tuple[dict[str, list[dict]], list[dict]]:
    by_barcode: dict[str, list[dict]] = {}
    all_rows = rows
    for r in rows:
        norm = normalizar_digitos(r.get("codigo_barras"))
        if len(norm) >= 40:
            by_barcode.setdefault(norm, []).append(r)
    return by_barcode, all_rows


def indexar_financeiro(rows: list[dict]) -> tuple[dict[str, list[dict]], list[dict]]:
    by_barcode: dict[str, list[dict]] = {}
    for r in rows:
        texto = (r.get("descricao") or "") + " " + (r.get("descricao_detalhada") or "")
        norm = normalizar_digitos(texto)
        if len(norm) >= 40:
            by_barcode.setdefault(norm, []).append(r)
        else:
            # também indexa substrings longas (>= 20 dígitos) para match parcial
            for m in re.finditer(r"\d{20,}", norm):
                by_barcode.setdefault(m.group(0), []).append(r)
    return by_barcode, rows


def match_pagamento(doc: LancamentoDoc, by_bc: dict, all_rows: list[dict]) -> list[MatchDb]:
    matches: list[MatchDb] = []
    if doc.linha_digitavel_norm and len(doc.linha_digitavel_norm) >= 40:
        for r in by_bc.get(doc.linha_digitavel_norm, []):
            matches.append(
                MatchDb(
                    tabela="pagamento",
                    id=int(r["id"]),
                    valor=dec(r.get("valor")),
                    data_ref=r.get("data_vencimento") or r.get("data_agendamento"),
                    status=r.get("status"),
                    descricao=r.get("descricao"),
                    metodo="codigo_barras",
                    imovel_db=imovel_label(r),
                )
            )
        if matches:
            return matches

    for r in all_rows:
        if doc.valor is not None:
            rv = dec(r.get("valor"))
            if rv is None or abs(rv - doc.valor) > TOLERANCIA_VALOR:
                continue
        else:
            continue
        data_candidatas = [r.get("data_vencimento"), r.get("data_agendamento"), r.get("data_pagamento_efetivo")]
        ok_data = doc.vencimento_iso is None
        for d in data_candidatas:
            dias = dias_entre(doc.vencimento_iso, d)
            if dias is not None and dias <= TOLERANCIA_DIAS:
                ok_data = True
                break
        if not ok_data:
            continue
        if not imovel_match(doc.imovel, imovel_label(r), r.get("descricao", "")):
            continue
        if doc.tipo and r.get("categoria") and doc.tipo != r.get("categoria"):
            # gás costuma ser OUTROS no sistema
            if not (doc.tipo == "GAS" and r.get("categoria") == "OUTROS"):
                continue
        matches.append(
            MatchDb(
                tabela="pagamento",
                id=int(r["id"]),
                valor=dec(r.get("valor")),
                data_ref=next((d for d in data_candidatas if d), None),
                status=r.get("status"),
                descricao=r.get("descricao"),
                metodo="valor+data+imovel",
                imovel_db=imovel_label(r),
            )
        )
    return matches


def match_financeiro(doc: LancamentoDoc, by_bc: dict, all_rows: list[dict]) -> list[MatchDb]:
    matches: list[MatchDb] = []
    norm = doc.linha_digitavel_norm
    if norm and len(norm) >= 40:
        candidatos = by_bc.get(norm, [])
        if not candidatos and len(norm) >= 20:
            for chave, rows in by_bc.items():
                if norm in chave or chave in norm:
                    candidatos.extend(rows)
        vistos: set[int] = set()
        for r in candidatos:
            rid = int(r["id"])
            if rid in vistos:
                continue
            vistos.add(rid)
            texto = (r.get("descricao") or "") + " " + (r.get("descricao_detalhada") or "")
            if norm not in normalizar_digitos(texto) and norm[:20] not in normalizar_digitos(texto):
                continue
            matches.append(
                MatchDb(
                    tabela="financeiro_lancamento",
                    id=rid,
                    valor=dec(r.get("valor")),
                    data_ref=r.get("data_lancamento"),
                    status=r.get("status"),
                    descricao=r.get("descricao"),
                    metodo="codigo_barras_em_descricao",
                    imovel_db=imovel_label(r),
                )
            )
        if matches:
            return matches

    for r in all_rows:
        if doc.valor is not None:
            rv = dec(r.get("valor"))
            if rv is None or abs(abs(rv) - doc.valor) > TOLERANCIA_VALOR:
                continue
        else:
            continue
        dias = dias_entre(doc.vencimento_iso, r.get("data_lancamento"))
        if doc.vencimento_iso and (dias is None or dias > TOLERANCIA_DIAS):
            continue
        texto = (r.get("descricao") or "") + " " + (r.get("descricao_detalhada") or "")
        if not imovel_match(doc.imovel, imovel_label(r), texto):
            continue
        matches.append(
            MatchDb(
                tabela="financeiro_lancamento",
                id=int(r["id"]),
                valor=dec(r.get("valor")),
                data_ref=r.get("data_lancamento"),
                status=r.get("status"),
                descricao=r.get("descricao"),
                metodo="valor+data+imovel",
                imovel_db=imovel_label(r),
            )
        )
    return matches


def conciliar(docs: list[LancamentoDoc], db: MysqlClient) -> list[ResultadoLinha]:
    datas_iso = [d.vencimento_iso for d in docs if d.vencimento_iso]
    data_min = min(datas_iso) if datas_iso else None
    data_max = max(datas_iso) if datas_iso else None
    if data_min and data_max:
        # expande janela para tolerância
        dmin = datetime.strptime(data_min, "%Y-%m-%d").date()
        dmax = datetime.strptime(data_max, "%Y-%m-%d").date()
        from datetime import timedelta

        data_min = (dmin - timedelta(days=TOLERANCIA_DIAS)).isoformat()
        data_max = (dmax + timedelta(days=TOLERANCIA_DIAS)).isoformat()

    pag_rows = carregar_pagamentos(db, data_min, data_max)
    fin_rows = carregar_financeiro(db, data_min, data_max)
    pag_bc, pag_all = indexar_pagamentos(pag_rows)
    fin_bc, fin_all = indexar_financeiro(fin_rows)

    resultados: list[ResultadoLinha] = []
    for doc in docs:
        m1 = match_pagamento(doc, pag_bc, pag_all)
        m2 = match_financeiro(doc, fin_bc, fin_all) if not m1 else []
        matches = m1 or m2
        obs_parts: list[str] = []
        if len(matches) > 1:
            ids = ", ".join(f"{m.tabela}:{m.id}" for m in matches)
            obs_parts.append(f"POSSÍVEL DUPLICADO ({len(matches)} registros: {ids})")
        elif not matches:
            obs_parts.append("NÃO ENCONTRADO")
        for m in matches:
            if doc.valor is not None and m.valor is not None and abs(doc.valor - abs(m.valor)) > TOLERANCIA_VALOR:
                obs_parts.append(f"DIVERGÊNCIA VALOR doc={doc.valor} db={m.valor}")
        if m1 and m2:
            obs_parts.append("também há candidatos em financeiro_lancamento (priorizado pagamento)")
        resultados.append(ResultadoLinha(doc=doc, matches=matches, observacao="; ".join(obs_parts)))
    return resultados


def format_brl(v: Decimal | None) -> str:
    if v is None:
        return ""
    s = f"{v:.2f}".replace(".", ",")
    return s


def imprimir_relatorio(resultados: list[ResultadoLinha]) -> None:
    cols = [
        "Imóvel",
        "Tipo",
        "Referência",
        "Vencimento",
        "Valor",
        "Linha digitável",
        "Status no doc",
        "Encontrado?",
        "ID no banco",
        "Observação",
    ]
    print("\t".join(cols))
    for r in resultados:
        d = r.doc
        encontrado = "SIM" if r.matches else "NÃO"
        ids = ", ".join(f"{m.tabela}#{m.id}" for m in r.matches) if r.matches else ""
        print(
            "\t".join(
                [
                    d.imovel,
                    d.tipo,
                    d.referencia,
                    d.vencimento,
                    format_brl(d.valor),
                    d.linha_digitavel,
                    d.status_doc,
                    encontrado,
                    ids,
                    r.observacao,
                ]
            )
        )

    total = len(resultados)
    enc = sum(1 for r in resultados if r.matches)
    nao = sum(1 for r in resultados if not r.matches)
    dup = sum(1 for r in resultados if len(r.matches) > 1)
    div = sum(1 for r in resultados if "DIVERGÊNCIA" in r.observacao)
    print("\n--- RESUMO ---", file=sys.stderr)
    print(f"Total documento: {total}", file=sys.stderr)
    print(f"Encontrados: {enc}", file=sys.stderr)
    print(f"Não encontrados: {nao}", file=sys.stderr)
    print(f"Possíveis duplicados: {dup}", file=sys.stderr)
    print(f"Divergência de valor: {div}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description="Concilia contas de imóveis vs banco (somente SELECT)")
    parser.add_argument("arquivo", nargs="?", help="Documento (.txt livre ou .csv/.tsv exportado)")
    parser.add_argument("--csv", action="store_true", help="Forçar leitura como CSV/TSV")
    parser.add_argument("--mostrar-sql", action="store_true", help="Imprime queries e sai")
    args = parser.parse_args()

    if args.mostrar_sql:
        print("-- Query pagamentos\n", SQL_PAGAMENTOS, "\n", sep="")
        print("-- Query financeiro_lancamento\n", SQL_FINANCEIRO, "\n", sep="")
        return 0

    if not args.arquivo:
        parser.error("informe o caminho do documento ou use --mostrar-sql")

    path = args.arquivo
    if not os.path.isfile(path):
        print(f"Arquivo não encontrado: {path}", file=sys.stderr)
        return 1

    if args.csv or path.lower().endswith((".csv", ".tsv")):
        docs = ler_csv(path)
    else:
        docs = ler_texto_livre(path)

    if not docs:
        print("Nenhum lançamento extraído do documento. Verifique formato ou exporte CSV.", file=sys.stderr)
        return 1

    print(f"Lançamentos no documento: {len(docs)}", file=sys.stderr)
    db = MysqlClient()
    resultados = conciliar(docs, db)
    imprimir_relatorio(resultados)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
