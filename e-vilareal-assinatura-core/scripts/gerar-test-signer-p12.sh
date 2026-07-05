#!/usr/bin/env bash
# Gera test-signer.p12 (RSA 2048 autoassinado, sem PII) para testes PKCS#12 no Mac.
set -euo pipefail
OUT_DIR="$(cd "$(dirname "$0")/../src/test/resources/assinatura" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

openssl req -x509 -newkey rsa:2048 \
  -keyout "$TMP/key.pem" -out "$TMP/cert.pem" \
  -days 3650 -nodes \
  -subj "/CN=Teste CMS Sintetico/O=VilaReal Test/C=BR"

openssl pkcs12 -export \
  -out "$OUT_DIR/test-signer.p12" \
  -inkey "$TMP/key.pem" -in "$TMP/cert.pem" \
  -passout pass:test-fixture

echo "Gerado: $OUT_DIR/test-signer.p12"
echo "Senha: test-fixture"
openssl x509 -in "$TMP/cert.pem" -noout -fingerprint -sha1
