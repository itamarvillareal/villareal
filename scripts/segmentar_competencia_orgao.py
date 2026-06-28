#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ETAPA 2 (SOMENTE LEITURA): segmenta os processos com `competencia` por casabilidade
com as varas candidatas da comarca, usando match determinístico de texto.

NÃO escreve no banco. Lê o CSV de extração (Etapa 1) e gera 4 CSVs + 1 resumo .txt.
Conservador no balde ALTA: só entra match EXATO e ÚNICO após normalização.

Uso:
    python3 scripts/segmentar_competencia_orgao.py \
        [--in tmp/relatorios/competencia-orgao-extracao-AAAA-MM-DD.csv] \
        [--outdir tmp/relatorios]
"""
import argparse
import csv
import os
import re
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Normalização / sinônimos (LISTADOS no resumo para auditoria)
# ---------------------------------------------------------------------------
STOPWORDS = {"DE", "DA", "DO", "DAS", "DOS", "E"}

ORDINAIS_EXTENSO = {
    "PRIMEIRO": "1", "PRIMEIRA": "1",
    "SEGUNDO": "2", "SEGUNDA": "2",
    "TERCEIRO": "3", "TERCEIRA": "3",
    "QUARTO": "4", "QUARTA": "4",
    "QUINTO": "5", "QUINTA": "5",
    "SEXTO": "6", "SEXTA": "6",
    "SETIMO": "7", "SETIMA": "7",
    "OITAVO": "8", "OITAVA": "8",
    "NONO": "9", "NONA": "9",
    "DECIMO": "10", "DECIMA": "10",
}

# Descrição textual das regras (para o resumo)
REGRAS_DESCRICAO = [
    "Remoção de acentos (NFKD) + UPPER (ex.: 'Cível' -> 'CIVEL').",
    "Pontuação ( . , : ; ( ) / - ) trocada por espaço; espaços colapsados.",
    "Ordinal por símbolo: dígitos seguidos de º/ª/°/o/a viram só o número (1º,1ª,1A,6A -> 1,6).",
    "Ordinal por extenso: PRIMEIR[OA]..DECIM[OA] -> 1..10.",
    "Abreviação: 'JEC' (palavra isolada) -> 'JUIZADO ESPECIAL CIVEL'.",
    "Match EXATO = string normalizada idêntica. Match PARCIAL = um conjunto de tokens "
    "significativos (sem stopwords DE/DA/DO/E) contido no outro.",
]


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)
    )


def normalizar(texto: str):
    """Retorna (normalizado, flags_aplicadas:set)."""
    flags = set()
    if texto is None:
        texto = ""
    s = strip_accents(texto).upper()

    s2 = re.sub(r"[^\w\s]", " ", s)  # pontuação -> espaço (\w mantém dígitos/letras/_)
    s2 = s2.replace("_", " ")
    if s2 != s:
        flags.add("pontuacao")
    s = s2

    # Ordinal por símbolo: dígitos + (o/a) ordinal -> só dígitos. Ex.: "1O","1A","6A".
    s2 = re.sub(r"(\d+)[OA](?![A-Z0-9])", r"\1", s)
    if s2 != s:
        flags.add("ordinal_simbolo")
    s = s2

    # Ordinal por extenso
    def _ord_ext(m):
        return ORDINAIS_EXTENSO[m.group(0)]

    s2 = re.sub(
        r"\b(" + "|".join(ORDINAIS_EXTENSO.keys()) + r")\b", _ord_ext, s
    )
    if s2 != s:
        flags.add("ordinal_extenso")
    s = s2

    # Abreviação JEC
    s2 = re.sub(r"\bJEC\b", "JUIZADO ESPECIAL CIVEL", s)
    if s2 != s:
        flags.add("jec")
    s = s2

    s = re.sub(r"\s+", " ", s).strip()
    return s, flags


def tokens_significativos(norm: str):
    return {t for t in norm.split(" ") if t and t not in STOPWORDS}


def subset_match(a_norm: str, b_norm: str) -> bool:
    """True se os tokens significativos de a estão contidos nos de b (ou vice-versa)."""
    ta, tb = tokens_significativos(a_norm), tokens_significativos(b_norm)
    if not ta or not tb:
        return False
    return ta <= tb or tb <= ta


# ---------------------------------------------------------------------------
# Parsing das varas candidatas (campo "id|grau|tipo|nome || id|grau|tipo|nome")
# ---------------------------------------------------------------------------
def parse_varas(campo: str):
    varas = []
    if not campo:
        return varas
    for pedaco in campo.split(" || "):
        if not pedaco.strip():
            continue
        partes = pedaco.split("|", 3)
        if len(partes) < 4:
            continue
        vid, grau, tipo, nome = partes[0], partes[1], partes[2], partes[3]
        norm, _ = normalizar(nome)
        varas.append({"id": vid, "grau": grau, "tipo": tipo, "nome": nome, "norm": norm})
    return varas


# ---------------------------------------------------------------------------
# Classificação
# ---------------------------------------------------------------------------
def classificar(row):
    """Retorna dict com balde e dados auxiliares."""
    competencia = (row.get("competencia") or "").strip()
    eff_id = (row.get("eff_municipio_id") or "").strip()
    qtd = (row.get("qtd_varas_candidatas") or "").strip()
    try:
        qtd_n = int(qtd) if qtd else 0
    except ValueError:
        qtd_n = 0

    # FORA_ESCOPO: sem catálogo ou comarca não resolvida
    if qtd_n == 0 or not eff_id:
        razao = "comarca_nao_resolvida" if not eff_id else "sem_catalogo"
        return {"balde": "FORA_ESCOPO", "razao": razao}

    comp_norm, flags = normalizar(competencia)
    varas = parse_varas(row.get("varas_candidatas") or "")

    exatos = [v for v in varas if v["norm"] and v["norm"] == comp_norm]
    if len(exatos) == 1:
        sufixos = []
        if "jec" in flags:
            sufixos.append("+JEC")
        if "ordinal_extenso" in flags:
            sufixos.append("+ORD_EXT")
        if "ordinal_simbolo" in flags:
            sufixos.append("+ORD")
        regra = "EXATO_NORMALIZADO" + "".join(sufixos)
        return {"balde": "ALTA", "vara": exatos[0], "regra": regra}

    if len(exatos) > 1:
        return {"balde": "AMBIGUO", "matches": exatos, "motivo": "multiplos_exatos"}

    parciais = [v for v in varas if subset_match(comp_norm, v["norm"])]
    if parciais:
        motivo = (
            "match_parcial_multiplo" if len(parciais) > 1 else "match_parcial_unico"
        )
        return {"balde": "AMBIGUO", "matches": parciais, "motivo": motivo}

    return {"balde": "SEM_MATCH"}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    hoje = datetime.now().strftime("%Y-%m-%d")
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp",
                    default=f"tmp/relatorios/competencia-orgao-extracao-{hoje}.csv")
    ap.add_argument("--outdir", dest="outdir", default="tmp/relatorios")
    args = ap.parse_args()

    if not os.path.isfile(args.inp):
        sys.exit(f"ERRO: arquivo de entrada não encontrado: {args.inp}")
    os.makedirs(args.outdir, exist_ok=True)

    with open(args.inp, "r", encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.DictReader(f))

    total = len(linhas)
    baldes = {"ALTA": [], "AMBIGUO": [], "SEM_MATCH": [], "FORA_ESCOPO": []}
    regras_usadas = Counter()
    alta_ativos = Counter()
    top_ambiguo = Counter()
    top_sem_match = Counter()
    fora_motivo = Counter()
    sem_match_break = Counter()

    _FORA_KW = ("TRABALHO", "FEDERAL", "CAMARA", "TURMA")

    for row in linhas:
        res = classificar(row)
        b = res["balde"]
        baldes[b].append((row, res))
        comp = (row.get("competencia") or "").strip()
        if b == "ALTA":
            regras_usadas[res["regra"]] += 1
            alta_ativos[(row.get("ativo") or "").strip() or "(vazio)"] += 1
        elif b == "AMBIGUO":
            top_ambiguo[comp] += 1
        elif b == "SEM_MATCH":
            top_sem_match[comp] += 1
            qv = (row.get("qtd_varas_candidatas") or "").strip()
            comp_norm_sm, _ = normalizar(comp)
            if qv == "1":
                sem_match_break["comarca_vara_unica"] += 1
            elif any(k in comp_norm_sm for k in _FORA_KW):
                sem_match_break["provavel_fora_escopo_tjgo_1g"] += 1
            else:
                sem_match_break["outros"] += 1
        elif b == "FORA_ESCOPO":
            fora_motivo[res["razao"]] += 1

    def writer(path):
        fh = open(path, "w", encoding="utf-8", newline="")
        return fh, csv.writer(fh, quoting=csv.QUOTE_ALL)

    # 1) ALTA
    p_alta = os.path.join(args.outdir, "seg-ALTA.csv")
    fh, w = writer(p_alta)
    w.writerow(["processo_id", "numero_cnj", "competencia", "eff_municipio_nome",
                "eff_municipio_uf", "ativo", "fase", "orgao_sugerido_id",
                "orgao_sugerido_nome", "orgao_sugerido_grau", "regra_aplicada"])
    for row, res in baldes["ALTA"]:
        v = res["vara"]
        w.writerow([row.get("processo_id", ""), row.get("numero_cnj", ""),
                    row.get("competencia", ""), row.get("eff_municipio_nome", ""),
                    row.get("eff_municipio_uf", ""), row.get("ativo", ""),
                    row.get("fase", ""), v["id"], v["nome"], v["grau"], res["regra"]])
    fh.close()

    # 2) AMBIGUO
    p_amb = os.path.join(args.outdir, "seg-AMBIGUO.csv")
    fh, w = writer(p_amb)
    w.writerow(["processo_id", "numero_cnj", "competencia", "eff_municipio_nome",
                "eff_municipio_uf", "ativo", "fase", "qtd_match",
                "varas_match", "motivo"])
    for row, res in baldes["AMBIGUO"]:
        matches = res.get("matches", [])
        varas_match = " || ".join(f"{m['id']}|{m['grau']}|{m['nome']}" for m in matches)
        w.writerow([row.get("processo_id", ""), row.get("numero_cnj", ""),
                    row.get("competencia", ""), row.get("eff_municipio_nome", ""),
                    row.get("eff_municipio_uf", ""), row.get("ativo", ""),
                    row.get("fase", ""), len(matches), varas_match, res["motivo"]])
    fh.close()

    # 3) SEM_MATCH
    p_sm = os.path.join(args.outdir, "seg-SEM_MATCH.csv")
    fh, w = writer(p_sm)
    w.writerow(["processo_id", "numero_cnj", "competencia", "eff_municipio_nome",
                "eff_municipio_uf", "ativo", "fase", "qtd_varas_candidatas",
                "varas_candidatas"])
    for row, res in baldes["SEM_MATCH"]:
        w.writerow([row.get("processo_id", ""), row.get("numero_cnj", ""),
                    row.get("competencia", ""), row.get("eff_municipio_nome", ""),
                    row.get("eff_municipio_uf", ""), row.get("ativo", ""),
                    row.get("fase", ""), row.get("qtd_varas_candidatas", ""),
                    row.get("varas_candidatas", "")])
    fh.close()

    # 4) FORA_ESCOPO
    p_fe = os.path.join(args.outdir, "seg-FORA_ESCOPO.csv")
    fh, w = writer(p_fe)
    w.writerow(["processo_id", "numero_cnj", "competencia", "eff_municipio_nome",
                "eff_municipio_uf", "ativo", "fase", "municipio_id",
                "qtd_varas_candidatas", "razao"])
    for row, res in baldes["FORA_ESCOPO"]:
        w.writerow([row.get("processo_id", ""), row.get("numero_cnj", ""),
                    row.get("competencia", ""), row.get("eff_municipio_nome", ""),
                    row.get("eff_municipio_uf", ""), row.get("ativo", ""),
                    row.get("fase", ""), row.get("municipio_id", ""),
                    row.get("qtd_varas_candidatas", ""), res["razao"]])
    fh.close()

    # Resumo
    def pct(n):
        return f"{(100.0 * n / total):.1f}%" if total else "0%"

    p_resumo = os.path.join(args.outdir, "seg-RESUMO.txt")
    with open(p_resumo, "w", encoding="utf-8") as r:
        r.write("# Segmentação competencia -> orgao_julgador (ETAPA 2, SOMENTE LEITURA)\n")
        r.write(f"# Gerado: {datetime.now(timezone.utc).astimezone().isoformat()}\n")
        r.write(f"# Entrada: {args.inp}  |  Total de processos: {total}\n\n")

        r.write("== BALDES ==\n")
        for b in ("ALTA", "AMBIGUO", "SEM_MATCH", "FORA_ESCOPO"):
            n = len(baldes[b])
            r.write(f"  {b:<12} {n:>6}  ({pct(n)})\n")
        r.write("\n")

        r.write("== ALTA por ativo ==\n")
        for k, n in sorted(alta_ativos.items(), key=lambda x: -x[1]):
            r.write(f"  ativo={k:<8} {n:>6}\n")
        r.write("\n")

        r.write("== ALTA por regra aplicada ==\n")
        for k, n in sorted(regras_usadas.items(), key=lambda x: -x[1]):
            r.write(f"  {k:<24} {n:>6}\n")
        r.write("\n")

        r.write("== FORA_ESCOPO por razão ==\n")
        for k, n in sorted(fora_motivo.items(), key=lambda x: -x[1]):
            r.write(f"  {k:<24} {n:>6}\n")
        r.write("\n")

        r.write("== REGRAS DE NORMALIZAÇÃO/SINÔNIMO APLICADAS ==\n")
        for d in REGRAS_DESCRICAO:
            r.write(f"  - {d}\n")
        r.write("  Ordinais por extenso mapeados: "
                + ", ".join(f"{k}={v}" for k, v in ORDINAIS_EXTENSO.items()) + "\n")
        r.write("\n")

        r.write("== SEM_MATCH (detalhe, p/ priorizar o manual) ==\n")
        for k in ("comarca_vara_unica", "provavel_fora_escopo_tjgo_1g", "outros"):
            r.write(f"  {k:<32} {sem_match_break.get(k, 0):>6}\n")
        r.write("  (comarca_vara_unica = só 1 vara na comarca, p.ex. 'Vara Judicial' do interior;\n")
        r.write("   provavel_fora_escopo = competência cita TRABALHO/FEDERAL/CAMARA/TURMA)\n\n")

        r.write("== TOP 20 COMPETENCIAS EM AMBIGUO ==\n")
        for comp, n in top_ambiguo.most_common(20):
            r.write(f"  {n:>5}  {comp}\n")
        r.write("\n")

        r.write("== TOP 20 COMPETENCIAS EM SEM_MATCH ==\n")
        for comp, n in top_sem_match.most_common(20):
            r.write(f"  {n:>5}  {comp}\n")
        r.write("\n")

    # Eco no stdout
    print(f"Total: {total}")
    for b in ("ALTA", "AMBIGUO", "SEM_MATCH", "FORA_ESCOPO"):
        print(f"  {b:<12} {len(baldes[b]):>6}  ({pct(len(baldes[b]))})")
    print(f"Arquivos em: {args.outdir}")


if __name__ == "__main__":
    main()
