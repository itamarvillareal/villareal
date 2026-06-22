#!/usr/bin/env python3
"""Gera vinculo_doc_revisar.csv e vinculo_doc_auto.sql a partir dos alvos do relatório."""
import csv
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from vincular_imoveis import connect, parse_valor, strip_accents

ALVOS = [
    dict(imovel_id=72, label="404 São José", tipo="água", valor="3598.93", ref="~29/01/2026"),
    dict(imovel_id=72, label="404 São José", tipo="água", valor="1846.80", ref="jan/2026 fatura 1"),
    dict(imovel_id=72, label="404 São José", tipo="água", valor="1735.08", ref="jan/2026 fatura 2"),
    dict(imovel_id=72, label="água", tipo="água", valor="17.05", ref="fatura 3 (baixo)"),
    dict(imovel_id=71, label="Executive Privê", tipo="condomínio", valor="1763.95", ref="~03/06/2025 c/ multa"),
    dict(imovel_id=71, label="Executive Privê", tipo="IPTU", valor="9998.06", ref="~20/08/2025"),
    dict(imovel_id=73, label="1101 C Veredas", tipo="energia", valor="61.12", ref="~28/02/2026 (180150)"),
    dict(imovel_id=73, label="1101 C Veredas", tipo="água", valor="38.98", ref="~28/02/2026"),
    dict(imovel_id=73, label="1101 C Veredas", tipo="gás", valor="22.65", ref="~mar/2026"),
    dict(imovel_id=73, label="1101 C Veredas", tipo="condomínio", valor="1480.80", ref="nov/2025 aberto"),
    dict(imovel_id=73, label="1101 C Veredas", tipo="IPTU", valor="1886.11", ref="2025+2026"),
]

# fix label on 17.05 row
ALVOS[3]["label"] = "404 São José"


def norm(s):
    return strip_accents(str(s or "")).lower()


def corrobora(imovel_id, tipo, descricao, detalhada):
    texto = norm(descricao) + " " + norm(detalhada)
    tipo_n = norm(tipo)

    if imovel_id == 72:
        if tipo_n == "água" or tipo_n == "agua":
            return any(x in texto for x in ("saneago", "saneamento", "agua", "404", "sao jose"))
        return False

    if imovel_id == 71:
        if tipo_n == "condomínio" or tipo_n == "condominio":
            return "condomin" in texto
        if tipo_n == "iptu":
            return "iptu" in texto or "prefeitura" in texto or "fazenda" in texto
        return False

    if imovel_id == 73:
        if tipo_n == "energia":
            return any(x in texto for x in ("equatorial", "energia", "celg", "enel", "luz"))
        if tipo_n == "água" or tipo_n == "agua":
            return any(x in texto for x in ("saneago", "saneamento"))
        if tipo_n == "gás" or tipo_n == "gas":
            return any(x in texto for x in ("consigaz", " gás", "gas ", "ultragaz"))
        if tipo_n == "condomínio" or tipo_n == "condominio":
            return "condomin" in texto or "veredas" in texto
        if tipo_n == "iptu":
            return "iptu" in texto or "prefeitura" in texto
        return False
    return False


