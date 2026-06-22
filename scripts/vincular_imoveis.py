#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vincular_imoveis.py  —  Tarefa ÚNICA: vincular cada pagamento legado
(financeiro_lancamento) ao imóvel correto do cadastro (imovel), usando o
controle manual (CSV) como a única fonte que sabe "valor + data => imóvel".

Como funciona o casamento (em ordem de confiança):
  1. valor do lançamento == valor do controle
  2. data do lançamento dentro de ±N dias da data (vencimento) do controle
  3. DESEMPATE: processo_id do lançamento == processo_id do imóvel candidato
     (o vínculo cliente+processo que vocês já têm). Sem isso, vários imóveis do
     mesmo dono colidiriam em valor+data.

Valores em branco no controle são RECUPERADOS do código de barras (o boleto
carrega o valor), então não há trabalho manual para completá-los.

Segurança: por padrão é DRY-RUN. Não escreve nada no banco. Gera:
  - vinculo_imovel.csv  (mapa lancamento_id -> imovel_id, com confiança/obs)
  - vinculo_updates.sql (UPDATEs prontos para revisar)
Só aplica com --apply.

Uso:
  python3 vincular_imoveis.py --self-test                 # testa a lógica sem banco
  python3 vincular_imoveis.py --csv controle-contas.csv   # DRY-RUN (gera csv + sql)
  MYSQL_PORT=3308 python3 vincular_imoveis.py --csv controle-contas.csv --apply
  python3 vincular_imoveis.py --pass2 --csv controle-contas.csv   # 2ª passada (dry-run)
  python3 vincular_imoveis.py --pass2 --apply                     # só após OK explícito
