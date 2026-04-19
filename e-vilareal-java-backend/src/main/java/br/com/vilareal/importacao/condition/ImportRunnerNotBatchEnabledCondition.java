package br.com.vilareal.importacao.condition;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

/**
 * Jobs isolados de importação não devem registar-se quando o lote
 * {@code vilareal.import.batch.enabled=true} está ativo (evita dois listeners no mesmo {@code ApplicationReadyEvent}).
 */
public final class ImportRunnerNotBatchEnabledCondition implements Condition {

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        return !Boolean.TRUE.equals(
                context.getEnvironment().getProperty("vilareal.import.batch.enabled", Boolean.class, false));
    }
}
