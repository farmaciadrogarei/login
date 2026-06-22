'use strict';


// ════════════════════════════════════════════════════
//  FARMÁCIA DROGA REI – Telemedicina
//  Supabase JS SDK (via CDN)
// ════════════════════════════════════════════════════

// ── Configuração Supabase ──
// ⚠️ SUBSTITUA os valores abaixo pelos do seu projeto:
const SUPABASE_URL  = 'https://kwizzlodiyphqnthvhap.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aXp6bG9kaXlwaHFudGh2aGFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMTM3MzQsImV4cCI6MjA5Njg4OTczNH0.VImZLxGFrfjulHx9QvZi1TJECUGCo5q3boEa3bHyQLo';

var { createClient } = supabase;
var db = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ═══════════════════════════════════════════════
   /* HELPER – CRIPTOGRAFIA AES via Edge Function
═══════════════════════════════════════════════ */
async function cripto(acao, tabela, dados) {
  const { data: { session } } = await db.auth.getSession();
  const token = session?.access_token;
  const resp = await fetch(SUPABASE_URL + '/functions/v1/criptografia', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + token,
      'apikey':        SUPABASE_KEY,
    },
    body: JSON.stringify({ acao, tabela, dados }),
  });
  const json = await resp.json();
  if (!resp.ok || json.error) throw new Error(json.error || 'Erro na criptografia');
  return json.dados;
}

/* ═══════════════════════════════════════════════
   /* ESTADO DA APLICAÇÃO
═══════════════════════════════════════════════ */
const App = {
  beneficiarios: [],
  agendamentos:  [],
  anexos:        [],
  medicos:       [],
  colaboradores: [],

  currentUser: null,   // { id, email, role: 'adm' | 'colaborador' | 'usuario' }
  session:     null,

  editingBenefId:    null,
  editingAnexoViewId: null,
  editingMedicoId:   null,
  editingColabId:    null,
};

/* ═══════════════════════════════════════════════
   NAVEGAÇÃO ENTRE TELAS DE AUTH
═══════════════════════════════════════════════ */
function mostrarTelaCadastro() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('signupScreen').style.display = '';
  // Limpar campos
  ['sNome','sEmail','sCPF','sNasc','sTel','sSenha','sSenha2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('signupError').style.display = 'none';
  document.getElementById('signupSuccess').style.display = 'none';
}

function mostrarTelaLogin() {
  document.getElementById('signupScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = '';
}

/* ═══════════════════════════════════════════════
   CADASTRO DE USUÁRIO COMUM
═══════════════════════════════════════════════ */
async function realizarCadastro() {
  const nome    = document.getElementById('sNome').value.trim();
  const email   = document.getElementById('sEmail').value.trim().toLowerCase();
  const cpf     = document.getElementById('sCPF').value.replace(/\D/g, '');
  const nasc    = document.getElementById('sNasc').value;
  const tel     = document.getElementById('sTel').value.replace(/\D/g, '');
  const senha   = document.getElementById('sSenha').value;
  const senha2  = document.getElementById('sSenha2').value;

  const errEl = document.getElementById('signupError');
  const sucEl = document.getElementById('signupSuccess');
  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  function mostrarErro(msg) {
    errEl.textContent = msg;
    errEl.style.display = '';
  }

  if (!nome || !email || !cpf || !nasc || !tel || !senha || !senha2) {
    return mostrarErro('Preencha todos os campos obrigatórios.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return mostrarErro('Digite um e-mail válido.');
  }
  if (cpf.length !== 11) {
    return mostrarErro('CPF deve ter 11 dígitos.');
  }
  if (tel.length < 10) {
    return mostrarErro('Telefone inválido.');
  }
  if (senha.length < 6) {
    return mostrarErro('A senha deve ter ao menos 6 caracteres.');
  }
  if (senha !== senha2) {
    return mostrarErro('As senhas não coincidem.');
  }

  const btn = document.getElementById('btnCadastrar');
  btn.disabled = true;
  btn.textContent = 'Cadastrando…';

  try {
    // 1. Criar conta no Supabase Auth
    const { data, error } = await db.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome_completo: nome }
      }
    });

    if (error) {
      const msg = traduzirErroAuth(error);
      mostrarErro(msg);
      return;
    }

    // 2. Salvar perfil na tabela perfis com role 'usuario'
    if (data.user) {
      await db.from('perfis').upsert({
        id:    data.user.id,
        email: email,
        role:  'usuario',
        nome:  nome,
        cpf:   cpf,
        nascimento: nasc,
        telefone:   tel,
      });
    }

    // 3. Sucesso
    document.getElementById('signupForm').style.display = 'none';
    sucEl.textContent = '✅ Conta criada com sucesso! Agora faça login para acessar o sistema.';
    sucEl.style.display = '';
    setTimeout(() => {
      document.getElementById('signupForm').style.display = '';
      mostrarTelaLogin();
      document.getElementById('loginEmail').value = email;
    }, 3000);

  } catch (e) {
    mostrarErro('Erro de conexão. Verifique sua internet.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar conta';
  }
}

