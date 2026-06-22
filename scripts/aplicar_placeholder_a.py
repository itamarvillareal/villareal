#!/usr/bin/env python3
"""Registra apply caso (a) placeholder 100 -> imovel 60 e gera cross_ref_proposta.csv."""
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from vincular_imoveis import connect

IDS_606C = [
    150755, 151028, 151087, 166927, 168952, 168954, 171057, 171059,
    186777, 186836, 187000, 187088, 188045, 191310, 191312,
    215149, 215196, 215248, 215275, 216024,
]

IDS_CONDOMINIO_101 = [
    152108, 184409, 184572, 184722, 184890, 184893, 184902, 194791, 196204,
]

CROSS_REF = [
    dict(
        placeholder=94, cliente_id=915, codigo_cliente="00000915",
        cliente_nome="SIDNEI SILVA DE SOUZA FILHO",
        contas="216292;216293;216294;216295;216298",
        qtd_contas=5,
        imovel_candidato=70,
        unidade_candidata="101-C",
        evidencia=(
            "Contrato locacao id 40: locador Sidnei, imovel 70 (101-C Veredas). "
            "Processo 16025 (cli 938) -> imovel 70; revert/varredura ja mapeou Sidnei x Leandro com CC_CLI:938 -> 70. "
            "Leandro Pedro e parte REU proc 15464 (cli 915). Inquilino Leandro NAO aparece em contrato_locacao "
            "(contrato vigente: inquilino VRV); padrao duplicata CC_CLI proprietario vs imovel real."
        ),
        confianca="MEDIA-ALTA",
    ),
    dict(
        placeholder=96, cliente_id=809, codigo_cliente="00000808",
        cliente_nome="EDUARDO ALEXANDRE FELIX VILLA REAL",
        contas="215664",
        qtd_contas=1,
        imovel_candidato="",
        unidade_candidata="",
        evidencia="PAG AGUA Eduardo x Felipe (05/2020). Felipe nao encontrado em contrato_locacao do Eduardo.",
        confianca="BAIXA",
    ),
    dict(
        placeholder=96, cliente_id=809, codigo_cliente="00000808",
        cliente_nome="EDUARDO ALEXANDRE FELIX VILLA REAL",
        contas="166058;166059;166060;166061;166062;166063;166065;166068",
        qtd_contas=8,
        imovel_candidato="39|54|52",
        unidade_candidata="403-A Mirantes|403-A Av.Parque|103-B",
        evidencia=(
            "8 IPTU ja vinculados ao placeholder 96 via fase2 proc 13321 (1:1 errado). "
            "Descricoes: IPTU Eduardo x STHEFANE AMANDA — sem unidade explicita. "
            "Sthefane inquilina contrato id 64 -> imovel 52 (103-B Av.Parque), NAO 403-A. "
            "403-A existe: id 39 Mirantes (relatorio pagamentos) e id 54 Av.Parque (contrato Eduardo locador). "
            "Suspeito: vinculos atuais em 96 sao placeholder lixo; destino real incerto entre 39/54/52."
        ),
        confianca="REVISAR",
    ),
    dict(
        placeholder=97, cliente_id=718, codigo_cliente="00000717",
        cliente_nome="GETULINO BRAGA DE SOUZA",
        contas="194200;194201;196431",
        qtd_contas=3,
        imovel_candidato=63,
        unidade_candidata="1206-B",
        evidencia=(
            "1206-B existe (imovel 63, Veredas). Contrato locacao id 29: locador Getulino, inquilino Judiel. "
            "Processo 16022 (cli 938) -> imovel 63. Contas citam inquilinos Douglas/Isabelle — NAO batem com "
            "Judiel nem aparecem em contrato_locacao. Pista fraca; owner Getulino coerente com 1206-B."
        ),
        confianca="BAIXA",
    ),
    dict(
        placeholder=99, cliente_id=763, codigo_cliente="00000762",
        cliente_nome="GIOVANA CINTIA CINTRA BETTONI DE OLIVEIRA",
        contas="188150;188151;188153;190490",
        qtd_contas=4,
        imovel_candidato="",
        unidade_candidata="",
        evidencia="Gas + IPTU x Thamires Cardoso — sem unidade/condominio. Permanece quase_vinculos.",
        confianca="INDETERMINADO",
    ),
    dict(
        placeholder=98, cliente_id=728, codigo_cliente="00000727",
        cliente_nome="PABLO HERNANE SILVA",
        contas="",
        qtd_contas=0,
        imovel_candidato="",
        unidade_candidata="",
        evidencia="Sem contas CONTA sem imovel.",
        confianca="N/A",
    ),
    dict(
        placeholder=95, cliente_id=934, codigo_cliente="00000934",
        cliente_nome="GUILHERME NASCIMENTO TEIXEIRA",
        contas="",
        qtd_contas=0,
        imovel_candidato="",
        unidade_candidata="",
        evidencia="Sem contas CONTA sem imovel.",
        confianca="N/A",
    ),
    dict(
        placeholder=101, cliente_id=493, codigo_cliente="00000491",
        cliente_nome="CONDOMINIO RESIDENCIAL VEREDAS DO BOSQUE",
        contas="152108;184409;184572;184722;184890;184893;184902;194791;196204",
        qtd_contas=9,
        imovel_candidato="",
        unidade_candidata="nivel-condominio",
        evidencia="Entidade sindico; taxas de moradores diversos sem NNN-L. Nao vincular a unidade.",
        confianca="N/A",
    ),
]


