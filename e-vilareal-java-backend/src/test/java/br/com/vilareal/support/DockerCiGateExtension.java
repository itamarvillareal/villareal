package br.com.vilareal.support;

import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ConditionEvaluationResult;
import org.junit.jupiter.api.extension.ExecutionCondition;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.testcontainers.DockerClientFactory;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Local sem Docker: desabilita a classe (skip com mensagem). CI sem Docker: habilita e falha em {@code @BeforeAll}.
 * CI com Docker / local com Docker: executa normalmente.
 */
public class DockerCiGateExtension implements ExecutionCondition, BeforeAllCallback {

    static boolean isCi() {
        return Boolean.parseBoolean(System.getenv("CI"));
    }

    static boolean isDockerAvailable() {
        return DockerClientFactory.instance().isDockerAvailable();
    }

    @Override
    public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context) {
        if (isDockerAvailable()) {
            return ConditionEvaluationResult.enabled("Docker disponível");
        }
        if (isCi()) {
            return ConditionEvaluationResult.enabled("CI: Docker obrigatório — falha em beforeAll se ausente");
        }
        return ConditionEvaluationResult.disabled("Docker indisponível localmente — pulando teste de migração V100");
    }

    @Override
    public void beforeAll(ExtensionContext context) {
        boolean docker = isDockerAvailable();
        boolean ci = isCi();
        if (ci) {
            assertTrue(docker, "Docker indisponível no CI — Testcontainers é obrigatório para o teste do V100");
        } else {
            assumeTrue(docker, "Docker indisponível localmente — pulando teste de migração V100");
        }
    }

}
