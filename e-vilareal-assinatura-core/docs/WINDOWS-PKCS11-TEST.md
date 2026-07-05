# Testes PKCS#11 no Windows (token A3 Soluti)

Execute **somente** na máquina Windows com o token USB plugado e o driver SafeSign (`aetpkss1.dll`) instalado.

## Pré-condições

1. **Java 21** instalado (`java -version`)
2. **Token USB** Soluti/G&D conectado (único dispositivo, ou ajuste `ASSINATURA_PKCS11_SLOT_INDEX`)
3. **Driver SafeSign** — `C:\Windows\System32\aetpkss1.dll` acessível
4. Repositório clonado/atualizado com o módulo `e-vilareal-assinatura-core`
5. Certificado com thumbprint **`C695BA1EC72328487E8FCDC4C34357FEFDD3D100`** presente no token

## Variáveis de ambiente (PowerShell)

```powershell
$env:ASSINATURA_TOKEN_PIN = "SEU_PIN_AQUI"
# Opcional — só se o token não for slot 0:
# $env:ASSINATURA_PKCS11_SLOT_INDEX = "0"
# Opcional — .cfg customizado (senão usa pkcs11/pkcs11-soluti.cfg do classpath):
# $env:ASSINATURA_PKCS11_CFG = "C:\caminho\pkcs11-soluti.cfg"
```

**Nunca** commite o PIN. Use só na sessão do terminal.

## Comandos Maven

Na raiz do repositório (`villareal`):

```powershell
cd C:\caminho\para\villareal

# Testes normais (sem hardware) — deve passar/ignorar PKCS#11
.\e-vilareal-java-backend\mvnw.cmd -f pom.xml -pl e-vilareal-assinatura-core test

# Testes de hardware (token real) — habilita grupo pkcs11-hardware
.\e-vilareal-java-backend\mvnw.cmd -f pom.xml -pl e-vilareal-assinatura-core test `
  "-Dsurefire.excluded.groups=" "-Dgroups=pkcs11-hardware"
```

Equivalente em CMD:

```cmd
set ASSINATURA_TOKEN_PIN=SEU_PIN_AQUI
e-vilareal-java-backend\mvnw.cmd -f pom.xml -pl e-vilareal-assinatura-core test "-Dsurefire.excluded.groups=" "-Dgroups=pkcs11-hardware"
```

> **Nota:** `-DexcludedGroups=` na linha de comando **não** sobrescreve o `pom.xml`.
> Use `-Dsurefire.excluded.groups=` (vazio) para limpar a exclusão definida em `<surefire.excluded.groups>`.

## O que cada teste de hardware valida

| Teste | Validação |
|-------|-----------|
| `token_geraCadeiaIcpEmbutidaNaOrdemCorreta` | 4 certs: signatário → AC Certifica Anápolis v5 → AC Soluti v5 → Raiz; issuers iguais à referência do tribunal |
| `token_geraP7sEstruturalmenteIdenticoAoTribunal` | Assina o PDF de 1483 bytes; estrutura CMS idêntica a `referencia-sintetica.p7s` (exceto `signingTime` e valor RSA) |

## Problemas comuns

| Sintoma | Ação |
|---------|------|
| `nenhum certificado no keystore com thumbprint SHA-1 C695...` | Confirme o certificado Videoconferência no token; há outro Soluti com mesmo CN — só o thumbprint distingue |
| `CKR_PIN_INCORRECT` | Verifique `ASSINATURA_TOKEN_PIN` |
| `library CK_RV=CKR_DEVICE_ERROR` | Reconecte o token; feche o programa do tribunal se estiver usando o token |
| Slot errado | Liste slots com `pkcs11-tool` (se instalado) ou tente `ASSINATURA_PKCS11_SLOT_INDEX=1` |

## Depois de executar

Envie o resultado do Maven (`BUILD SUCCESS` ou stack trace). Não cole o PIN nem dumps de certificado com subject/CN/CPF.
