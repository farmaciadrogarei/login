'use strict';

   COLABORADORES (ADM only)
═══════════════════════════════════════════════ */
async function abrirFormColab(colabId = null) {
  App.editingColabId = colabId;
  document.getElementById('formColabTitle').textContent = colabId ? 'Editar Colaborador' : 'Novo Colaborador';
  document.getElementById('btnSalvarColab').style.display  = colabId ? 'none' : '';
  document.getElementById('btnAlterarColab').style.display = colabId ? '' : 'none';

  limparFormColab();
  if (colabId) {
    const c = App.colaboradores.find(x => x.id === colabId);
    if (c) {
      document.getElementById('cEmail').value = c.email;
      document.getElementById('cSenha').value = 'Carregando...';
    }

    // Busca email + senha descriptografada via Edge Function
    try {
      const { data: { session } } = await db.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(SUPABASE_URL + '/functions/v1/convidar-usuario', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + token,
          'apikey':        SUPABASE_KEY,
        },
        body: JSON.stringify({ acao: 'buscar', uid: colabId }),
      });
      const json = await resp.json();
      if (json.success && json.colaborador) {
        document.getElementById('cEmail').value = json.colaborador.email;
        document.getElementById('cSenha').value = json.colaborador.senha || '';
      }
    } catch(e) {
      document.getElementById('cSenha').value = '';
    }
  }
  document.getElementById('formColabCard').style.display = '';
  document.getElementById('formColabCard').scrollIntoView({ behavior: 'smooth' });
}

function limparFormColab() {
  document.getElementById('cEmail').value = '';
  document.getElementById('cSenha').value = '';
}

function fecharFormColab() {
  document.getElementById('formColabCard').style.display = 'none';
  App.editingColabId = null;
}

function validarFormColab() {
  const email = document.getElementById('cEmail').value.trim();
  const senha = document.getElementById('cSenha').value;
  if (!email || !email.includes('@')) {
    abrirModal('E-mail inválido', 'Informe um e-mail válido.');
    return false;
  }
  if (!App.editingColabId && (!senha || senha.length < 6)) {
    abrirModal('Senha inválida', 'A senha deve ter no mínimo <strong>6 caracteres</strong>.');
    return false;
  }
  return true;
}

async function salvarColab() {
  if (!validarFormColab()) return;
  const email = document.getElementById('cEmail').value.trim().toLowerCase();
  const senha = document.getElementById('cSenha').value;

  const btnSalvar = document.getElementById('btnSalvarColab');
  btnSalvar.disabled = true;
  btnSalvar.textContent = 'Criando...';

  try {
    const { data: { session } } = await db.auth.getSession();
    const token = session?.access_token;

    const resp = await fetch(SUPABASE_URL + '/functions/v1/convidar-usuario', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + token,
        'apikey':        SUPABASE_KEY,
      },
      body: JSON.stringify({ email, senha }),
    });

    const json = await resp.json();
    if (!resp.ok || json.error) throw new Error(json.error || 'Erro desconhecido');

    // Recarregar lista de colaboradores
    const { data: perfis } = await db.from('perfis').select('*').eq('role', 'colaborador');
    if (perfis) App.colaboradores = perfis.map(p => ({ id: p.id, email: p.email, role: p.role }));

    fecharFormColab();
    renderTabelaColab();
    abrirModal('✅ Colaborador criado!', `<strong>${email}</strong> cadastrado com sucesso!`);

  } catch(e) {
    abrirModal('Erro', e.message || 'Erro inesperado.');
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = '💾 Salvar Cadastro';
  }
}

async function alterarColab() {
  if (!App.editingColabId) return;
  const email = (document.getElementById('cEmail').value || '').trim().toLowerCase();
  const senha  = (document.getElementById('cSenha').value || '').trim();

  // Pelo menos um campo deve ser preenchido
  if (!email && !senha) {
    abrirModal('Atenção', 'Informe o e-mail e/ou a nova senha para alterar.');
    return;
  }
  if (senha && senha.length < 6) {
    abrirModal('Atenção', 'A senha deve ter pelo menos 6 caracteres.');
    return;
  }

  const btnAlterar = document.getElementById('btnAlterarColab');
  btnAlterar.disabled = true;
  btnAlterar.textContent = 'Salvando…';

  try {
    const { data: { session } } = await db.auth.getSession();
    const token = session?.access_token;

    // Monta payload apenas com o que foi preenchido
    const payload = { uid: App.editingColabId };
    if (email) payload.email = email;
    if (senha) payload.senha = senha;

    const resp = await fetch(SUPABASE_URL + '/functions/v1/convidar-usuario', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + token,
        'apikey':        SUPABASE_KEY,
      },
      body: JSON.stringify({ acao: 'editar', ...payload }),
    });

    const json = await resp.json();
    if (!resp.ok || json.error) throw new Error(json.error || 'Erro desconhecido');

    // Recarregar lista e fechar form
    await carregarColaboradores();
    fecharFormColab();
    renderTabelaColab();

    const msg = [];
    if (email) msg.push('e-mail');
    if (senha) msg.push('senha');
    abrirModal('✅ Dados alterados!', `${msg.join(' e ')} atualizados com sucesso!`);

  } catch(e) {
    abrirModal('Erro ao alterar', e.message || 'Erro inesperado.');
  } finally {
    btnAlterar.disabled = false;
    btnAlterar.textContent = '✏️ Alterar Dados';
  }
}

async function excluirColab(colabId) {
  const c = App.colaboradores.find(x => x.id === colabId);
  if (!c) return;
  abrirModal('Excluir colaborador', `Excluir <strong>${c.email}</strong>?`,
    { confirm: true, onOk: async () => {
      const { error } = await db.from('perfis').delete().eq('id', colabId);
      if (error) { abrirModal('Erro', error.message); return; }
      App.colaboradores = App.colaboradores.filter(x => x.id !== colabId);
      renderTabelaColab();
      abrirModal('Removido', 'Colaborador removido. Remova o usuário no Auth Dashboard também.');
    }});
}

function renderTabelaColab() {
  const empty   = document.getElementById('emptyColab');
  const wrapper = document.getElementById('tableColabWrapper');
  const tbody   = document.getElementById('tableColabBody');

  if (!App.colaboradores.length) {
    empty.style.display   = '';
    wrapper.style.display = 'none';
    return;
  }
  empty.style.display   = 'none';
  wrapper.style.display = '';
  tbody.innerHTML = '';

  App.colaboradores.forEach((c, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Protocolo">${i + 1}</td>
      <td data-label="E-mail">${c.email}</td>
      <td data-label="Cadastrado em">${new Date(c.criadoEm).toLocaleDateString('pt-BR')}</td>
      <td data-label="Ações">
        <button class="btn btn-warning btn-sm" onclick="abrirFormColab('${c.id}')" title="Editar">&#9999;&#65039; Editar</button>
        <button class="btn btn-danger btn-sm" onclick="excluirColab('${c.id}')" title="Excluir">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ═══════════════════════════════════════════════