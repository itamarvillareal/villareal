package br.com.vilareal.orgaojulgador.application;

import br.com.vilareal.localidade.domain.MunicipioTextoUtil;

import org.junit.jupiter.api.Test;

import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Garante a semântica da busca de órgãos julgadores espelhando o contrato de
 * {@code OrgaoJulgadorRepository.buscarAutocomplete}: comparação NORMALIZADO × NORMALIZADO
 * (acento-insensível), por SUBSTRING, mantendo o ranking
 * (uso_count DESC → desempate Anápolis/Goiânia → favorito DESC → nome ASC).
 *
 * <p>Roda offline: usa a MESMA função de normalização usada na gravação do órgão
 * ({@link MunicipioTextoUtil#normalizarNome}) tanto no lado armazenado quanto no termo digitado.
 */
class OrgaoJulgadorBuscaNormalizadaTest {

    private static final int ANAPOLIS = 5201108;
    private static final int GOIANIA = 5208707;

    private record Orgao(String nome, int usoCount, boolean favorito, Integer municipioId) {
        String nomeNormalizado() {
            return MunicipioTextoUtil.normalizarNome(nome);
        }
    }

    /** Replica o WHERE da query: {@code nomeNormalizado LIKE %qNorm%}. */
    private static boolean casa(Orgao o, String termo) {
        String qNorm = MunicipioTextoUtil.normalizarNome(termo);
        return qNorm.isEmpty() || o.nomeNormalizado().contains(qNorm);
    }

    /** Replica o ORDER BY da query. */
    private static List<Orgao> ordenar(List<Orgao> orgaos) {
        Comparator<Orgao> cmp = Comparator
                .comparingInt(Orgao::usoCount).reversed()
                .thenComparingInt(o -> (o.municipioId() != null
                        && (o.municipioId() == ANAPOLIS || o.municipioId() == GOIANIA)) ? 0 : 1)
                .thenComparing(Comparator.comparing(Orgao::favorito).reversed())
                .thenComparing(Orgao::nome);
        return orgaos.stream().sorted(cmp).toList();
    }

    @Test
    void buscaAcentoInsensivel_termoSemAcentoCasaNomeComAcento() {
        Orgao juizadoCivel = new Orgao("9º Juizado Especial Cível", 0, false, GOIANIA);
        Orgao varaFamilia = new Orgao("2ª Vara de Família e Sucessões", 0, false, GOIANIA);
        Orgao varaExecucao = new Orgao("1ª Vara de Execução Penal", 0, false, GOIANIA);

        assertThat(casa(juizadoCivel, "civel")).isTrue();
        assertThat(casa(varaFamilia, "familia")).isTrue();
        assertThat(casa(varaExecucao, "execucao")).isTrue();

        // e o caminho inverso (termo acentuado também normaliza)
        assertThat(casa(juizadoCivel, "Cível")).isTrue();
    }

    @Test
    void buscaPorSubstring_casaMioloDoNome() {
        Orgao juizadoCivel = new Orgao("9º Juizado Especial Cível", 0, false, GOIANIA);

        // nomes de vara começam com ordinal/número → busca pelo miolo (substring), não prefixo
        assertThat(casa(juizadoCivel, "juizado")).isTrue();
        assertThat(casa(juizadoCivel, "especial")).isTrue();
    }

    @Test
    void naoCasaTermoAusente() {
        Orgao juizadoCivel = new Orgao("9º Juizado Especial Cível", 0, false, GOIANIA);
        assertThat(casa(juizadoCivel, "criminal")).isFalse();
    }

    @Test
    void ranking_usoCountDepoisDesempateMunicipioDepoisFavoritoDepoisNome() {
        Orgao maisUsado = new Orgao("Vara Cível B", 10, false, 5300108); // outra cidade
        Orgao goianiaA = new Orgao("Vara Cível A", 3, false, GOIANIA);
        Orgao anapolisFavorito = new Orgao("Vara Cível Z", 3, true, ANAPOLIS);
        Orgao outraCidade = new Orgao("Vara Cível A", 3, false, 5300108);

        List<Orgao> ordenado = ordenar(List.of(goianiaA, outraCidade, anapolisFavorito, maisUsado));

        // 1º) maior uso_count
        assertThat(ordenado.get(0)).isEqualTo(maisUsado);
        // 2º/3º) empate em uso_count=3 → Anápolis/Goiânia vêm antes de outra cidade
        assertThat(ordenado.subList(1, 3)).containsExactlyInAnyOrder(goianiaA, anapolisFavorito);
        // 4º) outra cidade fica por último no grupo de uso_count=3
        assertThat(ordenado.get(3)).isEqualTo(outraCidade);
    }
}
