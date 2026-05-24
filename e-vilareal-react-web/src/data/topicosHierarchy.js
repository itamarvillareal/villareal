/**
 * Árvore de tópicos: ramos (`children`) ou folha com lista selecionável (`items`).
 * Gerado automaticamente por `scripts/import-topicos-hierarchy.mjs` em 2026-05-24.
 * Fonte: Dropbox «Banco de Dados/Tópicos» (*.txt, caminho no nome com «=»).
 */

export const TOPICOS_RAIZ = {
  id: "_raiz",
  label: "Início",
  children: [
    {
      id: "contratos",
      label: "CONTRATOS",
      children: [
        {
          id: "contratos-compra-e-venda-confissao-de-divida",
          label: "COMPRA E VENDA + CONFISSÃO DE DÍVIDA",
          items: [
            {
              id: "contratos-compra-e-venda-confissao-de-divida-carteira-de-clientes",
              label: "CARTEIRA DE CLIENTES"
            },
            {
              id: "contratos-compra-e-venda-confissao-de-divida-com-garantia",
              label: "COM GARANTIA"
            },
            {
              id: "contratos-compra-e-venda-confissao-de-divida-imovel",
              label: "IMÓVEL"
            },
            {
              id: "contratos-compra-e-venda-confissao-de-divida-permuta",
              label: "PERMUTA"
            },
            {
              id: "contratos-compra-e-venda-confissao-de-divida-veiculos",
              label: "VEÍCULOS"
            }
          ]
        },
        {
          id: "contratos-de-trabalho",
          label: "DE TRABALHO",
          items: [
            {
              id: "contratos-de-trabalho-servicos-medicos",
              label: "SERVIÇOS MÉDICOS"
            }
          ]
        },
        {
          id: "contratos-garantidora",
          label: "GARANTIDORA",
          items: [
            {
              id: "contratos-garantidora-geral",
              label: "GERAL"
            }
          ]
        },
        {
          id: "contratos-honorarios-advocaticios",
          label: "HONORÁRIOS ADVOCATÍCIOS",
          items: [
            {
              id: "contratos-honorarios-advocaticios-condominios",
              label: "CONDOMÍNIOS"
            },
            {
              id: "contratos-honorarios-advocaticios-geral",
              label: "GERAL"
            }
          ]
        },
        {
          id: "contratos-intermediacao-imobiliaria",
          label: "INTERMEDIAÇÃO IMOBILIÁRIA",
          items: [
            {
              id: "contratos-intermediacao-imobiliaria-geral",
              label: "GERAL"
            }
          ],
          selecaoUnica: true
        },
        {
          id: "contratos-locacao",
          label: "LOCAÇÃO",
          items: [
            {
              id: "contratos-locacao-com-caucao",
              label: "COM CAUÇÃO"
            },
            {
              id: "contratos-locacao-distrato",
              label: "DISTRATO"
            },
            {
              id: "contratos-locacao-garantia-carta-fianca-aeronautica",
              label: "GARANTIA CARTA FIANÇA AERONÁUTICA"
            },
            {
              id: "contratos-locacao-geral-multa-fixa",
              label: "GERAL - Multa fixa"
            },
            {
              id: "contratos-locacao-geral-multa-proporcional",
              label: "GERAL - Multa proporcional"
            }
          ],
          selecaoUnica: true
        },
        {
          id: "contratos-servicos-musicais",
          label: "SERVIÇOS MUSICAIS",
          items: [
            {
              id: "contratos-servicos-musicais-geral",
              label: "GERAL"
            }
          ]
        }
      ]
    },
    {
      id: "dativos",
      label: "DATIVOS",
      children: [
        {
          id: "dativos-manifestacao",
          label: "MANIFESTAÇÃO",
          items: [
            {
              id: "dativos-manifestacao-ciencia-da-sentenca",
              label: "CIÊNCIA DA SENTENÇA"
            },
            {
              id: "dativos-manifestacao-ciencia-da-sentenca-uhd",
              label: "CIÊNCIA DA SENTENÇA + UHD"
            }
          ]
        },
        {
          id: "dativos-memoriais",
          label: "MEMORIAIS",
          items: [
            {
              id: "dativos-memoriais-art-121-caput",
              label: "Art. 121, caput"
            },
            {
              id: "dativos-memoriais-trafico",
              label: "TRÁFICO"
            }
          ]
        },
        {
          id: "dativos-recursos",
          label: "RECURSOS",
          children: [
            {
              id: "dativos-recursos-razoes",
              label: "RAZÕES",
              items: [
                {
                  id: "dativos-recursos-razoes-rese",
                  label: "RESE"
                }
              ]
            }
          ]
        },
        {
          id: "dativos-resposta-a-acusacao",
          label: "RESPOSTA À ACUSAÇÃO",
          items: [
            {
              id: "dativos-resposta-a-acusacao-art-12-da-lei-10-826",
              label: "ART. 12 da Lei 10.826"
            },
            {
              id: "dativos-resposta-a-acusacao-art-121-2-inciso-ii-c-c-artigo-14-inciso-ii-do-codig",
              label: "ART. 121, § 2º, inciso II, c.c. artigo 14, inciso II, do Código de Trânsito Brasileiro"
            },
            {
              id: "dativos-resposta-a-acusacao-art-129-9-do-cp-maria-da-penha",
              label: "ART. 129, §9º, do CP (Maria da Penha)"
            },
            {
              id: "dativos-resposta-a-acusacao-art-155-4-inciso-ii-em-concurso-artigo-69-c-artigo-1",
              label: "ART. 155, § 4º, inciso II, em concurso (artigo 69) c artigo 163, parágrafo único, inciso III, do CP"
            },
            {
              id: "dativos-resposta-a-acusacao-art-180-caput-do-cp-receptacao",
              label: "ART. 180, caput, do CP (Receptação)"
            },
            {
              id: "dativos-resposta-a-acusacao-art-306-1-inciso-i-do-codigo-de-transito-brasileiro",
              label: "ART. 306, § 1º, inciso I, do Código de Trânsito Brasileiro"
            },
            {
              id: "dativos-resposta-a-acusacao-art-33-da-lei-11-343-caput",
              label: "ART. 33 da Lei 11.343, caput"
            }
          ]
        },
        {
          id: "dativos-uhd",
          label: "UHD",
          items: [
            {
              id: "dativos-uhd-expedicao-3-uhd-sentenca-transitada-em-julgado",
              label: "Expedição 3 UHD, sentença transitada em julgado"
            }
          ]
        }
      ]
    },
    {
      id: "impugnacoes",
      label: "IMPUGNAÇÕES",
      children: [
        {
          id: "impugnacoes-contestacao",
          label: "CONTESTAÇÃO",
          children: [
            {
              id: "impugnacoes-contestacao-civil",
              label: "CIVIL",
              items: [
                {
                  id: "impugnacoes-contestacao-civil-ausencia-de-litigancia-de-ma-fe",
                  label: "AUSÊNCIA DE LITIGÂNCIA DE MÁ-FÉ"
                },
                {
                  id: "impugnacoes-contestacao-civil-consumidor",
                  label: "CONSUMIDOR"
                },
                {
                  id: "impugnacoes-contestacao-civil-da-aptidao-da-inicial",
                  label: "DA APTIDÃO DA INICIAL"
                },
                {
                  id: "impugnacoes-contestacao-civil-da-competencia-dos-juizados-pericia",
                  label: "DA COMPETÊNCIA DOS JUIZADOS-PERÍCIA"
                },
                {
                  id: "impugnacoes-contestacao-civil-da-contestacao-generica-uso-de-peca-modelo",
                  label: "DA CONTESTAÇÃO GENÉRICA - USO DE PEÇA MODELO"
                },
                {
                  id: "impugnacoes-contestacao-civil-da-decadencia-nao-configurada-fato-ou-vicio",
                  label: "DA DECADÊNCIA NÃO CONFIGURADA-FATO OU VÍCIO"
                },
                {
                  id: "impugnacoes-contestacao-civil-da-intempestividade-da-contestacao",
                  label: "DA INTEMPESTIVIDADE DA CONTESTAÇÃO"
                },
                {
                  id: "impugnacoes-contestacao-civil-da-nao-configuracao-de-litispendencia",
                  label: "DA NÃO CONFIGURAÇÃO DE LITISPENDENCIA"
                },
                {
                  id: "impugnacoes-contestacao-civil-da-possibilidade-de-inversao-do-onus-da-prova",
                  label: "DA POSSIBILIDADE DE INVERSÃO DO ÔNUS DA PROVA"
                },
                {
                  id: "impugnacoes-contestacao-civil-da-prescricao-nao-configurada-10-anos",
                  label: "DA PRESCRIÇÃO NÃO CONFIGURADA 10 ANOS"
                },
                {
                  id: "impugnacoes-contestacao-civil-da-responsabilidade-objetiva-da-prestadora-de-serv",
                  label: "DA RESPONSABILIDADE OBJETIVA DA PRESTADORA DE SERVIÇO PÚBLICO"
                },
                {
                  id: "impugnacoes-contestacao-civil-do-interesse-de-agir-configurado",
                  label: "DO INTERESSE DE AGIR CONFIGURADO"
                },
                {
                  id: "impugnacoes-contestacao-civil-do-interesse-de-agir-e-da-possibilidade-juridica-d",
                  label: "DO INTERESSE DE AGIR E DA POSSIBILIDADE JURÍDICA DO PEDIDO"
                },
                {
                  id: "impugnacoes-contestacao-civil-dos-documentos-da-inicial-orcamentos-teoria-dos-mo",
                  label: "DOS DOCUMENTOS DA INICIAL-ORÇAMENTOS-TEORIA DOS MÓDULOS"
                },
                {
                  id: "impugnacoes-contestacao-civil-dos-fatos-nao-impugnados",
                  label: "DOS FATOS NÃO IMPUGNADOS"
                },
                {
                  id: "impugnacoes-contestacao-civil-fora-do-prazo",
                  label: "Fora do Prazo"
                }
              ]
            },
            {
              id: "impugnacoes-contestacao-resposta-a-impugnacao",
              label: "RESPOSTA À IMPUGNAÇÃO",
              items: [
                {
                  id: "impugnacoes-contestacao-resposta-a-impugnacao-da-validade-da-penhora-em-conta-co",
                  label: "DA VALIDADE DA PENHORA EM CONTA CORRENTE"
                },
                {
                  id: "impugnacoes-contestacao-resposta-a-impugnacao-dos-fatos",
                  label: "DOS FATOS"
                }
              ]
            },
            {
              id: "impugnacoes-contestacao-trabalhista",
              label: "TRABALHISTA",
              items: [
                {
                  id: "impugnacoes-contestacao-trabalhista-01-breve-historico-da-inicial",
                  label: "01 BREVE HISTORICO DA INICIAL"
                },
                {
                  id: "impugnacoes-contestacao-trabalhista-02-do-indeferimento-da-gratuidade-de-justica",
                  label: "02 DO INDEFERIMENTO DA GRATUIDADE DE JUSTIÇA"
                },
                {
                  id: "impugnacoes-contestacao-trabalhista-03-da-preliminar-de-ausencia-de-provas",
                  label: "03 DA PRELIMINAR DE AUSÊNCIA DE PROVAS"
                },
                {
                  id: "impugnacoes-contestacao-trabalhista-04-da-inepcia-da-inicial",
                  label: "04 DA INÉPCIA DA INICIAL"
                },
                {
                  id: "impugnacoes-contestacao-trabalhista-06-da-litigancia-de-ma-fe",
                  label: "06 DA LITIGÂNCIA DE MÁ-FÉ"
                },
                {
                  id: "impugnacoes-contestacao-trabalhista-07-dos-honorarios",
                  label: "07 DOS HONORÁRIOS"
                },
                {
                  id: "impugnacoes-contestacao-trabalhista-08-da-impugnacao-aos-pedidos-doc-e-valor-da-",
                  label: "08 DA IMPUGNAÇÃO AOS PEDIDOS, DOC E VALOR, DA COMPENSAÇÃO, JUROS E CORREÇÃO"
                }
              ]
            }
          ]
        },
        {
          id: "impugnacoes-embargos-a-execucao",
          label: "EMBARGOS À EXECUÇÃO",
          items: [
            {
              id: "impugnacoes-embargos-a-execucao-tese-condominio",
              label: "TESE CONDOMÍNIO"
            }
          ]
        },
        {
          id: "impugnacoes-embargos-de-declaracao",
          label: "EMBARGOS DE DECLARAÇÃO",
          items: [
            {
              id: "impugnacoes-embargos-de-declaracao-001-dos-fatos",
              label: "001. DOS FATOS"
            },
            {
              id: "impugnacoes-embargos-de-declaracao-002-do-merito",
              label: "002. DO MÉRITO"
            }
          ]
        },
        {
          id: "impugnacoes-manifestacao-sobre-impugnacao",
          label: "MANIFESTAÇÃO SOBRE IMPUGNAÇÃO",
          children: [
            {
              id: "impugnacoes-manifestacao-sobre-impugnacao-a-penhora",
              label: "À PENHORA",
              items: [
                {
                  id: "impugnacoes-manifestacao-sobre-impugnacao-a-penhora-00-dos-fatos",
                  label: "00 Dos fatos"
                },
                {
                  id: "impugnacoes-manifestacao-sobre-impugnacao-a-penhora-01-da-falta-de-provas-quanto",
                  label: "01. Da falta de provas quanto à verba alimentar"
                },
                {
                  id: "impugnacoes-manifestacao-sobre-impugnacao-a-penhora-01-da-nulidade-de-citacao-a-",
                  label: "01. Da nulidade de citação A.R. recebido por terceiro"
                },
                {
                  id: "impugnacoes-manifestacao-sobre-impugnacao-a-penhora-02-da-conta-poupanca-utiliza",
                  label: "02. Da conta poupança utilizada como conta corrente"
                }
              ]
            }
          ]
        },
        {
          id: "impugnacoes-penhora-conta-poupanca",
          label: "PENHORA CONTA POUPANÇA",
          items: [
            {
              id: "impugnacoes-penhora-conta-poupanca-da-nulidade-absoluta-da-penhora",
              label: "DA NULIDADE ABSOLUTA DA PENHORA"
            },
            {
              id: "impugnacoes-penhora-conta-poupanca-do-direito",
              label: "DO DIREITO"
            },
            {
              id: "impugnacoes-penhora-conta-poupanca-dos-fatos",
              label: "DOS FATOS"
            },
            {
              id: "impugnacoes-penhora-conta-poupanca-dos-pedidos",
              label: "DOS PEDIDOS"
            }
          ]
        },
        {
          id: "impugnacoes-preliminares",
          label: "PRELIMINARES",
          items: [
            {
              id: "impugnacoes-preliminares-001-intempestividade-e-desentranhamento-da-contestacao",
              label: "001. INTEMPESTIVIDADE E DESENTRANHAMENTO DA CONTESTAÇÃO"
            },
            {
              id: "impugnacoes-preliminares-002-da-legitimidade-passiva-ad-causam-vicio-no-produto",
              label: "002. DA LEGITIMIDADE PASSIVA AD CAUSAM - Vício no Produto"
            },
            {
              id: "impugnacoes-preliminares-003-da-assistencia-judiciaria-no-jec-1-grau",
              label: "003. DA ASSISTÊNCIA JUDICIÁRIA - NO JEC - 1 GRAU"
            },
            {
              id: "impugnacoes-preliminares-003-da-carencia-de-acao",
              label: "003. DA CARÊNCIA DE AÇÃO"
            },
            {
              id: "impugnacoes-preliminares-003-manutencao-da-assistencia-judiciaria-concedida",
              label: "003. MANUTENÇÃO DA ASSISTÊNCIA JUDICIÁRIA CONCEDIDA"
            }
          ]
        }
      ]
    },
    {
      id: "inicial",
      label: "INICIAL",
      items: [
        {
          id: "inicial-legitimidade-ativa-da-pessoa-juridica-no-jec",
          label: "LEGITIMIDADE ATIVA DA PESSOA JURÍDICA NO JEC"
        }
      ]
    },
    {
      id: "recurso",
      label: "RECURSO",
      items: [
        {
          id: "recurso-breve-sintese-dos-fatos",
          label: "BREVE SÍNTESE DOS FATOS"
        },
        {
          id: "recurso-da-assistencia-judiciaria",
          label: "DA ASSISTÊNCIA JUDICIÁRIA"
        },
        {
          id: "recurso-da-tempestividade",
          label: "DA TEMPESTIVIDADE"
        },
        {
          id: "recurso-especificar-provas",
          label: "ESPECIFICAR PROVAS"
        }
      ]
    },
    {
      id: "requerimentos",
      label: "REQUERIMENTOS",
      children: [
        {
          id: "requerimentos-parte-1",
          label: "PARTE 1",
          children: [
            {
              id: "requerimentos-parte-1-arresto",
              label: "ARRESTO",
              items: [
                {
                  id: "requerimentos-parte-1-arresto-arresto-online",
                  label: "ARRESTO ONLINE"
                },
                {
                  id: "requerimentos-parte-1-arresto-arresto-penhora-no-rosto-dos-autos",
                  label: "ARRESTO PENHORA NO ROSTO DOS AUTOS"
                }
              ]
            },
            {
              id: "requerimentos-parte-1-atingir-bens-dos-socios-microempresa-expedicao-de-oficio-a",
              label: "Atingir bens dos sócios Microempresa - Expedicao de oficio a JUCEG",
              items: [
                {
                  id: "requerimentos-parte-1-atingir-bens-dos-socios-microempresa-expedicao-de-oficio-a-2",
                  label: "001. DOS FATOS"
                },
                {
                  id: "requerimentos-parte-1-atingir-bens-dos-socios-microempresa-expedicao-de-oficio-a-3",
                  label: "002. DA RESPONSABILIDADE DOS SÓCIOS"
                }
              ]
            },
            {
              id: "requerimentos-parte-1-gerais",
              label: "GERAIS",
              items: [
                {
                  id: "requerimentos-parte-1-gerais-desnecessidade-intimacao-pessoal-do-executado",
                  label: "DESNECESSIDADE INTIMACAO PESSOAL DO EXECUTADO"
                },
                {
                  id: "requerimentos-parte-1-gerais-informar-telefones-e-e-mails-tecnet",
                  label: "INFORMAR TELEFONES E E-MAILS TECNET"
                },
                {
                  id: "requerimentos-parte-1-gerais-litigancia-de-ma-fe",
                  label: "LITIGÂNCIA DE MÁ-FÉ"
                },
                {
                  id: "requerimentos-parte-1-gerais-proceguimento-da-execucao-apos-alvara",
                  label: "PROCEGUIMENTO DA EXECUÇÃO APÓS ALVARÁ"
                },
                {
                  id: "requerimentos-parte-1-gerais-processo-no-limbo",
                  label: "PROCESSO NO LIMBO"
                },
                {
                  id: "requerimentos-parte-1-gerais-renuncia-a-procuracao",
                  label: "RENÚNCIA À PROCURAÇÃO"
                },
                {
                  id: "requerimentos-parte-1-gerais-substabelecimento",
                  label: "SUBSTABELECIMENTO"
                },
                {
                  id: "requerimentos-parte-1-gerais-substittuicao-de-testemunha-nao-localizada",
                  label: "SUBSTITTUIÇÃO DE TESTEMUNHA NÃO LOCALIZADA"
                },
                {
                  id: "requerimentos-parte-1-gerais-sustentacao-oral",
                  label: "SUSTENTAÇÃO ORAL"
                },
                {
                  id: "requerimentos-parte-1-gerais-transferencia-nao-identificada",
                  label: "TRANSFERÊNCIA NÃO IDENTIFICADA"
                },
                {
                  id: "requerimentos-parte-1-gerais-verificacao-de-transferencia-dos-valores-depositado",
                  label: "VERIFICAÇÃO DE TRANSFERÊNCIA DOS VALORES DEPOSITADOS"
                }
              ]
            },
            {
              id: "requerimentos-parte-1-informar-dados",
              label: "INFORMAR DADOS",
              items: [
                {
                  id: "requerimentos-parte-1-informar-dados-informar-novo-endereco-para-citacao",
                  label: "INFORMAR NOVO ENDEREÇO PARA CITAÇÃO"
                },
                {
                  id: "requerimentos-parte-1-informar-dados-informar-telefones-e-e-mails-m-s",
                  label: "INFORMAR TELEFONES E E-MAILS M&S"
                },
                {
                  id: "requerimentos-parte-1-informar-dados-informar-telefones-e-e-mails-tecnet",
                  label: "INFORMAR TELEFONES E E-MAILS TECNET"
                }
              ]
            },
            {
              id: "requerimentos-parte-1-pedido-de-reconsideracao",
              label: "PEDIDO DE RECONSIDERAÇÃO",
              children: [
                {
                  id: "requerimentos-parte-1-pedido-de-reconsideracao-citacao-justificativa",
                  label: "CITAÇÃO JUSTIFICATIVA",
                  children: [
                    {
                      id: "requerimentos-parte-1-pedido-de-reconsideracao-citacao-justificativa-pessoa-fisi",
                      label: "PESSOA FÍSICA",
                      items: [
                        {
                          id: "requerimentos-parte-1-pedido-de-reconsideracao-citacao-justificativa-pessoa-fisi-2",
                          label: "DA RECONSIDERAÇÃO"
                        },
                        {
                          id: "requerimentos-parte-1-pedido-de-reconsideracao-citacao-justificativa-pessoa-fisi-3",
                          label: "DOS FATOS"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              id: "requerimentos-parte-1-penhora",
              label: "PENHORA",
              items: [
                {
                  id: "requerimentos-parte-1-penhora-penhora-bacenjud-renajud-e-cartorio",
                  label: "PENHORA BACENJUD, RENAJUD E CARTÓRIO"
                },
                {
                  id: "requerimentos-parte-1-penhora-penhora-de-alugueis",
                  label: "PENHORA DE ALUGUEIS"
                },
                {
                  id: "requerimentos-parte-1-penhora-penhora-de-salario",
                  label: "PENHORA DE SALÁRIO"
                },
                {
                  id: "requerimentos-parte-1-penhora-penhora-de-veiculo-bloqueado-via-renajudi",
                  label: "PENHORA DE VEÍCULO BLOQUEADO VIA RENAJUDI"
                },
                {
                  id: "requerimentos-parte-1-penhora-penhora-na-residencia",
                  label: "PENHORA NA RESIDÊNCIA"
                },
                {
                  id: "requerimentos-parte-1-penhora-penhora-por-convenio-bacenjud",
                  label: "PENHORA POR CONVÊNIO BACENJUD"
                },
                {
                  id: "requerimentos-parte-1-penhora-penhora-por-convenio-renajud",
                  label: "PENHORA POR CONVÊNIO RENAJUD"
                },
                {
                  id: "requerimentos-parte-1-penhora-penhora-por-ter-transcorrido-prazo-de-embargos-pro",
                  label: "PENHORA POR TER TRANSCORRIDO PRAZO DE EMBARGOS (PROJUDI)"
                },
                {
                  id: "requerimentos-parte-1-penhora-penhora-unidade",
                  label: "PENHORA UNIDADE"
                },
                {
                  id: "requerimentos-parte-1-penhora-rosto-dos-autos-de-inventario",
                  label: "ROSTO DOS AUTOS DE INVENTÁRIO"
                }
              ]
            }
          ]
        },
        {
          id: "requerimentos-parte-2",
          label: "PARTE 2",
          items: [
            {
              id: "requerimentos-parte-2-certidao-sistema-berna",
              label: "CERTIDÃO SISTEMA BERNA"
            }
          ]
        },
        {
          id: "requerimentos-parte-3",
          label: "PARTE 3",
          items: [
            {
              id: "requerimentos-parte-3-andamento-limbo",
              label: "ANDAMENTO (LIMBO)"
            },
            {
              id: "requerimentos-parte-3-cumprimento-de-sentenca-contra-a-fazenda-publica",
              label: "CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA"
            },
            {
              id: "requerimentos-parte-3-cumprimento-de-sentenca-inss-rpv",
              label: "CUMPRIMENTO DE SENTENÇA INSS-RPV"
            },
            {
              id: "requerimentos-parte-3-desnecessidade-intimacao-pessoal-do-executado",
              label: "DESNECESSIDADE INTIMACAO PESSOAL DO EXECUTADO"
            },
            {
              id: "requerimentos-parte-3-dispensa-de-novas-provas-julgamento-antecipado",
              label: "DISPENSA DE NOVAS PROVAS - JULGAMENTO ANTECIPADO"
            },
            {
              id: "requerimentos-parte-3-do-pedido-de-transferencia-dos-valores",
              label: "DO PEDIDO DE TRANSFERÊNCIA DOS VALORES"
            },
            {
              id: "requerimentos-parte-3-expedicao-de-rpv",
              label: "EXPEDIÇÃO DE RPV"
            },
            {
              id: "requerimentos-parte-3-honorarios-5-e-10",
              label: "HONORÁRIOS 5% E 10%"
            },
            {
              id: "requerimentos-parte-3-informar-telefones-e-e-mails-m-s",
              label: "INFORMAR TELEFONES E E-MAILS M&S"
            },
            {
              id: "requerimentos-parte-3-informar-telefones-e-e-mails-tecnet",
              label: "INFORMAR TELEFONES E E-MAILS TECNET"
            },
            {
              id: "requerimentos-parte-3-litigancia-de-ma-fe",
              label: "LITIGÂNCIA DE MÁ-FÉ"
            },
            {
              id: "requerimentos-parte-3-manifestacao-berna",
              label: "MANIFESTAÇÃO BERNA"
            },
            {
              id: "requerimentos-parte-3-modelo",
              label: "MODELO"
            },
            {
              id: "requerimentos-parte-3-pagamento-de-alvara-ao-procurador",
              label: "PAGAMENTO DE ALVARÁ AO PROCURADOR"
            },
            {
              id: "requerimentos-parte-3-pesquisa-de-enderecos",
              label: "PESQUISA DE ENDEREÇOS"
            },
            {
              id: "requerimentos-parte-3-prioridade-de-tramitacao-pessoa-idosa",
              label: "PRIORIDADE DE TRAMITAÇÃO - PESSOA IDOSA"
            },
            {
              id: "requerimentos-parte-3-proceguimento-da-execucao-apos-alvara",
              label: "PROCEGUIMENTO DA EXECUÇÃO APÓS ALVARÁ"
            },
            {
              id: "requerimentos-parte-3-reconsideracao-de-exclusao-de-multa-revel",
              label: "RECONSIDERAÇÃO DE EXCLUSÃO DE MULTA - REVEL"
            },
            {
              id: "requerimentos-parte-3-renuncia",
              label: "RENÚNCIA"
            },
            {
              id: "requerimentos-parte-3-serasajud",
              label: "SERASAJUD"
            },
            {
              id: "requerimentos-parte-3-substituicao-de-testemunha-nao-localizada",
              label: "SUBSTITUIÇÃO DE TESTEMUNHA NÃO LOCALIZADA"
            },
            {
              id: "requerimentos-parte-3-suspensao-cnh-devedor",
              label: "SUSPENSAO CNH DEVEDOR"
            },
            {
              id: "requerimentos-parte-3-sustentacao-oral",
              label: "SUSTENTAÇÃO ORAL"
            },
            {
              id: "requerimentos-parte-3-transferencia-nao-identificada",
              label: "TRANSFERÊNCIA NÃO IDENTIFICADA"
            },
            {
              id: "requerimentos-parte-3-vereadores",
              label: "VEREADORES"
            }
          ]
        },
        {
          id: "requerimentos-parte-4",
          label: "PARTE 4",
          children: [
            {
              id: "requerimentos-parte-4-leiloes",
              label: "LEILÕES",
              items: [
                {
                  id: "requerimentos-parte-4-leiloes-alienacao-particular",
                  label: "ALIENAÇÃO PARTICULAR"
                }
              ]
            }
          ]
        },
        {
          id: "requerimentos-parte-5",
          label: "PARTE 5",
          items: [
            {
              id: "requerimentos-parte-5-arquivamento-serasajud",
              label: "ARQUIVAMENTO + SERASAJUD"
            },
            {
              id: "requerimentos-parte-5-dados-bancarios",
              label: "DADOS BANCÁRIOS"
            },
            {
              id: "requerimentos-parte-5-manifestacao-prazo",
              label: "MANIFESTAÇÃO PRAZO"
            },
            {
              id: "requerimentos-parte-5-nova-penhora-online-depois-de-1-ano",
              label: "Nova Penhora online (depois de 1 ano)"
            },
            {
              id: "requerimentos-parte-5-oficio-ao-empregador",
              label: "Ofício ao empregador"
            },
            {
              id: "requerimentos-parte-5-penhora-recorrente-ate-quitacao-do-debito",
              label: "Penhora Recorrente até quitação do débito"
            },
            {
              id: "requerimentos-parte-5-planilha-atualizada-dos-debitos",
              label: "Planilha atualizada dos débitos"
            }
          ]
        }
      ]
    }
  ]
};

/**
 * @param {TopicoNo} root
 * @param {string[]} stackIds ids do caminho a partir dos filhos da raiz (não inclui _raiz)
 * @returns {TopicoNo | null}
 */
export function resolverNoPorCaminho(root, stackIds) {
  let node = root;
  for (const id of stackIds) {
    const next = node.children?.find((c) => c.id === id);
    if (!next) return null;
    node = next;
  }
  return node;
}

/** Rótulos do caminho para breadcrumb (um rótulo por id em `pathStack`). */
export function rotulosDoCaminho(raiz, pathStack) {
  const out = [];
  let node = raiz;
  for (const id of pathStack) {
    const next = node.children?.find((c) => c.id === id);
    if (!next) break;
    out.push(next.label);
    node = next;
  }
  return out;
}
