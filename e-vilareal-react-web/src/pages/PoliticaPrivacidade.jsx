const ENDERECO_ESCRITORIO =
  'Av. Pinheiro Chagas, nº 232, Bairro Jundiaí, Anápolis-GO, CEP 75.110-580';
const EMAIL_CONTATO = 'villareal@villarealadvocacia.adv.br';
const TELEFONE = '(62) 9404-5077';
const TELEFONE_HREF = 'tel:+556294045077';

function Secao({ id, titulo, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{titulo}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-5 sm:px-6">
          <img
            src="/logo-villareal.png"
            alt="Villa Real e Advogados Associados"
            className="h-10 w-auto max-w-[12rem] object-contain sm:h-11"
            width={180}
            height={64}
            decoding="async"
          />
        </div>
      </header>

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
          <header className="mb-10 border-b border-slate-200 pb-8">
            <p className="text-sm font-medium uppercase tracking-wide text-cyan-700">
              Villa Real e Advogados Associados
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 tracking-tight sm:text-3xl">
              Política de Privacidade
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              portal.villarealadvocacia.adv.br — última atualização: maio de 2026
            </p>
          </header>

          <div className="space-y-10">
            <Secao id="introducao" titulo="1. Introdução">
              <p>
                O escritório <strong>Villa Real e Advogados Associados</strong> (&quot;nós&quot;) respeita a
                privacidade dos usuários e está comprometido com a proteção dos dados pessoais, em conformidade
                com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
              </p>
            </Secao>

            <Secao id="dados-coletados" titulo="2. Dados que coletamos">
              <p>Podemos tratar, conforme a relação com o escritório e os serviços utilizados:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>Dados de identificação:</strong> nome, CPF, e-mail, telefone
                </li>
                <li>
                  <strong>Dados processuais:</strong> informações sobre processos judiciais vinculados ao cliente
                </li>
                <li>
                  <strong>Dados de comunicação:</strong> mensagens trocadas via WhatsApp, e-mail e outros canais
                  de atendimento
                </li>
                <li>
                  <strong>Dados de navegação:</strong> cookies e informações técnicas de acesso ao portal
                </li>
              </ul>
            </Secao>

            <Secao id="utilizacao" titulo="3. Como utilizamos seus dados">
              <p>Utilizamos os dados pessoais para, entre outras finalidades:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Prestação de serviços advocatícios e acompanhamento processual</li>
                <li>Comunicação sobre andamento de processos, audiências e prazos</li>
                <li>
                  Envio de notificações e lembretes via WhatsApp (através da WhatsApp Business API da Meta)
                </li>
                <li>Resposta a consultas e atendimento ao cliente</li>
                <li>Cumprimento de obrigações legais e regulatórias</li>
              </ul>
            </Secao>

            <Secao id="whatsapp" titulo="4. WhatsApp Business">
              <ul className="list-disc space-y-2 pl-5">
                <li>Utilizamos a plataforma WhatsApp Business API para comunicação com clientes</li>
                <li>
                  As mensagens podem ser processadas por sistemas automatizados para agilizar o atendimento
                </li>
                <li>
                  O conteúdo das mensagens é tratado com sigilo profissional (sigilo advocatício)
                </li>
                <li>
                  Você pode solicitar a interrupção do envio de mensagens a qualquer momento enviando{' '}
                  <strong>SAIR</strong> por WhatsApp
                </li>
              </ul>
            </Secao>

            <Secao id="compartilhamento" titulo="5. Compartilhamento de dados">
              <p>
                Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins comerciais.
              </p>
              <p>Os dados podem ser compartilhados com:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Tribunais e órgãos do Poder Judiciário (para fins processuais)</li>
                <li>Prestadores de serviços essenciais (hospedagem, sistemas)</li>
                <li>Autoridades ou terceiros, quando exigido por lei</li>
              </ul>
            </Secao>

            <Secao id="seguranca" titulo="6. Segurança">
              <p>
                Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado,
                perda ou alteração.
              </p>
              <p>Nossos sistemas utilizam criptografia e controles de acesso.</p>
            </Secao>

            <Secao id="direitos" titulo="7. Seus direitos (LGPD)">
              <p>Nos termos da LGPD, você pode solicitar, entre outros:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Acesso aos seus dados pessoais</li>
                <li>Correção de dados incompletos ou desatualizados</li>
                <li>Eliminação de dados desnecessários</li>
                <li>Revogação do consentimento</li>
              </ul>
              <p>
                Para exercer seus direitos, entre em contato pelo e-mail ou telefone do escritório indicados na
                seção Contato.
              </p>
            </Secao>

            <Secao id="retencao" titulo="8. Retenção de dados">
              <p>
                Os dados são mantidos pelo tempo necessário ao cumprimento das finalidades para as quais foram
                coletados, respeitando os prazos legais aplicáveis à advocacia.
              </p>
            </Secao>

            <Secao id="contato" titulo="9. Contato">
              <ul className="space-y-2 not-italic">
                <li>
                  <strong>Villa Real e Advogados Associados</strong>
                </li>
                <li>
                  <strong>Responsável:</strong> Dr. Itamar — OAB/GO 33.329
                </li>
                <li>
                  <strong>Endereço:</strong> {ENDERECO_ESCRITORIO}
                </li>
                <li>
                  <strong>Telefone:</strong>{' '}
                  <a href={TELEFONE_HREF} className="text-cyan-700 underline-offset-2 hover:underline">
                    {TELEFONE}
                  </a>
                </li>
                <li>
                  <strong>E-mail:</strong>{' '}
                  <a
                    href={`mailto:${EMAIL_CONTATO}`}
                    className="text-cyan-700 underline-offset-2 hover:underline break-all"
                  >
                    {EMAIL_CONTATO}
                  </a>
                </li>
              </ul>
            </Secao>

            <Secao id="atualizacao" titulo="10. Atualização desta política">
              <p>
                Esta política pode ser atualizada periodicamente. A data da última atualização será indicada nesta
                página.
              </p>
              <p className="text-sm text-slate-500">
                <strong>Última atualização:</strong> maio de 2026
              </p>
            </Secao>
          </div>
        </article>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-xs text-slate-500 sm:px-6">
          <p>© {new Date().getFullYear()} Villa Real e Advogados Associados — Anápolis, GO</p>
          <p className="mt-1">
            <a
              href="https://www.villarealadvocacia.adv.br"
              className="text-cyan-700 hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              www.villarealadvocacia.adv.br
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
