'use strict';

/* ANEXOS
═══════════════════════════════════════════════ */
function abrirFormAnexo() {
  if (App.beneficiarios.length === 0) {
    abrirModal('Atenção', 'Cadastre ao menos um beneficiário antes de enviar anexos.');
    return;
  }
  popularSelectBenef('fAnexoBenef');
  document.getElementById('fAnexoTipo').value  = '';
  document.getElementById('fAnexoDesc').value  = '';
  document.getElementById('fAnexoArquivo').value = '';
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('formAnexoCard').style.display = '';
  document.getElementById('formAnexoCard').scrollIntoView({ behavior: 'smooth' });
}

function fecharFormAnexo() {
  document.getElementById('formAnexoCard').style.display = 'none';
}

async function salvarAnexo() {
  const benefId = document.getElementById('fAnexoBenef').value;
  const tipo    = document.getElementById('fAnexoTipo').value;
  const desc    = document.getElementById('fAnexoDesc').value.trim();
  const fileInp = document.getElementById('fAnexoArquivo');
  const file    = fileInp.files[0];

  if (!benefId || !tipo || !file) {
    abrirModal('Campos obrigatórios', 'Selecione o beneficiário, tipo e arquivo.');
    return;
  }

  // Upload para o Supabase Storage
  const ext       = file.name.split('.').pop();
  const filePath  = `${benefId}/${Date.now()}_${gerarId()}.${ext}`;

  const { error: upErr } = await db.storage
    .from('anexos-documentos')
    .upload(filePath, file, { contentType: file.type });

  if (upErr) {
    abrirModal('Erro no upload', upErr.message);
    return;
  }

  // Salvar metadados na tabela anexos
  const payload = {
    paciente_id:    benefId,
    tipo,
    descricao:      desc || null,
    nome_arquivo:   file.name,
    mime_type:      file.type,
    tamanho_bytes:  file.size,
    storage_path:   filePath,
    criado_por:     App.currentUser.id,
  };

  const { data: row, error } = await db.from('anexos').insert(payload).select().single();
  if (error) { abrirModal('Erro', error.message); return; }

  App.anexos.unshift(mapAnexo(row));
  atualizarContadores();
  fecharFormAnexo();
  renderAnexos();
  abrirModal('Anexo enviado', `Arquivo <strong>${file.name}</strong> enviado com sucesso!`);
}

function renderAnexos() {
  const container = document.getElementById('listaAnexos');
  if (!container) return;

  const isUsuario = App.currentUser && App.currentUser.role === 'usuario';

  // Usuário comum NÃO pode enviar anexos — ocultar botão e fechar form
  const btnEnviar = document.getElementById('btnEnviarAnexo');
  if (btnEnviar) btnEnviar.style.display = isUsuario ? 'none' : '';
  const formCard = document.getElementById('formAnexoCard');
  if (isUsuario && formCard) formCard.style.display = 'none';

  const lista = App.anexos.slice();

  if (lista.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:32px;">Nenhum anexo encontrado.</p>';
    return;
  }

  container.innerHTML = lista.map(a => {
    const benef = App.beneficiarios.find(b => b.id === a.beneficiarioId);
    return `
      <div class="anexo-card">
        <div class="anexo-card-header">
          <div class="anexo-tipo-icon">${iconePorTipo(a.tipo)}</div>
          <div>
            <div class="anexo-tipo-nome">${a.tipo}</div>
            <div class="anexo-benef">&#128100; ${benef ? benef.nome : '—'}</div>
          </div>
        </div>
        <div class="anexo-desc">&#128196; ${a.nomeArquivo}</div>
        ${a.descricao ? `<div class="anexo-desc">${a.descricao}</div>` : ''}
        <div class="anexo-meta">&#128197; ${formatarDataHora(a.criadoEm)} · ${formatarTamanho(a.tamanho)}</div>
        <div class="anexo-actions">
          <button class="btn btn-primary btn-sm" onclick="visualizarAnexo('${a.id}')">👁 Ver</button>
          <button class="btn btn-warning btn-sm" onclick="baixarAnexo('${a.id}')">⬇ Baixar</button>
          <button class="btn btn-outline btn-sm" onclick="imprimirAnexo('${a.id}')">&#128424;&#65039; Imprimir</button>
          ${App.currentUser.role === 'adm'
            ? `<button class="btn btn-danger btn-sm" onclick="excluirAnexo('${a.id}')">🗑️</button>`
            : ''}
        </div>
      </div>`;
  }).join('');
}

