"""
Pipeline de RAG para processos jurídicos — Villa Real Advocacia
================================================================
Objetivo: parar de reenviar o processo inteiro à IA a cada movimentação.
Fluxo:  PDF do processo  ->  chunks  ->  embeddings  ->  banco vetorial (pgvector)
        pergunta do advogado  ->  embedding  ->  busca  ->  só os trechos relevantes -> LLM

REGRA DE OURO: prazos e valores têm UMA fonte de verdade — o MySQL operacional
(tabelas `processo` e `processo_prazo`). O RAG NÃO mantém cópia própria: lê do
MySQL no momento de cada pergunta, para nunca responder com prazo envelhecido.

Instalação:
  pip install -r scripts/processo_rag/requirements.txt
  docker compose -f docker-compose.rag-pgvector.yml up -d

Variáveis de ambiente (ver .env.example):
  VOYAGE_API_KEY, ANTHROPIC_API_KEY, DATABASE_URL
  MYSQL_URL          (banco operacional — fonte da verdade de prazos/valores)
  ANTHROPIC_MODEL    (opcional, padrão claude-sonnet-4-6; sobreponível por chamada)
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Optional

import psycopg
from pgvector.psycopg import register_vector
from pypdf import PdfReader

EMBED_DIM = 1024  # voyage-3 = 1024. OpenAI text-embedding-3-large → 3072.

# --------------------------------------------------------------------------- #
# 1. ESQUEMA DO BANCO (pgvector)
#
# Prazos e valores NÃO vivem aqui: a fonte da verdade é o MySQL operacional
# (processo.prazo_fatal, processo.valor_causa, processo_prazo). Ver seção 5.
# --------------------------------------------------------------------------- #
SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;

-- Um registro por processo: aqui mora a ESTRATÉGIA e o resumo executivo vivo.
CREATE TABLE IF NOT EXISTS processos (
    numero_cnj      TEXT PRIMARY KEY,
    cliente         TEXT,
    tipo_acao       TEXT,
    objetivo        TEXT,
    chance_exito    TEXT,
    prioridade      TEXT,
    estrategia      TEXT,
    tatica_prazo    TEXT,
    resumo_executivo JSONB DEFAULT '{}'::jsonb,
    atualizado_em   TIMESTAMPTZ DEFAULT now()
);

-- Chunks versionados: reindexar NUNCA apaga — marca ativo=false e sobe versao.
-- Assim, referências antigas a chunk.id (auditoria, citações em peças) seguem válidas.
CREATE TABLE IF NOT EXISTS chunks (
    id            BIGSERIAL PRIMARY KEY,
    numero_cnj    TEXT REFERENCES processos(numero_cnj) ON DELETE CASCADE,
    versao        INT NOT NULL DEFAULT 1,
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    fonte_id      TEXT,
    tipo_peca     TEXT,
    data_mov      DATE,
    ordem         INT,
    texto         TEXT,
    embedding     vector(%(embed_dim)s)
);
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS versao INT NOT NULL DEFAULT 1;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS fonte_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_fonte_id
    ON chunks(fonte_id) WHERE fonte_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chunks_embedding
    ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_chunks_cnj_ativo ON chunks(numero_cnj) WHERE ativo;

-- Auditoria: quais chunks embasaram cada resposta (rastreabilidade jurídica).
CREATE TABLE IF NOT EXISTS consultas (
    id            BIGSERIAL PRIMARY KEY,
    numero_cnj    TEXT REFERENCES processos(numero_cnj) ON DELETE CASCADE,
    pergunta      TEXT,
    chunk_ids     BIGINT[],
    modelo        TEXT,
    criado_em     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consultas_cnj ON consultas(numero_cnj);
""".replace("%(embed_dim)s", str(EMBED_DIM))


def conectar():
    conn = psycopg.connect(os.environ["DATABASE_URL"], autocommit=True)
    register_vector(conn)
    return conn


def criar_schema(conn):
    conn.execute(SCHEMA)


def _modelo_anthropic(override: Optional[str] = None) -> str:
    """Sonnet no dia a dia; para análise crítica (sentença, contestação) passe
    um override pontual, ex.: modelo='claude-opus-4-8'."""
    return override or os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")


