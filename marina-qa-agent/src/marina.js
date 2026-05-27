/**
 * Marina QA Agent v1.0
 * ────────────────────
 * Usuária fictícia com IA que navega o portal Villa Real,
 * analisa cada tela visualmente, e gera relatório de UX.
 *
 * Uso:
 *   npm run audit           → auditoria completa (headless)
 *   npm run audit:visible   → abre o navegador visível
 *   npm run audit:flow clientes  → audita só um módulo
 */

require('dotenv').config();
const { chromium } = require('playwright');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// ── Configuração ────────────────────────────────────────

const CONFIG = {
  portalUrl: process.env.PORTAL_URL || 'https://portal.villarealadvocacia.adv.br',
  loginUser: process.env.LOGIN_USER || 'marina.teste',
  loginPass: process.env.LOGIN_PASS || 'Marina@2026',
  headless: process.env.HEADLESS !== 'false',
  viewport: {
    width: parseInt(process.env.VIEWPORT_WIDTH || '1366'),
    height: parseInt(process.env.VIEWPORT_HEIGHT || '768'),
  },
  timeout: parseInt(process.env.NAVIGATION_TIMEOUT || '15000'),
  claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
};

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Persona da Marina ───────────────────────────────────

const MARINA_PERSONA = `
Você é Marina, uma secretária de 24 anos recém-contratada no escritório Villa Real e Advogados Associados em Anápolis-GO.
Você nunca usou este sistema antes. Você é inteligente mas não é técnica — sabe usar computador no nível básico (Word, WhatsApp, e-mail).

Seu papel é avaliar cada tela do sistema como uma USUÁRIA REAL. Você deve:

1. DESCREVER o que vê na tela (elementos, botões, menus, tabelas, informações)
2. AVALIAR a usabilidade:
   - A tela é intuitiva? Você saberia o que fazer sem treinamento?
   - Os rótulos são claros? Algum botão ou campo tem nome confuso?
   - A informação mais importante está visível de imediato ou precisa rolar/clicar?
   - Há elementos visuais que distraem ou confundem?
   - As cores e tamanhos ajudam ou atrapalham a hierarquia de informação?
3. IDENTIFICAR PROBLEMAS:
   - Campos sem validação aparente
   - Botões sem feedback visual
   - Informação que deveria estar na tela mas não está
   - Excesso de cliques para tarefas comuns
   - Tela poluída ou vazia demais
4. SUGERIR MELHORIAS concretas e específicas
5. DAR UMA NOTA de 1 a 10 para a tela

Responda SEMPRE em português brasileiro, em formato estruturado.
Seja honesta e direta — se a tela está ruim, diga que está ruim.
Se está boa, reconheça. Não seja genérica — cite elementos específicos.

FORMATO DA RESPOSTA (JSON):
{
  "tela": "nome da tela",
  "primeira_impressao": "O que a Marina pensa ao ver essa tela pela primeira vez",
  "descricao": "Descrição objetiva dos elementos visíveis",
  "pontos_positivos": ["lista de acertos"],
  "problemas": [
    {
      "severidade": "critica|alta|media|baixa",
      "descricao": "o problema",
      "impacto": "como isso afeta o trabalho diário",
      "sugestao": "como resolver"
    }
  ],
  "sugestoes_gerais": ["melhorias que não são correção de problema"],
  "fluxo_usuario": "Descrição do caminho que a Marina faria para realizar a tarefa principal desta tela",
  "nota": 7,
  "resumo": "Uma frase resumindo a avaliação"
}
`;

// ── Utilitários ─────────────────────────────────────────

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const screenshotsDir = path.join(__dirname, '..', 'screenshots');
const reportsDir = path.join(__dirname, '..', 'reports');

