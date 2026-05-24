package br.com.vilareal.topicos.application;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.topicos.api.dto.TopicoImportResultDto;
import br.com.vilareal.topicos.infrastructure.persistence.entity.TopicoEntity;
import br.com.vilareal.topicos.infrastructure.persistence.repository.TopicoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class TopicoImportService {

    private final TopicoRepository topicoRepository;

    public TopicoImportService(TopicoRepository topicoRepository) {
        this.topicoRepository = topicoRepository;
    }

    @Transactional
    public TopicoImportResultDto importar(List<MultipartFile> files) {
        TopicoImportResultDto result = new TopicoImportResultDto();
        Set<String> categorias = new LinkedHashSet<>();
        List<String> erros = new ArrayList<>();
        int totalBlocos = 0;
        int importados = 0;
        int atualizados = 0;
        int arquivosOk = 0;

        if (files == null || files.isEmpty()) {
            result.setErros(List.of("Nenhum arquivo enviado."));
            return result;
        }

        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            String nomeArquivo = file.getOriginalFilename();
            try {
                TopicoImportParser.MetadadosArquivo meta = TopicoImportParser.parseMetadados(nomeArquivo);
                String conteudoRaw = TopicoImportParser.decodificarConteudo(file.getBytes());
                String conteudo = Utf8MojibakeUtil.corrigir(conteudoRaw);
                List<TopicoImportParser.BlocoImportado> blocos = TopicoImportParser.parseBlocos(conteudo);
                if (blocos.isEmpty()) {
                    erros.add(nomeArquivo + ": conteúdo vazio");
                    continue;
                }
                arquivosOk++;
                categorias.add(meta.categoria());
                for (TopicoImportParser.BlocoImportado bloco : blocos) {
                    totalBlocos++;
                boolean criado = upsertBloco(meta, bloco);
                    if (criado) {
                        importados++;
                    } else {
                        atualizados++;
                    }
                }
            } catch (Exception e) {
                erros.add((nomeArquivo != null ? nomeArquivo : "(sem nome)") + ": " + e.getMessage());
            }
        }

        result.setTotalArquivos(arquivosOk);
        result.setTotalBlocos(totalBlocos);
        result.setTotalImportados(importados);
        result.setTotalAtualizados(atualizados);
        result.setCategorias(categorias.stream().sorted(Comparator.naturalOrder()).toList());
        result.setErros(erros);
        return result;
    }

    private boolean upsertBloco(TopicoImportParser.MetadadosArquivo meta, TopicoImportParser.BlocoImportado bloco) {
        TopicoEntity entity = topicoRepository
                .findByChaveNavegacaoAndBlocoIndice(meta.chaveNavegacao(), bloco.blocoIndice())
                .orElseGet(TopicoEntity::new);

        boolean criado = entity.getId() == null;
        entity.setCategoria(meta.categoria());
        entity.setSubcategoria(meta.subcategoria());
        entity.setNome(meta.nome());
        entity.setChaveNavegacao(meta.chaveNavegacao());
        entity.setBlocoIndice(bloco.blocoIndice());
        entity.setConteudoTemplate(Utf8MojibakeUtil.corrigir(bloco.conteudo()));
        entity.setTipoFormatacao(bloco.tipoFormatacao());
        entity.setOrdem(bloco.blocoIndice());
        entity.setAtivo(true);
        topicoRepository.save(entity);
        return criado;
    }
}
