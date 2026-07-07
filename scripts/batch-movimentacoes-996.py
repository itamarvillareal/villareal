#!/usr/bin/env python3
"""
Dispara «Obter movimentações» (POST /api/processos/{id}/movimentacoes-drive) para processos
PJe do cliente 996, um por vez, com verificação via logs VPS + Drive.

Ao final, reprocessa falhas em loop (--max-rounds, padrão 8).
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import hmac
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = os.environ.get("VILAREAL_API_BASE", "http://161.97.175.73:8081").rstrip("/")
SSH_HOST = os.environ.get("VILAREAL_SSH_HOST", "villareal-vps")
LOGIN = os.environ.get("VILAREAL_IMPORT_LOGIN", "itamar")
SENHA = os.environ.get("VILAREAL_IMPORT_SENHA", "123456")
JWT_SECRET = os.environ.get("VILAREAL_JWT_SECRET", "")
JWT_UID = int(os.environ.get("VILAREAL_JWT_UID", "1"))
JWT_EXP_S = int(os.environ.get("VILAREAL_JWT_EXP_S", "86400"))
PJE_LOGIN = "00733235190"
CODIGO_CLIENTE = "00000996"
POLL_MAX_S = 540
ROUND_COOLDOWN_S = 45
REPORT = Path(__file__).resolve().parent.parent / "relatorio-movimentacoes-996.csv"
LOG = Path(__file__).resolve().parent.parent / "relatorio-movimentacoes-996.log"

FIELDNAMES = [
    "processoId",
    "numeroInterno",
    "numeroCnj",
    "pjeTribunal",
    "pjeGrau",
    "temPublicacaoTrt",
    "temPdfAlternativoDrive",
    "disparoStatus",
    "disparoMensagem",
    "resultado",
    "categoria",
    "caminhoSugerido",
    "driveFileId",
    "duracaoSeg",
    "tentativas",
    "observacao",
]

# Falhas sem e-mail TRT / fora do acervo do advogado — não adianta retry automático.
CATEGORIAS_SEM_RETRY = frozenset({"SEM_ACESSO_PJE", "SEM_EMAIL_TRT"})


def log(msg: str) -> None:
    line = f"{datetime.now().isoformat(timespec='seconds')} {msg}"
    print(line, flush=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def api(method: str, path: str, token: str, body: dict | None = None, timeout: int = 120) -> tuple[int, object]:
    url = BASE + path
    data = None
    headers = {"Authorization": f"Bearer {token}"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw) if raw else {"erro": raw}
        except json.JSONDecodeError:
            payload = {"erro": raw}
        return e.code, payload


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def mint_jwt_token() -> str:
    if not JWT_SECRET:
        raise RuntimeError("VILAREAL_JWT_SECRET não definido")
    sub = (LOGIN or "").strip().lower()
    now = int(time.time())
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64url(
        json.dumps({"uid": JWT_UID, "sub": sub, "iat": now, "exp": now + JWT_EXP_S}, separators=(",", ":")).encode()
    )
    msg = f"{header}.{payload}".encode()
    sig = _b64url(hmac.new(JWT_SECRET.encode(), msg, hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


def login() -> str:
    if JWT_SECRET:
        return mint_jwt_token()
    _, resp = api("POST", "/api/auth/login", "", {"login": LOGIN, "senha": SENHA})
    token = resp.get("accessToken") if isinstance(resp, dict) else None
    if not token:
        raise RuntimeError(f"Login falhou: {resp}")
    return token


def preflight_pje(token: str, leve: bool = False) -> tuple[bool, str]:
    if leve:
        return True, "preflight leve (rodada de retry)"
    _, resp = api(
        "POST",
        "/api/admin/pje/trt18/teste-login",
        token,
        {"grau": "PRIMEIRO_GRAU", "login": PJE_LOGIN},
        timeout=120,
    )
    if not isinstance(resp, dict):
        return False, str(resp)
    if resp.get("sucesso"):
        return True, "robô PJe OK"
    msg = resp.get("mensagem") or resp.get("estadoFinal") or "erro desconhecido"
    if "ocupado" in msg.lower():
        return True, f"robô ocupado (seguindo): {msg}"
    if "auto-freio" in msg.lower():
        return False, msg
    return False, msg


def nome_arquivo_pdf(cnj: str) -> str:
    digitos = re.sub(r"\D", "", cnj or "")
    if len(digitos) == 20:
        return (
            f"Processo_{digitos[0:7]}-{digitos[7:9]}.{digitos[9:13]}."
            f"{digitos[13:14]}.{digitos[14:16]}.{digitos[16:20]}.pdf"
        )
    safe = re.sub(r"[^0-9A-Za-z.-]", "", cnj or "")
    return f"Processo_{safe}.pdf"


def parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        if s.endswith("Z"):
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def ssh_backend_logs_since(since_utc: datetime) -> str:
    since = since_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    if os.environ.get("VILAREAL_DOCKER_LOGS_LOCAL") == "1":
        cmd = ["docker", "logs", "vilareal-backend", "--since", since]
    else:
        cmd = ["ssh", SSH_HOST, f"docker logs vilareal-backend --since {since} 2>&1"]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return out.stdout + out.stderr
    except (subprocess.TimeoutExpired, OSError) as e:
        return str(e)


def analisar_logs_pje(cnj: str, logs: str) -> tuple[str | None, str | None, str | None]:
    cnj_u = cnj.strip().upper()
    relevant = [ln for ln in logs.splitlines() if cnj_u in ln.upper()]
    if not relevant:
        return None, None, None

    last_fail = None
    aguardando_2grau = False

    for ln in relevant:
        if "arquivada (fileId=" in ln:
            m = re.search(r"fileId=([^,)]+)", ln)
            return "SUCESSO", (m.group(1) if m else None), "log: arquivada no Drive"
        if "tentando 2º grau" in ln or "tentando 2o grau" in ln.lower():
            aguardando_2grau = True
            last_fail = None
            continue
        if "falha em 1º grau" in ln or "falha em 1o grau" in ln.lower():
            aguardando_2grau = True
            continue
        if "PjeCopiaIntegralOrchestrator" in ln and "falhou" in ln:
            m = re.search(r"falhou \(cnj=[^)]+\): (.+)$", ln)
            if m:
                last_fail = m.group(1).strip()
        if "PjeCopiaIntegralPorProcessoService" in ln:
            if "auto-freio" in ln or "ocupado" in ln or "não concluiu" in ln:
                last_fail = ln.split(":", 2)[-1].strip()

    if last_fail and not aguardando_2grau:
        return "FALHA", None, f"log: {last_fail[:200]}"
    return None, None, None


def poll_interval(elapsed_s: float) -> float:
    if elapsed_s < 90:
        return 6
    if elapsed_s < 240:
        return 10
    return 15


class DriveCache:
    def __init__(self) -> None:
        self._pastas: dict[int, str | None] = {}

    def invalidate(self, numero_interno: int) -> None:
        self._pastas.pop(numero_interno, None)

    def pasta_movimentacoes(self, token: str, numero_interno: int) -> str | None:
        if numero_interno not in self._pastas:
            self._pastas[numero_interno] = self._fetch_pasta(token, numero_interno)
        return self._pastas[numero_interno]

    def _fetch_pasta(self, token: str, numero_interno: int) -> str | None:
        _, data = api("GET", f"/api/drive/arquivos?codigoCliente={CODIGO_CLIENTE}&numeroInterno={numero_interno}", token)
        items = data if isinstance(data, list) else []
        for item in items:
            if item.get("tipo") == "pasta" and "moviment" in (item.get("nome") or "").lower():
                return item.get("id")
        return None

    def pdf_info(self, token: str, numero_interno: int, nome_esperado: str) -> tuple[str | None, datetime | None]:
        pasta_id = self.pasta_movimentacoes(token, numero_interno)
        if not pasta_id:
            return None, None
        _, data = api(
            "GET",
            f"/api/drive/arquivos?codigoCliente={CODIGO_CLIENTE}&numeroInterno={numero_interno}&pastaId={pasta_id}",
            token,
        )
        items = data if isinstance(data, list) else []
        for item in items:
            if item.get("tipo") == "arquivo" and item.get("nome") == nome_esperado:
                return item.get("id"), parse_iso(item.get("dataModificacao"))
        return None, None


def drive_atualizado(
    cache: DriveCache,
    token: str,
    numero_interno: int,
    nome_esperado: str,
    baseline: datetime | None,
    started: datetime,
) -> tuple[bool, str | None]:
    cache.invalidate(numero_interno)
    file_id, mod = cache.pdf_info(token, numero_interno, nome_esperado)
    if not file_id:
        return False, None
    if mod is None:
        return True, file_id
    if baseline is None and mod >= started:
        return True, file_id
    if baseline is not None and mod > baseline:
        return True, file_id
    return False, None


def tem_publicacao_trt(token: str, processo_id: int) -> bool:
    _, data = api("GET", f"/api/publicacoes?processoId={processo_id}", token)
    if not isinstance(data, list):
        return False
    for pub in data:
        origem = (pub.get("origemImportacao") or "").upper()
        if origem == "TRT":
            return True
        texto = (pub.get("assunto") or "") + (pub.get("corpo") or "")
        if ".5.18." in (pub.get("numeroCnj") or "") or "TRT" in origem:
            return True
    return False


def tem_pdf_alternativo_drive(token: str, numero_interno: int, cnj: str) -> bool:
    """ATOrd/ATSum na raiz do processo — caminho manual/legado sem cópia integral PJe."""
    digitos = re.sub(r"\D", "", cnj)
    _, data = api("GET", f"/api/drive/arquivos?codigoCliente={CODIGO_CLIENTE}&numeroInterno={numero_interno}", token)
    items = data if isinstance(data, list) else []
    for item in items:
        if item.get("tipo") != "arquivo":
            continue
        nome = (item.get("nome") or "").upper()
        if nome.startswith("ATORD_") or nome.startswith("ATSUM_"):
            if digitos and digitos in re.sub(r"\D", "", nome):
                return True
        if nome.startswith("PROCESSO_") and digitos in re.sub(r"\D", "", nome):
            return True
    return False


def classificar_resultado(
    resultado: str,
    obs: str,
    tem_email_trt: bool,
    tem_alt_drive: bool,
) -> tuple[str, str]:
    if resultado == "SUCESSO":
        return "OK", ""

    obs_l = (obs or "").lower()
    if any(x in obs_l for x in ("timeout", "exceeded", "tela_login", "não concluiu", "nao concluiu")):
        if not tem_email_trt:
            caminho = (
                "Sem publicação TRT por e-mail — provável falta de habilitação no PJe; "
                "tentar grau manual (modal Tramitação), outro login ou PDF ATOrd já no Drive"
            )
            return "SEM_ACESSO_PJE", caminho
        if tem_alt_drive:
            return "SEM_ACESSO_PJE", "Acervo PJe inacessível; já existe PDF alternativo (ATOrd/ATSum) no Drive"
        return "SEM_ACESSO_PJE", "Acervo PJe inacessível neste login — revisar grau/tribunal ou acesso manual"

    if not tem_email_trt:
        return "SEM_EMAIL_TRT", "Sem e-mail TRT vinculado — caminho automático por e-mail não se aplica"

    if any(x in obs_l for x in ("auto-freio", "ocupado", "http")):
        return "FALHA_TECNICA", "Retry automático pode resolver"

    return "FALHA_TECNICA", "Revisar logs; retry automático"


def listar_processos_pje(token: str) -> list[dict]:
    _, data = api("GET", f"/api/processos?codigoCliente={CODIGO_CLIENTE}&size=200", token)
    items = data.get("content", []) if isinstance(data, dict) else []
    return sorted(
        [p for p in items if (p.get("tramitacao") or "").strip() == "PJe"],
        key=lambda x: x["id"],
    )


def carregar_rows() -> list[dict]:
    if not REPORT.exists():
        return []
    with REPORT.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def salvar(rows: list[dict]) -> None:
    with REPORT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def tentativas_de(row: dict | None) -> int:
    if not row:
        return 0
    try:
        return int(row.get("tentativas") or 0)
    except ValueError:
        return 0


def aguardar_resultado(
    token: str,
    cache: DriveCache,
    cnj: str,
    numero_interno: int,
    nome_pdf: str,
    baseline_mod: datetime | None,
    started: datetime,
) -> tuple[str, str | None, str]:
    deadline = time.time() + POLL_MAX_S
    t0 = time.time()
    ultimo_log_fail: str | None = None

    while time.time() < deadline:
        logs = ssh_backend_logs_since(started)
        st, fid, msg = analisar_logs_pje(cnj, logs)
        if st == "SUCESSO":
            return "SUCESSO", fid, msg
        if st == "FALHA":
            ultimo_log_fail = msg
            return "FALHA", None, msg or "falha no log do backend"

        ok, drive_id = drive_atualizado(cache, token, numero_interno, nome_pdf, baseline_mod, started)
        if ok:
            return "SUCESSO", drive_id, f"Drive: {nome_pdf}"

        time.sleep(poll_interval(time.time() - t0))

    if ultimo_log_fail:
        return "FALHA", None, ultimo_log_fail
    return "FALHA", None, f"timeout {POLL_MAX_S}s (log+Drive)"


def processar_um(
    token: str,
    cache: DriveCache,
    p: dict,
    rows: list[dict],
    idx: int,
    total: int,
    rodada: int,
) -> list[dict]:
    pid = p["id"]
    ni = p.get("numeroInterno")
    cnj = p.get("numeroCnj") or ""
    nome_pdf = nome_arquivo_pdf(cnj)
    prev = next((r for r in rows if int(r["processoId"]) == pid), None)
    n_tent = tentativas_de(prev) + 1

    t0 = time.time()
    started = datetime.now(timezone.utc)
    _, baseline_mod = cache.pdf_info(token, ni, nome_pdf)
    tem_trt = tem_publicacao_trt(token, pid)
    tem_alt = tem_pdf_alternativo_drive(token, ni, cnj)

    log(
        f"[R{rodada} {idx}/{total}] processo {pid} proc#{ni} CNJ {cnj} "
        f"(tentativa {n_tent}, emailTRT={'sim' if tem_trt else 'não'}, altDrive={'sim' if tem_alt else 'não'})…"
    )

    status_code, resp = api("POST", f"/api/processos/{pid}/movimentacoes-drive", token)
    disparo_status = resp.get("status") if isinstance(resp, dict) else None
    disparo_msg = resp.get("mensagem") or resp.get("erro") if isinstance(resp, dict) else str(resp)

    resultado = "FALHA"
    drive_id = None
    obs = ""

    if status_code >= 400:
        obs = f"HTTP {status_code}: {resp}"
    elif disparo_status == "INICIADO":
        resultado, drive_id, obs = aguardar_resultado(token, cache, cnj, ni, nome_pdf, baseline_mod, started)
    elif disparo_status in ("PJE_AUTOMACAO_INDISPONIVEL", "SEM_SISTEMA"):
        obs = disparo_msg or disparo_status
    elif disparo_status == "CONCLUIDO":
        resultado = "SUCESSO"
        obs = disparo_msg or "Projudi concluído"
    else:
        obs = disparo_msg or f"status inesperado: {disparo_status}"

    categoria, caminho = classificar_resultado(resultado, obs, tem_trt, tem_alt)

    row = {
        "processoId": pid,
        "numeroInterno": ni,
        "numeroCnj": cnj,
        "pjeTribunal": p.get("pjeTribunal"),
        "pjeGrau": p.get("pjeGrau"),
        "temPublicacaoTrt": "sim" if tem_trt else "nao",
        "temPdfAlternativoDrive": "sim" if tem_alt else "nao",
        "disparoStatus": disparo_status,
        "disparoMensagem": disparo_msg,
        "resultado": resultado,
        "categoria": categoria,
        "caminhoSugerido": caminho,
        "driveFileId": drive_id or "",
        "duracaoSeg": int(time.time() - t0),
        "tentativas": n_tent,
        "observacao": obs,
    }
    rows = [r for r in rows if int(r["processoId"]) != pid] + [row]
    salvar(rows)
    log(f"  → {resultado} [{categoria}] ({row['duracaoSeg']}s) {obs}")
    return rows


def ids_sucesso(rows: list[dict]) -> set[int]:
    return {int(r["processoId"]) for r in rows if r.get("resultado") == "SUCESSO"}


def ids_retry(rows: list[dict]) -> set[int]:
    """Processos que ainda podem ser retentados automaticamente."""
    ok = ids_sucesso(rows)
    out = set()
    for r in rows:
        pid = int(r["processoId"])
        if pid in ok:
            continue
        cat = r.get("categoria") or ""
        if cat in CATEGORIAS_SEM_RETRY:
            continue
        out.add(pid)
    return out


def rodada_processar(
    token: str,
    processos: list[dict],
    rows: list[dict],
    rodada: int,
    apenas_falhas: bool,
) -> list[dict]:
    if apenas_falhas:
        retry_ids = ids_retry(rows)
        pendentes = [p for p in processos if p["id"] in retry_ids]
    else:
        pendentes = [p for p in processos if p["id"] not in ids_sucesso(rows)]

    if not pendentes:
        return rows

    cache = DriveCache()
    for i, p in enumerate(pendentes, 1):
        rows = processar_um(token, cache, p, rows, i, len(pendentes), rodada)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--resume", action="store_true", help="Pula processos já com SUCESSO no CSV")
    parser.add_argument("--preflight-only", action="store_true", help="Só verifica robô e sai")
    parser.add_argument("--no-loop", action="store_true", help="Não reprocessa falhas ao final")
    parser.add_argument("--max-rounds", type=int, default=8, help="Máximo de rodadas incluindo retries")
    args = parser.parse_args()

    token = login()
    ok, preflight_msg = preflight_pje(token, leve=False)
    log(f"Preflight PJe: {'OK' if ok else 'BLOQUEADO'} — {preflight_msg}")

    if args.preflight_only:
        return 0 if ok else 2

    if not ok:
        return 2

    processos = listar_processos_pje(token)
    rows = carregar_rows() if args.resume else []
    if not args.resume:
        rows = []

    log(f"Início: {len(processos)} processos PJe; {len(ids_sucesso(rows))} já com sucesso")

    max_rounds = 1 if args.no_loop else args.max_rounds
    rodada = 0

    while rodada < max_rounds:
        rodada += 1
        sucesso_ids = ids_sucesso(rows)
        retry_ids = ids_retry(rows)
        falhas_antes = len(processos) - len(sucesso_ids)
        retry_antes = len(retry_ids)
        if falhas_antes == 0:
            break

        if rodada > 1:
            if retry_antes == 0:
                log(f"─── Rodada {rodada}: só falhas SEM_ACESSO/SEM_EMAIL — encerrando retries ───")
                break
            log(
                f"─── Rodada {rodada}: {falhas_antes} falha(s) total, "
                f"{retry_antes} retentável(is), aguardando {ROUND_COOLDOWN_S}s ───"
            )
            time.sleep(ROUND_COOLDOWN_S)
            ok_r, msg_r = preflight_pje(token, leve=True)
            log(f"Preflight rodada {rodada}: {msg_r}")

        rows = rodada_processar(token, processos, rows, rodada, apenas_falhas=(rodada > 1))
        sucesso = len(ids_sucesso(rows))
        falhas = len(processos) - sucesso
        log(f"Rodada {rodada} fim: {sucesso} sucesso, {falhas} falha")

        if falhas == 0 or args.no_loop:
            break

    sucesso = len(ids_sucesso(rows))
    falhas = len(processos) - sucesso
    sem_acesso = sum(1 for r in rows if (r.get("categoria") or "") in CATEGORIAS_SEM_RETRY)
    tecnicas = falhas - sem_acesso
    log(
        f"Concluído: {sucesso} sucesso, {falhas} falha "
        f"({sem_acesso} sem acesso/e-mail, {tecnicas} técnica) — {REPORT}"
    )
    return 0 if falhas == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
