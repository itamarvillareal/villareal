package br.com.vilareal.projudi.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "projudi_peticao")
@Getter
@Setter
public class ProjudiPeticaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "credencial_id", nullable = false)
    private Long credencialId;

    @Column(name = "numero_processo", length = 40, nullable = false)
    private String numeroProcesso;

    @Column(columnDefinition = "TEXT")
    private String complemento;

    @Column(name = "id_movimentacao_tipo", nullable = false)
    private int idMovimentacaoTipo = 260;

    @Column(length = 30, nullable = false)
    private String status = "PENDENTE_ASSINATURA";

    @Column(name = "protocolo_mensagem", columnDefinition = "TEXT")
    private String protocoloMensagem;

    @Column(name = "protocolo_etapa", length = 160)
    private String protocoloEtapa;

    @Column(name = "protocolado_em")
    private Instant protocoladoEm;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;

    @OneToMany(mappedBy = "peticao", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("ordem ASC")
    private List<ProjudiPeticaoArquivoEntity> arquivos = new ArrayList<>();

    public void adicionarArquivo(ProjudiPeticaoArquivoEntity arquivo) {
        arquivos.add(arquivo);
        arquivo.setPeticao(this);
    }
}