# --------------------------------------------------------------------------- #
# 1b. MYSQL OPERACIONAL — fonte única de prazos e valores
# --------------------------------------------------------------------------- #
def normalizar_cnj_digitos(numero_cnj: str) -> str:
    """CNJ canônico: só dígitos, 20 posições (zeros à esquerda preservados).

    Alinha com o padrão do backend (PublicacaoRepository): pontuação é irrelevante;
    padding evita falso negativo quando um lado suprime zeros.
    """
    digitos = re.sub(r"\D", "", numero_cnj or "")
    if not digitos:
        raise ValueError(f"CNJ inválido (sem dígitos): {numero_cnj!r}")
    if len(digitos) > 20:
        raise ValueError(f"CNJ com mais de 20 dígitos: {numero_cnj!r}")
    return digitos.zfill(20)


def _mysql_timeout_s() -> int:
    return int(os.environ.get("MYSQL_QUERY_TIMEOUT_S", "5"))


def _mysql_conectar():
    import pymysql
    from urllib.parse import unquote, urlparse

    url = os.environ.get("MYSQL_URL")
    if not url:
        raise ValueError(
            "MYSQL_URL não definida. Prazos e valores vêm do MySQL operacional "
            "(fonte única da verdade); ex.: mysql://root:root@localhost:3307/vilareal"
        )
    timeout = _mysql_timeout_s()
    u = urlparse(url)
    return pymysql.connect(
        host=u.hostname or "localhost",
        port=u.port or 3306,
        user=unquote(u.username or ""),
        password=unquote(u.password or ""),
        database=u.path.lstrip("/"),
        charset="utf8mb4",
        connect_timeout=timeout,
        read_timeout=timeout,
        write_timeout=timeout,
    )


def carregar_prazos_valores_mysql(
    numero_cnj: str,
    *,
    janela_cumpridos_dias: int = 30,
) -> dict:
    """Lê prazos e valores do MySQL no momento da consulta (nunca de cópia local).

    Separa prazos abertos de prazos recentemente encerrados: um prazo marcado
    cumprido (ex.: embargos protocolados no último dia) deixa de correr, mas a
    IA ainda precisa saber que aconteceu e quando — por isso a janela de
    cumpridos recentes entra como contexto, não como prazo em aberto.
    """
    digitos = normalizar_cnj_digitos(numero_cnj)
    my = _mysql_conectar()
    try:
        with my.cursor() as cur:
            cur.execute(
                """SELECT id, prazo_fatal, valor_causa FROM processo
                   WHERE LPAD(REGEXP_REPLACE(COALESCE(numero_cnj,''), '[^0-9]', ''), 20, '0') = %s
                     AND ativo""",
                (digitos,),
            )
            rows = cur.fetchall()
            if not rows:
                raise ValueError(
                    f"Processo CNJ {numero_cnj} não encontrado no MySQL operacional."
                )
            if len(rows) > 1:
                print(
                    f"[AVISO] {len(rows)} processos ativos com CNJ {numero_cnj} no MySQL; "
                    "usando o primeiro."
                )
            processo_id, prazo_fatal_cab, valor_causa = rows[0]

            cur.execute(
                """SELECT descricao, data_inicio, data_fim, prazo_fatal, status, observacao
                   FROM processo_prazo
                   WHERE processo_id = %s
                     AND (status IS NULL OR UPPER(status) NOT IN ('CANCELADO','CUMPRIDO','CONCLUIDO'))
                   ORDER BY data_fim""",
                (processo_id,),
            )
            prazos_abertos = [
                {
                    "descricao": d,
                    "data_inicio": str(di) if di else None,
                    "data_fatal": str(df),
                    "fatal": bool(f),
                    "status": s,
                    "observacao": o,
                }
                for d, di, df, f, s, o in cur.fetchall()
            ]

            cur.execute(
                """SELECT descricao, data_inicio, data_fim, prazo_fatal, status, observacao
                   FROM processo_prazo
                   WHERE processo_id = %s
                     AND UPPER(COALESCE(status,'')) IN ('CUMPRIDO','CONCLUIDO')
                     AND data_fim >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
                   ORDER BY data_fim DESC""",
                (processo_id, janela_cumpridos_dias),
            )
            prazos_recentemente_encerrados = [
                {
                    "descricao": d,
                    "data_inicio": str(di) if di else None,
                    "data_fatal": str(df),
                    "fatal": bool(f),
                    "status": s,
                    "observacao": o,
                }
                for d, di, df, f, s, o in cur.fetchall()
            ]
    except Exception as exc:
        timeout = _mysql_timeout_s()
        nome = type(exc).__name__
        if "timeout" in nome.lower() or "timed out" in str(exc).lower():
            raise TimeoutError(
                f"MySQL operacional não respondeu em {timeout}s ao buscar prazos de "
                f"{numero_cnj}. Pergunta abortada (falhar alto)."
            ) from exc
        raise
    finally:
        my.close()

    if prazo_fatal_cab:
        prazos_abertos.insert(0, {
            "descricao": "prazo fatal (cabeçalho do processo)",
            "data_fatal": str(prazo_fatal_cab),
            "fatal": True,
        })
    valores = []
    if valor_causa is not None:
        valores.append({"rubrica": "valor da causa", "valor": float(valor_causa)})
    return {
        "prazos_abertos": prazos_abertos,
        "prazos_recentemente_encerrados": prazos_recentemente_encerrados,
        "valores": valores,
    }