function ensureDirs() {
  [screenshotsDir, reportsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

async function screenshot(page, name) {
  const filename = `${timestamp()}_${name}.png`;
  const filepath = path.join(screenshotsDir, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  📸 Screenshot: ${filename}`);
  return filepath;
}

async function screenshotFull(page, name) {
  const filename = `${timestamp()}_${name}_full.png`;
  const filepath = path.join(screenshotsDir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  📸 Screenshot (full): ${filename}`);
  return filepath;
}

// ── Claude Vision ───────────────────────────────────────

async function askMarina(screenshotPaths, context) {
  const content = [];

  // Adiciona cada screenshot como imagem
  for (const sp of (Array.isArray(screenshotPaths) ? screenshotPaths : [screenshotPaths])) {
    const imageData = fs.readFileSync(sp).toString('base64');
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: imageData },
    });
  }

  content.push({ type: 'text', text: context });

  const response = await claude.messages.create({
    model: CONFIG.claudeModel,
    max_tokens: 3000,
    system: MARINA_PERSONA,
    messages: [{ role: 'user', content }],
  });

  const text = response.content[0].text;

  // Tenta parsear como JSON, senão retorna texto bruto
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    // fallback
  }
  return { raw: text };
}

// ── Descoberta de navegação ─────────────────────────────

async function discoverNavigation(page) {
  console.log('\n🔍 Descobrindo estrutura de navegação...');
  const sp = await screenshot(page, 'navegacao_principal');

  const analysis = await askMarina(sp, `
    Analise esta tela FOCANDO APENAS na estrutura de navegação (menu lateral, barra superior, links).
    
    Responda em JSON:
    {
      "menus_visiveis": [
        {
          "texto": "texto do menu/link",
          "posicao": "lateral|superior|centro",
          "parece_clicavel": true,
          "descricao": "o que você acha que esse menu faz"
        }
      ],
      "estrutura_geral": "descrição da organização do menu",
      "sugestoes_navegacao": ["sugestões para melhorar a navegação"]
    }
  `);

  console.log('  ✅ Navegação mapeada');
  return analysis;
}

// ── Login ───────────────────────────────────────────────

async function doLogin(page) {
  console.log('\n🔑 Fazendo login...');
  await page.goto(CONFIG.portalUrl, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
  await page.waitForTimeout(2000);

  // Screenshot da tela de login
  const loginScreenshot = await screenshot(page, '00_login');

  // Tenta identificar campos de login
  // Estratégia 1: campos comuns
  const selectors = {
    user: [
      'input[name="login"]', 'input[name="username"]', 'input[name="email"]',
      'input[name="usuario"]', 'input[type="text"]', '#login', '#username',
    ],
    pass: [
      'input[name="senha"]', 'input[name="password"]', 'input[type="password"]',
      '#senha', '#password',
    ],
    submit: [
      'button[type="submit"]', 'input[type="submit"]',
      'button:has-text("Entrar")', 'button:has-text("Login")',
      'button:has-text("Acessar")',
    ],
  };

  let userField, passField, submitBtn;

  for (const sel of selectors.user) {
    try { userField = await page.waitForSelector(sel, { timeout: 2000 }); break; } catch {}
  }
  for (const sel of selectors.pass) {
    try { passField = await page.waitForSelector(sel, { timeout: 2000 }); break; } catch {}
  }
  for (const sel of selectors.submit) {
    try { submitBtn = await page.waitForSelector(sel, { timeout: 2000 }); break; } catch {}
  }

  if (!userField || !passField) {
    console.log('  ⚠️  Não encontrei campos de login padrão. Pedindo ajuda à Marina...');
    const help = await askMarina(loginScreenshot, `
      Preciso fazer login nesta tela. Descreva EXATAMENTE:
      1. Que campos de input você vê (posição, placeholder, label)
      2. Que botão de submit você vê
      3. Algum outro elemento relevante (captcha, link de recuperação)
      Responda em JSON: { "campos": [...], "botao": "...", "observacoes": "..." }
    `);
    console.log('  ℹ️  Análise da Marina:', JSON.stringify(help, null, 2));
    return { success: false, analysis: help, screenshot: loginScreenshot };
  }

  await userField.fill(CONFIG.loginUser);
  await passField.fill(CONFIG.loginPass);
  await page.waitForTimeout(500);

  // Screenshot com campos preenchidos
  await screenshot(page, '00_login_preenchido');

  if (submitBtn) await submitBtn.click();
  else await passField.press('Enter');

  // Espera navegação pós-login
  try {
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: CONFIG.timeout });
  } catch {
    await page.waitForTimeout(3000);
  }

  const postLoginUrl = page.url();
  const loginSuccess = postLoginUrl !== CONFIG.portalUrl && !postLoginUrl.includes('login');

  if (loginSuccess) {
    console.log('  ✅ Login bem-sucedido');
    await page.waitForTimeout(2000);
    const dashScreenshot = await screenshot(page, '01_dashboard');
    return { success: true, screenshot: dashScreenshot, loginScreenshot };
  } else {
    console.log('  ❌ Login falhou');
    const failScreenshot = await screenshot(page, '00_login_falha');
    return { success: false, screenshot: failScreenshot, loginScreenshot };
  }
}

