'use strict';

/* AGENDAMENTOS
═══════════════════════════════════════════════ */
let especialistaSelecionada = '';

function abrirFormAgend(benefId = null) {
  if (App.beneficiarios.length === 0) {
    abrirModal('Atenção', 'Cadastre ao menos um beneficiário antes de agendar.');
    return;
  }
  popularSelectBenef('fAgendBenef');
  if (benefId) {
    document.getElementById('fAgendBenef').value = benefId;
  }
  document.getElementById('fAgendData').value = '';
  document.getElementById('fAgendHora').value = '';
  document.getElementById('fAgendObs').value  = '';
  document.getElementById('fAgendEsp').value  = '';
  especialistaSelecionada = '';
  document.querySelectorAll('.esp-select-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('formAgendCard').style.display = '';
  document.getElementById('formAgendCard').scrollIntoView({ behavior: 'smooth' });
}

function fecharFormAgend() {
  document.getElementById('formAgendCard').style.display = 'none';
}

function iniciarAgendamentoPara(benefId) {
  navegar('agendamentos');
  setTimeout(() => abrirFormAgend(benefId), 100);
}

async function salvarAgendamento() {
  const benefId = document.getElementById('fAgendBenef').value;
  const data    = document.getElementById('fAgendData').value;
  const hora    = document.getElementById('fAgendHora').value;
  const esp     = document.getElementById('fAgendEsp').value || especialistaSelecionada;

  if (!benefId || !data || !hora || !esp) {
    abrirModal('Campos obrigatórios', 'Preencha todos os campos obrigatórios.');
    return;
  }

  const obs = document.getElementById('fAgendObs').value.trim();

  const payload = {
    paciente_id:  benefId,
    data,
    hora,
    especialista: esp,
    observacoes:  obs || null,
    status:       'Aguardando confirmação',
    criado_por:   App.currentUser.id,
  };

  const payloadCripto = await cripto('criptografar', 'agendamentos', payload);
  const { data: row, error } = await db.from('agendamentos').insert(payloadCripto).select().single();
  if (error) { abrirModal('Erro', error.message); return; }

  const rowDesc = await cripto('descriptografar', 'agendamentos', row);
  App.agendamentos.unshift(mapAgendamento(rowDesc));
  atualizarContadores();
  fecharFormAgend();
  renderTabelaAgend();

  const benef = App.beneficiarios.find(b => b.id === benefId);
  document.getElementById('confirmacaoAgend').style.display = '';
  document.getElementById('confirmaNome').textContent = benef ? benef.nome : '';
  document.getElementById('confirmaData').textContent = formatarData(data);
  document.getElementById('confirmaHora').textContent = hora;
  document.getElementById('confirmaEsp').textContent  = esp;
}

function renderTabelaAgend() {
  const empty   = document.getElementById('emptyAgend');
  const wrapper = document.getElementById('tableAgendWrapper');
  const tbody   = document.getElementById('tableAgendBody');

  if (App.agendamentos.length === 0) {
    empty.style.display   = '';
    wrapper.style.display = 'none';
    return;
  }
  empty.style.display   = 'none';
  wrapper.style.display = '';
  tbody.innerHTML = App.agendamentos.map(a => {
    const benef = App.beneficiarios.find(b => b.id === a.beneficiarioId);
    const statusClass = {
      'Aguardando confirmação': 'warning',
      'Confirmado':  'success',
      'Realizado':   'info',
      'Cancelado':   'danger',
    }[a.status] || 'secondary';
    return `
      <tr>
        <td data-label="Protocolo">${formatarProtocolo(a.seq)}</td>
        <td data-label="Paciente">${benef ? benef.nome : '—'}</td>
        <td data-label="Data">${formatarData(a.data)}</td>
        <td data-label="Hora">${a.hora}</td>
        <td data-label="Especialista">${a.especialista}</td>
        <td data-label="Status"><span class="badge badge-${statusClass}">${a.status}</span></td>
        <td class="td-actions">
          ${App.currentUser.role === 'adm'
            ? `<button class="btn btn-sm btn-danger" onclick="excluirAgend('${a.id}')">🗑️</button>`
            : ''}
        </td>
      </tr>`;
  }).join('');
}

async function excluirAgend(id) {
  const a = App.agendamentos.find(x => x.id === id);
  const benef = App.beneficiarios.find(b => b.id === a.beneficiarioId);
  abrirModal('Excluir agendamento',
    `Excluir agendamento de <strong>${benef ? benef.nome : ''}</strong> em ${formatarData(a.data)}?`,
    { confirm: true, onOk: async () => {
      const { error } = await db.from('agendamentos').delete().eq('id', id);
      if (error) { abrirModal('Erro', error.message); return; }
      App.agendamentos = App.agendamentos.filter(x => x.id !== id);
      atualizarContadores();
      renderTabelaAgend();
    }});
}