# --------------------------------------------------------------------------- #
# 2. EMBEDDINGS
# --------------------------------------------------------------------------- #
def embed(textos: list[str], input_type: str = "document") -> list[list[float]]:
    """Gera embeddings semânticos. input_type: 'document' ao indexar, 'query' ao buscar."""
    import voyageai

    vo = voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])
    r = vo.embed(textos, model="voyage-3", input_type=input_type)
    return r.embeddings


# --------------------------------------------------------------------------- #
# 3. CHUNKING
# --------------------------------------------------------------------------- #
MARCADORES = [
    "AÇÃO DE COBRANÇA",
    "CONTESTA",
    "RECONVEN",
    "AUDIÊNCIA",
    "SENTENÇA",
    "EMBARGOS DE DECLARAÇÃO",
    "DECIDO",
    "DISPOSITIVO",
    "CERTIDÃO",
    "INTIMAÇÃO",
    "DESPACHO",
    "DECISÃO",
    "MANDADO",
]
_PAT = re.compile("(" + "|".join(MARCADORES) + ")", re.IGNORECASE)


def _tipo_peca(trecho: str) -> str:
    m = _PAT.search(trecho)
    return m.group(1).lower() if m else "outros"


@dataclass
class Chunk:
    tipo_peca: str
    ordem: int
    texto: str


def chunk_texto(texto: str, tam: int = 1200, overlap: int = 150) -> list[Chunk]:
    cortes = sorted({0, *[m.start() for m in _PAT.finditer(texto)], len(texto)})
    blocos = [
        texto[a:b].strip()
        for a, b in zip(cortes, cortes[1:])
        if len(texto[a:b].strip()) > 300
    ]
    chunks, ordem = [], 0
    for bloco in blocos:
        tipo = _tipo_peca(bloco)
        i = 0
        while i < len(bloco):
            sub = bloco[i : i + tam].strip()
            if sub:
                chunks.append(Chunk(tipo_peca=tipo, ordem=ordem, texto=sub))
                ordem += 1
            i += tam - overlap
    return chunks


def ler_pdf(caminho: str) -> str:
    return "\n".join(p.extract_text() or "" for p in PdfReader(caminho).pages)


# --------------------------------------------------------------------------- #
# 4. INGESTÃO
# --------------------------------------------------------------------------- #
@dataclass
class Estrategia:
    cliente: str = ""
    tipo_acao: str = ""
    objetivo: str = ""
    chance_exito: str = "media"
    prioridade: str = "normal"
    estrategia: str = "ritmo_normal"
    tatica_prazo: str = ""