/* ═══════════════════════════════════════════════
   AUTENTICAÇÃO – LOGIN / LOGOUT
═══════════════════════════════════════════════ */

async function realizarLogin() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const senha = document.getElementById('loginSenha').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.remove('visible');

  if (!email || !senha) {
    errEl.textContent = 'Preencha e-mail e senha.';
    errEl.classList.add('visible');
    return;
  }

  // Validação básica de formato de e-mail
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = 'Digite um e-mail válido.';
    errEl.classList.add('visible');
    return;
  }

  const btn = document.getElementById('btnEntrar');
  btn.disabled = true;
  btn.textContent = 'Entrando…';

  let data, error;
  try {
    ({ data, error } = await db.auth.signInWithPassword({ email, password: senha }));
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Entrar';
    errEl.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
    errEl.classList.add('visible');
    return;
  }

  btn.disabled = false;
  btn.textContent = 'Entrar';

  if (error) {
    // Mensagens amigáveis em português por tipo de erro
    const msg = traduzirErroAuth(error);
    errEl.textContent = msg;
    errEl.classList.add('visible');
    document.getElementById('loginSenha').value = '';
    return;
  }

  // Login bem-sucedido — onAuthStateChange cuidará da navegação
  // (mas mantemos o fluxo direto como fallback)
  App.session = data.session;
  await carregarPerfilUsuario(data.user);
  await carregarTodosDados();
  finalizarLogin();
}

// Traduz erros do Supabase Auth para português
function traduzirErroAuth(error) {
  const msg = (error.message || '').toLowerCase();
  const status = error.status || 0;

  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials') || status === 400)
    return 'E-mail ou senha incorretos. Verifique e tente novamente.';
  if (msg.includes('email not confirmed'))
    return 'E-mail não confirmado. Verifique sua caixa de entrada.';
  if (msg.includes('too many requests') || status === 429)
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (msg.includes('user not found'))
    return 'Usuário não encontrado. Verifique o e-mail digitado.';
  if (msg.includes('network') || status === 0)
    return 'Erro de conexão. Verifique sua internet.';
  if (status >= 500)
    return 'Serviço temporariamente indisponível. Tente novamente em instantes.';

  return 'Erro ao entrar: ' + error.message;
}

async function carregarPerfilUsuario(user) {
  const { data, error } = await db
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .single();

  App.currentUser = {
    id:    user.id,
    email: user.email,
    role:  (data && !error) ? data.role : 'colaborador',
  };
}

function finalizarLogin() {
  var ls = document.getElementById('loginScreen');
  var ss = document.getElementById('signupScreen');
  var am = document.getElementById('appMain');
  var ah = document.getElementById('appHeader');
  var af = document.getElementById('appFooter');
  if (ls) { ls.classList.add('hidden'); ls.style.display = 'none'; }
  if (ss) ss.style.display = 'none';
  if (am) { am.style.display = ''; am.style.visibility = 'visible'; }
  if (ah) ah.style.display = '';
  if (af) af.style.display = '';

  const badge = document.getElementById('userBadge');
  const role  = document.getElementById('userBadgeRole');
  badge.style.display = '';
  const isAdm      = App.currentUser.role === 'adm';
  const isUsuario  = App.currentUser.role === 'usuario';
  if (isAdm) {
    role.textContent = '👑 ADM';
    role.className   = 'user-badge-role adm';
  } else if (isUsuario) {
    role.textContent = '👤 Paciente';
    role.className   = 'user-badge-role';
  } else {
    role.textContent = '👤 Colaborador';
    role.className   = 'user-badge-role';
  }

  document.querySelectorAll('.adm-only, .adm-only-mobile').forEach(el => {
    el.style.display = isAdm ? '' : 'none';
  });

  // Ocultar itens de menu que usuario comum não acessa
  document.querySelectorAll('.nav-link[data-page="beneficiarios"], .nav-link[data-page="medicos"], .nav-link[data-page="colaboradores"]').forEach(el => {
    if (isUsuario) el.style.display = 'none';
    else el.style.display = '';
  });

  navegar('home');
}

