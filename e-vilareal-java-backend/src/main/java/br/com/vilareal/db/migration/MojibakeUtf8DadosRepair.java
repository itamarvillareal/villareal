package br.com.vilareal.db.migration;

import br.com.vilareal.common.text.Utf8MojibakeUtil;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.StringJoiner;

/**
 * Varre colunas de texto e grava {@link Utf8MojibakeUtil#corrigir(String)} quando mudar.
 * Usado por migrações Flyway (novos padrões de mojibake → nova versão de migração).
 */
public final class MojibakeUtf8DadosRepair {

    private MojibakeUtf8DadosRepair() {}

    public static void executar(Connection conn) throws Exception {
        atualizarTabela(
                conn,
                "processo",
                "id",
                "natureza_acao",
                "descricao_acao",
                "competencia",
                "fase",
                "tramitacao",
                "observacao",
                "cidade",
                "uf",
                "consultor",
                "numero_cnj",
                "numero_processo_antigo");
        atualizarTabela(conn, "processo_parte", "id", "nome_livre", "qualificacao");
        atualizarTabela(conn, "processo_andamento", "id", "titulo", "detalhe", "origem");
        atualizarTabela(conn, "processo_prazo", "id", "descricao", "status", "observacao");
        atualizarTabela(conn, "pessoa", "id", "nome", "email");
        atualizarTabela(
                conn,
                "pessoa_complementar",
                "pessoa_id",
                "rg",
                "orgao_expedidor",
                "profissao",
                "nacionalidade",
                "estado_civil",
                "genero");
        atualizarTabela(conn, "pessoa_endereco", "id", "rua", "bairro", "cidade", "estado", "cep");
        atualizarTabela(conn, "pessoa_contato", "id", "tipo", "valor", "usuario_lancamento");
        atualizarTabela(conn, "cliente", "id", "nome_referencia", "documento_referencia", "observacao");
        atualizarTabela(
                conn,
                "auditoria_atividade",
                "id",
                "usuario_ref",
                "usuario_nome",
                "modulo",
                "tela",
                "tipo_acao",
                "descricao",
                "registro_afetado_id",
                "registro_afetado_nome",
                "ip_origem",
                "observacoes_tecnicas");
        atualizarTabela(conn, "agenda_evento", "id", "descricao", "hora_evento", "status_curto", "processo_ref", "origem");
        atualizarTabela(
                conn,
                "financeiro_lancamento",
                "id",
                "banco_nome",
                "numero_lancamento",
                "descricao",
                "descricao_detalhada",
                "origem",
                "status");
        atualizarTabela(conn, "financeiro_conta_contabil", "id", "codigo", "nome");
        atualizarTabela(conn, "tarefa_operacional", "id", "titulo", "descricao", "origem");
        atualizarTabela(conn, "usuarios", "id", "nome", "apelido");
        atualizarTabela(conn, "perfil", "id", "nome", "descricao");
        atualizarTabela(conn, "topico_hierarquia", "id", "raiz_json");
        atualizarTabela(conn, "calculo_rodada", "id", "payload_json");
        atualizarTabelaChaveString(conn, "calculo_cliente_config", "codigo_cliente", "payload_json");
    }

    private static void atualizarTabela(Connection conn, String tabela, String idColuna, String... colunas)
            throws Exception {
        StringJoiner sj = new StringJoiner(", ");
        for (String c : colunas) {
            sj.add(c);
        }
        String sqlSelect = "SELECT " + idColuna + ", " + sj + " FROM " + tabela;
        try (var st = conn.createStatement();
                ResultSet rs = st.executeQuery(sqlSelect)) {
            while (rs.next()) {
                long id = rs.getLong(idColuna);
                List<String> corrigidos = new ArrayList<>(colunas.length);
                boolean mudou = false;
                for (String col : colunas) {
                    String v = rs.getString(col);
                    if (v == null) {
                        corrigidos.add(null);
                        continue;
                    }
                    String f = Utf8MojibakeUtil.corrigir(v);
                    corrigidos.add(f);
                    if (!Objects.equals(v, f)) {
                        mudou = true;
                    }
                }
                if (!mudou) {
                    continue;
                }
                StringJoiner setJ = new StringJoiner(", ");
                for (String col : colunas) {
                    setJ.add(col + " = ?");
                }
                String sqlUpd = "UPDATE " + tabela + " SET " + setJ + " WHERE " + idColuna + " = ?";
                try (PreparedStatement ps = conn.prepareStatement(sqlUpd)) {
                    int i = 1;
                    for (String f : corrigidos) {
                        ps.setString(i++, f);
                    }
                    ps.setLong(i, id);
                    ps.executeUpdate();
                }
            }
        }
    }

    /**
     * Atualiza linhas cuja chave primária é textual (ex.: {@code calculo_cliente_config.codigo_cliente}).
     */
    private static void atualizarTabelaChaveString(
            Connection conn, String tabela, String chaveColuna, String... colunas) throws Exception {
        StringJoiner sj = new StringJoiner(", ");
        for (String c : colunas) {
            sj.add(c);
        }
        String sqlSelect = "SELECT " + chaveColuna + ", " + sj + " FROM " + tabela;
        try (var st = conn.createStatement();
                ResultSet rs = st.executeQuery(sqlSelect)) {
            while (rs.next()) {
                String chave = rs.getString(chaveColuna);
                if (chave == null) {
                    continue;
                }
                List<String> corrigidos = new ArrayList<>(colunas.length);
                boolean mudou = false;
                for (String col : colunas) {
                    String v = rs.getString(col);
                    if (v == null) {
                        corrigidos.add(null);
                        continue;
                    }
                    String f = Utf8MojibakeUtil.corrigir(v);
                    corrigidos.add(f);
                    if (!Objects.equals(v, f)) {
                        mudou = true;
                    }
                }
                if (!mudou) {
                    continue;
                }
                StringJoiner setJ = new StringJoiner(", ");
                for (String col : colunas) {
                    setJ.add(col + " = ?");
                }
                String sqlUpd = "UPDATE " + tabela + " SET " + setJ + " WHERE " + chaveColuna + " = ?";
                try (PreparedStatement ps = conn.prepareStatement(sqlUpd)) {
                    int i = 1;
                    for (String f : corrigidos) {
                        ps.setString(i++, f);
                    }
                    ps.setString(i, chave);
                    ps.executeUpdate();
                }
            }
        }
    }
}
