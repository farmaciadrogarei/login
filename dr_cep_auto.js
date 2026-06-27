// ============================================================
//  DR – Autopreenchimento de Endereço por CEP
//  Arquivo: dr_cep_auto.js
//  Carregue APÓS o index.html (de preferência no final do <body>).
//
//  O que faz:
//  ✅ Digitou o CEP e saiu do campo → preenche logradouro, bairro,
//     cidade e UF automaticamente (fonte: ViaCEP).
//  ✅ Aplica a máscara 00000-000 enquanto digita.
//
//  Detalhes de segurança:
//  • Só preenche campos VAZIOS — nunca sobrescreve o que foi digitado.
//  • Usa delegação de evento no document, então funciona mesmo com
//    campos que aparecem depois (troca de aba/página).
//  • API pública, gratuita, com CORS liberado (roda no navegador).
// ============================================================

(function () {
  'use strict';

  const LOG = '[DR CEP]';

  /* ─────────────────────────── CONFIGURAÇÃO ─────────────────────────── */
  // Campo de CEP  →  campos de destino do endereço.
  // (basta acrescentar outros blocos aqui se você tiver mais de um formulário)
  const MAPA_CEP = {
    'fCEP': {
      logradouro: 'fEndereco',
      bairro:     'fBairro',
      cidade:     'fCidade',
      uf:         'fEstado'
    }
  };

  const CONFIG = {
    autoCEP:           true,
    mascaraCEP:        true,   // aplica 00000-000 enquanto digita
    soPreencherVazios: true,   // nunca sobrescreve o que já foi digitado
    focarNumero:       'fNumero' // após preencher, dá foco neste campo (ou null)
  };

  /* ─────────────────────────── UTILITÁRIOS ──────────────────────────── */
  const digitos = (s) => (s || '').replace(/\D/g, '');
  const $ = (id) => document.getElementById(id);

  function aviso(msg, tipo) {
    if (typeof window.toast === 'function') window.toast(msg, tipo || 'info');
    else console.log(LOG, msg);
  }

  // Preenche um campo só se ele existir e (conforme config) estiver vazio.
  function setCampo(id, valor) {
    if (!id || valor == null || valor === '') return;
    const el = $(id);
    if (!el) return;
    if (CONFIG.soPreencherVazios && el.value && el.value.trim() !== '') return;
    el.value = valor;
    // Dispara 'input' e 'change' para o resto do sistema reagir (selects, validações etc.)
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ──────────────────────────── CEP (ViaCEP) ─────────────────────────── */
  const _cepEmAndamento = {};

  async function buscarCEP(idCampo) {
    const campo = $(idCampo);
    if (!campo) return;
    const cep = digitos(campo.value);
    if (cep.length !== 8) return;
    if (_cepEmAndamento[idCampo] === cep) return; // evita busca repetida
    _cepEmAndamento[idCampo] = cep;

    const mapa = MAPA_CEP[idCampo];
    try {
      const r = await fetch('https://viacep.com.br/ws/' + cep + '/json/');
      if (!r.ok) { aviso('Não foi possível consultar o CEP agora.', 'warn'); return; }
      const d = await r.json();
      if (d.erro) { aviso('CEP não encontrado.', 'warn'); return; }

      setCampo(mapa.logradouro, d.logradouro);
      setCampo(mapa.bairro,     d.bairro);
      setCampo(mapa.cidade,     d.localidade);
      setCampo(mapa.uf,         d.uf);

      aviso('Endereço preenchido pelo CEP.', 'ok');
      console.log(LOG, 'CEP', cep, '→', d.localidade + '/' + d.uf);

      // Conveniência: leva o cursor pro campo Número, que o CEP não preenche.
      if (CONFIG.focarNumero) {
        const num = $(CONFIG.focarNumero);
        if (num && !num.value) num.focus();
      }
    } catch (e) {
      console.warn(LOG, 'Falha ViaCEP:', e.message || e);
      aviso('Não foi possível consultar o CEP agora.', 'warn');
    } finally {
      setTimeout(() => { delete _cepEmAndamento[idCampo]; }, 1500);
    }
  }

  function mascararCEP(campo) {
    let v = digitos(campo.value).substring(0, 8);
    if (v.length > 5) v = v.replace(/(\d{5})(\d{1,3})/, '$1-$2');
    campo.value = v;
  }

  /* ──────────────────── DELEGAÇÃO DE EVENTOS NO DOCUMENT ─────────────── */
  // focusout = blur que "borbulha", então um único listener cobre o campo
  // mesmo que ele seja recriado dinamicamente.
  document.addEventListener('focusout', function (e) {
    const id = e.target && e.target.id;
    if (id && CONFIG.autoCEP && MAPA_CEP[id]) buscarCEP(id);
  });

  // Máscara leve de CEP durante a digitação.
  if (CONFIG.mascaraCEP) {
    document.addEventListener('input', function (e) {
      const id = e.target && e.target.id;
      if (id && MAPA_CEP[id]) mascararCEP(e.target);
    });
  }

  // Permite acionar manualmente, se precisar: window.drCEP.buscar('fCEP')
  window.drCEP = { buscar: buscarCEP, config: CONFIG, mapa: MAPA_CEP };

  console.log(LOG, '✅ Autopreenchimento de CEP ativo.');
})();
