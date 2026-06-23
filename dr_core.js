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
    errEl.style.cssText = 'display:block!important;background:#ef4444;color:#fff;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:13px;';
    console.error('Cadastro erro:', msg);
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

    // Guardar dados para criar perfil+paciente após login (com sessão ativa)
    sessionStorage.setItem('signup_pendente', JSON.stringify({
      nome, cpf, nascimento: nasc, telefone: tel, email
    }));

    // Login automático logo após cadastro
    sucEl.textContent = '✅ Conta criada! Entrando automaticamente…';
    sucEl.style.display = '';
    document.getElementById('signupForm').style.display = 'none';

    const { data: loginData, error: loginErr } = await db.auth.signInWithPassword({ email, password: senha });
    if (!loginErr && loginData.session) {
      App.session = loginData.session;
      await carregarPerfilUsuario(loginData.user);
      await _criarPerfilEPacienteSeNecessario(loginData.user);
      await carregarTodosDados();
      finalizarLogin();
    } else {
      document.getElementById('signupForm').style.display = '';
      sucEl.style.display = 'none';
      mostrarTelaLogin();
      document.getElementById('loginEmail').value = email;
    }

  } catch (e) {
    console.error('Erro cadastro:', e);
    mostrarErro('Erro: ' + (e.message || 'Verifique sua conexão.'));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar conta';
  }
}

