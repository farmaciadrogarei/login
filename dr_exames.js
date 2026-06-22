'use strict';

/* ═══════════════════════════════════════════════
   DR_EXAMES – Exames de Imagens
   Para adicionar/remover: edite o array abaixo
═══════════════════════════════════════════════ */

const EXAMES = [
  { icon: '🔍', nome: 'Endoscopia',           desc: 'Exame endoscópico para visualização do trato digestivo superior.' },
  { icon: '🦠', nome: 'Teste do Covid',        desc: 'Teste rápido ou laboratorial para detecção do vírus SARS-CoV-2.' },
  { icon: '📋', nome: 'Ultrassonografia',      desc: 'Exame de imagem por ondas de ultrassom para avaliação de órgãos internos.' },
  { icon: '🧪', nome: 'Hormonais',             desc: 'Exames para avaliação dos níveis hormonais no sangue.' },
  { icon: '🏥', nome: 'Exames Laboratoriais',  desc: 'Análises clínicas laboratoriais para diagnóstico de diversas condições de saúde.' },
  { icon: '💉', nome: 'Sorologia',             desc: 'Exames para detecção de anticorpos e diagnóstico de doenças infecciosas.' },
  { icon: '📋', nome: 'Rotina',                desc: 'Exames de rotina para acompanhamento geral da saúde.' },
  { icon: '👥', nome: 'PCCU',                  desc: 'Exame preventivo para rastreamento do câncer do colo do útero.' },
  { icon: '🧬', nome: 'Teste DNA',             desc: 'Teste de paternidade ou maternidade por análise do DNA.' },
  { icon: '🤱', nome: 'Beta HCG',              desc: 'Exame de sangue para detecção da gravidez e acompanhamento gestacional.' },
  { icon: '👣', nome: 'Teste do Pezinho',      desc: 'Triagem neonatal obrigatória para detecção precoce de doenças congênitas.' },
  { icon: '📄', nome: 'Outros Exames',         desc: 'Outros exames não listados acima. Consulte nossa equipe.' },
];

/* ── Renderiza cards na HOME ── */
function renderExamesHome() {
  const grid = document.getElementById('gridExames');
  if (!grid) return;
  grid.innerHTML = EXAMES.map(e => `
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
function renderExamesSelect() {
  const grid = document.getElementById('selectGridExames');
  if (!grid) return;
  grid.innerHTML = EXAMES.map(e => `
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
  renderExamesHome();
  renderExamesSelect();
});