def buscar_candidatos(conn, valor):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, valor, data_lancamento, processo_id, imovel_id,
                   descricao, descricao_detalhada
            FROM financeiro_lancamento
            WHERE status = 'ATIVO' AND natureza = 'DEBITO' AND imovel_id IS NULL
              AND valor = %s
            ORDER BY data_lancamento, id
            """,
            (str(valor),),
        )
        return cur.fetchall()


def main():
    outdir = os.path.dirname(__file__) or "."
    conn = connect()
    revisar_rows = []
    auto = []

    try:
        for alvo in ALVOS:
            valor = parse_valor(alvo["valor"])
            cands = buscar_candidatos(conn, valor)
            corroborados = [
                c for c in cands if corrobora(alvo["imovel_id"], alvo["tipo"], c["descricao"], c.get("descricao_detalhada"))
            ]

            if not cands:
                revisar_rows.append({
                    "alvo_imovel_id": alvo["imovel_id"],
                    "alvo_label": alvo["label"],
                    "tipo": alvo["tipo"],
                    "valor_alvo": alvo["valor"],
                    "referencia_doc": alvo["ref"],
                    "lancamento_id": "",
                    "data_lancamento": "",
                    "valor": "",
                    "descricao": "",
                    "processo_id": "",
                    "imovel_id_atual": "",
                    "decisao": "SEM_CANDIDATO",
                    "motivo": "Nenhum débito ATIVO com imovel_id NULL e valor exato",
                })
                continue

            for c in cands:
                cid = c["id"]
                ok_desc = corrobora(alvo["imovel_id"], alvo["tipo"], c["descricao"], c.get("descricao_detalhada"))
                if len(cands) == 1 and ok_desc:
                    dec = "AUTO_PROPOSTO"
                    mot = "candidato único; descrição confirma tipo/imóvel"
                elif len(cands) >= 2:
                    dec = "REVISAR"
                    mot = f"{len(cands)} candidatos valor exato"
                    if ok_desc:
                        mot += "; descrição parcialmente compatível"
                else:
                    dec = "REVISAR"
                    mot = "descrição não confirma imóvel/tipo" if not ok_desc else "único mas não auto"

                revisar_rows.append({
                    "alvo_imovel_id": alvo["imovel_id"],
                    "alvo_label": alvo["label"],
                    "tipo": alvo["tipo"],
                    "valor_alvo": alvo["valor"],
                    "referencia_doc": alvo["ref"],
                    "lancamento_id": cid,
                    "data_lancamento": c["data_lancamento"],
                    "valor": c["valor"],
                    "descricao": (c["descricao"] or "")[:120],
                    "processo_id": c["processo_id"] or "",
                    "imovel_id_atual": c["imovel_id"] or "",
                    "decisao": dec,
                    "motivo": mot,
                })

            # Forçar 180150->73 conforme instrução explícita
            if alvo["valor"] == "61.12" and len(cands) == 1 and cands[0]["id"] == 180150:
                auto.append((180150, 73, "1101 C energia Equatorial 61.12 (confirmado 3 fontes)"))
            elif len(cands) == 1 and corroborados:
                c = cands[0]
                if not any(a[0] == c["id"] for a in auto):
                    auto.append((
                        c["id"],
                        alvo["imovel_id"],
                        f"{alvo['label']} / {alvo['tipo']} / {alvo['valor']} — {c['descricao'][:60]}",
                    ))

        # dedupe auto by lancamento_id
        seen = set()
        auto_unique = []
        for lid, iid, obs in auto:
            if lid in seen:
                continue
            seen.add(lid)
            auto_unique.append((lid, iid, obs))

        rev_path = os.path.join(outdir, "vinculo_doc_revisar.csv")
        cols = [
            "alvo_imovel_id", "alvo_label", "tipo", "valor_alvo", "referencia_doc",
            "lancamento_id", "data_lancamento", "valor", "descricao", "processo_id",
            "imovel_id_atual", "decisao", "motivo",
        ]
        with open(rev_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cols, delimiter=";")
            w.writeheader()
            w.writerows(revisar_rows)

        sql_path = os.path.join(outdir, "vinculo_doc_auto.sql")
        with open(sql_path, "w", encoding="utf-8") as f:
            f.write("-- Relatório pagamentos / group chat — AUTO propostos (dry-run).\n")
            f.write(f"-- Total: {len(auto_unique)}\n")
            f.write("START TRANSACTION;\n")
            for lid, iid, obs in auto_unique:
                f.write(
                    f"UPDATE financeiro_lancamento SET imovel_id = {iid} "
                    f"WHERE id = {lid} AND imovel_id IS NULL "
                    f"AND status = 'ATIVO' AND natureza = 'DEBITO';  -- {obs}\n"
                )
            f.write("-- COMMIT;  (descomente após OK)\n")

        print(f"Revisar: {rev_path} ({len(revisar_rows)} linhas)")
        print(f"Auto SQL: {sql_path} ({len(auto_unique)} UPDATEs)")
        for lid, iid, obs in auto_unique:
            print(f"  AUTO: {lid} -> imovel {iid}  ({obs[:70]})")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
