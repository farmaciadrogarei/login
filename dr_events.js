'use strict';

/* EVENT LISTENERS
═══════════════════════════════════════════════ */

/* ── Inicialização: Splash + Auth ── */
(function() {
  var loginScreen = document.getElementById('loginScreen');
  var appMain     = document.getElementById('appMain');
  var splash      = document.getElementById('splashScreen');

  // Esconde tudo inicialmente
  if (loginScreen) loginScreen.style.display = 'none';
  if (appMain)     appMain.style.display      = 'none';

  function mostrarLogin() {
    if (loginScreen) {
      loginScreen.style.display = '';
      loginScreen.classList.remove('hidden');
    }
  }

  function esconderSplash() {
    if (splash) {
      // Respeita a animação CSS de 2.5s antes de esconder
      setTimeout(function() {
        splash.classList.add('hidden');
        splash.style.display = 'none';
      }, 2500);
    }
  }

  // Verifica sessão em background enquanto splash é exibido
  (async function() {
    try {
      const { data: { session } } = await db.auth.getSession();

      // Aguarda animação do splash (2.5s) antes de mostrar próxima tela
      setTimeout(async function() {
        if (splash) { splash.classList.add('hidden'); splash.style.display = 'none'; }

        if (session) {
          App.session = session;
          await carregarPerfilUsuario(session.user);
          await carregarTodosDados();
          finalizarLogin();
        } else {
          mostrarLogin();
        }
      }, 2500);

    } catch(e) {
      console.warn('Erro ao verificar sessao:', e);
      setTimeout(function() {
        if (splash) { splash.classList.add('hidden'); splash.style.display = 'none'; }
        mostrarLogin();
      }, 2500);
    }
  })();

  // TOKEN_REFRESHED: renova sessao sem recarregar
  db.auth.onAuthStateChange(function(event, session) {
    if (event === 'TOKEN_REFRESHED' && session) {
      App.session = session;
    }
  });
})();

