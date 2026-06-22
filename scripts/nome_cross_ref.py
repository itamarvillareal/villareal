#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cross-ref por NOME nos quase_vinculos (dry-run)."""
import csv
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from vinculo_cliente import parse_cc_cli, load_cliente_map, is_placeholder, tipo_conta
from vincular_imoveis import connect, strip_accents, fetch_imoveis, resolve_imoveis, IMOVEL_OVERRIDES, parse_valor

RELATORIO_PATH = "relatorio-pagamentos.csv"
RELATORIO_OVERRIDES = {
    **IMOVEL_OVERRIDES,
    "103-A": 27, "103-C": 47, "503-A": 79, "503 A": 62,
    "404 São José": 72, "404 04 São José": 72,
    "403-A": 39, "403 A": 39,
    "casa Ana Paula": None, "casa Jd Ana": None, "casa Sócrates": None,
    "casa Thamires": None,
}

ENTITY_WORDS = {
    "condominio", "condominio", "residencial", "saneamento", "saneago", "celg", "enel",
    "equatorial", "consigaz", "itamar", "alexandre", "felix", "villa", "real", "vrv",
    "solucoes", "ltda", "me", "eireli", "prefeitura", "fazenda", "tributo", "fornecedores",
    "sispag", "transferencia", "transf", "pix", "banco", "bradesco", "correios",
    "energia", "eletrica", "agua", "gas", "iptu", "cond", "taxa", "repasse",
    "junior", "filho", "filha", "neto", "neta",  # suffixes alone not entities in full names
}

COMMON_FIRST = {
    "MARIA", "JOSE", "JOSÉ", "JOAO", "JOÃO", "ANA", "PAULO", "PEDRO", "CARLOS", "LUIZ",
    "LUIS", "ANTONIO", "ANTÔNIO", "FRANCISCO", "FERNANDA", "JULIANA", "MICHELLE",
}


