'use strict';

/* MÉDICOS
═══════════════════════════════════════════════ */
function abrirFormMedico(medicoId = null) {
  App.editingMedicoId = medicoId;
  document.getElementById('formMedicoTitle').textContent = medicoId ? 'Editar Médico' : 'Novo Médico';
  document.getElementById('btnSalvarMedico').style.display  = medicoId ? 'none' : '';
  document.getElementById('btnAlterarMedico').style.display = medicoId ? '' : 'none';
  document.getElementById('btnExcluirMedico').style.display = medicoId ? '' : 'none';

  // Campos de login só aparecem ao CRIAR novo médico
  const emailField = document.getElementById('mEmail') ? document.getElementById('mEmail').closest('.field') : null;
  const senhaField = document.getElementById('campoSenhaMedico');
  const tituloAcesso = document.querySelector('#formMedicoCard h4');
  const mostrarLogin = !medicoId;
  if (emailField) emailField.style.display = mostrarLogin ? '' : 'none';
  if (senhaField) senhaField.style.display = mostrarLogin ? '' : 'none';
  if (tituloAcesso) tituloAcesso.parentElement.style.display = mostrarLogin ? '' : 'none';

  limparFormMedico();
  if (medicoId) {
    const m = App.medicos.find(x => x.id === medicoId);
    if (!m) return;
    document.getElementById('mNome').value         = m.nome;
    document.getElementById('mEspecialidade').value= m.especialidade;
    document.getElementById('mCRM').value          = m.crm;
    document.getElementById('mCodPais').value      = m.codPais;
    document.getElementById('mDDD').value          = m.ddd;
    document.getElementById('mWhatsApp').value     = m.whatsapp;
    atualizarPreviewTelefone();
  }

  document.getElementById('formMedicoCard').style.display = '';
  document.getElementById('formMedicoCard').scrollIntoView({ behavior: 'smooth' });
}

function limparFormMedico() {
  ['mNome','mEspecialidade','mCRM','mWhatsApp'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('mCodPais').value = '55';
  document.getElementById('mDDD').value     = '';
  document.getElementById('medicoPhonePreview').innerHTML = '';
}

function fecharFormMedico() {
  document.getElementById('formMedicoCard').style.display = 'none';
  App.editingMedicoId = null;
}

function atualizarPreviewTelefone() {
  const cod = document.getElementById('mCodPais').value;
  const ddd = document.getElementById('mDDD').value;
  const num = document.getElementById('mWhatsApp').value;
  const prev = document.getElementById('medicoPhonePreview');
  if (cod && ddd && num) {
    prev.innerHTML = `📱 +${cod} (${ddd}) ${num}`;
  } else {
    prev.innerHTML = '';
  }
}

function validarFormMedico() {
  const campos = ['mNome','mEspecialidade','mCRM','mCodPais','mDDD','mWhatsApp'];
  for (const id of campos) {
    if (!document.getElementById(id).value.trim()) {
      abrirModal('Campo obrigatório', `O campo <strong>${id.replace('m','')}</strong> é obrigatório.`);
      return false;
    }
  }
  return true;
}

async function salvarMedico() {
  if (!validarFormMedico()) return;

  const email = document.getElementById('mEmail').value.trim().toLowerCase();
  const senha = document.getElementById('mSenha').value;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    abrirModal('E-mail inválido', 'Informe um e-mail válido para o login do médico.');
    return;
  }
  if (!senha || senha.length < 6) {
    abrirModal('Senha inválida', 'A senha de acesso deve ter ao menos 6 caracteres.');
    return;
  }

  // 1. Guardar sessão atual do ADM para restaurar depois
  const { data: sessaoAdm } = await db.auth.getSession();

  // 2. Criar a conta de login do médico (isso troca a sessão temporariamente)
  const { data: signupData, error: signupErr } = await db.auth.signUp({ email, password: senha });
  if (signupErr) {
    abrirModal('Erro ao criar login', traduzirErroAuth ? traduzirErroAuth(signupErr) : signupErr.message);
    return;
  }
  const medicoUserId = signupData.user ? signupData.user.id : null;

  // 3. Restaurar a sessão do ADM imediatamente
  if (sessaoAdm && sessaoAdm.session) {
    await db.auth.setSession({
      access_token:  sessaoAdm.session.access_token,
      refresh_token: sessaoAdm.session.refresh_token,
    });
  }

  // 4. Salvar o médico na tabela
  const payload = {
    nome:          document.getElementById('mNome').value.trim(),
    especialidade: document.getElementById('mEspecialidade').value.trim(),
    crm:           document.getElementById('mCRM').value.trim(),
    cod_pais:      document.getElementById('mCodPais').value.trim(),
    ddd:           document.getElementById('mDDD').value.trim(),
    whatsapp:      document.getElementById('mWhatsApp').value.trim(),
    criado_por:    App.currentUser.id,
  };
  const payloadCripto = await cripto('criptografar', 'medicos', payload);
  payloadCripto.email = email;
  payloadCripto.user_id = medicoUserId;
  payloadCripto.criado_por = App.currentUser.id;
  const { data, error } = await db.from('medicos').insert(payloadCripto).select().single();
  if (error) { abrirModal('Erro', error.message); return; }

  // 5. Criar o perfil do médico com role 'medico' ligado ao medico_id
  if (medicoUserId && data) {
    await db.from('perfis').upsert({
      id:        medicoUserId,
      email:     email,
      role:      'medico',
      nome:      payload.nome,
      medico_id: data.id,
    });
  }

  const dataDesc = await cripto('descriptografar', 'medicos', data);
  App.medicos.push(mapMedico(dataDesc));
  atualizarContadores();
  fecharFormMedico();
  renderTabelaMedicos();
  popularSelectMedicoVideo();
  abrirModal('Médico salvo', `Dr(a). <strong>${payload.nome}</strong> cadastrado com sucesso.<br>Login: <strong>${email}</strong>`);
}

