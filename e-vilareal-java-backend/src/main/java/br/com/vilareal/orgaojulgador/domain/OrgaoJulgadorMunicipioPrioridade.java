package br.com.vilareal.orgaojulgador.domain;

import java.util.Set;

public final class OrgaoJulgadorMunicipioPrioridade {

    /** Anápolis-GO */
    public static final int ANAPOLIS_IBGE = 5201108;
    /** Goiânia-GO */
    public static final int GOIANIA_IBGE = 5208707;

    public static final Set<Integer> DESEMPATE_IBGE = Set.of(ANAPOLIS_IBGE, GOIANIA_IBGE);

    private OrgaoJulgadorMunicipioPrioridade() {}
}