"""

import argparse, csv, os, re, sys, unicodedata, difflib
from datetime import datetime, date, timedelta
from decimal import Decimal
from collections import defaultdict

# ───────────────────────────── CONFIG ──────────────────────────────
DB = dict(
    host=os.getenv("MYSQL_HOST", "127.0.0.1"),
    port=int(os.getenv("MYSQL_PORT", "3307")),
    user=os.getenv("MYSQL_USER", "root"),
    password=os.getenv("MYSQL_PASSWORD", "root"),
    database=os.getenv("MYSQL_DB", "vilareal"),
)

# Tabela legada com os pagamentos a vincular (confirmada pelo Cursor)
LANC = dict(
    table="financeiro_lancamento",
    col_id="id",
    col_valor="valor",
    cols_data=["data_lancamento", "data_competencia"],  # usa a 1ª não nula p/ casar
    col_processo="processo_id",
    where_extra="status = 'ATIVO' AND natureza = 'DEBITO'",
)

# Cadastro de imóveis
IMOVEL = dict(
    table="imovel",
    col_id="id",
    col_processo="processo_id",
    cols_match=["unidade", "condominio", "titulo", "endereco_completo"],
    where_extra="ativo = 1",
)

# Onde gravar o vínculo: coluna imovel_id em financeiro_lancamento (migration V130).
# Preferida a tabela N:N porque cada lançamento pertence a no máximo um imóvel;
# espelha pagamento.imovel_id e simplifica consultas. Rodar Flyway V130 antes de --apply.
LINK_COLUMN = "imovel_id"
IMOVEL_PROCESSO_TABLE = "imovel_processo"

DATE_TOLERANCE_DAYS = 7
PASS2_DATE_TOLERANCE_DAYS = 60

# 2ª passada: imóveis com processo ativo em imovel_processo → casamento por valor+processo.
PASS2_IMOVEL_IDS_COM_PROCESSO = {8, 42, 65, 70, 73}  # F-18, Casa Alvorada, 505 A, 101 C, 1101 C
PASS2_IMOVEL_IDS_SEM_PROCESSO = {71, 72}              # Executive, 404 — só revisão

# Varredura por processo (3ª rodada): processos a verificar 1:1 em imovel_processo.
VARREDURA_PROCESSO_IDS = [1946, 16021, 16025, 16053, 16033]

# Pool da 2ª passada: não reutilizar lançamentos já vinculados na 1ª rodada.
LANC_WHERE_UNLINKED = f"{LANC['where_extra']} AND {LINK_COLUMN} IS NULL"

# Corrija aqui QUALQUER rótulo do controle que o casamento automático errar.
# (o script imprime a tabela de correspondência proposta para você conferir)
#   "rótulo no controle": imovel_id_correto
IMOVEL_OVERRIDES = {
    # Confirmados no cadastro local (imovel.id). Ajuste se o score automático errar.
    "F-18": 8,                  # Casa F 18 (não id 59 = CNPJ Villa Real)
    "404 04 São José": 72,      # Bl 04 apto 404 / São José
    "Executive Privê": 71,      # 101 / Executive Privê
    "505 A": 65,                # Unidade 505 A / Veredas do Bosque
    "101 C": 70,                # Unidade 101 C / Veredas do Bosque
    "1101 C Veredas": 73,       # Unidade 1101 C / Veredas do Bosque
    "Casa Alvorada": 42,        # Bairro Alvorada
}

# Vínculos manuais pós-revisão (além do casamento ALTA/MÉDIA do dry-run).
# lancamento_id -> (imovel_id, observação)
MANUAL_LINKS = {
    180353: (72, "404 São José cond R$308,68 — CONFLITO resolvido"),
    177436: (65, "505 A água SANEAGO (não vincular 177417 SISPAG)"),
    180037: (65, "505 A água R$16,65"),
    180419: (70, "101 C água R$17,46"),
    180151: (73, "1101 C gás nov/2025"),
    180152: (73, "1101 C gás fev/2026"),
}

# Reimportações / candidatos descartados — registrar no relatório, NÃO vincular.
DUPLICATAS_INVESTIGAR = {
    177417: "505 A água R$38,65 — SISPAG; vinculado 177436 (SANEAGO)",
    210074: "505 A água R$16,65 — reimport duplicata de 180037",
    210802: "101 C água R$17,46 — reimport duplicata de 180419",
}

# ──────────────────────────── HELPERS ──────────────────────────────
def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "")
                   if unicodedata.category(c) != "Mn")

def norm(s):
    s = strip_accents(str(s)).lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def parse_valor(v):
    if v is None or str(v).strip() == "":
        return None
    s = str(v).strip()
    if "," in s:                       # 1.234,56 -> 1234.56
        s = s.replace(".", "").replace(",", ".")
    try:
        return Decimal(s).quantize(Decimal("0.01"))
    except Exception:
        return None

def parse_date(s):
    if not s:
        return None
    s = str(s).strip()[:10]
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None

def barcode_value(code):
    """Recupera o valor (R$) embutido na linha digitável do boleto."""
    code = re.sub(r"\D", "", code or "")
    if len(code) == 48 and code[0] == "8":          # arrecadação (concessionária)
        bc = code[0:11] + code[12:23] + code[24:35] + code[36:47]  # tira os 4 DVs -> 44
        if bc[2] in ("6", "7"):                      # 6/7 = valor efetivo em reais
            return (Decimal(int(bc[4:15])) / 100).quantize(Decimal("0.01"))
        return None                                  # 8/9 = referência, sem valor
    if len(code) == 47:                              # boleto bancário
        return (Decimal(int(code[-10:])) / 100).quantize(Decimal("0.01"))
    return None

# ─────────────────────── CARGA DO CONTROLE ─────────────────────────
def load_control(path):
    out = []
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter=";"):
            v_ctrl = parse_valor(r.get("valor"))
            v_bar = barcode_value(r.get("linha_digitavel"))
            cand = set(v for v in (v_ctrl, v_bar) if v is not None)
            display = v_ctrl if v_ctrl is not None else v_bar
            if v_ctrl is not None and v_bar is not None and v_ctrl != v_bar:
                origem_valor = f"controle {v_ctrl} / barcode {v_bar}"
            elif v_ctrl is not None:
                origem_valor = "controle"
            elif v_bar is not None:
                origem_valor = "código de barras"
            else:
                origem_valor = "—"
            out.append(dict(
                imovel=(r.get("imovel") or "").strip(),
                tipo=(r.get("tipo") or "").strip(),
                vencimento=parse_date(r.get("vencimento")),
                valor=display,
                valores=cand,
                origem_valor=origem_valor,
                status=(r.get("status") or "").strip(),
                linha=r.get("linha_digitavel", ""),
            ))
    return out

# ───────────────── RESOLUÇÃO RÓTULO -> IMOVEL_ID ───────────────────
def resolve_imoveis(labels, imoveis, overrides):
    """imoveis: lista de dicts {id, processo_id, <campos de match>}."""
    # texto de busca por imóvel
    for im in imoveis:
        partes = [str(im.get(c) or "") for c in IMOVEL["cols_match"]]
        im["_txt"] = norm(" ".join(partes))
        im["_cols"] = [norm(p) for p in partes]

    mapping = {}
    for label in labels:
        if label in overrides:
            mapping[label] = dict(imovel_id=overrides[label], score=1.0,
                                  match="(override manual)", procs=[], manual=True)
            continue
        nl = norm(label)
        best = None
        for im in imoveis:
            # score = melhor entre: ratio no texto completo, ratio por coluna,
            # e bônus quando todos os tokens do rótulo aparecem no imóvel
            r_full = difflib.SequenceMatcher(None, nl, im["_txt"]).ratio()
            r_col = max((difflib.SequenceMatcher(None, nl, c).ratio()
                         for c in im["_cols"] if c), default=0)
            toks = nl.split()
            contidos = sum(1 for t in toks if t and t in im["_txt"])
            bonus = contidos / len(toks) if toks else 0
            score = max(r_full, r_col) * 0.6 + bonus * 0.4
            cand = (score, im)
            if best is None or cand[0] > best[0]:
                best = cand
        score, im = best
        procs = im.get("_procs") or []
        mapping[label] = dict(imovel_id=im[IMOVEL["col_id"]], score=round(score, 2),
                              match=" / ".join(p for p in
                                  [str(im.get(c) or "") for c in IMOVEL["cols_match"]] if p),
                              procs=procs, manual=False)
    return mapping

# ───────────────────────── CASAMENTO ───────────────────────────────
def match(control, lancamentos, mapping, tol):
    """lancamentos: lista de dicts {id, valor(Decimal), datas[list], processo_id}.
    Retorna linhas de vínculo + conflitos."""
    by_val = defaultdict(list)
    for l in lancamentos:
        if l["valor"] is not None:
            by_val[l["valor"]].append(l)

    rows = []
    claims = defaultdict(list)   # lancamento_id -> [imovel_id...] (p/ detectar conflito)

    for c in control:
        if not c["valores"] or c["vencimento"] is None:
            continue
        m = mapping.get(c["imovel"])
        if not m:
            continue
        alvo_imovel = m["imovel_id"]
        alvo_procs = set(m.get("procs") or [])

        cands, vistos = [], set()
        for v in c["valores"]:
            for l in by_val.get(v, []):
                if l["id"] in vistos:
                    continue
                datas = [d for d in l["datas"] if d]
                if datas and any(abs((d - c["vencimento"]).days) <= tol for d in datas):
                    cands.append(l)
                    vistos.add(l["id"])

        if not cands:
            rows.append(_row(c, alvo_imovel, None, "NAO_ENCONTRADO",
                             "sem lançamento com esse valor/data"))
            continue

        # desempate por processo (imovel.processo_id + imovel_processo ativos)
        comproc = [l for l in cands if l["processo_id"] is not None and
                   l["processo_id"] in alvo_procs]
        if len(comproc) >= 1:
            escolhidos, conf = comproc, "ALTA"
        elif len(cands) == 1:
            escolhidos, conf = cands, "MEDIA"   # único por valor+data, sem processo p/ confirmar
        else:
            procs_txt = ",".join(str(p) for p in sorted(alvo_procs)) or "—"
            rows.append(_row(c, alvo_imovel, None, "AMBIGUO",
                             f"{len(cands)} lançamentos batem valor+data; "
                             f"nenhum com processo em ({procs_txt})"))
            continue

        for l in escolhidos:
            claims[l["id"]].append(alvo_imovel)
            rows.append(_row(c, alvo_imovel, l, conf, ""))

    # marca lançamentos disputados por imóveis diferentes
    for r in rows:
        lid = r["lancamento_id"]
        if lid and len(set(claims.get(lid, []))) > 1:
            r["status_match"] = "CONFLITO"
            r["obs"] = (r["obs"] + " | lançamento reivindicado por +1 imóvel").strip(" |")
    return rows

def _row(c, imovel_id, l, status_match, obs):
    return dict(
        lancamento_id=(l["id"] if l else ""),
        processo_id=(l["processo_id"] if l else ""),
        data_lancamento=(next((d for d in l["datas"] if d), "") if l else ""),
        valor=str(c["valor"]),
        imovel_id=imovel_id,
        imovel_label=c["imovel"],
        tipo=c["tipo"],
        venc_controle=c["vencimento"],
        origem_valor=c["origem_valor"],
        confianca=status_match if status_match in ("ALTA", "MEDIA") else "",
        status_match=status_match,
        obs=obs,
    )

# ───────────────────────── SAÍDA ───────────────────────────────────
def build_apply_set(rows):
    """União dry-run ALTA/MÉDIA + MANUAL_LINKS, sem ids em DUPLICATAS_INVESTIGAR."""
    blocked = set(DUPLICATAS_INVESTIGAR)
    seen = set()
    aplicaveis = []
    for r in rows:
        lid = r.get("lancamento_id")
        if not lid or r["status_match"] not in ("ALTA", "MEDIA"):
            continue
        lid = int(lid)
        if lid in blocked or lid in seen:
            continue
        seen.add(lid)
        aplicaveis.append(dict(
            lancamento_id=lid,
            imovel_id=int(r["imovel_id"]),
            origem="auto",
            obs=f"{r['imovel_label']} / {r['tipo']} / {r['valor']} / {r['confianca']}",
        ))
    for lid, (imovel_id, obs) in MANUAL_LINKS.items():
        if lid in blocked or lid in seen:
            continue
        seen.add(lid)
        aplicaveis.append(dict(
            lancamento_id=lid,
            imovel_id=imovel_id,
            origem="manual",
            obs=obs,
        ))
    return aplicaveis


def emit(rows, mapping, outdir):
    rcsv = os.path.join(outdir, "vinculo_imovel.csv")
    cols = ["lancamento_id", "imovel_id", "imovel_label", "tipo", "valor",
            "data_lancamento", "venc_controle", "processo_id", "origem_valor",
            "confianca", "status_match", "obs"]
    manual_rows = []
    for lid, (imovel_id, obs) in MANUAL_LINKS.items():
        manual_rows.append(dict(
            lancamento_id=lid,
            imovel_id=imovel_id,
            imovel_label="(manual)",
            tipo="",
            valor="",
            data_lancamento="",
            venc_controle="",
            processo_id="",
            origem_valor="",
            confianca="MANUAL",
            status_match="MANUAL",
            obs=obs,
        ))
    with open(rcsv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)
        for r in manual_rows:
            w.writerow(r)

    dup_csv = os.path.join(outdir, "vinculo_duplicatas.csv")
    with open(dup_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["lancamento_id", "motivo"])
        for lid, motivo in sorted(DUPLICATAS_INVESTIGAR.items()):
            w.writerow([lid, motivo])

    aplicaveis = build_apply_set(rows)
    sql = os.path.join(outdir, "vinculo_updates.sql")
    auto_n = sum(1 for a in aplicaveis if a["origem"] == "auto")
    manual_n = sum(1 for a in aplicaveis if a["origem"] == "manual")
    with open(sql, "w", encoding="utf-8") as f:
        f.write("-- Vínculo imóvel <- financeiro_lancamento (revise antes de aplicar).\n")
        f.write(f"-- Alvo: {LANC['table']}.{LINK_COLUMN}\n")
        f.write(f"-- Auto ALTA/MÉDIA: {auto_n} | Manual: {manual_n} | Total: {len(aplicaveis)}\n")
        f.write("-- Duplicatas NÃO vinculadas: ver vinculo_duplicatas.csv\n")
        f.write("START TRANSACTION;\n")
        for a in aplicaveis:
            tag = "MANUAL" if a["origem"] == "manual" else "AUTO"
            f.write(
                f"UPDATE {LANC['table']} SET {LINK_COLUMN} = {a['imovel_id']} "
                f"WHERE {LANC['col_id']} = {a['lancamento_id']} "
                f"AND {LINK_COLUMN} IS NULL;  -- [{tag}] {a['obs']}\n"
            )
        f.write("COMMIT;\n")
    return rcsv, sql, aplicaveis, dup_csv

def print_mapping(mapping):
    print("\n=== Correspondência rótulo do controle  ->  imóvel do cadastro ===")
    for label, m in mapping.items():
        flag = "  <-- CONFERIR (score baixo)" if (not m["manual"] and m["score"] < 0.55) else ""
        procs = ",".join(str(p) for p in (m.get("procs") or [])) or "—"
        print(f"  {label:22} -> id {str(m['imovel_id']):>6}  (score {m['score']}, procs {procs})  [{m['match']}]{flag}")

# ───────────────────────── BANCO ───────────────────────────────────
def report_apply_stats(conn):
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT COUNT(*) AS n FROM {LANC['table']} "
            f"WHERE {LINK_COLUMN} IS NOT NULL AND {LANC['where_extra']}"
        )
        vinculados = cur.fetchone()["n"]
        cur.execute(
            f"SELECT COUNT(*) AS n FROM {LANC['table']} "
            f"WHERE {LINK_COLUMN} IS NULL AND {LANC['where_extra']}"
        )
        sem = cur.fetchone()["n"]
        cur.execute(
            f"SELECT {LINK_COLUMN} AS imovel_id, COUNT(*) AS n "
            f"FROM {LANC['table']} "
            f"WHERE {LINK_COLUMN} IS NOT NULL AND {LANC['where_extra']} "
            f"GROUP BY {LINK_COLUMN} ORDER BY n DESC, imovel_id"
        )
        por_imovel = cur.fetchall()
    print("\n=== Pós-apply ===")
    print(f"  Débitos ATIVOS com imóvel: {vinculados}")
    print(f"  Débitos ATIVOS sem imóvel: {sem}")
    print("  Por imóvel:")
    for row in por_imovel:
        print(f"    imovel_id {row['imovel_id']:>4}: {row['n']} lançamentos")
    print("  Duplicatas registradas (NÃO vinculadas):")
    for lid, motivo in sorted(DUPLICATAS_INVESTIGAR.items()):
        print(f"    {lid}: {motivo}")


def column_exists(conn, table, column):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS n FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s",
            (DB["database"], table, column),
        )
        return cur.fetchone()["n"] > 0


def connect():
    try:
        import pymysql
    except ImportError:
        sys.exit("Instale o driver:  pip install pymysql")
    return pymysql.connect(charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor, **DB)

def fetch_imoveis(conn):
    cols = [IMOVEL["col_id"], IMOVEL["col_processo"]] + IMOVEL["cols_match"]
    q = f"SELECT {', '.join(cols)} FROM {IMOVEL['table']}"
    if IMOVEL["where_extra"]:
        q += f" WHERE {IMOVEL['where_extra']}"
    with conn.cursor() as cur:
        cur.execute(q)
        imoveis = cur.fetchall()
    # processos ativos em imovel_processo (imovel.processo_id costuma estar NULL)
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT imovel_id, processo_id FROM {IMOVEL_PROCESSO_TABLE} WHERE ativo = 1"
        )
        proc_rows = cur.fetchall()
    procs_por_imovel = defaultdict(set)
    for row in proc_rows:
        procs_por_imovel[row["imovel_id"]].add(row["processo_id"])
    for im in imoveis:
        procs = set(procs_por_imovel.get(im[IMOVEL["col_id"]], set()))
        if im.get(IMOVEL["col_processo"]):
            procs.add(im[IMOVEL["col_processo"]])
        im["_procs"] = sorted(procs)
    return imoveis

def fetch_lancamentos(conn, valores, where_extra=None):
    if not valores:
        return []
    placeholders = ", ".join(["%s"] * len(valores))
    datas = ", ".join(LANC["cols_data"])
    extra = where_extra if where_extra is not None else LANC["where_extra"]
    q = (f"SELECT {LANC['col_id']} AS id, {LANC['col_valor']} AS valor, "
         f"{datas}, {LANC['col_processo']} AS processo_id "
         f"FROM {LANC['table']} "
         f"WHERE {LANC['col_valor']} IN ({placeholders})")
    if extra:
        q += f" AND {extra}"
    with conn.cursor() as cur:
        cur.execute(q, [str(v) for v in valores])
        out = []
        for row in cur.fetchall():
            out.append(dict(id=row["id"],
                            valor=parse_valor(row["valor"]),
                            datas=[row.get(c) for c in LANC["cols_data"]],
                            processo_id=row.get("processo_id")))
        return out


def format_candidato(l):
    d = next((x for x in l["datas"] if x), "")
    return f"{l['id']}|{l['valor']}|{d}|proc={l['processo_id'] or 'NULL'}"


def load_nao_encontrados(vinculo_path, control_path):
    """Linhas NAO_ENCONTRADO da 1ª passada, enriquecidas com valores do controle."""
    raw = []
    with open(vinculo_path, encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter=";"):
            if r.get("status_match") != "NAO_ENCONTRADO":
                continue
            raw.append(r)

    control = load_control(control_path)
    idx = {}
    for c in control:
        if c["vencimento"] is not None:
            idx[(c["imovel"], c["tipo"], c["vencimento"])] = c

    enriched = []
    for r in raw:
        imovel_id = int(r["imovel_id"])
        label = r["imovel_label"]
        tipo = r["tipo"]
        venc = parse_date(r["venc_controle"]) if r.get("venc_controle") else None
        c = idx.get((label, tipo, venc))
        if c:
            valores = set(c["valores"])
            origem = c["origem_valor"]
        else:
            v = parse_valor(r["valor"])
            valores = {v} if v is not None else set()
            origem = r.get("origem_valor", "")
        if not valores:
            enriched.append(dict(
                imovel_id=imovel_id, imovel_label=label, tipo=tipo, vencimento=venc,
                valores=set(), origem_valor=origem, valor_display=None,
                skip_motivo="sem valor (controle e barcode)",
            ))
            continue
        display = parse_valor(r["valor"])
        if display is None and len(valores) == 1:
            display = next(iter(valores))
        enriched.append(dict(
            imovel_id=imovel_id, imovel_label=label, tipo=tipo, vencimento=venc,
            valores=valores, origem_valor=origem, valor_display=display,
        ))
    return enriched


def match_pass2(items, lancamentos, procs_por_imovel):
    blocked = set(DUPLICATAS_INVESTIGAR)
    auto = []
    revisar = []
    claimed = set()

    for item in items:
        if item.get("skip_motivo"):
            revisar.append({**item, "status": "REVISAR", "motivo": item["skip_motivo"], "candidatos": []})
            continue

        alvo_procs = set(procs_por_imovel.get(item["imovel_id"], []))
        pool = [
            l for l in lancamentos
            if l["id"] not in blocked
            and l["valor"] is not None
            and l["valor"] in item["valores"]
        ]

        imovel_id = item["imovel_id"]
        if imovel_id in PASS2_IMOVEL_IDS_COM_PROCESSO:
            cands = [l for l in pool if l["processo_id"] is not None and l["processo_id"] in alvo_procs]
            if len(cands) == 1:
                lid = cands[0]["id"]
                if lid in claimed:
                    revisar.append(dict(
                        **item, status="REVISAR",
                        motivo=f"lançamento {lid} já reservado por outra linha do controle",
                        candidatos=cands,
                    ))
                else:
                    claimed.add(lid)
                    auto.append(dict(**item, lancamento_id=lid, candidato=cands[0], status="ALTA"))
            else:
                motivo = (
                    f"{len(cands)} candidatos valor+processo (procs {sorted(alvo_procs) or '—'})"
                    if cands
                    else f"0 candidatos com processo; {len(pool)} com valor exato sem processo"
                )
                revisar.append(dict(**item, status="REVISAR", motivo=motivo, candidatos=cands or pool))

        elif imovel_id in PASS2_IMOVEL_IDS_SEM_PROCESSO:
            venc = item["vencimento"]
            if venc:
                cands = [
                    l for l in pool
                    if any(d and abs((d - venc).days) <= PASS2_DATE_TOLERANCE_DAYS for d in l["datas"])
                ]
            else:
                cands = list(pool)
            revisar.append(dict(
                **item, status="REVISAR",
                motivo="imóvel sem processo — revisão manual (valor+data±60d)",
                candidatos=cands,
            ))
        else:
            revisar.append(dict(
                **item, status="REVISAR",
                motivo=f"imovel_id {imovel_id} fora das listas COM/SEM processo",
                candidatos=pool,
            ))

    return auto, revisar


def emit_pass2(auto, revisar, outdir):
    sql_path = os.path.join(outdir, "vinculo_2a_auto.sql")
    rev_path = os.path.join(outdir, "vinculo_2a_revisar.csv")
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write("-- 2ª passada: vínculos ALTA (valor exato + processo único). Revise antes de aplicar.\n")
        f.write(f"-- Total: {len(auto)}\n")
        f.write("START TRANSACTION;\n")
        for a in auto:
            l = a["candidato"]
            f.write(
                f"UPDATE {LANC['table']} SET {LINK_COLUMN} = {a['imovel_id']} "
                f"WHERE {LANC['col_id']} = {a['lancamento_id']} "
                f"AND {LINK_COLUMN} IS NULL;  "
                f"-- {a['imovel_label']} / {a['tipo']} / {a['valor_display']} / "
                f"{format_candidato(l)}\n"
            )
        f.write("-- COMMIT;\n")

    cols = ["imovel_label", "tipo", "vencimento", "valor", "imovel_id", "status",
            "motivo", "candidatos", "origem_valor"]
    with open(rev_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for r in revisar:
            w.writerow(dict(
                imovel_label=r["imovel_label"],
                tipo=r["tipo"],
                vencimento=r["vencimento"] or "",
                valor=r.get("valor_display") or "",
                imovel_id=r["imovel_id"],
                status=r["status"],
                motivo=r["motivo"],
                candidatos=" ; ".join(format_candidato(c) for c in r.get("candidatos", [])),
                origem_valor=r.get("origem_valor", ""),
            ))
    return sql_path, rev_path


def run_pass2(control_path, vinculo_path, apply, outdir):
    items = load_nao_encontrados(vinculo_path, control_path)
    conn = connect()
    try:
        imoveis = fetch_imoveis(conn)
        procs_por_imovel = {im[IMOVEL["col_id"]]: im.get("_procs", []) for im in imoveis}

        valores = sorted({v for it in items for v in it.get("valores", set())})
        lancamentos = fetch_lancamentos(conn, valores, where_extra=LANC_WHERE_UNLINKED)
        print(f"\n=== 2ª passada (dry-run) ===")
        print(f"Linhas NAO_ENCONTRADO da 1ª rodada: {len(items)}")
        print(f"Pool: {len(lancamentos)} lançamentos (imovel_id IS NULL, valor exato)")
        print(f"Filtro pool: {LANC_WHERE_UNLINKED}")

        auto, revisar = match_pass2(items, lancamentos, procs_por_imovel)
        sql_path, rev_path = emit_pass2(auto, revisar, outdir)

        print(f"\nALTA (auto):     {len(auto)}")
        print(f"Para revisar:    {len(revisar)}")
        print(f"SQL:             {sql_path}")
        print(f"Revisão:         {rev_path}")

        if auto:
            print("\n--- Vínculos ALTA propostos ---")
            for a in auto:
                print(f"  {a['lancamento_id']:>6} -> imovel {a['imovel_id']}  "
                      f"{a['imovel_label']:22} {a['tipo']:10} R${a['valor_display']}  "
                      f"[{format_candidato(a['candidato'])}]")

        if revisar:
            print("\n--- Amostra revisar (primeiros 12) ---")
            for r in revisar[:12]:
                n = len(r.get("candidatos") or [])
                print(f"  {r['imovel_label']:22} {r['tipo']:10} R${r.get('valor_display','')}  "
                      f"{r['motivo']}  ({n} candidatos)")
                for c in (r.get("candidatos") or [])[:3]:
                    print(f"      -> {format_candidato(c)}")
                if n > 3:
                    print(f"      ... +{n - 3}")

        if apply:
            if not column_exists(conn, LANC["table"], LINK_COLUMN):
                sys.exit(f"Coluna {LINK_COLUMN} inexistente. Rode migration V130.")
            with conn.cursor() as cur:
                cur.execute("START TRANSACTION")
                n = 0
                for a in auto:
                    cur.execute(
                        f"UPDATE {LANC['table']} SET {LINK_COLUMN}=%s "
                        f"WHERE {LANC['col_id']}=%s AND {LINK_COLUMN} IS NULL",
                        (a["imovel_id"], a["lancamento_id"]),
                    )
                    n += cur.rowcount
                cur.execute("COMMIT")
            report_apply_stats(conn)
            print(f"\n[APLICADO 2ª passada] {n} lançamentos vinculados.")
        else:
            print("\n[DRY-RUN 2ª passada] nada gravado. Use --pass2 --apply após seu OK.")
    finally:
        conn.close()


def run_varredura_processo(outdir, apply=False):
    """Vincula por processo_id quando imovel_processo (ativo) é 1:1."""
    conn = connect()
    try:
        placeholders = ", ".join(["%s"] * len(VARREDURA_PROCESSO_IDS))
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT ip.processo_id,
                       COUNT(DISTINCT ip.imovel_id) AS qtd_imoveis,
                       GROUP_CONCAT(DISTINCT ip.imovel_id ORDER BY ip.imovel_id) AS imovel_ids
                FROM {IMOVEL_PROCESSO_TABLE} ip
                JOIN {IMOVEL['table']} i ON i.id = ip.imovel_id AND i.ativo = 1
                WHERE ip.ativo = 1 AND ip.processo_id IN ({placeholders})
                GROUP BY ip.processo_id
                ORDER BY ip.processo_id
                """,
                VARREDURA_PROCESSO_IDS,
            )
            proc_map = cur.fetchall()

        print("\n=== Varredura por processo (1:1 imovel_processo) ===")
        ok_procs = {}
        multi = []
        for row in proc_map:
            pid = row["processo_id"]
            qtd = row["qtd_imoveis"]
            ids = row["imovel_ids"]
            if qtd == 1:
                imovel_id = int(ids)
                ok_procs[pid] = imovel_id
                print(f"  processo {pid:>5} -> imovel {imovel_id}  (1:1 OK)")
            else:
                multi.append(row)
                print(f"  processo {pid:>5} -> imoveis [{ids}]  ({qtd} imóveis — EXCLUÍDO)")

        for pid in VARREDURA_PROCESSO_IDS:
            if pid not in {r["processo_id"] for r in proc_map}:
                print(f"  processo {pid:>5} -> (sem vínculo ativo em imovel_processo)")

        if multi:
            print(f"\nProcessos com 2+ imóveis (NÃO entram no SQL): {len(multi)}")

        if not ok_procs:
            print("\nNenhum processo 1:1 elegível.")
            return

        ok_placeholders = ", ".join(["%s"] * len(ok_procs))
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT fl.id, fl.processo_id, fl.valor, fl.data_lancamento,
                       LEFT(fl.descricao, 80) AS descricao
                FROM {LANC['table']} fl
                WHERE fl.status = 'ATIVO' AND fl.natureza = 'DEBITO'
                  AND fl.{LINK_COLUMN} IS NULL
                  AND fl.processo_id IN ({ok_placeholders})
                ORDER BY fl.processo_id, fl.data_lancamento, fl.id
                """,
                list(ok_procs.keys()),
            )
            lanc_rows = cur.fetchall()

        csv_path = os.path.join(outdir, "vinculo_processo.csv")
        sql_path = os.path.join(outdir, "vinculo_processo.sql")
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(["lancamento_id", "processo_id", "imovel_id", "data_lancamento", "valor", "descricao"])
            for r in lanc_rows:
                w.writerow([
                    r["id"], r["processo_id"], ok_procs[r["processo_id"]],
                    r["data_lancamento"], r["valor"], r["descricao"],
                ])

        from collections import Counter
        by_imovel = Counter(ok_procs[r["processo_id"]] for r in lanc_rows)
        by_proc = Counter(r["processo_id"] for r in lanc_rows)

        with open(sql_path, "w", encoding="utf-8") as f:
            f.write("-- Varredura por processo (1:1 imovel_processo). Dry-run — revise antes de aplicar.\n")
            f.write(f"-- Lançamentos: {len(lanc_rows)}\n")
            f.write("START TRANSACTION;\n")
            for pid, imovel_id in sorted(ok_procs.items()):
                n = by_proc.get(pid, 0)
                f.write(
                    f"UPDATE {LANC['table']} SET {LINK_COLUMN} = {imovel_id} "
                    f"WHERE processo_id = {pid} AND {LINK_COLUMN} IS NULL "
                    f"AND {LANC['where_extra']};  -- {n} lançamento(s)\n"
                )
            f.write("-- COMMIT;\n")

        print(f"\nLançamentos elegíveis: {len(lanc_rows)}")
        print(f"CSV:  {csv_path}")
        print(f"SQL:  {sql_path}")
        print("\nResumo por imóvel (proposto, NÃO aplicado):")
        for imovel_id, n in sorted(by_imovel.items()):
            print(f"  imovel_id {imovel_id:>4}: {n} lançamentos")
        print("\nResumo por processo:")
        for pid, n in sorted(by_proc.items()):
            print(f"  processo {pid:>5} -> imovel {ok_procs[pid]}: {n} lançamentos")

        if apply:
            sys.exit("Use --varredura-processo sem --apply primeiro; aguardando OK explícito.")
    finally:
        conn.close()


# ───────────────────────── MAIN ────────────────────────────────────
def run(csv_path, apply, outdir):
    control = load_control(csv_path)
    conn = connect()
    try:
        imoveis = fetch_imoveis(conn)
        labels = sorted({c["imovel"] for c in control if c["imovel"]})
        mapping = resolve_imoveis(labels, imoveis, IMOVEL_OVERRIDES)
        imovel_by_id = {im[IMOVEL["col_id"]]: im for im in imoveis}
        for m in mapping.values():
            if m.get("manual") or not m.get("procs"):
                im = imovel_by_id.get(m["imovel_id"])
                if im:
                    m["procs"] = im.get("_procs", [])
        print_mapping(mapping)

        valores = sorted({v for c in control for v in c["valores"]})
        lancamentos = fetch_lancamentos(conn, valores)
        print(f"\nLançamentos candidatos no banco (por valor): {len(lancamentos)}")

        rows = match(control, lancamentos, mapping, DATE_TOLERANCE_DAYS)
        rcsv, sql, aplicaveis, dup_csv = emit(rows, mapping, outdir)

        from collections import Counter
        st = Counter(r["status_match"] for r in rows)
        print("\n=== Resumo do casamento ===")
        for k in ("ALTA", "MEDIA", "AMBIGUO", "CONFLITO", "NAO_ENCONTRADO"):
            if st.get(k):
                print(f"  {k:14}: {st[k]}")
        auto_n = sum(1 for a in aplicaveis if a["origem"] == "auto")
        manual_n = sum(1 for a in aplicaveis if a["origem"] == "manual")
        print(f"\nRelatório:     {rcsv}")
        print(f"Duplicatas:    {dup_csv}  ({len(DUPLICATAS_INVESTIGAR)} ids)")
        print(f"SQL:           {sql}  (auto={auto_n}, manual={manual_n}, total={len(aplicaveis)})")

        if apply:
            if not column_exists(conn, LANC["table"], LINK_COLUMN):
                sys.exit(
                    f"Coluna {LANC['table']}.{LINK_COLUMN} não existe. "
                    "Rode a migration V130__financeiro_lancamento_imovel.sql antes de --apply."
                )
            with conn.cursor() as cur:
                cur.execute("START TRANSACTION")
                n = 0
                for a in aplicaveis:
                    cur.execute(
                        f"UPDATE {LANC['table']} SET {LINK_COLUMN}=%s "
                        f"WHERE {LANC['col_id']}=%s AND {LINK_COLUMN} IS NULL",
                        (a["imovel_id"], a["lancamento_id"]))
                    n += cur.rowcount
                cur.execute("COMMIT")
            report_apply_stats(conn)
            print(f"\n[APLICADO] {n} lançamentos vinculados nesta rodada.")
        else:
            print("\n[DRY-RUN] nada foi alterado. Use --apply para gravar.")
    finally:
        conn.close()


def self_test(csv_path):
    print("=== SELF-TEST (sem banco) ===")
    # 1) valor recuperado do código de barras confere com o valor do controle?
    ok = bad = 0
    if csv_path and os.path.exists(csv_path):
        with open(csv_path, encoding="utf-8") as f:
            for r in csv.DictReader(f, delimiter=";"):
                v_ctrl = parse_valor(r.get("valor"))
                v_bar = barcode_value(r.get("linha_digitavel"))
                if v_ctrl is not None and v_bar is not None:
                    if v_ctrl == v_bar:
                        ok += 1
                    else:
                        bad += 1
                        print(f"  divergência: controle {v_ctrl} x barcode {v_bar} "
                              f"({r.get('imovel')}/{r.get('tipo')})")
        print(f"valor barcode x controle -> iguais: {ok} | divergentes: {bad}")

    # 2) resolução de imóvel + casamento com processo (fixtures)
    imoveis = [
        dict(id=1, processo_id=900, _procs=[900], unidade="F-18", condominio="", titulo="Ap F-18", endereco_completo=""),
        dict(id=2, processo_id=None, _procs=[900], unidade="404", condominio="São José", titulo="", endereco_completo="Cond São José 404"),
        dict(id=3, processo_id=None, _procs=[], unidade="", condominio="Executive Privê", titulo="Executive Privê", endereco_completo=""),
        dict(id=4, processo_id=901, _procs=[901], unidade="505 A", condominio="VRV", titulo="", endereco_completo=""),
    ]
    mapping = resolve_imoveis(["F-18", "404 04 São José", "Executive Privê", "505 A"],
                              imoveis, {})
    print_mapping(mapping)
    assert mapping["F-18"]["imovel_id"] == 1
    assert mapping["404 04 São José"]["imovel_id"] == 2
    assert mapping["Executive Privê"]["imovel_id"] == 3
    assert mapping["505 A"]["imovel_id"] == 4

    # casamento: dois imóveis do MESMO processo, mesmo valor/data -> processo não
    # desempata, mas o controle aponta imóveis diferentes em datas diferentes.
    control = [
        dict(imovel="404 04 São José", tipo="condomínio", vencimento=date(2026,3,20),
             valor=Decimal("268.42"), valores={Decimal("268.42")}, origem_valor="controle", status="", linha=""),
        dict(imovel="505 A", tipo="condomínio", vencimento=date(2026,3,10),
             valor=Decimal("294.56"), valores={Decimal("294.56")}, origem_valor="controle", status="", linha=""),
    ]
    lanc = [
        dict(id=10, valor=Decimal("268.42"), datas=[date(2026,3,19)], processo_id=900),
        dict(id=11, valor=Decimal("294.56"), datas=[date(2026,3,10)], processo_id=901),
    ]
    rows = match(control, lanc, mapping, 7)
    by = {r["imovel_label"]: r for r in rows}
    assert by["404 04 São José"]["lancamento_id"] == 10 and by["404 04 São José"]["confianca"] == "ALTA"
    assert by["505 A"]["lancamento_id"] == 11 and by["505 A"]["confianca"] == "ALTA"
    print("casamento com desempate por processo: OK")
    print("\nSELF-TEST passou.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="controle-contas.csv")
    ap.add_argument("--pass2", action="store_true", help="2ª passada: NAO_ENCONTRADOS da 1ª rodada")
    ap.add_argument("--varredura-processo", action="store_true",
                    help="Varredura 1:1 por processo_id (dry-run)")
    ap.add_argument("--vinculo", default="vinculo_imovel.csv", help="Relatório da 1ª passada")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--outdir", default=".")
    a = ap.parse_args()
    base = os.path.dirname(__file__) or "."

    def resolve(p):
        return p if os.path.isabs(p) else os.path.join(base, p)

    if a.self_test:
        self_test(resolve(a.csv))
    elif a.pass2:
        run_pass2(resolve(a.csv), resolve(a.vinculo), a.apply, a.outdir)
    elif a.varredura_processo:
        run_varredura_processo(a.outdir, a.apply)
    else:
        run(resolve(a.csv), a.apply, a.outdir)