// ── Navegação por telas ─────────────────────────────────

async function navigateAndAnalyze(page, menuText, index) {
  const padded = String(index).padStart(2, '0');
  const slug = menuText.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  console.log(`\n📄 [${padded}] Navegando para: ${menuText}`);

  try {
    // Tenta clicar no menu pelo texto
    const menuItem = await page.locator(`text="${menuText}"`).first();
    if (await menuItem.isVisible()) {
      await menuItem.click();
      await page.waitForTimeout(2000);

      // Espera a página carregar
      try {
        await page.waitForLoadState('networkidle', { timeout: 8000 });
      } catch {}

      // Screenshots: viewport + fullpage
      const sp1 = await screenshot(page, `${padded}_${slug}`);
      const sp2 = await screenshotFull(page, `${padded}_${slug}`);

      // Análise da Marina
      const analysis = await askMarina([sp1], `
        Você acabou de clicar no menu "${menuText}" e esta é a tela que apareceu.
        Avalie esta tela como uma secretária que precisa usar isso no dia a dia.
        
        Contexto: este é um sistema de gestão para um escritório de advocacia.
        As tarefas típicas são: cadastrar clientes, acompanhar processos, controlar agenda,
        calcular débitos judiciais, gerenciar imóveis e gerar documentos.
      `);

      console.log(`  ✅ Análise concluída — Nota: ${analysis.nota || '?'}/10`);
      return { menu: menuText, slug, analysis, screenshots: [sp1, sp2], success: true };
    }
  } catch (err) {
    console.log(`  ⚠️  Erro ao navegar para "${menuText}": ${err.message}`);
  }

  return { menu: menuText, slug, success: false, error: 'Menu não encontrado ou erro ao clicar' };
}

// ── Análise de fluxo completo ───────────────────────────

async function analyzeFlow(page, flowName) {
  console.log(`\n🔄 Testando fluxo: ${flowName}`);

  const flows = {
    'debito_cliente': {
      descricao: 'Consultar quanto um cliente deve para hoje',
      passos: [
        'Encontre e clique no menu de Clientes ou similar',
        'Busque ou selecione um cliente qualquer da lista',
        'Encontre a seção de processos desse cliente',
        'Acesse os cálculos/débitos do processo',
        'Verifique se o valor atualizado é exibido claramente',
      ],
    },
    'agendar_audiencia': {
      descricao: 'Agendar uma audiência para um cliente',
      passos: [
        'Encontre e clique no menu de Agenda',
        'Tente criar um novo evento/compromisso',
        'Preencha os campos necessários',
        'Salve o agendamento',
        'Verifique se aparece na agenda',
      ],
    },
    'cadastrar_cliente': {
      descricao: 'Cadastrar um cliente novo no sistema',
      passos: [
        'Encontre o menu de Clientes ou Pessoas',
        'Clique em Novo/Adicionar',
        'Preencha os dados básicos (nome, CPF, contato)',
        'Salve o cadastro',
        'Verifique se o cliente aparece na lista',
      ],
    },
  };

  const flow = flows[flowName];
  if (!flow) {
    console.log(`  ❌ Fluxo "${flowName}" não existe. Disponíveis: ${Object.keys(flows).join(', ')}`);
    return null;
  }

  const stepResults = [];
  for (let i = 0; i < flow.passos.length; i++) {
    const passo = flow.passos[i];
    console.log(`  Passo ${i + 1}: ${passo}`);

    const sp = await screenshot(page, `flow_${flowName}_step${i + 1}`);
    const analysis = await askMarina(sp, `
      Você está testando o fluxo: "${flow.descricao}"
      
      PASSO ATUAL (${i + 1} de ${flow.passos.length}): ${passo}
      
      Olhe a tela e responda:
      1. Você consegue executar este passo? O que clicar/preencher?
      2. É óbvio o que fazer ou precisaria de treinamento?
      3. Quantos cliques seriam necessários?
      4. Há algum obstáculo ou confusão?
      
      Responda em JSON:
      {
        "passo": "${passo}",
        "executavel": true/false,
        "dificuldade": "facil|medio|dificil|impossivel",
        "caminho": "descreva exatamente o que clicaria/faria",
        "obstaculos": ["lista de dificuldades encontradas"],
        "cliques_necessarios": 2,
        "observacao": "comentário geral"
      }
    `);

    stepResults.push({ passo, analysis });

    // Se a Marina diz que é executável, tenta clicar no que ela sugeriu
    if (analysis.caminho && analysis.executavel) {
      // Aqui futuramente podemos automatizar o clique com base na sugestão
      // Por agora, registramos a análise
    }
  }

  return { flowName, descricao: flow.descricao, steps: stepResults };
}