document.addEventListener('DOMContentLoaded', () => {

  /* ── LOGIN ── */
  document.getElementById('btnEntrar').addEventListener('click', realizarLogin);
  document.getElementById('loginSenha').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') realizarLogin();
  });
  document.getElementById('loginEmail').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('loginSenha').focus();
  });
  document.getElementById('btnToggleLoginPw').addEventListener('click', function() {
    var inp = document.getElementById('loginSenha');
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    this.textContent = show ? '🙈' : '👁';
  });
  document.getElementById('btnLogout').addEventListener('click', realizarLogout);

  /* ── SIGNUP ── */
  document.getElementById('btnToggleSignupPw').addEventListener('click', function() {
    var inp = document.getElementById('sSenha');
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    this.textContent = show ? '🙈' : '👁';
  });
  document.getElementById('btnToggleSignupPw2').addEventListener('click', function() {
    var inp = document.getElementById('sSenha2');
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    this.textContent = show ? '🙈' : '👁';
  });
  document.getElementById('sCPF').addEventListener('input', function() {
    this.value = formatarCPF(this.value);
  });
  document.getElementById('sTel').addEventListener('input', function() {
    this.value = formatarTel(this.value);
  });
  // Enter no último campo de senha do signup dispara cadastro
  document.getElementById('sSenha2').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') realizarCadastro();
  });

  /* ── BOTÕES Voltar ── */
  document.querySelectorAll('.btn-back[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navegar(btn.dataset.page));
  });

  /* ── Navegação ── */
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navegar(el.dataset.page);
    });
  });

  /* ── Hamburger menu ── */
  document.getElementById('hamburger').addEventListener('click', function() {
    var mobileNav = document.getElementById('mobileNav');
    var isOpen = mobileNav.classList.toggle('open');
    this.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    mobileNav.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  });

  /* ── ESPECIALISTAS DISPONÍVEIS (info ao clicar) ── */
  document.querySelectorAll('.esp-card').forEach(card => {
    const abrirInfoEsp = () => {
      const titulo = card.querySelector('span').textContent;
      const desc   = card.dataset.desc || '';
      abrirModal(titulo, `<p>${desc}</p>`);
    };
    card.addEventListener('click', abrirInfoEsp);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirInfoEsp(); }
    });
  });

  /* ── BENEFICIÁRIOS ── */
  document.getElementById('btnNovoBenef').addEventListener('click', () => abrirFormBenef());
  document.getElementById('btnSalvarBenef').addEventListener('click', salvarBenef);
  document.getElementById('btnAlterarBenef').addEventListener('click', alterarBenef);
  document.getElementById('btnExcluirBenef').addEventListener('click', excluirBenef);
  document.getElementById('btnCancelarBenef').addEventListener('click', fecharFormBenef);

  /* ── MÉDICOS ── */
  document.getElementById('btnNovoMedico').addEventListener('click', () => abrirFormMedico());
  document.getElementById('btnSalvarMedico').addEventListener('click', salvarMedico);
  const btnTogMed = document.getElementById('btnToggleMedicoPw');
  if (btnTogMed) btnTogMed.addEventListener('click', function() {
    var inp = document.getElementById('mSenha');
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    this.textContent = show ? '🙈' : '👁';
  });
  document.getElementById('btnAlterarMedico').addEventListener('click', alterarMedico);
  document.getElementById('btnExcluirMedico').addEventListener('click', excluirMedico);
  document.getElementById('btnCancelarMedico').addEventListener('click', fecharFormMedico);
  ['mCodPais','mDDD','mWhatsApp'].forEach(id => {
    document.getElementById(id).addEventListener('input', atualizarPreviewTelefone);
  });

  // Máscaras
  document.getElementById('fCPF').addEventListener('input', function() {
    this.value = formatarCPF(this.value);
  });
  document.getElementById('fTelefone').addEventListener('input', function() {
    this.value = formatarTel(this.value);
  });
  document.getElementById('fCEP').addEventListener('input', function() {
    this.value = formatarCEP(this.value);
  });

  /* ── AGENDAMENTOS ── */
  document.getElementById('btnNovoAgend').addEventListener('click', () => abrirFormAgend());
  document.getElementById('btnSalvarAgend').addEventListener('click', salvarAgendamento);
  document.getElementById('btnCancelarAgend').addEventListener('click', fecharFormAgend);
  document.getElementById('btnConfirmOk').addEventListener('click', () => {
    document.getElementById('confirmacaoAgend').style.display = 'none';
  });

  // Seleção de especialista (cards)
  document.querySelectorAll('.esp-select-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.esp-select-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      especialistaSelecionada = card.dataset.esp;
      document.getElementById('fAgendEsp').value = especialistaSelecionada;
    });
  });

  /* ── ANEXOS ── */
  document.getElementById('btnEnviarAnexo').addEventListener('click', abrirFormAnexo);
  document.getElementById('btnSalvarAnexo').addEventListener('click', salvarAnexo);
  document.getElementById('btnCancelarAnexo').addEventListener('click', fecharFormAnexo);



  const uploadArea = document.getElementById('uploadArea');
  const fileInput  = document.getElementById('fAnexoArquivo');

  uploadArea.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });
  uploadArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) {
      try { fileInput.files = files; } catch(err) {}
      mostrarPreviewArquivo(files[0]);
    }
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) mostrarPreviewArquivo(fileInput.files[0]);
  });

  function mostrarPreviewArquivo(file) {
    const prev = document.getElementById('uploadPreview');
    prev.style.display = '';
    prev.innerHTML = `📄 ${file.name} <span style="color:var(--gray-400);margin-left:8px;">(${formatarTamanho(file.size)})</span>`;
  }

  /* ── MODAL ── */
  document.getElementById('modalOk').addEventListener('click', () => {
    if (typeof modalCallback === 'function') modalCallback();
    fecharModal();
  });
  document.getElementById('modalCancel').addEventListener('click', fecharModal);
  document.getElementById('modalClose').addEventListener('click', fecharModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) fecharModal();
  });

  /* ── VIEWER DE ANEXOS ── */
  document.getElementById('viewerClose').addEventListener('click', () => {
    document.getElementById('viewerOverlay').style.display = 'none';
  });
  document.getElementById('btnViewerFechar').addEventListener('click', () => {
    document.getElementById('viewerOverlay').style.display = 'none';
  });
  document.getElementById('viewerOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('viewerOverlay'))
      document.getElementById('viewerOverlay').style.display = 'none';
  });
  document.getElementById('btnViewerDownload').addEventListener('click', () => {
    if (App.editingAnexoViewId) baixarAnexo(App.editingAnexoViewId);
  });
  document.getElementById('btnViewerPrint').addEventListener('click', () => {
    if (App.editingAnexoViewId) {
      // Para arquivos no Storage, abrimos numa nova aba para impressão
      visualizarAnexo(App.editingAnexoViewId);
    }
  });


  /* ── VIDEOCONFERÊNCIA ── */
  document.getElementById('selectMedicoVideo').addEventListener('change', function() {
    if (App.currentUser && App.currentUser.role === 'medico') {
      verificarVideoPacienteMedico(this.value);
    } else {
      verificarAgendamentoHoje(this.value);
    }
  });

  document.getElementById('btnIniciarWhatsApp').addEventListener('click', () => {
    if (App.currentUser && App.currentUser.role === 'medico') {
      // Médico liga pro WhatsApp do paciente selecionado
      iniciarVideoComoPacienteAlvo();
      return;
    }
    const sel = document.getElementById('selectMedicoVideo');
    const medicoId = sel.value;
    if (!medicoId) return;
    const m = App.medicos.find(x => x.id === medicoId);
    if (!m) return;
    const numero = `${m.codPais}${m.ddd}${m.whatsapp}`;
    window.open(`https://wa.me/${numero}`, '_blank');
  });

});
  