def norm_name(s):
    t = strip_accents(str(s or "")).upper()
    t = re.sub(r"[^A-Z0-9 ]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def name_tokens(name):
    return [t for t in norm_name(name).split() if len(t) >= 2]


def clean_name_chunk(raw):
    raw = re.sub(r"\s*-\s*\d{2}/\d{4}.*$", "", raw)
    raw = re.sub(r"^(?:iptu|agua|água|energia|gas|gás|condominio|condomínio|taxa)\s*[-:]\s*", "", raw, flags=re.I)
    raw = re.sub(r"\s*-\s*IPTU.*$", "", raw, flags=re.I)
    raw = re.sub(r"\s*-\s*G[aá]s.*$", "", raw, flags=re.I)
    raw = re.sub(r"\s*-\s*Saneago.*$", "", raw, flags=re.I)
    raw = re.sub(r"\s*-\s*Energia.*$", "", raw, flags=re.I)
    raw = re.sub(r"\s*-\s*Diferenca:.*$", "", raw, flags=re.I)
    return raw.strip(" .,-")


def is_company_name(name):
    n = norm_name(name)
    if any(w in n for w in (" LTDA", " EIRELI", " ME ", " S/A", " S.A", " CONDOMINIO ", " RESIDENCIAL ", " SISTEMAS ", " SEGURANCA ")):
        return True
    if n.endswith(" ME") or n.endswith(" LTDA"):
        return True
    return False


def is_specific_person_name(name):
    if is_company_name(name):
        return False
    toks = name_tokens(name)
    if len(toks) < 2:
        return False
    if all(t in ENTITY_WORDS for t in toks):
        return False
    if len(toks) == 2 and toks[0] in COMMON_FIRST and toks[1] in {"SILVA", "SANTOS", "SOUZA", "OLIVEIRA", "COSTA"}:
        return False
    low = set(toks)
    if low & {"CONDOMINIO", "RESIDENCIAL", "SANEAMENTO", "SANEAGO", "VRV", "SOLUCOES"}:
        return False
    return True


def names_match(extracted, registered):
    """Match estrito: igualdade, >=3 tokens iguais, primeiro+último (nome>=3), ou prefixo de >=2 tokens."""
    ne, nr = norm_name(extracted), norm_name(registered)
    if not ne or not nr:
        return False
    if ne == nr:
        return True
    te, tr = ne.split(), nr.split()
    inter = set(te) & set(tr)
    if len(inter) >= 3:
        return True
    if len(te) >= 3 and te[0] == tr[0] and te[-1] == tr[-1]:
        return True
    if len(tr) >= 2 and te[: len(tr)] == tr:
        return True
    if len(te) >= 2 and tr[: len(te)] == te:
        return True
    return False


def extract_person_names(text):
    """Extrai pares (nome, papel): locador|inquilino|desconhecido."""
    t = re.sub(r"\[CC_CLI:\d+\]", "", text or "", flags=re.I)
    if " · " in t:
        parts = t.split(" · ")
        t = " · ".join(parts[1:] if len(parts) > 1 else parts)
    found = []

    def add(raw, role="desconhecido"):
        raw = clean_name_chunk(raw)
        if is_specific_person_name(raw):
            found.append((norm_name(raw), role))

    if re.search(r"\bx\b", t, re.I):
        idx = t.lower().rfind(" x ")
        left, right = t[:idx].strip(), t[idx + 3 :].strip()
        if " · " in left:
            left = left.split(" · ", 1)[-1]
        left_clean = clean_name_chunk(left)
        if is_company_name(left_clean) or re.search(r"\b(condominio|residencial)\b", norm_name(left_clean).lower()):
            add(right, "inquilino")
            for chunk in re.split(r"\s+e\s+", right, flags=re.I):
                add(chunk, "inquilino")
        else:
            add(left_clean, "locador")
            for chunk in re.split(r"\s+e\s+", right, flags=re.I):
                add(chunk, "inquilino")
    else:
        for m in re.finditer(
            r"(?:repasse|aluguel|inquilino|propriet[aá]rio|locat[aá]rio|parte|fav\.?)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\.\-]{3,60})",
            t,
            re.I,
        ):
            add(m.group(1), "desconhecido")

    seen = set()
    out = []
    for n, role in found:
        if n not in seen:
            seen.add(n)
            out.append((n, role))
    return out


def build_contrato_index(conn):
    """nome normalizado -> set imovel_id (inquilino + locador)."""
    idx = defaultdict(set)
    contracts = []
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT cl.id, cl.imovel_id, cl.status, pl.nome locador, pi.nome inquilino
            FROM contrato_locacao cl
            LEFT JOIN pessoa pl ON pl.id = cl.locador_pessoa_id
            LEFT JOIN pessoa pi ON pi.id = cl.inquilino_pessoa_id
            """
        )
        contracts = cur.fetchall()
    for cl in contracts:
        for role, nome in (("locador", cl.get("locador")), ("inquilino", cl.get("inquilino"))):
            if not nome or not str(nome).strip():
                continue
            nn = norm_name(nome)
            if len(name_tokens(nome)) >= 2:
                idx[nn].add(cl["imovel_id"])
            # também indexar chaves parciais únicas? não — só nome completo normalizado
    return idx, contracts


def code_from_unidade(unidade):
    if not unidade:
        return None
    m = re.search(r"\b(\d{3,4})\s*[- ]?\s*([abc])\b", norm_name(unidade).lower(), re.I)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    return None


def build_unit_to_imoveis(conn):
    by_code = defaultdict(list)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, cliente_id, unidade, condominio, titulo FROM imovel WHERE ativo = 1"
        )
        rows = cur.fetchall()
    for im in rows:
        if is_placeholder(im):
            continue
        for f in ("unidade", "titulo"):
            m = re.search(r"\b(\d{3,4})\s*[- ]?\s*([abc])\b", norm_name(im.get(f) or "").lower(), re.I)
            if m:
                k = f"{m.group(1)}-{m.group(2)}"
                by_code[k].append(im["id"])
    for k in by_code:
        by_code[k] = sorted(set(by_code[k]))
    return by_code


def resolve_hint_to_imoveis(hint, imoveis, by_code):
    if not hint or not hint.strip():
        return set()
    h = hint.strip()
    if h in RELATORIO_OVERRIDES:
        v = RELATORIO_OVERRIDES[h]
        return set() if v is None else {v}
    mapping = resolve_imoveis([h], imoveis, RELATORIO_OVERRIDES)
    m = mapping.get(h, {})
    if m.get("manual") or m.get("score", 0) >= 0.55:
        return {m["imovel_id"]}
    # tentar NNN-L
    m2 = re.search(r"\b(\d{3,4})\s*[- ]?\s*([abc])\b", h, re.I)
    if m2:
        k = f"{m2.group(1)}-{m2.group(2).upper()}"
        return set(by_code.get(k, []))
    return set()


def extract_relatorio_names(descricao):
    names = set()
    d = descricao or ""
    patterns = [
        r"Repasse\s+([A-Za-zÀ-ÿ][\w\s\.\-]{2,40}?)(?:\s*\(|$|\s+\d|\s+-|\s+\()",
        r"(?:aluguel|boleto)\s+(?:do\s+|de\s+)?([A-Za-zÀ-ÿ][\w\s\.\-]{2,40}?)(?:\s*\(|$|\s+-|\s+\()",
        r"IPTU[^;]*?\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)+)",
        r"Repasse\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)+)",
        r"([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)+)\s+505-A",
        r"([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)+)\s+403-A",
        r"Rodrigo\s+505-A",
        r"Andreia\s+F18",
        r"Neemias",
        r"Getulino",
        r"Hildebrando",
        r"Eduardo\s+(?:403|Alexandre)?",
        r"Mariana\s+Queiroz",
        r"Maria\s+Jos[eé]",
        r"Luiz\s+(?:Ant[oô]nio|Faria)",
        r"Carlos\s+606",
    ]
    for pat in patterns:
        for m in re.finditer(pat, d, re.I):
            g = m.group(1) if m.lastindex else m.group(0)
            if g and is_specific_person_name(g):
                names.add(norm_name(g))
    # nomes explícitos mencionados no enunciado
    for token in ("NEEMIAS RODRIGUES BORGES", "HILDEBRANDO JORGE RODRIGUES NETO",
                  "GETULINO BRAGA DE SOUZA", "EDUARDO ALEXANDRE FELIX VILLA REAL",
                  "MARIANA QUEIROZ", "STHEFANE AMANDA DUARTE SILVA"):
        if token.split()[0] in norm_name(d):
            if is_specific_person_name(token):
                names.add(norm_name(token))
    return names


def build_relatorio_index(path, conn):
    imoveis = fetch_imoveis(conn)
    by_code = build_unit_to_imoveis(conn)
    idx = defaultdict(set)  # name -> imovel_ids
    meta = defaultdict(list)

    if not os.path.isabs(path):
        path = os.path.join(os.path.dirname(__file__) or ".", path)
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter=";"):
            desc = row.get("descricao") or ""
            hint = (row.get("imovel_hint") or "").strip()
            imoveis_hint = resolve_hint_to_imoveis(hint, imoveis, by_code)
            if not imoveis_hint and not hint:
                continue
            names = extract_relatorio_names(desc)
            # também extrair nomes genéricos de padrões curtos
            for short in re.finditer(
                r"\b(Neemias|Getulino|Hildebrando|Eduardo|Mariana|Andreia|Rodrigo|Bianca|Michelle|Thamires|Carlos|Luiz|Vin[ií]cius|Josu[eé])\b",
                desc,
                re.I,
            ):
                n = short.group(1)
                if len(n) >= 4:  # evitar só "Luiz" — mas Luiz alone is 1 token
                    pass
            for sn in re.finditer(
                r"\b(Neemias|Getulino|Hildebrando|Rodrigo|Bianca|Michelle|Thamires|Vinicius|Josue)\b",
                desc,
                re.I,
            ):
                # nomes únicos no relatório — expandir com sobrenome se conhecido
                expansions = {
                    "NEEMIAS": "NEEMIAS RODRIGUES BORGES",
                    "GETULINO": "GETULINO BRAGA DE SOUZA",
                    "HILDEBRANDO": "HILDEBRANDO JORGE RODRIGUES NETO",
                    "RODRIGO": "RODRIGO",  # too short alone
                    "MICHELLE": "MICHELLE",
                    "BIANCA": "BIANCA",
                    "THAMIRES": "THAMIRES",
                    "VINICIUS": "VINICIUS",
                    "JOSUE": "JOSUE",
                }
                key = norm_name(sn.group(1))
                full = expansions.get(key, key)
                if is_specific_person_name(full):
                    names.add(norm_name(full))

            if not names:
                continue
            if not imoveis_hint:
                continue
            for name in names:
                for iid in imoveis_hint:
                    idx[name].add(iid)
                    meta[name].append(dict(imovel_id=iid, hint=hint, desc=desc[:80]))
    return idx, meta


def lookup_name_in_contrato(name, contracts, role=None):
    """Retorna set imovel_id; role=locador|inquilino restringe o polo."""
    found = set()
    for cl in contracts:
        if role == "locador":
            nomes = [(cl.get("locador"), "locador")]
        elif role == "inquilino":
            nomes = [(cl.get("inquilino"), "inquilino")]
        else:
            nomes = [(cl.get("locador"), "locador"), (cl.get("inquilino"), "inquilino")]
        for nome, _ in nomes:
            if nome and names_match(name, nome):
                found.add(cl["imovel_id"])
    return found


def lookup_name_in_relatorio(name, relatorio_idx):
    found = set()
    for rn, imoveis in relatorio_idx.items():
        if names_match(name, rn):
            found.update(imoveis)
    return found


def client_imoveis_ids(cliente_id, by_client):
    if not cliente_id:
        return set()
    return {im["id"] for im in by_client.get(cliente_id, [])}


def resolve_cliente_id(row, cc_to_cliente):
    cliente_col = (row.get("cliente") or "").strip().split()
    if cliente_col and cliente_col[0].isdigit():
        return int(cliente_col[0])
    cc = row.get("cc_cli") or ""
    if str(cc).isdigit():
        return cc_to_cliente.get(int(cc))
    return None


def tiebreak_by_cliente(imoveis, cliente_id, by_id):
    if not cliente_id or not imoveis:
        return set(imoveis)
    owned = {i for i in imoveis if by_id.get(i, {}).get("cliente_id") == cliente_id}
    return owned


def classify_row(row, contrato_idx, contracts, relatorio_idx, cc_to_cliente, by_client, by_id):
    motivo = row.get("motivo_nao_vinculo") or ""
    if "nivel-condominio" in motivo:
        return dict(
            confianca="REVISAR", nome_extraido="", imovel_proposto="", fonte="",
            nota="nivel-condominio (entidade sindico); nao atribuir por nome de morador",
            imoveis_do_cliente="",
        )

    texto = f"{row.get('descricao') or ''} {row.get('detalhada') or ''}"
    name_roles = extract_person_names(texto)
    cid = resolve_cliente_id(row, cc_to_cliente)
    c_imoveis = client_imoveis_ids(cid, by_client)
    c_imoveis_label = ";".join(
        f"{im['id']}:{im.get('unidade') or '?'}" for im in by_client.get(cid or -1, [])
    ) if cid else ""

    if not name_roles:
        return dict(
            confianca="REVISAR", nome_extraido="", imovel_proposto="", fonte="",
            nota="sem nome especifico extraivel", imoveis_do_cliente=c_imoveis_label,
        )

    alta_candidates = []
    media_candidates = []

    for name, role in name_roles:
        search_role = role if role in ("locador", "inquilino") else None
        c_set = lookup_name_in_contrato(name, contracts, search_role)
        if search_role is None and len(c_set) > 1:
            # tentar locador primeiro para nomes em posição proprietário
            c_loc = lookup_name_in_contrato(name, contracts, "locador")
            if len(c_loc) == 1:
                c_set = c_loc
        r_set = lookup_name_in_relatorio(name, relatorio_idx)

        if len(c_set) > 1:
            c_owned = tiebreak_by_cliente(c_set, cid, by_id)
            if len(c_owned) == 1:
                c_set = c_owned
            elif len(c_owned) > 1:
                return dict(
                    confianca="REVISAR", nome_extraido=name, imovel_proposto="",
                    fonte="contrato", nota=f"duplicata cadastro contrato {sorted(c_owned)}",
                    imoveis_do_cliente=c_imoveis_label,
                )
            elif cid and c_imoveis:
                return dict(
                    confianca="REVISAR", nome_extraido=name, imovel_proposto="",
                    fonte="contrato", nota=f"contrato ambiguo {sorted(c_set)}; cliente nao desempata",
                    imoveis_do_cliente=c_imoveis_label,
                )

        if len(c_set) == 1:
            iid = next(iter(c_set))
            cc = (row.get("cc_cli") or "").strip()
            if cc and cid and (not c_imoveis or iid not in c_imoveis):
                continue
            fonte = "contrato"
            if r_set:
                if iid in r_set and len(r_set) == 1:
                    fonte = "ambos"
                elif iid not in r_set and len(r_set) >= 1:
                    return dict(
                        confianca="REVISAR", nome_extraido=name, imovel_proposto="",
                        fonte="contrato/relatorio", nota=f"conflito contrato {iid} vs relatorio {sorted(r_set)}",
                        imoveis_do_cliente=c_imoveis_label,
                    )
            alta_candidates.append((name, iid, fonte))

        elif len(c_set) == 0 and len(r_set) == 1:
            iid = next(iter(r_set))
            cc = (row.get("cc_cli") or "").strip()
            if cc and cid and c_imoveis and iid not in c_imoveis:
                continue
            media_candidates.append((name, iid, "relatorio"))
        elif len(c_set) == 0 and len(r_set) > 1:
            r_owned = tiebreak_by_cliente(r_set, cid, by_id)
            if len(r_owned) == 1:
                iid = next(iter(r_owned))
                if not (cid and c_imoveis and iid not in c_imoveis):
                    media_candidates.append((name, iid, "relatorio"))

    if len(alta_candidates) == 1:
        name, iid, fonte = alta_candidates[0]
        return dict(
            confianca="ALTA", nome_extraido=name, imovel_proposto=str(iid),
            fonte=fonte, nota="", imoveis_do_cliente=c_imoveis_label,
        )
    if len(alta_candidates) > 1:
        ids = {x[1] for x in alta_candidates}
        if len(ids) == 1:
            return dict(
                confianca="ALTA", nome_extraido=" | ".join(x[0] for x in alta_candidates),
                imovel_proposto=str(next(iter(ids))), fonte=alta_candidates[0][2],
                nota="multiplos nomes mesmo imovel", imoveis_do_cliente=c_imoveis_label,
            )
        return dict(
            confianca="REVISAR", nome_extraido=" | ".join(x[0] for x in alta_candidates),
            imovel_proposto="", fonte="contrato",
            nota=f"conflito nomes -> imoveis {sorted(ids)}", imoveis_do_cliente=c_imoveis_label,
        )

    if len(media_candidates) == 1:
        name, iid, fonte = media_candidates[0]
        return dict(
            confianca="MEDIA", nome_extraido=name, imovel_proposto=str(iid),
            fonte=fonte, nota="so relatorio (sem contrato)", imoveis_do_cliente=c_imoveis_label,
        )
    if len(media_candidates) > 1:
        ids = {x[1] for x in media_candidates}
        if len(ids) == 1:
            return dict(
                confianca="MEDIA", nome_extraido=" | ".join(x[0] for x in media_candidates),
                imovel_proposto=str(next(iter(ids))), fonte="relatorio",
                nota="multiplos nomes mesmo imovel (relatorio)", imoveis_do_cliente=c_imoveis_label,
            )
        return dict(
            confianca="REVISAR", nome_extraido=" | ".join(x[0] for x in media_candidates),
            imovel_proposto="", fonte="relatorio",
            nota=f"relatorio ambiguo {sorted(ids)}", imoveis_do_cliente=c_imoveis_label,
        )

    names_only = " | ".join(n for n, _ in name_roles[:3])
    return dict(
        confianca="REVISAR", nome_extraido=names_only,
        imovel_proposto="", fonte="",
        nota="sem match unico contrato/relatorio", imoveis_do_cliente=c_imoveis_label,
    )


def load_client_imoveis(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, cliente_id, unidade, condominio, titulo FROM imovel WHERE ativo = 1"
        )
        rows = cur.fetchall()
    by_client = defaultdict(list)
    by_id = {}
    for im in rows:
        by_id[im["id"]] = im
        if not is_placeholder(im):
            by_client[im["cliente_id"]].append(im)
    return by_client, by_id


def main():
    outdir = os.path.dirname(__file__) or "."
    conn = connect()
    clientes, cc_to_cliente, _, _ = load_cliente_map(conn)
    by_client, by_id = load_client_imoveis(conn)
    contrato_idx, contracts = build_contrato_index(conn)
    relatorio_idx, rel_meta = build_relatorio_index(RELATORIO_PATH, conn)

    # índice resumo Fase 1
    idx_path = os.path.join(outdir, "nome_indice_fase1.csv")
    with open(idx_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["fonte", "nome", "imovel_id", "detalhe"])
        for name, imoveis in sorted(contrato_idx.items()):
            for iid in sorted(imoveis):
                w.writerow(["contrato", name, iid, by_id.get(iid, {}).get("unidade") or ""])
        for name, imoveis in sorted(relatorio_idx.items()):
            for iid in sorted(imoveis):
                w.writerow(["relatorio", name, iid, ""])

    qv_path = os.path.join(outdir, "quase_vinculos.csv")
    out_path = os.path.join(outdir, "nome_cross_ref_proposta.csv")
    stats = Counter()

    with open(qv_path, newline="", encoding="utf-8") as f:
        qv_rows = list(csv.DictReader(f, delimiter=";"))

    out_rows = []
    for row in qv_rows:
        r = classify_row(row, contrato_idx, contracts, relatorio_idx, cc_to_cliente, by_client, by_id)
        stats["total"] += 1
        stats[r["confianca"]] += 1
        out_rows.append(dict(
            conta_id=row["id"],
            valor=row["valor"],
            tipo=row.get("tipo_conta") or tipo_conta(row.get("descricao"), row.get("detalhada")),
            nome_extraido=r["nome_extraido"],
            imovel_proposto=r["imovel_proposto"],
            fonte=r["fonte"],
            cliente=row.get("cliente") or "",
            cc_cli=row.get("cc_cli") or "",
            imoveis_do_cliente=r["imoveis_do_cliente"],
            confianca=r["confianca"],
            nota=r["nota"],
        ))

    cols = [
        "conta_id", "valor", "tipo", "nome_extraido", "imovel_proposto", "fonte",
        "cliente", "cc_cli", "imoveis_do_cliente", "confianca", "nota",
    ]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";")
        w.writeheader()
        w.writerows(out_rows)

    conn.close()

    print(f"Contas analisadas: {stats['total']}")
    print(f"  ALTA:    {stats.get('ALTA', 0)}")
    print(f"  MEDIA:   {stats.get('MEDIA', 0)}")
    print(f"  REVISAR: {stats.get('REVISAR', 0)}")
    print(f"Indice Fase 1: {idx_path}")
    print(f"Proposta: {out_path}")

    alta = [r for r in out_rows if r["confianca"] == "ALTA"][:8]
    if alta:
        print("\nAmostra ALTA:")
        for r in alta:
            print(f"  {r['conta_id']} | {r['nome_extraido'][:40]} | imovel {r['imovel_proposto']} | {r['fonte']}")


if __name__ == "__main__":
    main()
