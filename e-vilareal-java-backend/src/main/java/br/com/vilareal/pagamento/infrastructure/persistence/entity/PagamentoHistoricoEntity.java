package br.com.vilareal.pagamento.infrastructure.persistence.entity;

import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "pagamento_historico")
@Getter
@Setter
public class PagamentoHistoricoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pagamento_id", nullable = false)
    private PagamentoEntity pagamento;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private UsuarioEntity usuario;

    @Column(nullable = false, length = 80)
    private String acao;

    @Column(name = "status_anterior", length = 40)
    private String statusAnterior;

    @Column(name = "status_novo", length = 40)
    private String statusNovo;

    @Column(name = "dados_alterados_json", columnDefinition = "TEXT")
    private String dadosAlteradosJson;

    @Column(length = 500)
    private String observacao;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;
}