async function realizarLogout() {
  await db.auth.signOut();
  App.currentUser = null;
  App.session     = null;
  App.beneficiarios = [];
  App.agendamentos  = [];
  App.anexos        = [];
  App.medicos       = [];
  App.colaboradores = [];

  document.getElementById('appMain').style.display = 'none';
  var ah = document.getElementById('appHeader');
  var af = document.getElementById('appFooter');
  if (ah) ah.style.display = 'none';
  if (af) af.style.display = 'none';
  var ls = document.getElementById('loginScreen');
  ls.style.display = '';
  ls.classList.remove('hidden');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginSenha').value = '';
  document.getElementById('loginError').classList.remove('visible');
  document.getElementById('userBadge').style.display = 'none';
  document.querySelectorAll('.adm-only, .adm-only-mobile').forEach(el => {
    el.style.display = 'none';
  });
}

/* ═══════════════════════════════════════════════
   /* CARREGAMENTO DE DADOS DO SUPABASE
═══════════════════════════════════════════════ */

async function carregarTodosDados() {
  const isUsuario = App.currentUser && App.currentUser.role === 'usuario';

  if (isUsuario) {
    // Usuário comum: carrega só agendamentos e anexos dele
    await Promise.all([
      carregarAgendamentosUsuario(),
      carregarAnexosUsuario(),
      carregarMedicos(),
    ]);
  } else {
    await Promise.all([
      carregarBeneficiarios(),
      carregarAgendamentos(),
      carregarAnexos(),
      carregarMedicos(),
      carregarColaboradores(),
    ]);
  }
  atualizarContadores();
}

async function carregarBeneficiarios() {
  const { data, error } = await db
    .from('pacientes')
    .select('*')
    .order('protocolo', { ascending: true });
  if (!error && data) {
    const dataDesc = await cripto('descriptografar', 'pacientes', data);
    App.beneficiarios = dataDesc.map(mapPaciente);
  }
}

async function carregarAgendamentos() {
  const { data, error } = await db
    .from('agendamentos')
    .select('*')
    .order('data', { ascending: false });
  if (!error && data) {
    const dataDesc = await cripto('descriptografar', 'agendamentos', data);
    App.agendamentos = dataDesc.map(mapAgendamento);
  }
}

async function carregarAnexos() {
  const { data, error } = await db
    .from('anexos')
    .select('*')
    .order('criado_em', { ascending: false });
  if (!error && data) {
    App.anexos = data.map(mapAnexo);
  }
}

async function carregarMedicos() {
  const { data, error } = await db
    .from('medicos')
    .select('*')
    .order('seq', { ascending: true });
  if (!error && data) {
    const dataDesc = await cripto('descriptografar', 'medicos', data);
    App.medicos = dataDesc.map(mapMedico);
  }
}

async function carregarColaboradores() {
  if (!App.currentUser || App.currentUser.role !== 'adm') return;
  const { data, error } = await db
    .from('colaboradores')   // view no Supabase
    .select('*')
    .order('criado_em', { ascending: true });
  if (!error && data) {
    App.colaboradores = data.map(p => ({
      id:       p.id,
      email:    p.email,
      role:     p.role,
      criadoEm: p.criado_em,
    }));
  }
}

/* Carregamento filtrado para usuário comum (role: 'usuario') */
async function carregarAgendamentosUsuario() {
  // Busca agendamentos onde o paciente está ligado ao email do usuário
  const { data, error } = await db
    .from('agendamentos')
    .select('*, pacientes!inner(email)')
    .eq('pacientes.email', App.currentUser.email)
    .order('data', { ascending: false });
  if (!error && data) {
    const dataDesc = await cripto('descriptografar', 'agendamentos', data);
    App.agendamentos = dataDesc.map(mapAgendamento);
    // Guardar o paciente_id do usuário para uso posterior
    if (dataDesc.length > 0) {
      App.currentUser.pacienteId = dataDesc[0].paciente_id;
    } else {
      // Tentar buscar pelo email diretamente na tabela pacientes
      const { data: pac } = await db.from('pacientes').select('id').eq('email', App.currentUser.email).maybeSingle();
      if (pac) App.currentUser.pacienteId = pac.id;
    }
  }
}

async function carregarAnexosUsuario() {
  if (!App.currentUser.pacienteId) return;
  const { data, error } = await db
    .from('anexos')
    .select('*')
    .eq('paciente_id', App.currentUser.pacienteId)
    .order('criado_em', { ascending: false });
  if (!error && data) {
    App.anexos = data.map(mapAnexo);
  }
}

/* ── Mapeadores Supabase → App ── */
function mapPaciente(p) {
  return {
    id:        p.id,
    protocolo: p.protocolo,
    nome:      p.nome,
    cpf:       p.cpf,
    nascimento:p.nascimento,
    mae:       p.nome_mae,
    pai:       p.nome_pai,
    telefone:  p.telefone,
    email:     p.email,
    cep:       p.cep,
    endereco:  p.endereco,
    numero:    p.numero,
    bairro:    p.bairro,
    cidade:    p.cidade,
    estado:    p.estado,
    criadoEm:  p.criado_em,
  };
}