/* ═══════════════════════════════════════════════
   CRIAR PERFIL + PACIENTE APÓS LOGIN (signup pendente)
═══════════════════════════════════════════════ */
async function _criarPerfilEPacienteSeNecessario(user) {
  const raw = sessionStorage.getItem('signup_pendente');
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    // Criar/atualizar perfil
    await db.from('perfis').upsert({
      id:         user.id,
      email:      d.email,
      role:       'usuario',
      nome:       d.nome,
      cpf:        d.cpf,
      nascimento: d.nascimento,
      telefone:   d.telefone,
    });
    // Criar paciente se não existir (verificar por email E por cpf para evitar duplicata)
    const cpfLimpo = (d.cpf || '').replace(/\D/g, '');
    const { data: pacExiste } = await db.from('pacientes').select('id').eq('email', d.email).maybeSingle();
    if (!pacExiste) {
      const { data: pacNovo } = await db.from('pacientes').insert({
        nome:       d.nome,
        cpf:        d.cpf,
        nascimento: d.nascimento,
        telefone:   d.telefone,
        email:      d.email,
        criado_por: user.id,
      }).select('id').single();
      if (pacNovo) App.currentUser.pacienteId = pacNovo.id;
    } else {
      App.currentUser.pacienteId = pacExiste.id;
    }
    sessionStorage.removeItem('signup_pendente');
  } catch(e) { console.error('Erro ao criar perfil/paciente:', e); }
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
  App.session = data.session;
  await carregarPerfilUsuario(data.user);
  await _criarPerfilEPacienteSeNecessario(data.user);

  // Se veio de um cadastro, criar registro em pacientes agora que tem sessão
  const signupPendente = sessionStorage.getItem('signup_pendente');
  if (signupPendente) {
    try {
      const d = JSON.parse(signupPendente);
      const { data: pacExiste } = await db.from('pacientes').select('id').eq('email', d.email).maybeSingle();
      if (!pacExiste) {
        await db.from('pacientes').insert({
          nome:       d.nome,
          cpf:        d.cpf,
          nascimento: d.nascimento,
          telefone:   d.telefone,
          email:      d.email,
          criado_por: data.user.id,
        });
      }
    } catch(e) { console.error('Erro ao criar paciente:', e); }
    sessionStorage.removeItem('signup_pendente');
  }

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
    .select('role, medico_id')
    .eq('id', user.id)
    .single();

  App.currentUser = {
    id:        user.id,
    email:     user.email,
    role:      (data && !error) ? data.role : 'usuario',
    medico_id: (data && !error) ? data.medico_id : null,
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
  const isAdm     = App.currentUser.role === 'adm';
  const isUsuario = App.currentUser.role === 'usuario';
  const isMedico  = App.currentUser.role === 'medico';
  if (isAdm) {
    role.textContent = '👑 ADM';
    role.className   = 'user-badge-role adm';
  } else if (isMedico) {
    role.textContent = '👨‍⚕️ Médico';
    role.className   = 'user-badge-role';
  } else if (isUsuario) {
    role.textContent = '👤 Paciente';
    role.className   = 'user-badge-role';
  } else {
    role.textContent = '👤 Colaborador';
    role.className   = 'user-badge-role';
  }


  // Ocultar itens de menu que usuario/medico não acessam
  document.querySelectorAll('.nav-link[data-page="medicos"], .nav-link[data-page="colaboradores"]').forEach(el => {
    if (isUsuario || isMedico) el.style.display = 'none';
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
}

/* ═══════════════════════════════════════════════
   /* CARREGAMENTO DE DADOS DO SUPABASE
═══════════════════════════════════════════════ */

async function carregarTodosDados() {
  const isUsuario = App.currentUser && App.currentUser.role === 'usuario';
  const isMedico  = App.currentUser && App.currentUser.role === 'medico';

  if (isMedico) {
    // Médico: vê só os agendamentos com o medico_id dele,
    // e só os pacientes/anexos ligados a esses agendamentos
    await Promise.all([
      carregarAgendamentosMedico(),
      carregarMedicos(),
    ]);
  } else if (isUsuario) {
    // Usuário comum: carrega seus pacientes, agendamentos e anexos
    await Promise.all([
      carregarBeneficiarios(),
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
      ]);
  }
  atualizarContadores();
}

async function carregarBeneficiarios() {
  const isUsuario = App.currentUser && App.currentUser.role === 'usuario';
  let query = db.from('pacientes').select('*').order('protocolo', { ascending: true });
  if (isUsuario) query = query.eq('user_id', App.currentUser.id);
  const { data, error } = await query;
  if (error) { console.error('Erro carregarBeneficiarios:', error); return; }
  if (!data || data.length === 0) { App.beneficiarios = []; return; }
  let dataFinal = data;
  try {
    dataFinal = await cripto('descriptografar', 'pacientes', data);
  } catch (e) {
    console.error('Erro ao descriptografar pacientes, usando dados crus:', e);
    dataFinal = data;
  }
  App.beneficiarios = dataFinal.map(mapPaciente);
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
  if (error) { console.error('Erro carregarMedicos:', error); return; }
  if (!data || data.length === 0) { App.medicos = []; return; }
  let dataFinal = data;
  try {
    dataFinal = await cripto('descriptografar', 'medicos', data);
  } catch (e) {
    console.error('Erro ao descriptografar medicos, usando dados crus:', e);
    dataFinal = data;
  }
  App.medicos = dataFinal.map(mapMedico);
}



/* Carregamento filtrado para usuário comum (role: 'usuario') */
async function carregarAgendamentosUsuario() {
  // Busca paciente pelo user_id
  const { data: pac } = await db.from('pacientes').select('id').eq('user_id', App.currentUser.id).maybeSingle();
  if (pac) App.currentUser.pacienteId = pac.id;
  if (!App.currentUser.pacienteId) return;
  const { data, error } = await db
    .from('agendamentos')
    .select('*')
    .eq('paciente_id', App.currentUser.pacienteId)
    .order('data', { ascending: false });
  if (!error && data) {
    const dataDesc = await cripto('descriptografar', 'agendamentos', data);
    App.agendamentos = dataDesc.map(mapAgendamento);
  }
}

async function carregarAnexosUsuario() {
  if (!App.currentUser.pacienteId) return;
  const { data, error } = await db
    .from('anexos')
    .select('*')
    .eq('paciente_id', App.currentUser.pacienteId)
    .order('criado_em', { ascending: false });
  if (!error && data) App.anexos = data.map(mapAnexo);
}

/* Carregamento filtrado para MÉDICO (role: 'medico') */
async function carregarAgendamentosMedico() {
  const medicoId = App.currentUser.medico_id;
  if (!medicoId) {
    App.agendamentos = [];
    App.beneficiarios = [];
    App.anexos = [];
    return;
  }

  // 1. Agendamentos com o medico_id deste médico
  const { data: agData, error: agErr } = await db
    .from('agendamentos')
    .select('*')
    .eq('medico_id', medicoId)
    .order('data', { ascending: false });

  if (agErr || !agData) { App.agendamentos = []; App.beneficiarios = []; App.anexos = []; return; }

  const agDesc = await cripto('descriptografar', 'agendamentos', agData);
  App.agendamentos = agDesc.map(mapAgendamento);

  // 2. IDs dos pacientes desses agendamentos (únicos)
  const pacIds = [...new Set(agData.map(a => a.paciente_id).filter(Boolean))];
  if (pacIds.length === 0) { App.beneficiarios = []; App.anexos = []; return; }

  // 3. Carregar só esses pacientes
  const { data: pacData } = await db
    .from('pacientes')
    .select('*')
    .in('id', pacIds);
  if (pacData && pacData.length) {
    let pacFinal = pacData;
    try { pacFinal = await cripto('descriptografar', 'pacientes', pacData); }
    catch (e) { console.error('Erro descript. pacientes (medico):', e); }
    App.beneficiarios = pacFinal.map(mapPaciente);
  } else {
    App.beneficiarios = [];
  }

  // 4. Carregar só os anexos desses pacientes
  const { data: anxData } = await db
    .from('anexos')
    .select('*')
    .in('paciente_id', pacIds)
    .order('criado_em', { ascending: false });
  App.anexos = (anxData && anxData.length) ? anxData.map(mapAnexo) : [];
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
  const isUsuario = App.currentUser && App.currentUser.role === 'usuario';
  // Usuário comum não acessa médicos e colaboradores
  if (isUsuario && ['medicos', 'colaboradores'].includes(pageId)) return;

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

