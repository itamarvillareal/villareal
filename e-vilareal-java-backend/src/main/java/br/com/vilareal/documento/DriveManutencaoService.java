package br.com.vilareal.documento;

import com.google.api.services.drive.model.File;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Manutenção das pastas do Drive. Hoje cobre a limpeza de pastas vazias duplicadas
 * (mesmo nome normalizado) — tipicamente criadas pelo app quando não reencontrava uma
 * pasta migrada por divergência de caixa/acento.
 *
 * <p>Sempre suporta {@code dryRun=true} para apenas relatar, sem alterar nada. As exclusões
 * usam a lixeira do Drive (reversíveis).
 */
@Service
public class DriveManutencaoService {

    private static final Logger log = LoggerFactory.getLogger(DriveManutencaoService.class);
    private static final Pattern PREFIXO_CODIGO = Pattern.compile("^(\\d{8})\\s*-\\s*.*");

    private final GoogleDriveService drive;

    public DriveManutencaoService(GoogleDriveService drive) {
        this.drive = drive;
    }

    public Relatorio limparDuplicatasVazias(boolean dryRun, String codigoClienteFiltro) throws Exception {
        Relatorio rel = new Relatorio(dryRun);
        if (!drive.isConfigurado()) {
            rel.add("ERRO", "Google Drive não configurado.");
            return rel;
        }
        String clientesFolderId = drive.getClientesFolderId();
        boolean filtrando = StringUtils.hasText(codigoClienteFiltro);
        for (File clienteFolder : drive.listarFilhos(clientesFolderId)) {
            if (!drive.isPasta(clienteFolder)) {
                continue;
            }
            if (filtrando) {
                String codigo = extrairCodigo(clienteFolder.getName());
                if (codigo == null || !codigo.equals(codigoClienteFiltro.trim())) {
                    continue;
                }
            }
            limparDuplicatasRecursivo(rel, clienteFolder, dryRun, 0);
        }
        if (!filtrando) {
            // Duplicatas no próprio nível de clientes (pastas de cliente repetidas).
            limparDuplicatasNoNivel(rel, clientesFolderId, "(01 - Ativos)", dryRun);
        }
        log.info("Limpeza Drive {} concluída: {}", dryRun ? "(DRY-RUN)" : "(APLICADA)", rel.resumo());
        return rel;
    }

    private void limparDuplicatasRecursivo(Relatorio rel, File pasta, boolean dryRun, int profundidade)
            throws Exception {
        if (profundidade > 4) {
            return;
        }
        limparDuplicatasNoNivel(rel, pasta.getId(), pasta.getName(), dryRun);
        for (File sub : drive.listarFilhos(pasta.getId())) {
            if (drive.isPasta(sub)) {
                limparDuplicatasRecursivo(rel, sub, dryRun, profundidade + 1);
            }
        }
    }

    private void limparDuplicatasNoNivel(Relatorio rel, String parentId, String nomePai, boolean dryRun)
            throws Exception {
        Map<String, List<File>> grupos = new HashMap<>();
        for (File f : drive.listarFilhos(parentId)) {
            if (drive.isPasta(f)) {
                grupos.computeIfAbsent(GoogleDriveService.normalizarChaveNome(f.getName()),
                        k -> new ArrayList<>()).add(f);
            }
        }
        for (List<File> grupo : grupos.values()) {
            if (grupo.size() >= 2) {
                removerVaziasDoGrupo(rel, nomePai, grupo, dryRun);
            }
        }
    }

    private void removerVaziasDoGrupo(Relatorio rel, String nomePai, List<File> grupo, boolean dryRun)
            throws Exception {
        List<File> vazias = new ArrayList<>();
        boolean haComConteudo = false;
        for (File f : grupo) {
            if (drive.contarFilhos(f.getId()) == 0) {
                vazias.add(f);
            } else {
                haComConteudo = true;
            }
        }
        // Mantém pelo menos uma pasta do grupo: se nenhuma tem conteúdo, preserva a primeira vazia.
        List<File> remover = new ArrayList<>();
        if (haComConteudo) {
            remover.addAll(vazias);
        } else {
            for (int i = 1; i < vazias.size(); i++) {
                remover.add(vazias.get(i));
            }
        }
        for (File f : remover) {
            rel.add("REMOVER_VAZIA", nomePai + " / " + f.getName() + " (id=" + f.getId() + ")");
            if (!dryRun) {
                drive.enviarParaLixeira(f.getId());
                rel.aplicados++;
            }
        }
    }

    private static String extrairCodigo(String nomePasta) {
        if (nomePasta == null) {
            return null;
        }
        var m = PREFIXO_CODIGO.matcher(nomePasta.trim());
        return m.matches() ? m.group(1) : null;
    }

    /** Relatório de ações (planejadas em dry-run, ou aplicadas). */
    public static class Relatorio {
        public final boolean dryRun;
        public int aplicados = 0;
        public final List<String> acoes = new ArrayList<>();
        private final Map<String, Integer> contagem = new HashMap<>();

        public Relatorio(boolean dryRun) {
            this.dryRun = dryRun;
        }

        public void add(String tipo, String detalhe) {
            acoes.add(tipo + ": " + detalhe);
            contagem.merge(tipo, 1, Integer::sum);
        }

        public Map<String, Integer> getContagem() {
            return contagem;
        }

        public List<String> getAcoes() {
            return acoes;
        }

        public boolean isDryRun() {
            return dryRun;
        }

        public int getAplicados() {
            return aplicados;
        }

        public String resumo() {
            return contagem.toString() + (dryRun ? " [DRY-RUN]" : " [aplicados=" + aplicados + "]");
        }
    }
}
