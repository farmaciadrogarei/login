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
  App._editandoAgendId = null;
  const titulo = document.getElementById('formAgendTitle');
  if (titulo) titulo.textContent = 'Novo Agendamento';
}

/* Abre o formulário preenchido para EDITAR um agendamento existente */
function editarAgend(id) {
  const ag = App.agendamentos.find(a => a.id === id);
  if (!ag) return;

  App._editandoAgendId = id;

  // Mostrar campo de paciente (mesmo para o usuário, travado no próprio)
  const campoPaciente = document.getElementById('campoPacienteAgend');
  const isUsuario = App.currentUser && App.currentUser.role === 'usuario';
  if (campoPaciente) campoPaciente.style.display = isUsuario ? 'none' : '';

  popularSelectBenef('fAgendBenef');
  document.getElementById('fAgendBenef').value = ag.beneficiarioId || '';
  document.getElementById('fAgendData').value  = ag.data || '';
  document.getElementById('fAgendHora').value  = (ag.hora || '').slice(0,5);
  document.getElementById('fAgendObs').value   = ag.observacoes || '';
  document.getElementById('fAgendEsp').value   = ag.especialista || '';
  especialistaSelecionada = ag.especialista || '';

  // Marcar visualmente o card da especialidade
  document.querySelectorAll('.esp-select-card').forEach(c => {
    const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (norm(c.dataset.esp) === norm(ag.especialista)) c.classList.add('selected');
    else c.classList.remove('selected');
  });

  // Se o select de médico estiver visível, tenta selecionar o médico atual
  const selMed = document.getElementById('fAgendMedico');
  if (selMed && ag.medicoId) {
    selMed.value = ag.medicoId;
  }

  const titulo = document.getElementById('formAgendTitle');
  if (titulo) titulo.textContent = 'Editar Agendamento';

  document.getElementById('formAgendCard').style.display = '';
  document.getElementById('formAgendCard').scrollIntoView({ behavior: 'smooth' });
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
  const medicoId = document.getElementById('fAgendMedico') ? document.getElementById('fAgendMedico').value : '';

  if (!benefId || !data || !hora || !esp) {
    abrirModal('Campos obrigatórios', 'Preencha todos os campos obrigatórios.');
    return;
  }

  // Se a especialidade tem médicos cadastrados, exigir escolha do médico
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const temMedicos = (App.medicos || []).some(m => norm(m.especialidade) === norm(esp));
  if (temMedicos && !medicoId) {
    abrirModal('Selecione o médico', 'Escolha o médico para essa consulta.');
    return;
  }

  const obs = document.getElementById('fAgendObs').value.trim();

  const payload = {
    paciente_id:  benefId,
    medico_id:    medicoId || null,
    data,
    hora,
    especialista: esp,
    observacoes:  obs || null,
    status:       'Aguardando confirmação',
    criado_por:   App.currentUser.id,
  };

  const payloadCripto = await cripto('criptografar', 'agendamentos', payload);
  // Garantir campos que a criptografia pode remover
  payloadCripto.medico_id = medicoId || null;
  payloadCripto.paciente_id = benefId;

  // ── MODO EDIÇÃO ──
  if (App._editandoAgendId) {
    const editId = App._editandoAgendId;
    // Não sobrescreve criado_por nem status na edição
    delete payloadCripto.criado_por;
    delete payloadCripto.status;
    const { data: rowUpd, error: errUpd } = await db
      .from('agendamentos')
      .update(payloadCripto)
      .eq('id', editId)
      .select()
      .single();
    if (errUpd) { abrirModal('Erro', errUpd.message); return; }

    const rowDesc = await cripto('descriptografar', 'agendamentos', rowUpd);
    const idx = App.agendamentos.findIndex(a => a.id === editId);
    if (idx !== -1) App.agendamentos[idx] = mapAgendamento(rowDesc);

    App._editandoAgendId = null;
    atualizarContadores();
    fecharFormAgend();
    renderTabelaAgend();
    abrirModal('Agendamento atualizado', 'As alterações foram salvas com sucesso.');
    return;
  }

  // ── MODO CRIAÇÃO ──
  payloadCripto.criado_por = App.currentUser.id;
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

  // Notificar o médico por email
  if (medicoId) {
    try {
      const { data: sessaoAtual } = await db.auth.getSession();
      const token = sessaoAtual?.session?.access_token;
      await fetch(SUPABASE_URL + '/functions/v1/notificar-medico', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + token,
          'apikey':        SUPABASE_KEY,
        },
        body: JSON.stringify({
          medico_id:     medicoId,
          paciente_nome: benef ? benef.nome : 'Paciente',
          data,
          hora,
          especialista:  esp,
        }),
      });
    } catch(e) {
      console.warn('Notificação ao médico falhou:', e.message);
    }
  }
}

