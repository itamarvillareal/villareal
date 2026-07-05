# Fixtures de assinatura CMS (teste estrutural)

Par **sintético congelado** para calibrar o assinador — sem dados de clientes/processos.

## Arquivos versionados (apenas estes)

| Arquivo | Tamanho | Origem |
|---------|---------|--------|
| `referencia-sintetica.pdf` | **1483 bytes** | PDF mínimo (ReportLab); fixture congelado |
| `referencia-sintetica.p7s` | ~9100 bytes | Assinado no Windows com programa do tribunal + token A3 |
| `test-signer.p12` | ~2.6 KB | **Autoassinado sintético** (RSA 2048); senha `test-fixture`; só testes Mac |

## test-signer.p12 (PKCS#12 sintético)

- **Não** é certificado ICP-Brasil; **não** contém identidade real.
- Subject: `CN=Teste CMS Sintetico, O=VilaReal Test, C=BR`
- SHA-1 thumbprint: `A89EA5CD2BA3A875D2A8C7DDC29F44F66466878F`
- Regenerar (opcional): `scripts/gerar-test-signer-p12.sh`

## Importante: par tribunal não é regenerável

O par PDF + `.p7s` é um **artefato congelado**. O PDF embutido no `.p7s` deve ser **byte-idêntico** ao `referencia-sintetica.pdf` desta pasta.

- **Não** regenere o PDF com scripts — versões diferentes (ex.: 569 bytes vs 1483 bytes) invalidam o pareamento.
- O script `gerar-referencia-sintetica-pdf.py` no backend foi **aposentado**; não use para este fixture.

Para substituir o par no futuro: gere um novo PDF, assine no tribunal, valide estrutura e substitua **ambos** os arquivos juntos.

## Testes

```bash
# Mac/Linux/CI (sem token)
./e-vilareal-java-backend/mvnw -f pom.xml -pl e-vilareal-assinatura-core test

# Windows + token A3 — ver docs/WINDOWS-PKCS11-TEST.md
```

Roda no Mac **sem token**. Testes PKCS#11 (`@Tag("pkcs11-hardware")`) só no Windows com `ASSINATURA_TOKEN_PIN`.

## Dados sensíveis

O certificado do signatário no `.p7s` contém identidade do advogado (nome/CPF no CN). Inevitável na assinatura real. Os testes validam estrutura por OIDs/algoritmos/issuers (hash), **sem** imprimir subject/CN/CPF em logs ou mensagens de falha.