// ── Geração de relatório ────────────────────────────────

function generateReport(results) {
  const ts = timestamp();
  const reportPath = path.join(reportsDir, `relatorio_marina_${ts}.md`);

  let md = `# 🔍 Relatório de Auditoria UX — Marina QA Agent\n\n`;
  md += `**Data:** ${new Date().toLocaleString('pt-BR')}\n`;
  md += `**Portal:** ${CONFIG.portalUrl}\n`;
  md += `**Usuária:** Marina Teste (IA)\n\n`;
  md += `---\n\n`;

  // Resumo executivo
  const notas = results
    .filter(r => r.success && r.analysis && r.analysis.nota)
    .map(r => ({ menu: r.menu, nota: r.analysis.nota }));

  if (notas.length > 0) {
    const media = (notas.reduce((s, n) => s + n.nota, 0) / notas.length).toFixed(1);
    md += `## 📊 Resumo Executivo\n\n`;
    md += `**Nota média geral: ${media}/10**\n\n`;
    md += `| Tela | Nota | Resumo |\n`;
    md += `|------|------|--------|\n`;
    results
      .filter(r => r.success && r.analysis)
      .forEach(r => {
        const a = r.analysis;
        md += `| ${r.menu} | ${a.nota || '-'}/10 | ${a.resumo || '-'} |\n`;
      });
    md += `\n---\n\n`;
  }

  // Problemas críticos
  const criticos = [];
  results.forEach(r => {
    if (r.success && r.analysis && r.analysis.problemas) {
      r.analysis.problemas
        .filter(p => p.severidade === 'critica' || p.severidade === 'alta')
        .forEach(p => criticos.push({ tela: r.menu, ...p }));
    }
  });

  if (criticos.length > 0) {
    md += `## 🚨 Problemas Críticos e de Alta Severidade\n\n`;
    criticos.forEach((c, i) => {
      md += `### ${i + 1}. [${c.severidade.toUpperCase()}] ${c.tela}\n`;
      md += `- **Problema:** ${c.descricao}\n`;
      md += `- **Impacto:** ${c.impacto}\n`;
      md += `- **Sugestão:** ${c.sugestao}\n\n`;
    });
    md += `---\n\n`;
  }

  // Análise detalhada por tela
  md += `## 📋 Análise Detalhada por Tela\n\n`;
  results.forEach(r => {
    if (!r.success) {
      md += `### ❌ ${r.menu}\n`;
      md += `Não foi possível acessar: ${r.error || 'erro desconhecido'}\n\n`;
      return;
    }
    if (!r.analysis) return;

    const a = r.analysis;
    md += `### ${a.nota >= 7 ? '✅' : a.nota >= 5 ? '⚠️' : '❌'} ${r.menu} — ${a.nota || '?'}/10\n\n`;

    if (a.primeira_impressao) md += `> _"${a.primeira_impressao}"_ — Marina\n\n`;
    if (a.descricao) md += `**Descrição:** ${a.descricao}\n\n`;

    if (a.pontos_positivos && a.pontos_positivos.length > 0) {
      md += `**Pontos positivos:**\n`;
      a.pontos_positivos.forEach(p => md += `- ✅ ${p}\n`);
      md += `\n`;
    }

    if (a.problemas && a.problemas.length > 0) {
      md += `**Problemas encontrados:**\n`;
      a.problemas.forEach(p => {
        const icon = p.severidade === 'critica' ? '🔴' : p.severidade === 'alta' ? '🟠' : p.severidade === 'media' ? '🟡' : '🟢';
        md += `- ${icon} **[${p.severidade}]** ${p.descricao}\n`;
        if (p.sugestao) md += `  → _Sugestão: ${p.sugestao}_\n`;
      });
      md += `\n`;
    }

    if (a.sugestoes_gerais && a.sugestoes_gerais.length > 0) {
      md += `**Sugestões de melhoria:**\n`;
      a.sugestoes_gerais.forEach(s => md += `- 💡 ${s}\n`);
      md += `\n`;
    }

    if (a.fluxo_usuario) md += `**Fluxo do usuário:** ${a.fluxo_usuario}\n\n`;

    md += `---\n\n`;
  });

  // Todas as sugestões consolidadas
  const todasSugestoes = [];
  results.forEach(r => {
    if (r.success && r.analysis) {
      const a = r.analysis;
      if (a.problemas) a.problemas.forEach(p => {
        if (p.sugestao) todasSugestoes.push({ tela: r.menu, tipo: 'correção', texto: p.sugestao, severidade: p.severidade });
      });
      if (a.sugestoes_gerais) a.sugestoes_gerais.forEach(s => {
        todasSugestoes.push({ tela: r.menu, tipo: 'melhoria', texto: s, severidade: 'baixa' });
      });
    }
  });

  if (todasSugestoes.length > 0) {
    md += `## 🎯 Backlog de Melhorias (priorizado)\n\n`;
    const prioridade = { critica: 0, alta: 1, media: 2, baixa: 3 };
    todasSugestoes
      .sort((a, b) => (prioridade[a.severidade] || 3) - (prioridade[b.severidade] || 3))
      .forEach((s, i) => {
        md += `${i + 1}. **[${s.tela}]** ${s.texto} _(${s.tipo} — ${s.severidade})_\n`;
      });
  }

  fs.writeFileSync(reportPath, md, 'utf-8');
  console.log(`\n📄 Relatório salvo: ${reportPath}`);
  return reportPath;
}