function renderTabelaAgend() {
  const empty   = document.getElementById('emptyAgend');
  const wrapper = document.getElementById('tableAgendWrapper');
  const tbody   = document.getElementById('tableAgendBody');

  const isUsuario = App.currentUser && App.currentUser.role === 'usuario';
  const isMedico  = App.currentUser && App.currentUser.role === 'medico';

  // Médico não pode criar agendamento (visão somente leitura)
  const btnNovo = document.getElementById('btnNovoAgend');
  if (btnNovo) btnNovo.style.display = isMedico ? 'none' : '';

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
          ${(App.currentUser.role === 'adm' || isUsuario)
            ? `<button class="btn btn-sm btn-warning" onclick="editarAgend('${a.id}')">✏️ Editar</button>
               <button class="btn btn-sm btn-danger" onclick="excluirAgend('${a.id}')">🗑️</button>`
            : '—'}
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

/* ═══════════════════════════════════════════════
   VIDEOCHAMADA DO MÉDICO
   O médico seleciona o PACIENTE agendado e liga pro WhatsApp dele
═══════════════════════════════════════════════ */
function popularSelectPacienteVideo() {
  const sel = document.getElementById('selectMedicoVideo');
  if (!sel) return;

  // Ajustar textos da tela para o contexto do médico
  const label = document.querySelector('label[for="selectMedicoVideo"]');
  if (label) label.innerHTML = '👤 Selecionar Paciente *';
  const subtitulo = document.querySelector('#page-video .video-hero-card > p');
  if (subtitulo) subtitulo.textContent = 'Selecione o paciente agendado e inicie a videochamada pelo WhatsApp dele.';

  sel.innerHTML = '<option value="">-- Selecione um paciente --</option>';

  // Listar agendamentos do médico ordenados por data
  const ags = [...App.agendamentos].sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  ags.forEach(a => {
    const benef = App.beneficiarios.find(b => b.id === a.beneficiarioId);
    if (!benef) return;
    const opt = document.createElement('option');
    opt.value = a.id; // valor = id do agendamento
    const proto = formatarProtocolo(benef.protocolo);
    opt.textContent = `Protocolo ${proto} – ${benef.nome} – ${formatarData(a.data)} ${a.hora || ''}`;
    sel.appendChild(opt);
  });

  // Reset do botão/hint
  const btn  = document.getElementById('btnIniciarWhatsApp');
  const hint = document.getElementById('medicoHint');
  const info = document.getElementById('medicoSelectedInfo');
  if (btn)  btn.disabled = true;
  if (hint) { hint.innerHTML = '⚠️ Selecione um paciente para habilitar a videochamada'; hint.style.display = ''; }
  if (info) info.style.display = 'none';
}

function verificarVideoPacienteMedico(agendId) {
  const btn  = document.getElementById('btnIniciarWhatsApp');
  const hint = document.getElementById('medicoHint');
  const info = document.getElementById('medicoSelectedInfo');

  if (!agendId) {
    btn.disabled = true;
    hint.innerHTML = '⚠️ Selecione um paciente para habilitar a videochamada';
    hint.style.display = '';
    info.style.display = 'none';
    return;
  }

  const ag = App.agendamentos.find(a => a.id === agendId);
  if (!ag) return;
  const benef = App.beneficiarios.find(b => b.id === ag.beneficiarioId);
  if (!benef) return;

  info.style.display = '';
  const hoje = new Date().toISOString().slice(0, 10);

  if (ag.data === hoje) {
    // Janela de horário: a partir do horário marcado até 2h depois
    const agora = new Date();
    const [hh, mm] = (ag.hora || '00:00').split(':').map(Number);
    const inicio = new Date(); inicio.setHours(hh, mm, 0, 0);
    const fim = new Date(inicio.getTime() + 120 * 60000);
    const dentro = agora >= inicio && agora <= fim;

    if (dentro) {
      btn.disabled = false;
      hint.style.display = 'none';
      const waNum = montarNumeroWhats(benef.telefone);
      info.innerHTML = `✅ <strong>${benef.nome}</strong> – Consulta hoje às <strong>${ag.hora || ''}</strong><br>📱 WhatsApp: +${waNum}`;
    } else {
      btn.disabled = true;
      hint.style.display = '';
      if (agora < inicio) {
        hint.innerHTML = `⏰ Videochamada libera às <strong>${ag.hora}</strong> – aguarde o horário da consulta.`;
      } else {
        hint.innerHTML = `⌛ O horário desta consulta já encerrou.`;
      }
      info.innerHTML = `📅 <strong>${benef.nome}</strong> – Consulta hoje às <strong>${ag.hora || ''}</strong>`;
    }
  } else {
    // Não é hoje
    btn.disabled = true;
    hint.style.display = '';
    if (ag.data > hoje) {
      hint.innerHTML = `📅 Consulta de <strong>${benef.nome}</strong> agendada para <strong>${formatarData(ag.data)}</strong> às ${ag.hora || ''}. A videochamada libera no dia.`;
    } else {
      hint.innerHTML = `ℹ️ Esta consulta de ${benef.nome} foi em ${formatarData(ag.data)}.`;
    }
    info.innerHTML = `👤 <strong>${benef.nome}</strong> – ${formatarData(ag.data)} ${ag.hora || ''}`;
  }
}

/* Monta o número do WhatsApp no padrão 55+DDD+numero (só dígitos) */
function montarNumeroWhats(telefone) {
  let num = (telefone || '').replace(/\D/g, '');
  num = num.replace(/^0+/, '');
  if (num.length === 10 || num.length === 11) {
    num = '55' + num;
  } else if (num.length === 12 && num.startsWith('55')) {
    // mantém
  } else if (num.length === 13 && num.startsWith('55')) {
    // mantém
  } else if (!num.startsWith('55')) {
    num = '55' + num;
  }
  return num;
}

/* Abre o WhatsApp do PACIENTE selecionado (chamado pelo botão quando é médico) */
function iniciarVideoComoPacienteAlvo() {
  const sel = document.getElementById('selectMedicoVideo');
  const agendId = sel.value;
  if (!agendId) return;
  const ag = App.agendamentos.find(a => a.id === agendId);
  if (!ag) return;
  const benef = App.beneficiarios.find(b => b.id === ag.beneficiarioId);
  if (!benef || !benef.telefone) {
    abrirModal('Telefone não encontrado', 'Este paciente não tem telefone cadastrado.');
    return;
  }
  const num = montarNumeroWhats(benef.telefone);
  window.open(`https://wa.me/${num}`, '_blank');
}
