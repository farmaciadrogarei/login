'use strict';

/* ═══════════════════════════════════════════════
   DR_ESPECIALISTAS – Especialistas Disponíveis
   Para adicionar/remover: edite o array abaixo
═══════════════════════════════════════════════ */

const ESPECIALISTAS = [
  { icon: '🔬', nome: 'Dermatologista',  desc: 'Especialista no diagnóstico e tratamento de doenças da pele, cabelos e unhas.' },
  { icon: '🩺', nome: 'Clínico Geral',   desc: 'Médico que realiza atendimentos gerais, prevenindo, diagnosticando e tratando diversas condições de saúde.' },
  { icon: '⚕️', nome: 'Cirurgião Geral', desc: 'Especialista em procedimentos cirúrgicos para tratar doenças e lesões em diferentes partes do corpo.' },
  { icon: '👶', nome: 'Pediatra',         desc: 'Médico responsável pelo acompanhamento da saúde de crianças e adolescentes, desde o nascimento até a adolescência.' },
  { icon: '👩‍⚕️', nome: 'Ginecologista',  desc: 'Especialista na saúde da mulher, realizando consultas de rotina, prevenção e tratamento ginecológico.' },
  { icon: '🤰', nome: 'Obstetrícia',      desc: 'Especialista no acompanhamento da gestação, parto e puerpério, cuidando da saúde da mãe e do bebê.' },
  { icon: '🦷', nome: 'Odontologista',    desc: 'Especialista em saúde bucal, realizando diagnóstico, prevenção e tratamento de doenças dos dentes e gengivas.' },
];

/* ── Renderiza cards na HOME ── */
function renderEspecialistasHome() {
  const grid = document.getElementById('gridEspecialistas');
  if (!grid) return;
  grid.innerHTML = ESPECIALISTAS.map(e => `
    <div class="esp-card" role="button" tabindex="0" data-desc="${e.desc}">
      <div class="esp-icon">${e.icon}</div>
      <span>${e.nome}</span>
    </div>`).join('');

  // Reanexar eventos de clique (modal de info)
  grid.querySelectorAll('.esp-card').forEach(card => {
    const abrirInfo = () => {
      const titulo = card.querySelector('span').textContent;
      const desc   = card.dataset.desc || '';
      abrirModal(titulo, `<p>${desc}</p>`);
    };
    card.addEventListener('click', abrirInfo);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirInfo(); }
    });
  });
}

/* ── Renderiza cards no AGENDAMENTO ── */
function renderEspecialistasSelect() {
  const grid = document.getElementById('selectGridEspecialistas');
  if (!grid) return;
  grid.innerHTML = ESPECIALISTAS.map(e => `
    <div class="esp-select-card" data-esp="${e.nome}">
      <span class="esp-sel-icon">${e.icon}</span>${e.nome}
    </div>`).join('');

  // Reanexar eventos de seleção
  grid.querySelectorAll('.esp-select-card').forEach(card => {
    card.addEventListener('click', () => {
      // Deselecionar todos (especialistas + exames)
      document.querySelectorAll('.esp-select-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      especialistaSelecionada = card.dataset.esp;
      document.getElementById('fAgendEsp').value = especialistaSelecionada;
    });
  });
}

/* ── Inicializa tudo após DOM pronto ── */
document.addEventListener('DOMContentLoaded', function() {
  renderEspecialistasHome();
  renderEspecialistasSelect();
});
