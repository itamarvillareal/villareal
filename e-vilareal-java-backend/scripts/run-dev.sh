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
echo "JAVA_HOME=$JAVA_HOME"
java -version
exec ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev "$@"
