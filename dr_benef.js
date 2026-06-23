'use strict';

/* BENEFICIÁRIOS (pacientes)
═══════════════════════════════════════════════ */
function abrirFormBenef(benefId = null) {
  App.editingBenefId = benefId;
  document.getElementById('formBenefTitle').textContent = benefId ? 'Editar Beneficiário' : 'Novo Beneficiário';
  document.getElementById('btnSalvarBenef').style.display  = benefId ? 'none' : '';
  document.getElementById('btnAlterarBenef').style.display = benefId ? '' : 'none';
  document.getElementById('btnExcluirBenef').style.display = (benefId && App.currentUser.role === 'adm') ? '' : 'none';

  limparFormBenef();
  const proto = document.getElementById('formProtocol');

  if (benefId) {
    const b = App.beneficiarios.find(x => x.id === benefId);
    if (!b) return;
    document.getElementById('fNome').value      = b.nome;
    document.getElementById('fCPF').value       = b.cpf;
    document.getElementById('fNascimento').value= b.nascimento;
    document.getElementById('fMae').value       = b.mae;
    document.getElementById('fPai').value       = b.pai || '';
    document.getElementById('fTelefone').value  = b.telefone;
    document.getElementById('fEmail').value     = b.email || '';
    document.getElementById('fCEP').value       = b.cep;
    document.getElementById('fEndereco').value  = b.endereco;
    document.getElementById('fNumero').value    = b.numero;
    document.getElementById('fBairro').value    = b.bairro;
    document.getElementById('fCidade').value    = b.cidade;
    document.getElementById('fEstado').value    = b.estado;
    proto.textContent = `Protocolo: ${formatarProtocolo(b.protocolo)}`;
  } else {
    proto.textContent = 'Protocolo: gerado automaticamente';
  }

  document.getElementById('formBenefCard').style.display = '';
  document.getElementById('formBenefCard').scrollIntoView({ behavior: 'smooth' });
}

