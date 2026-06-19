package br.com.vilareal.email.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;

@Entity
@Table(name = "extrato_cora_email_processado")
@IdClass(ExtratoCoraEmailProcessadoEntity.Pk.class)
@Getter
@Setter
public class ExtratoCoraEmailProcessadoEntity {

    @Id
    @Column(name = "gmail_message_id", length = 64, nullable = false)
    private String gmailMessageId;

    @Id
    @Column(name = "gmail_user", length = 255, nullable = false)
    private String gmailUser;

    @Column(name = "processado_em", nullable = false)
    private Instant processadoEm;

    @Column(name = "lancamentos_criados", nullable = false)
    private int lancamentosCriados;

    @Column(name = "lancamentos_ja_existiam", nullable = false)
    private int lancamentosJaExistiam;

    @Column(name = "falhas", nullable = false)
    private int falhas;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Pk implements Serializable {
        private String gmailMessageId;
        private String gmailUser;
    }
}
