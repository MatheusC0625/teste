/* ==========================================================================
   script.js
   Organizado em módulos simples via IIFE, sem dependências externas.
   Seções: 1) Coração 3D  2) Fundo ambiente  3) Interação de clique
            4) Botão de música  5) Inicialização
   ========================================================================== */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  /* ========================================================================
     1) CORAÇÃO 3D FEITO DE PALAVRAS
     ======================================================================== */
  const HeartOfWords = (() => {
    const canvas = document.getElementById('heartCanvas');
    const ctx = canvas.getContext('2d');

    // Cores em RGB para permitir interpolação suave (mesmos tons do CSS)
    const COLOR_FAR = { r: 243, g: 214, b: 217 };   // --pink
    const COLOR_NEAR = { r: 94, g: 37, b: 48 };      // --wine-dark
    const COLOR_GOLD = { r: 200, g: 161, b: 92 };    // --gold

    // Parâmetros do modelo 3D (unidades independentes de pixel)
    const MODEL_MAX_R = 18;   // raio aproximado do desenho do coração
    const MAX_Z = 8;          // profundidade máxima do "bojo" do coração
    const FOCAL = 42;         // distância focal da perspectiva (quanto menor, mais dramático)
    const AUTO_ROT_SPEED = 0.0022; // radianos por ms — rotação contínua e suave

    let points = [];
    let cssWidth = 0;
    let cssHeight = 0;
    let scale = 1;

    let rotY = 0;
    let parallaxX = 0;
    let parallaxY = 0;
    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let lastTime = 0;
    let rafId = null;

    // Gera um ponto de texto dentro do formato de coração, com profundidade
    function makePoint() {
      const t = Math.random() * Math.PI * 2;
      // fator radial: aproxima o preenchimento por área (não só o contorno)
      const rf = Math.sqrt(Math.random());

      const baseX = 16 * Math.pow(Math.sin(t), 3);
      const baseY =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);

      const x = baseX * rf;
      const y = baseY * rf;
      // pontos centrais "incham" mais (bojo), pontos na borda ficam quase planos
      const z = (Math.random() * 2 - 1) * MAX_Z * (1 - rf);

      return {
        x,
        y,
        z,
        isGold: Math.random() < 0.07,
      };
    }

    function buildPoints() {
      const count = cssWidth < 420 ? 130 : cssWidth < 768 ? 165 : 195;
      points = Array.from({ length: count }, makePoint);
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      cssWidth = rect.width;
      cssHeight = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      scale = (Math.min(cssWidth, cssHeight) / 2) * 0.85 / MODEL_MAX_R;
      buildPoints();
    }

    function lerpColor(a, b, t) {
      return {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t,
      };
    }

    function draw(now) {
      if (!lastTime) lastTime = now;
      const dt = Math.min(now - lastTime, 48); // limita saltos ao trocar de aba
      lastTime = now;

      if (!prefersReducedMotion) {
        rotY += AUTO_ROT_SPEED * dt;
      }

      // suaviza o parallax do mouse (easing) para um movimento delicado
      parallaxX += (targetParallaxX - parallaxX) * 0.06;
      parallaxY += (targetParallaxY - parallaxY) * 0.06;

      const effRotY = rotY + parallaxY;
      const effRotX = 0.12 + parallaxX; // leve inclinação constante + mouse

      const cosY = Math.cos(effRotY);
      const sinY = Math.sin(effRotY);
      const cosX = Math.cos(effRotX);
      const sinX = Math.sin(effRotX);

      const centerX = cssWidth / 2;
      const centerY = cssHeight / 2;

      // calcula posição projetada de cada ponto (rotação rígida — o formato nunca muda)
      const projected = points.map((p) => {
        // rotação em Y
        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;
        // rotação em X (inclinação)
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        const perspective = FOCAL / (FOCAL + z2);

        return {
          screenX: centerX + x1 * scale * perspective,
          screenY: centerY - y2 * scale * perspective,
          perspective,
          isGold: p.isGold,
        };
      });

      // desenha do mais distante para o mais próximo (ordenação pintor)
      projected.sort((a, b) => a.perspective - b.perspective);

      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const minP = FOCAL / (FOCAL + MAX_Z);
      const maxP = FOCAL / (FOCAL - MAX_Z);

      for (const pt of projected) {
        const t = Math.max(0, Math.min(1, (pt.perspective - minP) / (maxP - minP)));
        const color = pt.isGold
          ? lerpColor(COLOR_FAR, COLOR_GOLD, 0.85)
          : lerpColor(COLOR_FAR, COLOR_NEAR, t);

        const opacity = 0.45 + t * 0.55;
        const fontSize = Math.max(7, 9 + t * 7);

        ctx.font = `600 ${fontSize.toFixed(1)}px 'Karla', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(${color.r | 0}, ${color.g | 0}, ${color.b | 0}, ${opacity.toFixed(2)})`;
        ctx.fillText('I love you', pt.screenX, pt.screenY);
      }

      rafId = requestAnimationFrame(draw);
    }

    function handlePointerMove(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
      const MAX_TILT = 0.16;
      targetParallaxX = Math.max(-1, Math.min(1, -ny)) * MAX_TILT;
      targetParallaxY = Math.max(-1, Math.min(1, nx)) * MAX_TILT;
    }

    function init() {
      resize();

      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resize, 150);
      });

      // Parallax reage ao mouse na página inteira, de forma bem sutil
      window.addEventListener('mousemove', (e) => {
        handlePointerMove(e.clientX, e.clientY);
      });

      // Some com o parallax quando o mouse sai da janela
      window.addEventListener('mouseleave', () => {
        targetParallaxX = 0;
        targetParallaxY = 0;
      });

      // Pausa a animação quando a aba não está visível (economiza bateria)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          cancelAnimationFrame(rafId);
          rafId = null;
        } else if (!rafId) {
          lastTime = 0;
          rafId = requestAnimationFrame(draw);
        }
      });

      rafId = requestAnimationFrame(draw);
    }

    return { init, canvas };
  })();

  /* ========================================================================
     2) FUNDO AMBIENTE — estrelas discretas e corações que sobem devagar
     ======================================================================== */
  const AmbientBackground = (() => {
    const container = document.getElementById('ambientBg');

    function createStars(count) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = 1 + Math.random() * 2;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.animationDuration = `${3 + Math.random() * 4}s`;
        star.style.animationDelay = `${Math.random() * 4}s`;
        fragment.appendChild(star);
      }
      container.appendChild(fragment);
    }

    function createDriftHearts(count) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < count; i++) {
        const heart = document.createElement('span');
        heart.className = 'drift-heart';
        heart.textContent = '❤';
        heart.style.left = `${5 + Math.random() * 90}%`;
        heart.style.setProperty('--drift-x', `${(Math.random() * 60 - 30).toFixed(0)}px`);
        const duration = 20 + Math.random() * 14;
        heart.style.animationDuration = `${duration}s`;
        heart.style.animationDelay = `-${(Math.random() * duration).toFixed(1)}s`;
        fragment.appendChild(heart);
      }
      container.appendChild(fragment);
    }

    function init() {
      if (prefersReducedMotion) return; // respeita a preferência do usuário
      createStars(32);
      createDriftHearts(6);
    }

    return { init };
  })();

  /* ========================================================================
     3) INTERAÇÃO DE CLIQUE NO CORAÇÃO — frases e corações que sobem
     ======================================================================== */
  const ClickInteraction = (() => {
    const canvas = HeartOfWords.canvas;
    const phraseCard = document.getElementById('phraseCard');
    const floatingContainer = document.getElementById('floatingHearts');
    const hint = document.getElementById('heartHint');

    const PHRASES = [
      'Você é meu lugar favorito.',
      'Meu mundo fica melhor com você.',
      'Cada dia ao seu lado vale a pena.',
      'Eu escolheria você em todas as vidas.',
      'Seu sorriso é o meu lugar seguro.',
      'Com você, até o simples vira especial.',
      'Te amo em cada versão de mim.',
      'Você é o meu capítulo favorito.',
    ];

    let lastIndex = -1;
    let phraseTimeout = null;

    function pickPhrase() {
      let index;
      do {
        index = Math.floor(Math.random() * PHRASES.length);
      } while (index === lastIndex && PHRASES.length > 1);
      lastIndex = index;
      return PHRASES[index];
    }

    function showPhrase() {
      clearTimeout(phraseTimeout);
      phraseCard.textContent = pickPhrase();
      phraseCard.classList.add('is-visible');
      phraseTimeout = setTimeout(() => {
        phraseCard.classList.remove('is-visible');
      }, 3400);
    }

    function spawnHearts(x, y) {
      const total = prefersReducedMotion ? 0 : 7;
      for (let i = 0; i < total; i++) {
        const heart = document.createElement('span');
        heart.className = 'click-heart';
        heart.textContent = Math.random() > 0.5 ? '❤' : '♡';
        heart.style.left = `${x + (Math.random() * 30 - 15)}px`;
        heart.style.top = `${y}px`;
        heart.style.setProperty('--tx', `${(Math.random() * 70 - 35).toFixed(0)}px`);
        heart.style.animationDelay = `${(i * 40)}ms`;
        floatingContainer.appendChild(heart);
        setTimeout(() => heart.remove(), 2200);
      }
    }

    function handleClick(e) {
      spawnHearts(e.clientX, e.clientY);
      showPhrase();
      if (hint) hint.classList.add('is-hidden');
    }

    function init() {
      canvas.addEventListener('click', handleClick);
    }

    return { init };
  })();

  /* ========================================================================
     4) BOTÃO DE MÚSICA — tocada via player oculto do YouTube (sem arquivo local)
     ======================================================================== */
  const MusicPlayer = (() => {
    const button = document.getElementById('musicToggle');

    // Frou Frou - "A New Kind of Love" (áudio oficial). Pra trocar a música,
    // troque só este ID pelo de outro vídeo do YouTube (a parte depois de
    // "watch?v=" na URL do vídeo).
    const VIDEO_ID = 'vWwIBemUwOI';

    let player = null;
    let isReady = false;
    let wantsToPlayOnReady = false; // guarda o clique caso o player ainda não tenha carregado

    function setPlayingState(isPlaying) {
      button.classList.toggle('is-playing', isPlaying);
      button.setAttribute('aria-pressed', String(isPlaying));
      button.setAttribute('aria-label', isPlaying ? 'Pausar música' : 'Tocar música');
    }

    function createPlayer() {
      player = new window.YT.Player('ytAudioPlayer', {
        videoId: VIDEO_ID,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          loop: 1,
          playlist: VIDEO_ID, // necessário para o loop funcionar no player embutido
        },
        events: {
          onReady: () => {
            isReady = true;
            if (wantsToPlayOnReady) player.playVideo();
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) setPlayingState(true);
            if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              setPlayingState(false);
            }
          },
        },
      });
    }

    function loadYouTubeApi() {
      // Se o script da API já foi carregado (ex: navegação de volta), reaproveita.
      if (window.YT && window.YT.Player) {
        createPlayer();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
      // A API do YouTube chama essa função global quando termina de carregar.
      window.onYouTubeIframeAPIReady = createPlayer;
    }

    function toggle() {
      if (!isReady) {
        // Usuário clicou rápido antes do player carregar — lembramos a intenção.
        wantsToPlayOnReady = !wantsToPlayOnReady;
        return;
      }
      const state = player.getPlayerState();
      if (state === window.YT.PlayerState.PLAYING) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    }

    function init() {
      button.addEventListener('click', toggle);
      loadYouTubeApi();
    }

    return { init };
  })();

  /* ========================================================================
     5) INICIALIZAÇÃO
     ======================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    HeartOfWords.init();
    AmbientBackground.init();
    ClickInteraction.init();
    MusicPlayer.init();
  });
})();
