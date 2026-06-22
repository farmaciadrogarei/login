'use strict';

/* AGENDAMENTOS
═══════════════════════════════════════════════ */
let especialistaSelecionada = '';

function abrirFormAgend(benefId = null) {
  if (App.beneficiarios.length === 0) {
    abrirModal('Atenção', 'Cadastre ao menos um paciente antes de agendar.');
    return;
  }
  const campoPaciente = document.getElementById('campoPacienteAgend');
  if (campoPaciente) campoPaciente.style.display = '';
  popularSelectBenef('fAgendBenef');
  if (benefId) document.getElementById('fAgendBenef').value = benefId;
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

  const isUsuario = App.currentUser && App.currentUser.role === 'usuario';

  // Ocultar botão de novo agendamento apenas se não for usuario nem adm/colab
  const btnNovo = document.getElementById('btnNovoAgend');
  if (btnNovo) btnNovo.style.display = '';

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
        ${!isUsuario ? `<td data-label="Paciente">${benef ? benef.nome : '—'}</td>` : ''}
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


/* ═══════════════════════════════════════════════
   VERIFICAÇÃO DE AGENDAMENTO PARA HOJE
═══════════════════════════════════════════════ */
function verificarAgendamentoHoje(medicoId) {
  const btn  = document.getElementById('btnIniciarWhatsApp');
  const hint = document.getElementById('medicoHint');
  const info = document.getElementById('medicoSelectedInfo');

  if (!medicoId) {
    btn.disabled = true;
    hint.innerHTML = '⚠️ Selecione um médico para habilitar a videochamada';
    hint.style.display = '';
    info.style.display = 'none';
    return;
  }

  const m = App.medicos.find(x => x.id === medicoId);
  if (!m) return;

  // Data de hoje no formato YYYY-MM-DD (mesmo formato do Supabase)
  const hoje = new Date().toISOString().slice(0, 10);

  // Buscar agendamento de hoje com esse médico (via especialidade)
  const agendHoje = App.agendamentos.find(a =>
    a.data === hoje && 
    (a.especialista === m.especialidade || a.medico_id === medicoId)
  );

  info.style.display = '';

  if (agendHoje) {
    // Verificar se está dentro da janela de horário (30min antes até 2h depois)
    const agora = new Date();
    const [hh, mm] = (agendHoje.hora || '00:00').split(':').map(Number);
    const inicioConsulta = new Date();
    inicioConsulta.setHours(hh, mm, 0, 0);
    const fechamento = new Date(inicioConsulta.getTime() + 120 * 60000);
    const dentroDoHorario = agora >= inicioConsulta && agora <= fechamento;

    const benef = App.beneficiarios ? App.beneficiarios.find(b => b.id === agendHoje.beneficiario_id) : null;
    info.style.display = '';

    if (dentroDoHorario) {
      // ✅ Dia e horário corretos — libera
      btn.disabled = false;
      hint.style.display = 'none';
      info.innerHTML = `✅ Dr(a). <strong>${m.nome}</strong> – Consulta hoje às <strong>${agendHoje.hora || ''}</strong>${benef ? ' com ' + benef.nome : ''}`;
    } else {
      // ⏰ Dia certo mas fora do horário — bloqueia
      btn.disabled = true;
      hint.style.display = '';
      if (agora < inicioConsulta) {
        hint.innerHTML = `⏰ Videochamada libera às <strong>${agendHoje.hora}</strong> – aguarde o horário da sua consulta.`;
      } else {
        hint.innerHTML = `⌛ O horário desta consulta já encerrou.`;
      }
      info.innerHTML = `📅 Dr(a). <strong>${m.nome}</strong> – Consulta hoje às <strong>${agendHoje.hora || ''}</strong>`;
    }
  } else {
    // ❌ Sem agendamento hoje — bloqueia e mostra próxima consulta
    btn.disabled = true;
    hint.style.display = '';

    // Verificar se há agendamento futuro com esse médico
    const proximo = App.agendamentos
      .filter(a => a.data > hoje && (a.especialista === m.especialidade || a.medico_id === medicoId))
      .sort((a, b) => a.data.localeCompare(b.data))[0];

    if (proximo) {
      hint.innerHTML = `📅 Próxima consulta com Dr(a). ${m.nome}: <strong>${formatarData(proximo.data)}</strong> às ${proximo.hora || ''}`;
    } else {
      hint.innerHTML = `ℹ️ Nenhum agendamento para hoje com Dr(a). ${m.nome}`;
    }
    info.innerHTML = `👨‍⚕️ Dr(a). <strong>${m.nome}</strong> – ${m.especialidade} | CRM: ${m.crm}`;
  }
}