function limparFormBenef() {
  ['fNome','fCPF','fNascimento','fMae','fPai','fTelefone','fEmail',
   'fCEP','fEndereco','fNumero','fBairro','fCidade','fEstado'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

function fecharFormBenef() {
  document.getElementById('formBenefCard').style.display = 'none';
  App.editingBenefId = null;
}

function validarFormBenef() {
  const campos = [
    { id: 'fNome',       label: 'Nome' },
    { id: 'fCPF',        label: 'CPF' },
    { id: 'fNascimento', label: 'Data de nascimento' },
    { id: 'fMae',        label: 'Nome da mãe' },
    { id: 'fTelefone',   label: 'Telefone' },
    { id: 'fCEP',        label: 'CEP' },
    { id: 'fEndereco',   label: 'Endereço' },
    { id: 'fNumero',     label: 'Número' },
    { id: 'fBairro',     label: 'Bairro' },
    { id: 'fCidade',     label: 'Cidade' },
    { id: 'fEstado',     label: 'Estado' },
  ];
  for (const c of campos) {
    if (!document.getElementById(c.id).value.trim()) {
      abrirModal('Campo obrigatório', `<strong>${c.label}</strong> é obrigatório.`);
      return false;
    }
  }
  return true;
}

async function salvarBenef() {
  if (!validarFormBenef()) return;

  const payload = {
    nome:       document.getElementById('fNome').value.trim(),
    cpf:        document.getElementById('fCPF').value.trim(),
    nascimento: document.getElementById('fNascimento').value,
    nome_mae:   document.getElementById('fMae').value.trim(),
    nome_pai:   document.getElementById('fPai').value.trim() || null,
    telefone:   document.getElementById('fTelefone').value.trim(),
    email:      document.getElementById('fEmail').value.trim() || null,
    cep:        document.getElementById('fCEP').value.trim(),
    endereco:   document.getElementById('fEndereco').value.trim(),
    numero:     document.getElementById('fNumero').value.trim(),
    bairro:     document.getElementById('fBairro').value.trim(),
    cidade:     document.getElementById('fCidade').value.trim(),
    estado:     document.getElementById('fEstado').value.trim().toUpperCase(),
    criado_por: App.currentUser.id,
    user_id:    App.currentUser.id,
  };

  const payloadCripto = await cripto('criptografar', 'pacientes', payload);
  // Garantir user_id e criado_por após a criptografia (a Edge Function pode removê-los)
  payloadCripto.user_id = App.currentUser.id;
  payloadCripto.criado_por = App.currentUser.id;
  const { data, error } = await db.from('pacientes').insert(payloadCripto).select().single();

  if (error) {
    abrirModal('Erro ao salvar', 'Não foi possível salvar o beneficiário.<br><small>' + error.message + '</small>');
    return;
  }

  const dataDesc = await cripto('descriptografar', 'pacientes', data);
  App.beneficiarios.push(mapPaciente(dataDesc));
  atualizarContadores();
  fecharFormBenef();
  renderTabelaBenef();
  popularSelectBenef('fAgendBenef');
  abrirModal('Beneficiário salvo', `Protocolo <strong>${formatarProtocolo(data.protocolo)}</strong> gerado com sucesso!`);
}

async function alterarBenef() {
  if (!validarFormBenef()) return;

  const payload = {
    nome:       document.getElementById('fNome').value.trim(),
    cpf:        document.getElementById('fCPF').value.trim(),
    nascimento: document.getElementById('fNascimento').value,
    nome_mae:   document.getElementById('fMae').value.trim(),
    nome_pai:   document.getElementById('fPai').value.trim() || null,
    telefone:   document.getElementById('fTelefone').value.trim(),
    email:      document.getElementById('fEmail').value.trim() || null,
    cep:        document.getElementById('fCEP').value.trim(),
    endereco:   document.getElementById('fEndereco').value.trim(),
    numero:     document.getElementById('fNumero').value.trim(),
    bairro:     document.getElementById('fBairro').value.trim(),
    cidade:     document.getElementById('fCidade').value.trim(),
    estado:     document.getElementById('fEstado').value.trim().toUpperCase(),
  };

  const payloadCripto = await cripto('criptografar', 'pacientes', payload);
  const { data, error } = await db
    .from('pacientes')
    .update(payloadCripto)
    .eq('id', App.editingBenefId)
    .select()
    .single();

  if (error) {
    abrirModal('Erro ao alterar', error.message);
    return;
  }

  const dataDesc = await cripto('descriptografar', 'pacientes', data);
  const idx = App.beneficiarios.findIndex(x => x.id === App.editingBenefId);
  if (idx !== -1) App.beneficiarios[idx] = mapPaciente(dataDesc);
  fecharFormBenef();
  renderTabelaBenef();
  abrirModal('Alterado', 'Beneficiário atualizado com sucesso.');
}

async function excluirBenef() {
  const b = App.beneficiarios.find(x => x.id === App.editingBenefId);
  if (!b) return;

  const agendsCom = App.agendamentos.filter(a => a.beneficiarioId === b.id).length;
  const anexosCom = App.anexos.filter(a => a.beneficiarioId === b.id).length;
  const aviso = (agendsCom || anexosCom)
    ? `<br><small>⚠️ ${agendsCom} agendamento(s) e ${anexosCom} anexo(s) também serão removidos.</small>`
    : '';

  abrirModal('Excluir beneficiário',
    `Confirma exclusão de <strong>${b.nome}</strong>?${aviso}`,
    { confirm: true, onOk: async () => {
      const { error } = await db.from('pacientes').delete().eq('id', b.id);
      if (error) { abrirModal('Erro', error.message); return; }
      App.beneficiarios = App.beneficiarios.filter(x => x.id !== b.id);
      App.agendamentos  = App.agendamentos.filter(a => a.beneficiarioId !== b.id);
      App.anexos        = App.anexos.filter(a => a.beneficiarioId !== b.id);
      atualizarContadores();
      fecharFormBenef();
      renderTabelaBenef();
    }});
}

function renderTabelaBenef() {
  const empty   = document.getElementById('emptyBenef');
  const wrapper = document.getElementById('tableBenefWrapper');
  const tbody   = document.getElementById('tableBenefBody');

  if (App.beneficiarios.length === 0) {
    empty.style.display   = '';
    wrapper.style.display = 'none';
    return;
  }
  empty.style.display   = 'none';
  wrapper.style.display = '';
  const isMedico = App.currentUser && App.currentUser.role === 'medico';
  tbody.innerHTML = App.beneficiarios.map(b => `
    <tr>
      <td data-label="Protocolo">${formatarProtocolo(b.protocolo)}</td>
      <td data-label="Nome">${b.nome}</td>
      <td data-label="CPF">${b.cpf}</td>
      <td data-label="Telefone">${b.telefone}</td>
      <td data-label="Cidade/UF">${[b.cidade, b.estado].filter(Boolean).join('/')}</td>
      <td class="td-actions">
        ${isMedico ? '—' : `
        <button class="btn btn-sm btn-warning" onclick="abrirFormBenef('${b.id}')">✏️ Editar</button>
        <button class="btn btn-sm btn-primary" onclick="iniciarAgendamentoPara('${b.id}')">📅 Agendar</button>
        <button class="btn btn-sm btn-danger" onclick="excluirBenefDireto('${b.id}')">🗑️</button>`}
      </td>
    </tr>`).join('');
}


function excluirBenefDireto(id) {
  const b = App.beneficiarios.find(x => x.id === id);
  if (!b) return;
  abrirModal('Excluir paciente',
    `Excluir <strong>${b.nome}</strong>? Esta ação não pode ser desfeita.`,
    { confirm: true, onOk: async () => {
      const { error } = await db.from('pacientes').delete().eq('id', id);
      if (error) { abrirModal('Erro', error.message); return; }
      App.beneficiarios = App.beneficiarios.filter(x => x.id !== id);
      atualizarContadores();
      renderTabelaBenef();
    }});
}

function popularSelectBenef(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- Selecione --</option>';
  App.beneficiarios
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.nome} (${formatarProtocolo(b.protocolo)})`;
      sel.appendChild(opt);
    });
  if (cur) sel.value = cur;
}

