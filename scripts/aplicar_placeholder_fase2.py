#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply placeholder 94->70, revert 96 (8 IPTU), update quase_vinculos, cadastro_duplicatas."""
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from opcao_a_contas import is_conta
from vinculo_cliente import parse_cc_cli, load_cliente_map, tipo_conta
from vincular_imoveis import connect

IDS_SIDNEI_70 = [216292, 216293, 216294, 216295, 216298]
IDS_REVERT_96 = [166058, 166059, 166060, 166061, 166062, 166063, 166065, 166068]
MOTIVO_96 = "placeholder 96 / destino incerto 39|54|52"
OBS_DUP = " | PLACEHOLDER DUPLICADO: contas movidas para imovel real; candidato inativacao cadastro"

CADASTRO_DUPLICATAS = [
    dict(
        tipo="placeholder->real",
        placeholder_id=100,
        placeholder_cliente_id=693,
        placeholder_codigo="00000692",
        placeholder_nome="LUIZ ANTÔNIO DE FARIA",
        real_imovel_id=60,
        real_unidade="606-C",
        real_condominio="Veredas do Bosque",
        real_cliente_id=938,
        evidencia="20 contas IPTU/utilities 606 C [CC_CLI:692]; imovel real Unidade 606 C cliente VRV",
        acao_vinculo="20 contas movidas para imovel 60",
    ),
    dict(
        tipo="placeholder->real",
        placeholder_id=94,
        placeholder_cliente_id=915,
        placeholder_codigo="00000915",
        placeholder_nome="SIDNEI SILVA DE SOUZA FILHO",
        real_imovel_id=70,
        real_unidade="101-C",
        real_condominio="Veredas do Bosque",
        real_cliente_id=938,
        evidencia="5 contas utilities x Leandro Pedro [CC_CLI:915]; contrato locacao + proc 16025 -> 101-C",
        acao_vinculo="5 contas movidas para imovel 70",
    ),
    dict(
        tipo="placeholder->real",
        placeholder_id=85,
        placeholder_cliente_id=151,
        placeholder_codigo="00000149",
        placeholder_nome="(cliente ledger CC_CLI)",
        real_imovel_id=65,
        real_unidade="505-A",
        real_condominio="Veredas do Bosque",
        real_cliente_id=938,
        evidencia="IPTU Amanda + 200881 IPTU 505 A; contas eram ledger CC_CLI nao imovel real",
        acao_vinculo="corrigido em rodadas anteriores (ex. 200881->65)",
    ),
    dict(
        tipo="cadastro-duplicado",
        placeholder_id="",
        placeholder_cliente_id="",
        placeholder_codigo="",
        placeholder_nome="",
        real_imovel_id="39|54",
        real_unidade="403-A",
        real_condominio="Mirantes do Vale | Avenida Parque",
        real_cliente_id=938,
        evidencia="Dois imoveis 403-A: id 39 Mirantes (relatorio IPTU Eduardo) vs id 54 Av.Parque (contrato locacao Eduardo locador)",
        acao_vinculo="pendencia faxina cadastro; nao vincular automaticamente",
    ),
]


def fetch_lanc_row(cur, lid):
    cur.execute(
        """
        SELECT id, cliente_id, valor, data_lancamento, descricao, descricao_detalhada, processo_id, imovel_id
        FROM financeiro_lancamento WHERE id=%s
        """,
        (lid,),
    )
    return cur.fetchone()


