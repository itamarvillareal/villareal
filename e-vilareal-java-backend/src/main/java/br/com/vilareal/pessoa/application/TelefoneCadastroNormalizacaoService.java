package br.com.vilareal.pessoa.application;

import br.com.vilareal.common.util.TelefoneBrasilUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteWhatsAppEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Normaliza telefones BR para o formato WhatsApp ({@code 55…}) e persiste no cadastro
 * (cliente WhatsApp, contato da pessoa ou telefone legado).
 */
@Service
public class TelefoneCadastroNormalizacaoService {

    private static final Logger log = LoggerFactory.getLogger(TelefoneCadastroNormalizacaoService.class);

    private final ClienteWhatsAppRepository clienteWhatsAppRepository;
    private final ClienteRepository clienteRepository;
    private final PessoaContatoRepository pessoaContatoRepository;
    private final PessoaRepository pessoaRepository;

    public TelefoneCadastroNormalizacaoService(
            ClienteWhatsAppRepository clienteWhatsAppRepository,
            ClienteRepository clienteRepository,
            PessoaContatoRepository pessoaContatoRepository,
            PessoaRepository pessoaRepository) {
        this.clienteWhatsAppRepository = clienteWhatsAppRepository;
        this.clienteRepository = clienteRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
        this.pessoaRepository = pessoaRepository;
    }

    /**
     * Extrai um número válido, grava no cadastro quando a origem é identificada e retorna o valor canônico.
     */
    @Transactional
    public Optional<String> normalizarParaWhatsAppEPersistir(Long pessoaId, Long clienteId, String telefoneBruto) {
        String bruto = StringUtils.hasText(telefoneBruto)
                ? telefoneBruto.trim()
                : localizarOrigem(pessoaId, clienteId).map(OrigemTelefone::valorAtual).orElse(null);
        if (!StringUtils.hasText(bruto)) {
            return Optional.empty();
        }
        Optional<String> normalizado = TelefoneBrasilUtil.extrairPrimeiroValido(bruto);
        if (normalizado.isEmpty()) {
            return Optional.empty();
        }
        String numero = normalizado.get();
        localizarOrigem(pessoaId, clienteId).ifPresent(origem -> origem.persistirSeNecessario(numero));
        return Optional.of(numero);
    }

    private Optional<OrigemTelefone> localizarOrigem(Long pessoaId, Long clienteId) {
        if (clienteId != null) {
            Optional<OrigemTelefone> origem = primeiroWhatsAppCliente(clienteId);
            if (origem.isPresent()) {
                return origem;
            }
        }
        if (pessoaId == null) {
            return Optional.empty();
        }
        for (ClienteEntity cliente : clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoaId)) {
            Optional<OrigemTelefone> origem = primeiroWhatsAppCliente(cliente.getId());
            if (origem.isPresent()) {
                return origem;
            }
        }
        for (PessoaContatoEntity contato : pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoaId)) {
            if (contato.getTipo() != null
                    && "telefone".equalsIgnoreCase(contato.getTipo().trim())
                    && StringUtils.hasText(contato.getValor())) {
                return Optional.of(new OrigemContato(contato));
            }
        }
        return pessoaRepository
                .findById(pessoaId)
                .filter(p -> StringUtils.hasText(p.getTelefone()))
                .map(OrigemPessoaLegado::new);
    }

    private Optional<OrigemTelefone> primeiroWhatsAppCliente(Long clienteId) {
        List<ClienteWhatsAppEntity> cadastros =
                clienteWhatsAppRepository.findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(clienteId);
        for (ClienteWhatsAppEntity w : cadastros) {
            if (StringUtils.hasText(w.getNumero())) {
                return Optional.of(new OrigemClienteWhatsApp(w));
            }
        }
        return Optional.empty();
    }

    private interface OrigemTelefone {
        String valorAtual();

        void persistirSeNecessario(String numeroCanonico);
    }

    private final class OrigemClienteWhatsApp implements OrigemTelefone {
        private final ClienteWhatsAppEntity entity;

        private OrigemClienteWhatsApp(ClienteWhatsAppEntity entity) {
            this.entity = entity;
        }

        @Override
        public String valorAtual() {
            return entity.getNumero().trim();
        }

        @Override
        public void persistirSeNecessario(String numeroCanonico) {
            if (jaCanonico(entity.getNumero(), numeroCanonico)) {
                return;
            }
            Long clienteId = entity.getCliente().getId();
            if (!numeroCanonico.equals(entity.getNumero())
                    && clienteWhatsAppRepository.existsByCliente_IdAndNumero(clienteId, numeroCanonico)) {
                log.debug(
                        "Telefone WhatsApp não atualizado (cliente {}): {} já cadastrado",
                        clienteId,
                        numeroCanonico);
                return;
            }
            log.info(
                    "Normalizando telefone WhatsApp (cliente {}): {} -> {}",
                    clienteId,
                    entity.getNumero(),
                    numeroCanonico);
            entity.setNumero(numeroCanonico);
            clienteWhatsAppRepository.save(entity);
        }
    }

    private final class OrigemContato implements OrigemTelefone {
        private final PessoaContatoEntity entity;

        private OrigemContato(PessoaContatoEntity entity) {
            this.entity = entity;
        }

        @Override
        public String valorAtual() {
            return entity.getValor().trim();
        }

        @Override
        public void persistirSeNecessario(String numeroCanonico) {
            if (jaCanonico(entity.getValor(), numeroCanonico)) {
                return;
            }
            log.info(
                    "Normalizando telefone contato (pessoa {}): {} -> {}",
                    entity.getPessoa().getId(),
                    entity.getValor(),
                    numeroCanonico);
            entity.setValor(numeroCanonico);
            TelefoneIndiceUtil.TelefoneIndice idx = TelefoneIndiceUtil.fromRaw(numeroCanonico);
            entity.setValorDigitos(idx.digitos());
            entity.setValorSufixo8(idx.sufixo8());
            entity.setDataAlteracao(Instant.now());
            pessoaContatoRepository.save(entity);
        }
    }

    private final class OrigemPessoaLegado implements OrigemTelefone {
        private final PessoaEntity entity;

        private OrigemPessoaLegado(PessoaEntity entity) {
            this.entity = entity;
        }

        @Override
        public String valorAtual() {
            return entity.getTelefone().trim();
        }

        @Override
        public void persistirSeNecessario(String numeroCanonico) {
            if (jaCanonico(entity.getTelefone(), numeroCanonico)) {
                return;
            }
            log.info(
                    "Normalizando telefone legado (pessoa {}): {} -> {}",
                    entity.getId(),
                    entity.getTelefone(),
                    numeroCanonico);
            entity.setTelefone(numeroCanonico);
            TelefoneIndiceUtil.TelefoneIndice idx = TelefoneIndiceUtil.fromRaw(numeroCanonico);
            entity.setTelefoneDigitos(idx.digitos());
            entity.setTelefoneSufixo8(idx.sufixo8());
            pessoaRepository.save(entity);
        }
    }

    private static boolean jaCanonico(String atual, String numeroCanonico) {
        return numeroCanonico.equals(atual);
    }
}
