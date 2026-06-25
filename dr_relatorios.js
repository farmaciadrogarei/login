'use strict';

// ════════════════════════════════════════════════════
//  FARMÁCIA DROGA REI – Relatórios de Consultas (ADM)
// ════════════════════════════════════════════════════

/* Abre o modal de relatórios — só ADM chama essa função */
async function abrirRelatorios() {
  if (!App.currentUser || App.currentUser.role !== 'adm') return;

  // Cria overlay se não existir
  let overlay = document.getElementById('relOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'relOverlay';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9999;
      display:flex;align-items:flex-start;justify-content:center;
      overflow-y:auto;padding:20px 12px 40px;
    `;
    overlay.innerHTML = `
      <div id="relModal" style="
        background:var(--surface,#0d1b2a);border:1px solid var(--border,#1e3a5f);
        border-radius:16px;width:100%;max-width:860px;padding:28px 24px;
        box-shadow:0 8px 40px rgba(0,0,0,.6);position:relative;
      ">
        <button onclick="fecharRelatorios()" style="
          position:absolute;top:14px;right:16px;background:none;border:none;
          color:var(--gray-400,#94a3b8);font-size:22px;cursor:pointer;line-height:1;
        " aria-label="Fechar">✕</button>

        <h2 style="margin:0 0 4px;font-size:20px;color:var(--primary,#3b82f6);">
          📊 Relatórios de Consultas
        </h2>
        <p style="margin:0 0 20px;font-size:13px;color:var(--gray-400,#94a3b8);">
          Visão geral dos agendamentos — acesso exclusivo ADM
        </p>

        <!-- Filtro de período -->
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:22px;">
          <div>
            <label style="display:block;font-size:12px;color:var(--gray-400,#94a3b8);margin-bottom:4px;">De</label>
            <input type="date" id="relDe" style="
              background:var(--bg,#041030);border:1px solid var(--border,#1e3a5f);
              color:var(--text,#e2e8f0);border-radius:8px;padding:7px 10px;font-size:14px;
            "/>
          </div>
          <div>
            <label style="display:block;font-size:12px;color:var(--gray-400,#94a3b8);margin-bottom:4px;">Até</label>
            <input type="date" id="relAte" style="
              background:var(--bg,#041030);border:1px solid var(--border,#1e3a5f);
              color:var(--text,#e2e8f0);border-radius:8px;padding:7px 10px;font-size:14px;
            "/>
          </div>
          <button onclick="gerarRelatorio()" class="btn btn-primary" style="padding:7px 18px;font-size:14px;">
            🔍 Gerar
          </button>
          <button onclick="exportarRelatorioCSV()" class="btn btn-outline" style="padding:7px 14px;font-size:14px;">
            ⬇️ Exportar CSV
          </button>
        </div>

        <!-- Cards de totais -->
        <div id="relCards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px;"></div>

        <!-- Seções de tabelas -->
        <div id="relSecoes"></div>

        <div id="relLoading" style="text-align:center;padding:40px;display:none;">
          <div style="font-size:32px;margin-bottom:10px;">⏳</div>
          <p style="color:var(--gray-400,#94a3b8);">Carregando dados…</p>
        </div>
        <div id="relVazio" style="text-align:center;padding:40px;display:none;">
          <div style="font-size:40px;margin-bottom:10px;">📭</div>
          <p style="color:var(--gray-400,#94a3b8);">Nenhum agendamento encontrado no período.</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Fechar clicando fora do modal
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) fecharRelatorios();
    });
  } else {
    overlay.style.display = 'flex';
  }

  // Pré-preencher período: mês atual
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  document.getElementById('relDe').value  = _isoDate(inicio);
  document.getElementById('relAte').value = _isoDate(hoje);

  await gerarRelatorio();
}

function fecharRelatorios() {
  const overlay = document.getElementById('relOverlay');
  if (overlay) overlay.style.display = 'none';
}

/* ── Gera o relatório com base no período selecionado ── */
async function gerarRelatorio() {
  const de  = document.getElementById('relDe').value;
  const ate = document.getElementById('relAte').value;

  const cards   = document.getElementById('relCards');
  const secoes  = document.getElementById('relSecoes');
  const loading = document.getElementById('relLoading');
  const vazio   = document.getElementById('relVazio');

  cards.innerHTML  = '';
  secoes.innerHTML = '';
  vazio.style.display   = 'none';
  loading.style.display = '';

  try {
    // Buscar agendamentos no período
    let query = db.from('agendamentos').select('*').order('data', { ascending: false });
    if (de)  query = query.gte('data', de);
    if (ate) query = query.lte('data', ate);

    const { data: raw, error } = await query;
    if (error) throw error;

    loading.style.display = 'none';

    if (!raw || raw.length === 0) {
      vazio.style.display = '';
      return;
    }

    // Descriptografar se necessário
    let dados = raw;
    try { dados = await cripto('descriptografar', 'agendamentos', raw); } catch(e) { dados = raw; }

    _renderRelatorio(dados);

  } catch(e) {
    loading.style.display = 'none';
    console.error('Erro relatório:', e);
    document.getElementById('relSecoes').innerHTML = `
      <div style="color:#ef4444;text-align:center;padding:20px;">
        ⚠️ Erro ao carregar dados: ${e.message || 'verifique sua conexão.'}
      </div>`;
  }
}

/* ── Processa e renderiza os dados ── */
function _renderRelatorio(dados) {
  const cards  = document.getElementById('relCards');
  const secoes = document.getElementById('relSecoes');

  // ── 1. Totais por status ──────────────────────────────
  const statusMap = {};
  dados.forEach(a => {
    const s = a.status || 'Sem status';
    statusMap[s] = (statusMap[s] || 0) + 1;
  });

  // ── 2. Por médico ─────────────────────────────────────
  const medicoMap = {};
  dados.forEach(a => {
    const medId = a.medico_id || 'desconhecido';
    const med   = App.medicos.find(m => m.id === medId);
    const nome  = med ? med.nome : 'Médico não encontrado';
    if (!medicoMap[nome]) medicoMap[nome] = { total: 0, status: {} };
    medicoMap[nome].total++;
    const s = a.status || 'Sem status';
    medicoMap[nome].status[s] = (medicoMap[nome].status[s] || 0) + 1;
  });

  // ── 3. Por especialidade ──────────────────────────────
  const espMap = {};
  dados.forEach(a => {
    const esp = a.especialista || a.especialidade || 'Não informada';
    espMap[esp] = (espMap[esp] || 0) + 1;
  });

  // ── 4. Por período (por mês) ──────────────────────────
  const mesMap = {};
  dados.forEach(a => {
    if (!a.data) return;
    const [y, m] = a.data.split('-');
    const chave  = `${y}-${m}`;
    mesMap[chave] = (mesMap[chave] || 0) + 1;
  });

  // ── CARDS DE RESUMO ───────────────────────────────────
  const statusColors = {
    'Aguardando confirmação': '#f59e0b',
    'Confirmado':             '#22c55e',
    'Realizado':              '#3b82f6',
    'Cancelado':              '#ef4444',
    'Reagendado':             '#a78bfa',
  };

  const cardTotal = _criarCard('Total de Consultas', dados.length, '📋', '#3b82f6');
  cards.innerHTML = cardTotal;
  Object.entries(statusMap).forEach(([s, n]) => {
    cards.innerHTML += _criarCard(s, n, _iconeStatus(s), statusColors[s] || '#94a3b8');
  });

  // ── SEÇÃO: Por Médico ─────────────────────────────────
  let htmlMedico = `<table style="${_estiloTabela()}">
    <thead><tr>
      <th style="${_estiloCabec()}">Médico</th>
      <th style="${_estiloCabec()}">Total</th>
      <th style="${_estiloCabec()}">Detalhes por Status</th>
    </tr></thead><tbody>`;

  Object.entries(medicoMap)
    .sort((a,b) => b[1].total - a[1].total)
    .forEach(([nome, info]) => {
      const detalhe = Object.entries(info.status)
        .map(([s, n]) => `<span style="
          background:${statusColors[s] || '#334155'}22;
          color:${statusColors[s] || '#94a3b8'};
          border:1px solid ${statusColors[s] || '#94a3b8'}44;
          border-radius:12px;padding:2px 8px;font-size:12px;margin:2px;display:inline-block;
        ">${s}: ${n}</span>`).join('');

      htmlMedico += `<tr>
        <td style="${_estiloCell()}">${nome}</td>
        <td style="${_estiloCell()};text-align:center;font-weight:700;color:#3b82f6;">${info.total}</td>
        <td style="${_estiloCell()}">${detalhe}</td>
      </tr>`;
    });
  htmlMedico += '</tbody></table>';

  // ── SEÇÃO: Por Especialidade ──────────────────────────
  let htmlEsp = `<table style="${_estiloTabela()}">
    <thead><tr>
      <th style="${_estiloCabec()}">Especialidade</th>
      <th style="${_estiloCabec()}">Qtd</th>
      <th style="${_estiloCabec()}">% do total</th>
    </tr></thead><tbody>`;

  Object.entries(espMap)
    .sort((a,b) => b[1] - a[1])
    .forEach(([esp, n]) => {
      const pct = ((n / dados.length) * 100).toFixed(1);
      htmlEsp += `<tr>
        <td style="${_estiloCell()}">${esp}</td>
        <td style="${_estiloCell()};text-align:center;font-weight:700;">${n}</td>
        <td style="${_estiloCell()}">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;background:#1e3a5f;border-radius:4px;height:8px;">
              <div style="width:${pct}%;background:#3b82f6;height:8px;border-radius:4px;"></div>
            </div>
            <span style="font-size:12px;color:#94a3b8;min-width:36px;">${pct}%</span>
          </div>
        </td>
      </tr>`;
    });
  htmlEsp += '</tbody></table>';

  // ── SEÇÃO: Por Mês ────────────────────────────────────
  let htmlMes = `<table style="${_estiloTabela()}">
    <thead><tr>
      <th style="${_estiloCabec()}">Mês / Ano</th>
      <th style="${_estiloCabec()}">Consultas</th>
    </tr></thead><tbody>`;

  Object.entries(mesMap)
    .sort((a,b) => b[0].localeCompare(a[0]))
    .forEach(([mes, n]) => {
      const [y, m] = mes.split('-');
      const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      htmlMes += `<tr>
        <td style="${_estiloCell()}">${nomes[+m-1]} / ${y}</td>
        <td style="${_estiloCell()};text-align:center;font-weight:700;">${n}</td>
      </tr>`;
    });
  htmlMes += '</tbody></table>';

  // ── SEÇÃO: Lista Completa ─────────────────────────────
  let htmlLista = `<table style="${_estiloTabela()}">
    <thead><tr>
      <th style="${_estiloCabec()}">#</th>
      <th style="${_estiloCabec()}">Data</th>
      <th style="${_estiloCabec()}">Hora</th>
      <th style="${_estiloCabec()}">Paciente</th>
      <th style="${_estiloCabec()}">Médico</th>
      <th style="${_estiloCabec()}">Especialidade</th>
      <th style="${_estiloCabec()}">Status</th>
    </tr></thead><tbody>`;

  dados.forEach(a => {
    const med = App.medicos.find(m => m.id === a.medico_id);
    const pac = App.beneficiarios.find(p => p.id === a.paciente_id);
    const cor = statusColors[a.status] || '#94a3b8';
    htmlLista += `<tr>
      <td style="${_estiloCell()};color:#64748b;">${a.seq || ''}</td>
      <td style="${_estiloCell()}">${formatarData(a.data)}</td>
      <td style="${_estiloCell()}">${a.hora || ''}</td>
      <td style="${_estiloCell()}">${pac ? pac.nome : '—'}</td>
      <td style="${_estiloCell()}">${med ? med.nome : '—'}</td>
      <td style="${_estiloCell()}">${a.especialista || a.especialidade || '—'}</td>
      <td style="${_estiloCell()}">
        <span style="
          background:${cor}22;color:${cor};border:1px solid ${cor}44;
          border-radius:12px;padding:2px 10px;font-size:12px;white-space:nowrap;
        ">${a.status || '—'}</span>
      </td>
    </tr>`;
  });
  htmlLista += '</tbody></table>';

  // ── MONTAR TODAS AS SEÇÕES ────────────────────────────
  secoes.innerHTML = `
    ${_secao('👨‍⚕️ Consultas por Médico', htmlMedico)}
    ${_secao('🏥 Consultas por Especialidade', htmlEsp)}
    ${_secao('📅 Consultas por Mês', htmlMes)}
    ${_secao('📋 Lista Completa', htmlLista)}
  `;

  // Guardar dados para exportar CSV
  window._relDados = dados;
}

/* ── Exportar CSV ── */
function exportarRelatorioCSV() {
  const dados = window._relDados;
  if (!dados || dados.length === 0) {
    alert('Gere o relatório primeiro.');
    return;
  }

  const linhas = [
    ['Seq','Data','Hora','Paciente ID','Médico ID','Especialidade','Status','Criado em'].join(';')
  ];
  dados.forEach(a => {
    const med = App.medicos.find(m => m.id === a.medico_id);
    const pac = App.beneficiarios.find(p => p.id === a.paciente_id);
    linhas.push([
      a.seq || '',
      a.data || '',
      a.hora || '',
      pac ? pac.nome : (a.paciente_id || ''),
      med ? med.nome : (a.medico_id || ''),
      a.especialista || a.especialidade || '',
      a.status || '',
      a.criado_em ? formatarDataHora(a.criado_em) : '',
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(';'));
  });

  const bom  = '\uFEFF';
  const blob = new Blob([bom + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `relatorio_consultas_${_isoDate(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Helpers de estilo ── */
function _criarCard(label, valor, icone, cor) {
  return `<div style="
    background:${cor}18;border:1px solid ${cor}44;border-radius:12px;
    padding:16px 14px;text-align:center;
  ">
    <div style="font-size:26px;margin-bottom:6px;">${icone}</div>
    <div style="font-size:24px;font-weight:800;color:${cor};">${valor}</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:4px;">${label}</div>
  </div>`;
}

function _iconeStatus(s) {
  const m = {
    'Aguardando confirmação': '⏳',
    'Confirmado':             '✅',
    'Realizado':              '🎯',
    'Cancelado':              '❌',
    'Reagendado':             '🔄',
  };
  return m[s] || '📌';
}

function _secao(titulo, conteudo) {
  return `
    <div style="margin-bottom:28px;">
      <h3 style="
        font-size:15px;font-weight:700;color:var(--text,#e2e8f0);
        margin:0 0 12px;padding-bottom:8px;
        border-bottom:1px solid var(--border,#1e3a5f);
      ">${titulo}</h3>
      <div style="overflow-x:auto;">${conteudo}</div>
    </div>`;
}

function _estiloTabela() {
  return 'width:100%;border-collapse:collapse;font-size:13px;min-width:400px;';
}
function _estiloCabec() {
  return 'padding:9px 12px;text-align:left;font-size:12px;font-weight:600;color:#94a3b8;border-bottom:1px solid #1e3a5f;white-space:nowrap;';
}
function _estiloCell() {
  return 'padding:9px 12px;border-bottom:1px solid #0f2340;color:var(--text,#e2e8f0);vertical-align:middle;';
}
function _isoDate(d) {
  return d.toISOString().split('T')[0];
}