def quase_row_from_lanc(l, cc_to_cliente, clientes, classificacao):
    cc = parse_cc_cli(l.get("descricao_detalhada") or "")
    cid = cc_to_cliente.get(cc) if cc is not None else l.get("cliente_id")
    cls = classificacao.get(cid, {}) if cid else {}
    qtd = cls.get("real", cls.get("qtd", 0)) if cid else ""
    nome = (clientes.get(cid, {}) or {}).get("nome_referencia") or ""
    return dict(
        id=l["id"],
        data=l["data_lancamento"],
        valor=l["valor"],
        tipo_conta=tipo_conta(l["descricao"], l.get("descricao_detalhada")),
        descricao=(l["descricao"] or "")[:100],
        detalhada=(l.get("descricao_detalhada") or "")[:140],
        cc_cli=cc or "",
        cliente=f"{cid or ''} {nome}".strip(),
        qtd_imoveis_cliente=qtd,
        imovel_candidato="39|54|52",
        motivo_nao_vinculo=MOTIVO_96,
    )


def patch_quase_vinculos(outdir, conn, remove_ids, add_rows):
    path = os.path.join(outdir, "quase_vinculos.csv")
    remove = set(remove_ids)
    existing = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        fieldnames = reader.fieldnames
        for row in reader:
            if int(row["id"]) not in remove:
                existing.append(row)
    existing_ids = {int(r["id"]) for r in existing}
    for row in add_rows:
        if int(row["id"]) not in existing_ids:
            existing.append(row)
        else:
            for i, r in enumerate(existing):
                if int(r["id"]) == int(row["id"]):
                    existing[i] = row
                    break
    existing.sort(key=lambda r: int(r["id"]))
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";")
        w.writeheader()
        w.writerows(existing)
    return path