def garantir_processo(conn, numero_cnj: str) -> None:
    """Garante registro mínimo em processos (FK dos chunks)."""
    conn.execute(
        "INSERT INTO processos (numero_cnj) VALUES (%s) ON CONFLICT (numero_cnj) DO NOTHING",
        (numero_cnj,),
    )


def fonte_id_drive(drive_file_id: str) -> str:
    return f"drive:{drive_file_id}"


def ja_indexado(conn, fonte_id: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM chunks WHERE fonte_id=%s LIMIT 1",
        (fonte_id,),
    ).fetchone()
    return row is not None


def ingerir_processo(
    conn,
    numero_cnj: str,
    caminho_pdf: str,
    estrat: Estrategia,
    *,
    reindexar: bool = False,
):
    """Indexa o PDF completo. Reindexar NÃO apaga chunks: marca a versão antiga
    como ativo=false e grava uma nova — ids antigos continuam válidos para
    auditoria (tabela consultas) e citações passadas."""
    conn.execute(
        """INSERT INTO processos (numero_cnj, cliente, tipo_acao, objetivo,
               chance_exito, prioridade, estrategia, tatica_prazo)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
           ON CONFLICT (numero_cnj) DO UPDATE SET
               cliente=EXCLUDED.cliente, tipo_acao=EXCLUDED.tipo_acao,
               objetivo=EXCLUDED.objetivo, chance_exito=EXCLUDED.chance_exito,
               prioridade=EXCLUDED.prioridade, estrategia=EXCLUDED.estrategia,
               tatica_prazo=EXCLUDED.tatica_prazo, atualizado_em=now()""",
        (
            numero_cnj,
            estrat.cliente,
            estrat.tipo_acao,
            estrat.objetivo,
            estrat.chance_exito,
            estrat.prioridade,
            estrat.estrategia,
            estrat.tatica_prazo,
        ),
    )

    versao_atual = conn.execute(
        "SELECT COALESCE(MAX(versao),0) FROM chunks WHERE numero_cnj=%s",
        (numero_cnj,),
    ).fetchone()[0]
    if versao_atual and not reindexar:
        print(
            f"[AVISO] {numero_cnj} já tem chunks (versão {versao_atual}). "
            "Use reindexar=True (--reindexar) para gerar nova versão sem apagar a antiga."
        )
        return
    if reindexar and versao_atual:
        conn.execute(
            "UPDATE chunks SET ativo=FALSE WHERE numero_cnj=%s AND ativo",
            (numero_cnj,),
        )
    versao = versao_atual + 1

    chunks = chunk_texto(ler_pdf(caminho_pdf))
    vetores = embed([c.texto for c in chunks], input_type="document")

    with conn.cursor() as cur:
        for c, v in zip(chunks, vetores):
            cur.execute(
                """INSERT INTO chunks (numero_cnj, versao, tipo_peca, ordem, texto, embedding)
                   VALUES (%s,%s,%s,%s,%s,%s)""",
                (numero_cnj, versao, c.tipo_peca, c.ordem, c.texto, v),
            )
    print(f"[OK] {numero_cnj}: {len(chunks)} chunks indexados (versão {versao}).")