// ── Fluxo principal ─────────────────────────────────────

async function main() {
  ensureDirs();
  console.log('═══════════════════════════════════════════');
  console.log('  🤖 Marina QA Agent v1.0');
  console.log('  Escritório Villa Real e Advogados');
  console.log('═══════════════════════════════════════════');
  console.log(`Portal: ${CONFIG.portalUrl}`);
  console.log(`Headless: ${CONFIG.headless}`);
  console.log(`Modelo: ${CONFIG.claudeModel}`);

  // Verifica se é auditoria de fluxo específico
  const flowArg = process.argv.find(a => a === '--flow');
  const flowName = flowArg ? process.argv[process.argv.indexOf('--flow') + 1] : null;

  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: CONFIG.viewport,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.timeout);

  try {
    // ── 1. Login ──
    const loginResult = await doLogin(page);

    if (!loginResult.success) {
      console.log('\n❌ Login falhou. Analisando tela de login...');
      const loginAnalysis = await askMarina(loginResult.loginScreenshot || loginResult.screenshot, `
        Esta é a tela de login do sistema. Avalie:
        - O design é profissional?
        - Os campos são claros?
        - Há feedback de erro visível?
        - Tem recuperação de senha?
      `);
      console.log('Análise da tela de login:', JSON.stringify(loginAnalysis, null, 2));
      generateReport([{
        menu: 'Tela de Login',
        success: true,
        analysis: loginAnalysis,
      }]);
      return;
    }

    // ── 2. Análise do Dashboard ──
    console.log('\n📊 Analisando dashboard/tela inicial...');
    const dashAnalysis = await askMarina(loginResult.screenshot, `
      Esta é a tela inicial do sistema após o login.
      Avalie como dashboard/página inicial de um sistema de escritório de advocacia.
      Uma boa tela inicial deveria mostrar: resumo de tarefas pendentes, próximas audiências,
      prazos vencendo, últimas movimentações. Verifique se isso está presente.
    `);

    const results = [{
      menu: 'Dashboard / Tela Inicial',
      slug: 'dashboard',
      success: true,
      analysis: dashAnalysis,
      screenshots: [loginResult.screenshot],
    }];

    // ── 3. Descobrir navegação ──
    const navAnalysis = await discoverNavigation(page);

    // ── 4. Navegar por cada menu descoberto ──
    if (navAnalysis.menus_visiveis && Array.isArray(navAnalysis.menus_visiveis)) {
      let menuIndex = 2;
      for (const menu of navAnalysis.menus_visiveis) {
        if (!menu.texto) continue;

        // Pula menus que não são de conteúdo (logout, config, etc.)
        const skipWords = ['sair', 'logout', 'configuração', 'config', 'perfil', 'marina'];
        if (skipWords.some(w => menu.texto.toLowerCase().includes(w))) {
          console.log(`  ⏭️  Pulando menu: ${menu.texto}`);
          continue;
        }

        const result = await navigateAndAnalyze(page, menu.texto, menuIndex);
        results.push(result);
        menuIndex++;

        // Volta para o dashboard/home entre as telas
        try {
          // Tenta clicar no logo ou link "home"
          const homeLink = page.locator('a[href="/"], a[href="/dashboard"], img[alt*="logo"]').first();
          if (await homeLink.isVisible({ timeout: 2000 })) {
            await homeLink.click();
            await page.waitForTimeout(1500);
          }
        } catch {
          // Se não achar, navega direto
          await page.goto(CONFIG.portalUrl, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
          await page.waitForTimeout(1500);
        }
      }
    } else {
      console.log('\n⚠️  Não consegui descobrir menus automaticamente.');
      console.log('  Tentando menus comuns de sistemas jurídicos...');

      const menusComuns = ['Clientes', 'Processos', 'Agenda', 'Cálculos', 'Financeiro', 'Imóveis', 'Documentos'];
      let menuIndex = 2;
      for (const menu of menusComuns) {
        const result = await navigateAndAnalyze(page, menu, menuIndex);
        results.push(result);
        menuIndex++;
        await page.goto(CONFIG.portalUrl, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
        await page.waitForTimeout(1000);
      }
    }

    // ── 5. Teste de fluxo (se solicitado) ──
    if (flowName) {
      const flowResult = await analyzeFlow(page, flowName);
      if (flowResult) {
        results.push({
          menu: `Fluxo: ${flowResult.descricao}`,
          slug: `flow_${flowName}`,
          success: true,
          analysis: {
            tela: `Fluxo: ${flowName}`,
            nota: null,
            descricao: flowResult.descricao,
            problemas: flowResult.steps.flatMap(s =>
              (s.analysis.obstaculos || []).map(o => ({
                severidade: s.analysis.dificuldade === 'impossivel' ? 'critica' : 'media',
                descricao: o,
                impacto: `Dificulta o fluxo de ${flowResult.descricao}`,
                sugestao: '',
              }))
            ),
            resumo: `Fluxo testado com ${flowResult.steps.length} passos`,
          },
        });
      }
    }

    // ── 6. Gerar relatório ──
    const reportPath = generateReport(results);

    // Resumo final no console
    console.log('\n═══════════════════════════════════════════');
    console.log('  📊 RESUMO DA AUDITORIA');
    console.log('═══════════════════════════════════════════');
    const sucesso = results.filter(r => r.success);
    const falha = results.filter(r => !r.success);
    console.log(`  Telas analisadas: ${sucesso.length}`);
    console.log(`  Telas não acessadas: ${falha.length}`);
    const notas = sucesso.filter(r => r.analysis && r.analysis.nota).map(r => r.analysis.nota);
    if (notas.length > 0) {
      console.log(`  Nota média: ${(notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1)}/10`);
      console.log(`  Pior tela: ${sucesso.find(r => r.analysis?.nota === Math.min(...notas))?.menu} (${Math.min(...notas)}/10)`);
      console.log(`  Melhor tela: ${sucesso.find(r => r.analysis?.nota === Math.max(...notas))?.menu} (${Math.max(...notas)}/10)`);
    }
    console.log(`\n  📄 Relatório: ${reportPath}`);
    console.log('═══════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n💥 Erro fatal:', err.message);
    await screenshot(page, 'ERRO_FATAL');
    throw err;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Falha na execução:', err);
  process.exit(1);
});