def check_inativacao_deps(conn):
    deps = []
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT cl.id, cl.imovel_id, cl.status, 'contrato_locacao' tipo
            FROM contrato_locacao cl
            WHERE cl.imovel_id IN (94, 100) AND cl.status = 'VIGENTE'
            """
        )
        deps.extend(cur.fetchall())
        cur.execute(
            """
            SELECT ip.id, ip.imovel_id, ip.processo_id, pr.numero_interno, 'imovel_processo' tipo
            FROM imovel_processo ip
            JOIN processo pr ON pr.id = ip.processo_id
            WHERE ip.imovel_id IN (94, 100) AND ip.ativo = 1
            """
        )
        deps.extend(cur.fetchall())
    return deps


def apply_sql(conn):
    with conn.cursor() as cur:
        cur.execute("START TRANSACTION")

        ph_sidnei = ",".join(map(str, IDS_SIDNEI_70))
        cur.execute(
            f"""
            UPDATE financeiro_lancamento SET imovel_id = 70
            WHERE id IN ({ph_sidnei}) AND imovel_id IS NULL
              AND status = 'ATIVO' AND natureza = 'DEBITO'
            """
        )
        n_sidnei = cur.rowcount

        ph_rev = ",".join(map(str, IDS_REVERT_96))
        cur.execute(
            f"""
            UPDATE financeiro_lancamento SET imovel_id = NULL
            WHERE id IN ({ph_rev}) AND imovel_id = 96
              AND status = 'ATIVO' AND natureza = 'DEBITO'
            """
        )
        n_revert = cur.rowcount

        cur.execute(
            """
            UPDATE imovel SET observacoes = CONCAT(COALESCE(observacoes, ''),
              ' | PLACEHOLDER DUPLICADO do imovel 70 (101-C); candidato inativacao cadastro')
            WHERE id = 94 AND observacoes NOT LIKE '%PLACEHOLDER DUPLICADO do imovel 70%'
            """
        )

        deps = check_inativacao_deps(conn)
        inativados = []
        bloqueados = []
        if not deps:
            for iid in (94, 100):
                cur.execute("UPDATE imovel SET ativo = 0 WHERE id = %s AND ativo = 1", (iid,))
                if cur.rowcount:
                    inativados.append(iid)
        else:
            bloqueados = deps

        cur.execute("COMMIT")

    return n_sidnei, n_revert, inativados, bloqueados


def write_reports(conn, outdir, n_sidnei, n_revert, inativados, bloqueados):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) c FROM financeiro_lancamento "
            "WHERE imovel_id IS NOT NULL AND status='ATIVO' AND natureza='DEBITO'"
        )
        total_vinc = cur.fetchone()["c"]
        cur.execute(
            "SELECT COUNT(*) c FROM financeiro_lancamento "
            "WHERE imovel_id=70 AND status='ATIVO' AND natureza='DEBITO'"
        )
        cnt70 = cur.fetchone()["c"]
        cur.execute(
            f"""
            SELECT id, valor, data_lancamento, descricao, LEFT(descricao_detalhada,100) det
            FROM financeiro_lancamento WHERE id IN ({','.join(map(str, IDS_SIDNEI_70))})
            ORDER BY data_lancamento, id
            """
        )
        sidnei_rows = cur.fetchall()

    apply_path = os.path.join(outdir, "placeholder_94_aplicado.csv")
    with open(apply_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["lancamento_id", "data", "valor", "descricao", "detalhada", "imovel_id_novo"], delimiter=";")
        w.writeheader()
        for r in sidnei_rows:
            w.writerow(dict(
                lancamento_id=r["id"], data=r["data_lancamento"], valor=r["valor"],
                descricao=(r["descricao"] or "")[:80], detalhada=(r["det"] or "")[:100],
                imovel_id_novo=r.get("imovel_id") or 70,
            ))

    dup_path = os.path.join(outdir, "cadastro_duplicatas.csv")
    cols = [
        "tipo", "placeholder_id", "placeholder_cliente_id", "placeholder_codigo", "placeholder_nome",
        "real_imovel_id", "real_unidade", "real_condominio", "real_cliente_id", "evidencia", "acao_vinculo",
    ]
    with open(dup_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";")
        w.writeheader()
        for r in CADASTRO_DUPLICATAS:
            w.writerow(r)

    dep_path = os.path.join(outdir, "placeholder_inativacao_deps.csv")
    with open(dep_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["tipo", "ref_id", "imovel_id", "processo_id", "numero_interno", "status"], delimiter=";")
        w.writeheader()
        for d in bloqueados:
            w.writerow(dict(
                tipo=d.get("tipo", ""),
                ref_id=d.get("id", ""),
                imovel_id=d.get("imovel_id", ""),
                processo_id=d.get("processo_id", ""),
                numero_interno=d.get("numero_interno", d.get("status", "")),
                status=d.get("status", "ativo"),
            ))

    return apply_path, dup_path, dep_path, total_vinc, cnt70, sidnei_rows


def main():
    outdir = os.path.dirname(__file__) or "."
    conn = connect()
    clientes, cc_to_cliente, classificacao, _ = load_cliente_map(conn)

    n_sidnei, n_revert, inativados, bloqueados = apply_sql(conn)

    add_qv = []
    with conn.cursor() as cur:
        for lid in IDS_REVERT_96:
            l = fetch_lanc_row(cur, lid)
            if l and l["imovel_id"] is None:
                add_qv.append(quase_row_from_lanc(l, cc_to_cliente, clientes, classificacao))

    qv_path = patch_quase_vinculos(outdir, conn, IDS_SIDNEI_70, add_qv)
    apply_path, dup_path, dep_path, total_vinc, cnt70, sidnei_rows = write_reports(
        conn, outdir, n_sidnei, n_revert, inativados, bloqueados,
    )
    conn.close()

    print(f"Sidnei 94->70: {n_sidnei} (esperado 5)")
    print(f"Revert 96: {n_revert} (esperado 8)")
    print(f"imovel 70 debitos ATIVOS: {cnt70} (esperado 41)")
    print(f"total com imovel: {total_vinc} (esperado 178)")
    print(f"quase_vinculos: {qv_path}")
    print(f"cadastro_duplicatas: {dup_path}")
    if inativados:
        print(f"Inativados: {inativados}")
    else:
        print(f"Inativacao bloqueada — deps em {dep_path} ({len(bloqueados)} refs)")
    print(f"apply log: {apply_path}")


if __name__ == "__main__":
    main()
