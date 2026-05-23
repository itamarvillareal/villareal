#!/usr/bin/env bash
# Spring Boot dev com Java 21 (o macOS costuma ter só Java 17 no PATH).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -d /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ]]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
elif [[ -d /opt/homebrew/opt/openjdk@21 ]]; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
fi

if [[ -z "${JAVA_HOME:-}" ]] || ! "$JAVA_HOME/bin/java" -version 2>&1 | grep -q 'version "21'; then
  echo "Java 21 não encontrado. Instale: brew install openjdk@21"
  echo "Depois: export JAVA_HOME=\"\$(/usr/libexec/java_home -v 21)\""
  exit 1
fi

export PATH="$JAVA_HOME/bin:$PATH"

# Jobs de import na subida encerram a JVM após o lote — não usar no servidor web de dev.
unset VILAREAL_IMPORT_PESSOAS_ENABLED VILAREAL_IMPORT_BATCH_ENABLED 2>/dev/null || true
unset VILAREAL_IMPORT_CLIENTES_PLANILHA_JOB_ENABLED VILAREAL_IMPORT_IMOVEIS_PLANILHA_JOB_ENABLED 2>/dev/null || true
export VILAREAL_IMPORT_PESSOAS_ENABLED=false
export VILAREAL_IMPORT_BATCH_ENABLED=false
export VILAREAL_IMPORT_CLIENTES_PLANILHA_JOB_ENABLED=false
export VILAREAL_IMPORT_IMOVEIS_PLANILHA_JOB_ENABLED=false

DEV_JVM_ARGS="-Dvilareal.import.pessoas.enabled=false"
DEV_JVM_ARGS="$DEV_JVM_ARGS -Dvilareal.import.batch.enabled=false"
DEV_JVM_ARGS="$DEV_JVM_ARGS -Dvilareal.import.clientes-planilha.job.enabled=false"
DEV_JVM_ARGS="$DEV_JVM_ARGS -Dvilareal.import.imoveis-planilha.job.enabled=false"

echo "JAVA_HOME=$JAVA_HOME"
java -version
echo "Import jobs desativados (servidor web permanece ativo)."
exec ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev \
  -Dspring-boot.run.jvmArguments="$DEV_JVM_ARGS" "$@"