def ingerir_incremental(
    conn,
    numero_cnj: str,
    texto_peca_nova: str,
    tipo: str,
    data_mov: Optional[str] = None,
    *,
    fonte_id: Optional[str] = None,
) -> bool:
    """Indexa uma petição/andamento novo. Retorna False se fonte_id já existir."""
    criar_schema(conn)
    garantir_processo(conn, numero_cnj)
    if fonte_id and ja_indexado(conn, fonte_id):
        print(f"[OK] {fonte_id} já indexado; ignorado.")
        return False

    base, versao = conn.execute(
        """SELECT COALESCE(MAX(ordem),0), COALESCE(MAX(versao),1)
           FROM chunks WHERE numero_cnj=%s AND ativo""",
        (numero_cnj,),
    ).fetchone()
    chunks = chunk_texto(texto_peca_nova)
    if not chunks:
        print(f"[AVISO] {numero_cnj}: peça sem texto indexável ({fonte_id or tipo}).")
        return False
    vetores = embed([c.texto for c in chunks], input_type="document")
    with conn.cursor() as cur:
        for k, (c, v) in enumerate(zip(chunks, vetores), start=1):
            cur.execute(
                """INSERT INTO chunks (numero_cnj, versao, fonte_id, tipo_peca, ordem, data_mov, texto, embedding)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    numero_cnj,
                    versao,
                    fonte_id if k == 1 else None,
                    tipo,
                    base + k,
                    data_mov,
                    c.texto,
                    v,
                ),
            )
    print(f"[OK] {numero_cnj}: +{len(chunks)} chunks da peça nova ({tipo}).")
    return True


def indexar_arquivo_local(
    numero_cnj: str,
    caminho_pdf: str,
    tipo: str,
    *,
    fonte_id: Optional[str] = None,
    data_mov: Optional[str] = None,
) -> bool:
    """Indexa um PDF local (chamado pelo backend Java após download do Drive)."""
    conn = conectar()
    criar_schema(conn)
    texto = ler_pdf(caminho_pdf).strip()
    if not texto:
        raise ValueError(f"PDF sem texto extraível: {caminho_pdf}")
    return ingerir_incremental(
        conn,
        numero_cnj,
        texto,
        tipo,
        data_mov,
        fonte_id=fonte_id,
    )


# --------------------------------------------------------------------------- #
# 5. BUSCA + RESPOSTA
# --------------------------------------------------------------------------- #
def buscar(conn, numero_cnj: str, pergunta: str, k: int = 5) -> list[dict]:
    qv = embed([pergunta], input_type="query")[0]
    rows = conn.execute(
        """SELECT id, tipo_peca, texto, 1 - (embedding <=> %s) AS similaridade
           FROM chunks WHERE numero_cnj = %s AND ativo
           ORDER BY embedding <=> %s LIMIT %s""",
        (qv, numero_cnj, qv, k),
    ).fetchall()
    return [
        {"id": i, "tipo_peca": t, "texto": x, "similaridade": round(s, 3)}
        for i, t, x, s in rows
    ]


def _carregar_contexto_interno(conn, numero_cnj: str) -> dict:
    p = conn.execute(
        """SELECT cliente, tipo_acao, objetivo, chance_exito, prioridade,
                  estrategia, tatica_prazo, COALESCE(resumo_executivo,'{}'::jsonb)
           FROM processos WHERE numero_cnj=%s""",
        (numero_cnj,),
    ).fetchone()
    if p is None:
        raise ValueError(f"Processo {numero_cnj} não encontrado.")
    ficha = {
        "numero_cnj": numero_cnj,
        "cliente": p[0],
        "tipo_acao": p[1],
        "objetivo": p[2],
        "chance_exito": p[3],
        "prioridade": p[4],
        "estrategia": p[5],
        "tatica_prazo": p[6],
    }
    resumo = p[7]
    # Prazos e valores: SEMPRE ao vivo do MySQL operacional (fonte única).
    operacional = carregar_prazos_valores_mysql(numero_cnj)
    return {
        "ficha": ficha,
        "resumo": resumo,
        "prazos_abertos": operacional["prazos_abertos"],
        "prazos_recentemente_encerrados": operacional["prazos_recentemente_encerrados"],
        "valores": operacional["valores"],
    }


_INSTRUCOES = (
    "Você é assistente jurídico INTERNO do escritório.\n"
    "REGRA CRÍTICA: o CONTEXTO INTERNO abaixo orienta o seu raciocínio, mas você "
    "NUNCA deve reproduzir, citar ou parafrasear os campos internos (chance_exito, "
    "estrategia, tatica_prazo, prioridade, pendencias) em petições, e-mails ou "
    "qualquer texto destinado a terceiros. Eles são de uso interno.\n"
    "Respeite a estratégia do caso: se estrategia='ganhar_tempo', não sugira "
    "acelerar atos; se 'acelerar', priorize celeridade.\n"
    "Para prazo e valor, use SEMPRE os campos estruturados como fonte da verdade, "
    "não a sua memória nem o texto do resumo.\n"
    "PRAZOS ABERTOS = o que ainda corre. PRAZOS RECENTEMENTE ENCERRADOS = cumpridos "
    "nos últimos 30 dias; use só como contexto (ex.: 'protocolou embargos em X'), "
    "nunca como prazo pendente."
)


def perguntar(
    conn,
    numero_cnj: str,
    pergunta_do_usuario: str,
    k: int = 8,
    modelo: Optional[str] = None,
) -> str:
    """`modelo` sobrepõe o padrão só nesta chamada — ex.: Opus para análise
    crítica de sentença/contestação, Sonnet para o dia a dia."""
    from anthropic import Anthropic

    ctx = _carregar_contexto_interno(conn, numero_cnj)
    trechos = buscar(conn, numero_cnj, pergunta_do_usuario, k)

    system_texto = (
        f"{_INSTRUCOES}\n\n"
        "=== CONTEXTO INTERNO (não reproduzir os campos em texto para terceiros) ===\n"
        f"FICHA: {json.dumps(ctx['ficha'], ensure_ascii=False)}\n"
        f"RESUMO: {json.dumps(ctx['resumo'], ensure_ascii=False)}\n"
        f"PRAZOS ABERTOS (fonte da verdade): "
        f"{json.dumps(ctx['prazos_abertos'], ensure_ascii=False)}\n"
        f"PRAZOS RECENTEMENTE ENCERRADOS (contexto, não pendência): "
        f"{json.dumps(ctx['prazos_recentemente_encerrados'], ensure_ascii=False)}\n"
        f"VALORES (fonte da verdade): {json.dumps(ctx['valores'], ensure_ascii=False)}\n\n"
        "=== TRECHOS RECUPERADOS DO PROCESSO (prova bruta) ===\n"
        + "\n---\n".join(f"[{t['tipo_peca']}] {t['texto']}" for t in trechos)
    )

    modelo_usado = _modelo_anthropic(modelo)
    cli = Anthropic()
    msg = cli.messages.create(
        model=modelo_usado,
        max_tokens=1500,
        system=[
            {
                "type": "text",
                "text": system_texto,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": pergunta_do_usuario}],
    )

    # Auditoria: registra quais chunks embasaram esta resposta.
    conn.execute(
        """INSERT INTO consultas (numero_cnj, pergunta, chunk_ids, modelo)
           VALUES (%s,%s,%s,%s)""",
        (numero_cnj, pergunta_do_usuario, [t["id"] for t in trechos], modelo_usado),
    )
    return msg.content[0].text


def atualizar_resumo(
    conn, numero_cnj: str, texto_peca_nova: str, modelo: Optional[str] = None
) -> dict:
    from anthropic import Anthropic

    antigo = conn.execute(
        "SELECT COALESCE(resumo_executivo,'{}'::jsonb) FROM processos WHERE numero_cnj=%s",
        (numero_cnj,),
    ).fetchone()[0]
    cli = Anthropic()
    msg = cli.messages.create(
        model=_modelo_anthropic(modelo),
        max_tokens=1200,
        system=(
            "Você atualiza o resumo executivo de um processo. Responda APENAS "
            "com um objeto JSON válido, sem cercas de código nem texto fora dele. "
            "Chaves: sintese (string), fase_atual (string), "
            "teses_desenvolvidas (array de strings), pendencias (array de strings). "
            "Preserve o que continua válido; só altere o que a peça nova muda. "
            "NÃO coloque datas de prazo nem valores aqui — eles vivem em tabelas próprias."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Resumo atual (JSON):\n{json.dumps(antigo, ensure_ascii=False)}\n\n"
                    f"Nova peça/andamento:\n{texto_peca_nova}"
                ),
            }
        ],
    )
    bruto = msg.content[0].text.strip().replace("```json", "").replace("```", "").strip()
    try:
        novo = json.loads(bruto)
    except json.JSONDecodeError:
        print("[AVISO] resposta não veio em JSON válido; resumo mantido.")
        return antigo
    conn.execute(
        "UPDATE processos SET resumo_executivo=%s, atualizado_em=now() WHERE numero_cnj=%s",
        (json.dumps(novo), numero_cnj),
    )
    return novo