function mapAgendamento(a) {
  return {
    id:             a.id,
    seq:            a.seq,
    beneficiarioId: a.paciente_id,
    medicoId:       a.medico_id,
    data:           a.data,
    hora:           a.hora,
    especialista:   a.especialista,
    obs:            a.observacoes,
    status:         a.status,
    criadoEm:       a.criado_em,
  };
}

function mapAnexo(a) {
  return {
    id:             a.id,
    seq:            a.seq,
    beneficiarioId: a.paciente_id,
    tipo:           a.tipo,
    descricao:      a.descricao,
    nomeArquivo:    a.nome_arquivo,
    mimeType:       a.mime_type,
    tamanho:        a.tamanho_bytes,
    storagePath:    a.storage_path,
    criadoEm:       a.criado_em,
  };
}

function mapMedico(m) {
  return {
    id:           m.id,
    seq:          m.seq,
    nome:         m.nome,
    especialidade:m.especialidade,
    crm:          m.crm,
    codPais:      m.cod_pais,
    ddd:          m.ddd,
    whatsapp:     m.whatsapp,
    criadoEm:     m.criado_em,
  };
}

/* ═══════════════════════════════════════════════
   /* NAVEGAÇÃO ENTRE PÁGINAS
═══════════════════════════════════════════════ */
function navegar(pageId) {
  if (pageId === 'colaboradores' && (!App.currentUser || App.currentUser.role !== 'adm')) return;

  const isUsuario = App.currentUser && App.currentUser.role === 'usuario';
  // Usuário comum só acessa home, agendamentos, anexos e video
  if (isUsuario && ['beneficiarios', 'medicos', 'colaboradores'].includes(pageId)) return;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  // Fechar menu mobile
  var mobileNav = document.getElementById('mobileNav');
  if (mobileNav && mobileNav.classList.contains('open')) {
    mobileNav.classList.remove('open');
    var hamburger = document.getElementById('hamburger');
    if (hamburger) {
      hamburger.setAttribute('aria-expanded', 'false');
      mobileNav.setAttribute('aria-hidden', 'true');
    }
  }

  switch (pageId) {
    case 'beneficiarios': renderTabelaBenef();    break;
    case 'agendamentos':  renderTabelaAgend();    break;
    case 'anexos':        renderAnexos();         break;
    case 'medicos':       renderTabelaMedicos();  popularSelectMedicoVideo(); break;
    case 'video':         popularSelectMedicoVideo(); break;
    case 'colaboradores': renderTabelaColab();    break;
  }

  window.scrollTo(0, 0);
}

/* ═══════════════════════════════════════════════
   /* UTILITÁRIOS
═══════════════════════════════════════════════ */
function formatarProtocolo(n) {
  return String(n).padStart(2, '0');
}
function formatarCPF(v) {
  v = v.replace(/\D/g, '').slice(0, 11);
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
          .replace(/(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3')
          .replace(/(\d{3})(\d{1,3})$/, '$1.$2');
}
function formatarTel(v) {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length >= 11) return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (v.length >= 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return v;
}
function formatarCEP(v) {
  v = v.replace(/\D/g, '').slice(0, 8);
  return v.replace(/(\d{5})(\d{1,3})/, '$1-$2');
}
function formatarData(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function formatarDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, '0');
  const mi  = String(d.getMinutes()).padStart(2, '0');
  const ss  = String(d.getSeconds()).padStart(2, '0');
  return `${dia}/${mes}/${ano}, ${hh}:${mi}:${ss}`;
}
function formatarTamanho(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
function gerarId() {
  return Math.random().toString(36).slice(2, 10);
}
function iconePorTipo(tipo) {
  const m = {
    'Receita Médica': '💊',
    'Atestado Médico': '📋',
    'Encaminhamento de Exames': '🔬',
    'Resultado de Exame': '📊',
    'Outros': '📎',
  };
  return m[tipo] || '📎';
}

/* ── Modal ── */
let modalCallback = null;
function abrirModal(titulo, corpo, { confirm = false, onOk = null } = {}) {
  document.getElementById('modalTitle').innerHTML = titulo;
  document.getElementById('modalBody').innerHTML  = corpo;
  document.getElementById('modalCancel').style.display = confirm ? '' : 'none';
  document.getElementById('modalOk').textContent = confirm ? 'Confirmar' : 'OK';
  document.getElementById('modalOverlay').style.display = '';
  modalCallback = onOk;
}
function fecharModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  modalCallback = null;
}

/* ── Contadores ── */
function atualizarContadores() {
  document.getElementById('countBenef').textContent = App.beneficiarios.length;
  document.getElementById('countAgend').textContent = App.agendamentos.length;
  document.getElementById('countAnex').textContent  = App.anexos.length;
  const elMed = document.getElementById('countMed');
  if (elMed) elMed.textContent = App.medicos.length;
}