def patch_quase_vinculos(outdir):
    path = os.path.join(outdir, "quase_vinculos.csv")
    motivo_cond = "nivel-condominio: cliente=entidade sindico Veredas (CC_CLI:491); nao atribuir a unidade"
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        fieldnames = reader.fieldnames
        for row in reader:
            lid = int(row["id"])
            if lid in IDS_CONDOMINIO_101:
                row["motivo_nao_vinculo"] = motivo_cond
                row["imovel_candidato"] = "nivel-condominio"
            rows.append(row)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";")
        w.writeheader()
        w.writerows(rows)
    return len(IDS_CONDOMINIO_101)


def write_apply_log(conn, outdir):
    path = os.path.join(outdir, "placeholder_a_aplicado.csv")
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, valor, data_lancamento, descricao, LEFT(descricao_detalhada,120) det, imovel_id
            FROM financeiro_lancamento
            WHERE id IN (%s)
            ORDER BY data_lancamento, id
            """ % ",".join(map(str, IDS_606C))
        )
        rows = cur.fetchall()
    cols = ["lancamento_id", "data", "valor", "descricao", "detalhada", "imovel_id_novo"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";")
        w.writeheader()
        for r in rows:
            w.writerow(dict(
                lancamento_id=r["id"], data=r["data_lancamento"], valor=r["valor"],
                descricao=(r["descricao"] or "")[:80],
                detalhada=(r["det"] or "")[:120],
                imovel_id_novo=r["imovel_id"],
            ))
    return path, rows


def write_cross_ref(outdir):
    path = os.path.join(outdir, "cross_ref_proposta.csv")
    cols = [
        "placeholder", "cliente_id", "codigo_cliente", "cliente_nome",
        "contas", "qtd_contas", "imovel_candidato", "unidade_candidata",
        "evidencia", "confianca",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";")
        w.writeheader()
        for r in CROSS_REF:
            w.writerow(r)
    return path


def main():
    outdir = os.path.dirname(__file__) or "."
    conn = connect()
    n = patch_quase_vinculos(outdir)
    log_path, moved = write_apply_log(conn, outdir)
    cross_path = write_cross_ref(outdir)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) c FROM financeiro_lancamento "
            "WHERE imovel_id=60 AND status='ATIVO' AND natureza='DEBITO'"
        )
        cnt60 = cur.fetchone()["c"]
    conn.close()
    print(f"quase_vinculos: {n} linhas marcadas nivel-condominio")
    print(f"apply log: {log_path} ({len(moved)} lancamentos)")
    print(f"cross_ref: {cross_path}")
    print(f"imovel 60 total debitos ATIVOS: {cnt60}")


if __name__ == "__main__":
    main()