async function visualizarAnexo(id) {
  const a = App.anexos.find(x => x.id === id);
  if (!a) return;
  App.editingAnexoViewId = id;

  const { data, error } = await db.storage
    .from('anexos-documentos')
    .createSignedUrl(a.storagePath, 60); // URL válida por 60s

  if (error || !data) {
    abrirModal('Erro', 'Não foi possível gerar o link do arquivo.');
    return;
  }

  document.getElementById('viewerTitle').textContent = a.nomeArquivo;
  const body = document.getElementById('viewerBody');
  body.innerHTML = '';

  if (a.mimeType.startsWith('image/')) {
    body.innerHTML = `<img src="${data.signedUrl}" style="max-width:100%;" alt="${a.nomeArquivo}">`;
  } else if (a.mimeType === 'application/pdf') {
    body.innerHTML = `<embed src="${data.signedUrl}" type="application/pdf" width="100%" height="500px">`;
  } else {
    body.innerHTML = `<div class="viewer-unsupported">
      <p>Pré-visualização não disponível para este tipo de arquivo.</p>
      <a href="${data.signedUrl}" target="_blank" class="btn btn-primary" style="margin-top:16px;">Abrir arquivo</a>
    </div>`;
  }

  document.getElementById('viewerOverlay').style.display = '';
}

async function baixarAnexo(id) {
  const a = App.anexos.find(x => x.id === id);
  if (!a) return;
  const { data, error } = await db.storage
    .from('anexos-documentos')
    .createSignedUrl(a.storagePath, 60);
  if (error || !data) { abrirModal('Erro', 'Não foi possível gerar o link para download.'); return; }
  const link = document.createElement('a');
  link.href = data.signedUrl;
  link.download = a.nomeArquivo;
  link.click();
}

async function imprimirAnexo(id) {
  const a = App.anexos.find(x => x.id === id);
  if (!a) return;
  const { data, error } = await db.storage
    .from('anexos-documentos')
    .createSignedUrl(a.storagePath, 60);
  if (error || !data) { abrirModal('Erro', 'Não foi possível gerar o link para impressão.'); return; }

  const win = window.open('', '_blank');
  if (!win) { abrirModal('Erro', 'Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.'); return; }

  if (a.mimeType.startsWith('image/')) {
    win.document.write(`<!DOCTYPE html><html><head><title>${a.nomeArquivo}</title>
      <meta charset="UTF-8"></head>
      <body style="margin:0;text-align:center;">
        <img src="${data.signedUrl}" style="max-width:100%;" onload="window.focus();window.print();">
      </body></html>`);
  } else if (a.mimeType === 'application/pdf') {
    win.document.write(`<!DOCTYPE html><html><head><title>${a.nomeArquivo}</title>
      <meta charset="UTF-8"></head>
      <body style="margin:0;">
        <embed src="${data.signedUrl}" type="application/pdf" width="100%" height="100%">
      </body></html>`);
    setTimeout(() => { win.focus(); win.print(); }, 600);
  } else {
    win.location.href = data.signedUrl;
  }
  win.document.close();
}

async function excluirAnexo(id) {
  const a = App.anexos.find(x => x.id === id);
  if (!a) return;
  abrirModal('Excluir anexo', `Excluir <strong>${a.nomeArquivo}</strong>?`,
    { confirm: true, onOk: async () => {
      await db.storage.from('anexos-documentos').remove([a.storagePath]);
      const { error } = await db.from('anexos').delete().eq('id', id);
      if (error) { abrirModal('Erro', error.message); return; }
      App.anexos = App.anexos.filter(x => x.id !== id);
      atualizarContadores();
      renderAnexos();
    }});
}