async function alterarMedico() {
  if (!validarFormMedico()) return;
  const payload = {
    nome:          document.getElementById('mNome').value.trim(),
    especialidade: document.getElementById('mEspecialidade').value.trim(),
    crm:           document.getElementById('mCRM').value.trim(),
    cod_pais:      document.getElementById('mCodPais').value.trim(),
    ddd:           document.getElementById('mDDD').value.trim(),
    whatsapp:      document.getElementById('mWhatsApp').value.trim(),
  };
  const payloadCripto = await cripto('criptografar', 'medicos', payload);
  const { data, error } = await db.from('medicos').update(payloadCripto).eq('id', App.editingMedicoId).select().single();
  if (error) { abrirModal('Erro', error.message); return; }
  const dataDesc = await cripto('descriptografar', 'medicos', data);
  const idx = App.medicos.findIndex(x => x.id === App.editingMedicoId);
  if (idx !== -1) App.medicos[idx] = mapMedico(dataDesc);
  fecharFormMedico();
  renderTabelaMedicos();
  popularSelectMedicoVideo();
  abrirModal('Alterado', 'Médico atualizado com sucesso.');
}

async function excluirMedico() {
  const m = App.medicos.find(x => x.id === App.editingMedicoId);
  if (!m) return;
  abrirModal('Excluir médico', `Excluir Dr(a). <strong>${m.nome}</strong>?`,
    { confirm: true, onOk: async () => {
      const { error } = await db.from('medicos').delete().eq('id', m.id);
      if (error) { abrirModal('Erro', error.message); return; }
      App.medicos = App.medicos.filter(x => x.id !== m.id);
      atualizarContadores();
      fecharFormMedico();
      renderTabelaMedicos();
    }});
}

function renderTabelaMedicos() {
  const empty   = document.getElementById('emptyMedicos');
  const wrapper = document.getElementById('tableMedicosWrapper');
  const tbody   = document.getElementById('tableMedicosBody');

  if (App.medicos.length === 0) {
    empty.style.display   = '';
    wrapper.style.display = 'none';
    return;
  }
  empty.style.display   = 'none';
  wrapper.style.display = '';
  tbody.innerHTML = App.medicos.map(m => `
    <tr>
      <td data-label="Protocolo">${formatarProtocolo(m.seq)}</td>
      <td data-label="Nome">${m.nome}</td>
      <td data-label="Especialidade">${m.especialidade}</td>
      <td data-label="CRM">${m.crm}</td>
      <td data-label="WhatsApp">+${m.codPais} (${m.ddd}) ${m.whatsapp}</td>
      <td class="td-actions">
        ${App.currentUser.role === 'adm'
          ? `<button class="btn btn-sm btn-warning" onclick="abrirFormMedico('${m.id}')">✏️ Editar</button>`
          : '—'}
      </td>
    </tr>`).join('');
}

function popularSelectMedicoVideo() {
  const sel = document.getElementById('selectMedicoVideo');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- Selecione --</option>';
  App.medicos.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `Dr(a). ${m.nome} – ${m.especialidade}`;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

