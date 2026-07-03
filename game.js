/* ===========================================================================
   SUCATA SURVIVOR  —  protótipo survivor-like (Vampire Survivors / Brotato)
   Assets: CraftPix "Free Roguelike Shoot 'em up Pixel Art Game Kit"
   Tudo em um arquivo. Sem dependências.
   =========================================================================== */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, ZOOM = 2.8;
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  // zoom inteiro evita costuras entre tiles (pixel-perfect)
  ZOOM = Math.max(2, Math.min(4, Math.round(Math.min(W, H) / 300)));
}
window.addEventListener('resize', resize);
resize();

/* ---------------------------------------------------------------- assets -- */
const SRC = {
  walk:'assets/char/walk.png', death:'assets/char/death.png',
  hit:'assets/fx/hit.png', muzzle:'assets/fx/muzzle.png', boom:'assets/fx/boom.png', expl5:'assets/fx/expl5.png', boom1expl:'assets/fx/boom1expl.png',
  // disparos (flash do bico) — um por arma
  fl_bullet:'assets/fx/flash_bullet.png', fl_skull:'assets/fx/flash_skull.png',
  fl_spike:'assets/fx/flash_spike.png', fl_feather:'assets/fx/flash_feather.png',
  fl_missile:'assets/fx/flash_missile.png',
  dust:'assets/objects/dust.png',
  bullet:'assets/proj/bullet.png', spike:'assets/proj/spike.png',
  skull:'assets/proj/skull.png', feather:'assets/proj/feather.png', missile:'assets/proj/missile.png',
  e1r:'assets/enemy/e1_run.png', e1d:'assets/enemy/e1_death.png',
  e2r:'assets/enemy/e2_run.png', e2d:'assets/enemy/e2_death.png',
  e3r:'assets/enemy/e3_run.png', e3d:'assets/enemy/e3_death.png',
  e4r:'assets/enemy/e4_run.png', e4d:'assets/enemy/e4_death.png',
  g1:'assets/tiles/g1.png', g2:'assets/tiles/g2.png', g3:'assets/tiles/g3.png',
  grass:'assets/objects/grass.png', rock:'assets/objects/rock.png',
  portal:'assets/objects/portal.png', gem:'assets/objects/gem.png',
  pt_start:'assets/objects/portal_start.png', pt_idle:'assets/objects/portal_idle.png',
  ei01:'assets/enemy/icon_01.png', ei02:'assets/enemy/icon_02.png', ei03:'assets/enemy/icon_03.png',
  ei04:'assets/enemy/icon_04.png', ei05:'assets/enemy/icon_05.png', ei06:'assets/enemy/icon_06.png',
  droppod:'assets/objects/droppod.png', dust:'assets/objects/dust.png', w7barrier:'assets/fx/w7barrier.png',
  target:'assets/objects/target.png', boom1:'assets/objects/boom1.png', orb8:'assets/fx/orb8.png',
  hp_back:'assets/gui/hp_back.png', hp_green:'assets/gui/hp_green.png',
  hp_red:'assets/gui/hp_red.png', cursor:'assets/gui/cursor.png', logo:'assets/gui/logo.png',
  main:'assets/gui/main.png', main_alert:'assets/gui/main_alert.png', main_radio:'assets/gui/main_radio.png',
  w01:'assets/weapons/icon_01.png', w02:'assets/weapons/icon_02.png', w03:'assets/weapons/icon_03.png',
  w04:'assets/weapons/icon_04.png', w05:'assets/weapons/icon_05.png', w06:'assets/weapons/icon_06.png',
  w07:'assets/weapons/icon_07.png', w08:'assets/weapons/icon_08.png', w09:'assets/weapons/icon_09.png',
  // sprites de arma (9 frames de mira) que orbitam o personagem
  s_bullet:'assets/weapons/w_bullet.png', s_skull:'assets/weapons/w_skull.png',
  s_spike:'assets/weapons/w_spike.png', s_feather:'assets/weapons/w_feather.png',
  s_missile:'assets/weapons/w_missile.png',
};
const IMG = {};
const ASSET_VER = '1.0.0';   // versão do build — bump ao atualizar assets (cache no portal)
function loadAll(cb, onProgress) {
  const keys = Object.keys(SRC);
  const total = keys.length;
  let done = 0;
  const tick = () => { done++; if (onProgress) onProgress(done / total); if (done === total) cb(); };
  keys.forEach(k => {
    const im = new Image();
    im.onload = tick;
    im.onerror = () => { console.warn('falhou', SRC[k]); tick(); };
    im.src = SRC[k] + '?v=' + ASSET_VER;
    IMG[k] = im;
  });
}
function setBootProgress(frac) {
  const fill = document.getElementById('bootFill');
  const pct = document.getElementById('bootPct');
  const p = Math.round(frac * 100);
  if (fill) fill.style.width = p + '%';
  if (pct) pct.textContent = p + '%';
}
function hideBootScreen() {
  const b = document.getElementById('ui-boot');
  if (!b) return;
  b.classList.add('hide');
  setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 550);
}

/* --- mede o BICO real de cada arma (por frame) e o recuo do flash, lendo pixels --- */
const MUZZLE_OFF = {};   // [sheet][frame] = [dx,dy] da ponta da arma (relativo ao centro)
const FLASH_BACK = {};   // [flashKey] = distância da borda traseira do efeito ao centro do quadro
function measureSprites() {
  const off = document.createElement('canvas'); off.width = 96; off.height = 96;
  const o = off.getContext('2d'); o.imageSmoothingEnabled = false;
  const scan = (img, fw, fh, idx) => {
    o.clearRect(0, 0, 96, 96); o.drawImage(img, idx * fw, 0, fw, fh, 0, 0, fw, fh);
    try { return o.getImageData(0, 0, fw, fh).data; } catch (e) { return null; }
  };
  for (const id in WEAPONS) {
    const sheet = WEAPONS[id].sheet, img = IMG[sheet];
    MUZZLE_OFF[sheet] = [];
    for (let f = 0; f < 9; f++) {
      const aim = (4 - f) * Math.PI / 8;          // direção representada por este frame (leste-hemisfério)
      const d = scan(img, 48, 48, f);
      let best = -1e9, bx = 24, by = 24;
      if (d) {
        const ca = Math.cos(aim), sa = Math.sin(aim);
        for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
          if (d[(y * 48 + x) * 4 + 3] > 40) { const pr = (x - 24) * ca + (y - 24) * sa; if (pr > best) { best = pr; bx = x; by = y; } }
        }
      }
      MUZZLE_OFF[sheet].push([bx - 24, by - 24]);    // ponta na direção do frame
    }
    // recuo do flash: borda traseira (esquerda) do conteúdo no quadro 96
    const fk = WEAPONS[id].flash, fimg = IMG[fk];
    const fd = scan(fimg, 96, 96, 2);
    let minX = 999;
    if (fd) for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { if (fd[(y * 96 + x) * 4 + 3] > 40 && x < minX) minX = x; }
    FLASH_BACK[fk] = (minX === 999) ? 44 : (48 - minX);
  }
}

/* --------------------------------------------------------- sprite helpers -- */
function drawFrame(img, fw, fh, idx, x, y, rot, scale, flip) {
  if (!img.complete || img.naturalWidth === 0) return;
  scale = scale || 1;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(flip ? -scale : scale, scale);
  ctx.drawImage(img, idx * fw, 0, fw, fh, -fw / 2, -fh / 2, fw, fh);
  ctx.restore();
}
function drawImg(img, x, y, rot, scale, flip) {
  if (!img.complete || img.naturalWidth === 0) return;
  scale = scale || 1;
  const w = img.naturalWidth, h = img.naturalHeight;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(flip ? -scale : scale, scale);
  ctx.drawImage(img, -w / 2, -h / 2);
  ctx.restore();
}

/* ------------------------------------------------------ CrazyGames SDK v3 -- */
/* Wrapper seguro: se o SDK não existir (dev local, outro portal), tudo vira
   no-op e os ads "passam direto" — o jogo nunca quebra fora do CrazyGames. */
const CG = (() => {
  const sdk = () => (window.CrazyGames && window.CrazyGames.SDK) || null;
  let ready = false;      // init concluído com sucesso
  let gpActive = false;   // gameplayStart em vigor (evita chamadas duplicadas)
  let adActive = false;   // um ad está tocando agora

  async function init() {
    // timeout evita tela travada se o SDK não responder (ex.: adblock, rede ruim)
    try {
      if (sdk()) {
        await Promise.race([
          sdk().init(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
        ]);
        ready = true;
      }
    } catch (e) { ready = false; console.warn('CG init falhou/timeout', e); }
  }
  const safe = fn => { try { if (ready) fn(sdk()); } catch (e) { /* silencioso */ } };

  return {
    init,
    get available() { return ready; },
    get adPlaying() { return adActive; },
    loadingStart() { safe(s => s.game.loadingStart()); },
    loadingStop()  { safe(s => s.game.loadingStop()); },
    happytime()    { safe(s => s.game.happytime()); },
    gameplayStart() { if (gpActive) return; gpActive = true; safe(s => s.game.gameplayStart()); },
    gameplayStop()  { if (!gpActive) return; gpActive = false; safe(s => s.game.gameplayStop()); },

    /* Respeita o mute do player do CrazyGames (settings.muteAudio). Aplica o
       estado atual e escuta mudanças; tem prioridade sobre o mute in-game. */
    initMute(apply) {
      if (!ready) return;
      try {
        const g = sdk().game;
        const read = () => { try { return !!(g.settings && g.settings.muteAudio); } catch (e) { return false; } };
        apply(read());
        g.addSettingsChangeListener(s => apply(!!(s && s.muteAudio)));
      } catch (e) {}
    },

    /* Storage persistente: usa o SDK.data do CrazyGames (salva por usuário,
       sincroniza entre dispositivos) quando disponível; senão localStorage.
       Escreve nos dois; na leitura prioriza o SDK.data. */
    get(key) {
      try { if (ready && sdk().data) { const v = sdk().data.getItem(key); if (v != null) return v; } } catch (e) {}
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
      try { if (ready && sdk().data) sdk().data.setItem(key, value); } catch (e) {}
      try { localStorage.setItem(key, value); } catch (e) {}
    },
    remove(key) {
      try { if (ready && sdk().data) sdk().data.removeItem(key); } catch (e) {}
      try { localStorage.removeItem(key); } catch (e) {}
    },

    /* Pede um ad ao portal. Durante o ad: muta o áudio e pausa o jogo;
       restaura no fim/erro. onDone(true=sucesso|false=erro) sempre é chamado.
       Sem SDK: chama onDone(true) na hora (dev local segue jogável). */
    requestAd(type, onDone) {
      const finish = ok => {
        if (adActive) { adActive = false; soundMuted = _preAdMuted; }
        if (onDone) onDone(ok);
      };
      if (!ready) { if (onDone) onDone(true); return; }   // fora do portal: segue
      try {
        console.log('[CG] requestAd:', type);
        sdk().ad.requestAd(type, {
          adStarted:  () => { console.log('[CG] adStarted:', type); adActive = true; _preAdMuted = soundMuted; soundMuted = true; if (game) game.paused = true; },
          adFinished: () => { console.log('[CG] adFinished:', type); finish(true); },
          adError:    (e) => { console.warn('[CG] adError:', type, e); finish(false); },
        });
      } catch (e) { console.warn('[CG] requestAd threw:', type, e); finish(false); }
    },

    /* Envia o score ao leaderboard do CrazyGames. Exige a Encryption Key gerada
       no painel ao criar o leaderboard (cole em LEADERBOARD_KEY). Sem chave ou
       sem SDK, vira no-op — o jogo segue normal fora do portal. */
    async submitScore(score) {
      if (!ready || !LEADERBOARD_KEY) return;
      try {
        const encryptedScore = await encryptScore(score, LEADERBOARD_KEY);
        sdk().user.submitScore({ encryptedScore, score });
      } catch (e) { console.warn('submitScore falhou', e); }
    },
  };
})();
let _preAdMuted = false;

/* ------------------------------------------------------- leaderboard -- */
/* Cole aqui a Encryption Key gerada no painel do CrazyGames ao criar o
   leaderboard (Dashboard → seu jogo → Leaderboards). Enquanto vazia, o envio
   de score fica desativado e o jogo funciona normalmente. */
const LEADERBOARD_KEY = '';
/* Criptografa o score em AES-GCM (formato exigido pelo CrazyGames): IV de 12
   bytes gerado por request, prefixado ao ciphertext, tudo em base64. */
async function encryptScore(score, encryptionKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const algorithm = { name: 'AES-GCM', iv };
  const keyBytes = new Uint8Array(atob(encryptionKey).split('').map(c => c.charCodeAt(0)));
  const cryptoKey = await window.crypto.subtle.importKey('raw', keyBytes, algorithm, false, ['encrypt']);
  const dataBuffer = new TextEncoder().encode(score.toString());
  const encryptedBuffer = await window.crypto.subtle.encrypt(algorithm, cryptoKey, dataBuffer);
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/* --------------------------------------------- meta-progressão (sucata) -- */
/* Moeda persistente (sucata) ganha ao fim de cada partida, gasta em upgrades
   permanentes de arma no menu. Persiste em localStorage; aplica-se a toda
   instância da arma (inicial ou pega no level-up). */
const META_KEY = 'ss_meta';
const START_COINS = 60;                         // sucata inicial (dá p/ 2 upgrades básicos)
// tracks de upgrade por arma: nível máx, custos por nível, efeito por nível
const WUP = {
  // dano: linear (+15%/nv). Cadência buffada p/ +12% (paridade melhor com dano).
  // Projéteis é de LONGE o mais forte (cada +1 ~dobra o DPS de armas de tiro único),
  // então é o upgrade premium: bem mais caro e escalonado.
  dmg:   { key: 'up_dmg',   max: 5, cost: [30, 55, 95, 160, 260], per: 0.15, fmt: v => '+' + Math.round(v * 100) + '%' },
  fire:  { key: 'up_fire',  max: 5, cost: [30, 55, 95, 160, 260], per: 0.12, fmt: v => '+' + Math.round(v * 100) + '%' },
  count: { key: 'up_count', max: 3, cost: [150, 400, 900],        per: 1,    fmt: v => '+' + v },
};
const WUP_ORDER = ['dmg', 'fire', 'count'];
let META = { coins: 0, up: {} };
let metaLoaded = false;   // true quando lemos dados REAIS do storage (ou mutamos em memória)
function metaLoad() {
  let data = null;
  try { data = JSON.parse(CG.get(META_KEY) || 'null'); } catch (e) { data = null; }
  if (data && typeof data.coins === 'number') {
    META = data;
    if (!META.up) META.up = {};
    metaLoaded = true;                        // dados reais carregados
  } else {
    META = { coins: START_COINS, up: {} };    // sem dados (novo jogador OU storage ainda não pronto)
  }
}
/* Reboot da leitura: se o boot leu vazio (SDK.data pode não estar pronto logo
   após init), tenta de novo quando o menu aparece — sem clobber, porque só
   re-lê enquanto NÃO temos dados reais nem mudanças em memória. */
function ensureMeta() { if (!metaLoaded) metaLoad(); }
function metaSave() { try { CG.set(META_KEY, JSON.stringify(META)); } catch (e) {} }
function upLvl(wid, tr) { return (META.up[wid] && META.up[wid][tr]) || 0; }
function upCost(tr, lvl) { const d = WUP[tr]; return lvl < d.max ? d.cost[lvl] : null; }
function buyUpgrade(wid, tr) {
  const lvl = upLvl(wid, tr), cost = upCost(tr, lvl);
  if (cost == null || META.coins < cost) return false;
  META.coins -= cost;
  (META.up[wid] = META.up[wid] || {})[tr] = lvl + 1;
  metaLoaded = true;   // estado em memória agora é autoritativo
  metaSave();
  return true;
}
function coinsForScore(score) { return Math.max(5, Math.round(score / 50)); }  // sucata ~ score/50
function awardCoins(score) {                     // soma e persiste
  const c = coinsForScore(score);
  META.coins += c; metaLoaded = true; metaSave(); return c;
}
/* credita a sucata da run UMA vez, só quando ela termina de fato (não em morte
   que será revivida). Guardado por game.coinsAwarded. */
function finalizeRun() {
  if (!game || game.coinsAwarded) return 0;
  game.coinsAwarded = true;
  return awardCoins(calcScore());
}

/* --------------------------------------------------------------- i18n -- */
/* Textos do jogo em EN (padrão global) e PT-BR. A fala dos bosses é gibberish
   alienígena de propósito — não entra aqui. Idioma detectado pelo locale do
   CrazyGames (systemInfo.locale), com fallback navigator.language e escolha
   manual persistida em localStorage. */
const I18N = {
  en: {
    tagline: '— ROBOT SPIDER · COMBAT UNIT —',
    records: '★ RECORDS', best_time: 'BEST TIME', best_level: 'MAX LEVEL', best_score: 'BEST SCORE',
    pilot: 'PILOT', starting_weapon: '⚔ STARTING WEAPON',
    choose_weapon: 'Choose which weapon to start with. Tap to select.',
    play: '▶ PLAY', weapon_label: 'WEAPON', hover_weapon: 'Hover over a weapon',
    key_space: 'SPACE', ctrl_move: 'Move', ctrl_discharge: 'Discharge', ctrl_pause: 'Pause',
    ctrl_drag: '☝ Drag to move', ctrl_tap_discharge: '⚡ Tap to discharge', ctrl_autoaim: '🎯 Auto-aim',
    paused: 'PAUSED', paused_sub: 'GAME PAUSED', resume: '▶ RESUME', menu: '↺ Menu',
    new_level: '✨ LEVEL UP!', choose_reward: 'Choose a reward',
    new_weapon: 'New Weapon', upgrade: 'Upgrade', passive: 'Passive', level: 'Level',
    you_fell: 'You Fell!', revive: '⚡ Revive', restart: '↺ Restart',
    new_record: '🏆 NEW RECORD!', previous: 'Previous: {0}', score: 'SCORE',
    time_survived: 'Time Survived', kills: 'Kills',
    upgrades_hdr: 'UPGRADES', up_dmg: 'Damage', up_fire: 'Fire Rate', up_count: 'Projectiles',
    up_max: 'MAX', scrap_earned: '⚙ Scrap earned', locked_hint: 'Select a weapon to upgrade it',
    all_maxed: '★ ALL MAXED! +{0} HP',
    prepare: 'Get ready...', wave: 'Wave {0}', lvl_short: 'Lv {0}', kills_count: '{0} Kills',
    pts: 'PTS', drone: 'DRONE', radar: 'RADAR',
    ready: '⚡ READY!', charge_short: '⚡ CHARGE', discharge: '⚡ DISCHARGE', low_hp: 'LOW HP! Kit in {0}s',
    tip_Zrk: 'They are FAST! Keep moving — shoot and retreat!',
    tip_Glub: 'TOUGH! Keep your distance and use discharge!',
    tip_Vrox: 'GIANT detected! Circle around, do not let it touch you!',
    tip_Skiv: 'NIMBLE all around! Take out the boss first!',
    tip_default: 'Keep moving!',
    w_bullet: 'Auto Cannon',   w_bullet_d: 'Rapid fire at the nearest target.',
    w_spike: 'Crystal Shard',  w_spike_d: 'Pierces several enemies in a line.',
    w_feather: 'Feather Fan',  w_feather_d: 'Fires a fan of projectiles.',
    w_skull: 'Hunter Skull',   w_skull_d: 'Fast homing projectile.',
    w_missile: 'Rocket',       w_missile_d: 'Slow, explodes for area damage.',
    p_pdmg: 'Heavy Ammo',      p_pdmg_d: '+20% damage to everything.',
    p_pfire: 'Overclock',      p_pfire_d: '+15% fire rate.',
    p_pspeed: 'Servo Motors',  p_pspeed_d: '+12% movement speed.',
    p_php: 'Armor Plating',    p_php_d: '+25 max HP and heal.',
    p_pmag: 'Scrap Magnet',    p_pmag_d: '+45% pickup range.',
  },
  pt: {
    tagline: '— ROBÔ ARANHA · UNIDADE DE COMBATE —',
    records: '★ RECORDES', best_time: 'MELHOR TEMPO', best_level: 'NÍVEL MÁX.', best_score: 'MELHOR SCORE',
    pilot: 'PILOTO', starting_weapon: '⚔ ARMA INICIAL',
    choose_weapon: 'Escolha com qual arma você quer começar. Toque para selecionar.',
    play: '▶ JOGAR', weapon_label: 'ARMA', hover_weapon: 'Passe o cursor sobre uma arma',
    key_space: 'ESPAÇO', ctrl_move: 'Mover', ctrl_discharge: 'Descarga', ctrl_pause: 'Pausar',
    ctrl_drag: '☝ Arraste para mover', ctrl_tap_discharge: '⚡ Toque p/ descarga', ctrl_autoaim: '🎯 Mira automática',
    paused: 'PAUSADO', paused_sub: 'JOGO EM PAUSA', resume: '▶ CONTINUAR', menu: '↺ Menu',
    new_level: '✨ NOVO NÍVEL!', choose_reward: 'Escolha uma recompensa',
    new_weapon: 'Nova Arma', upgrade: 'Melhorar', passive: 'Passiva', level: 'Nível',
    you_fell: 'Você Caiu!', revive: '⚡ Reviver', restart: '↺ Recomeçar',
    new_record: '🏆 NOVO RECORDE!', previous: 'Anterior: {0}', score: 'PONTUAÇÃO',
    time_survived: 'Tempo Sobrevivido', kills: 'Abates',
    upgrades_hdr: 'MELHORIAS', up_dmg: 'Dano', up_fire: 'Cadência', up_count: 'Projéteis',
    up_max: 'MÁX', scrap_earned: '⚙ Sucata coletada', locked_hint: 'Selecione uma arma para melhorá-la',
    all_maxed: '★ TUDO NO MÁXIMO! +{0} HP',
    prepare: 'Preparar...', wave: 'Onda {0}', lvl_short: 'Nv {0}', kills_count: '{0} Abates',
    pts: 'PTS', drone: 'DRONE', radar: 'RADAR',
    ready: '⚡ PRONTO!', charge_short: '⚡ CARGA', discharge: '⚡ DESCARGA', low_hp: 'VIDA BAIXA! Kit em {0}s',
    tip_Zrk: 'São VELOZES! Não pare — atire em movimento e recue!',
    tip_Glub: 'RESISTENTE! Mantenha distância e use a descarga!',
    tip_Vrox: 'GIGANTE detectado! Gire ao redor e não deixe encostar!',
    tip_Skiv: 'ÁGEIS por todos os lados! Elimine o chefe primeiro!',
    tip_default: 'Fique em movimento!',
    w_bullet: 'Canhão Automático', w_bullet_d: 'Disparos rápidos no alvo mais próximo.',
    w_spike: 'Estilhaço de Cristal', w_spike_d: 'Atravessa vários inimigos em linha.',
    w_feather: 'Leque de Penas',   w_feather_d: 'Dispara um leque de projéteis.',
    w_skull: 'Caveira Caçadora',   w_skull_d: 'Projétil veloz que persegue.',
    w_missile: 'Foguete',          w_missile_d: 'Lento, explode causando dano em área.',
    p_pdmg: 'Munição Pesada',      p_pdmg_d: '+20% de dano em tudo.',
    p_pfire: 'Sobrecarga',         p_pfire_d: '+15% de cadência de tiro.',
    p_pspeed: 'Servo-Motores',     p_pspeed_d: '+12% de velocidade de movimento.',
    p_php: 'Blindagem',            p_php_d: '+25 de HP máximo e cura.',
    p_pmag: 'Ímã de Sucata',       p_pmag_d: '+45% de alcance de coleta.',
  },
};
let LANG = 'en';
function detectLang() {
  const saved = CG.get('ss_lang');
  if (saved && I18N[saved]) return saved;         // escolha manual tem prioridade
  let loc = '';
  try { loc = (window.CrazyGames && CrazyGames.SDK && CrazyGames.SDK.user &&
               CrazyGames.SDK.user.systemInfo && CrazyGames.SDK.user.systemInfo.locale) || ''; } catch (e) {}
  if (!loc) loc = navigator.language || navigator.userLanguage || 'en';
  const code = String(loc).toLowerCase().slice(0, 2);
  return I18N[code] ? code : 'en';
}
function t(key, a0) {
  let s = (I18N[LANG] && I18N[LANG][key]);
  if (s == null) s = (I18N.en[key] != null ? I18N.en[key] : key);
  if (a0 !== undefined) s = s.replace('{0}', a0);
  return s;
}
function nf(n) { return n.toLocaleString(LANG === 'pt' ? 'pt-BR' : 'en-US'); }
function localizeDefs() {
  for (const id in WEAPONS) { WEAPONS[id].name = t('w_' + id); WEAPONS[id].desc = t('w_' + id + '_d'); }
  for (const id in PASSIVES) { PASSIVES[id].name = t('p_' + id); PASSIVES[id].desc = t('p_' + id + '_d'); }
}
function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.documentElement.lang = LANG === 'pt' ? 'pt-BR' : 'en';
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('lang-on', b.getAttribute('data-lang') === LANG);
  });
}
function setLang(code) {
  if (!I18N[code]) return;
  LANG = code;
  CG.set('ss_lang', code);
  localizeDefs();
  applyStaticI18n();
  if (typeof rebuildMenuGrid === 'function') rebuildMenuGrid();
}

/* ----------------------------------------------------------------- input -- */
const keys = {};
let soundMuted = false;    // mute manual do jogador (botão 🔊)
let portalMuted = false;   // mute pedido pelo CrazyGames (tem prioridade)
addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') { keys[' '] = true; e.preventDefault(); }
  if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
    if (!game || !game.running || game.over) return;
    const lvlUp = document.getElementById('ui-levelup').classList.contains('show');
    if (lvlUp) return;
    if (document.getElementById('ui-pause').classList.contains('show')) resumeGame();
    else pauseGame();
  }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; if (e.key === ' ') keys[' '] = false; });
let mouse = { x: W / 2, y: H / 2 };
const htmlCursor = document.getElementById('html-cursor');
addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (htmlCursor) { htmlCursor.style.left = e.clientX + 'px'; htmlCursor.style.top = e.clientY + 'px'; }
});

/* ------------------------------------------------------------------ touch -- */
let IS_TOUCH = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if (IS_TOUCH && htmlCursor) htmlCursor.style.display = 'none';
const JOY_R = 52;          // raio máximo do arrasto do joystick
const touch = {
  active: false, id: null,
  ox: 0, oy: 0,            // origem do joystick (onde o dedo pousou)
  dx: 0, dy: 0,            // vetor -1..1
  btnOC:    { x: 0, y: 0, r: 34 },   // botão descarga (posicionado no drawHUD)
  btnPause: { x: 0, y: 0, r: 18 },   // botão pausa
};
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (!game || !game.running || game.over || game.paused) return;
  for (const t of e.changedTouches) {
    const x = t.clientX, y = t.clientY;
    // botão de descarga
    if (Math.hypot(x - touch.btnOC.x, y - touch.btnOC.y) < touch.btnOC.r + 14) {
      const p = game.player;
      if (p.overcharge >= p.ocMax) { overchargeBlast(); p.overcharge = 0; }
      continue;
    }
    // botão de pausa
    if (Math.hypot(x - touch.btnPause.x, y - touch.btnPause.y) < touch.btnPause.r + 12) {
      pauseGame();
      continue;
    }
    // joystick: primeiro dedo livre, nasce onde tocou
    if (!touch.active) {
      touch.active = true; touch.id = t.identifier;
      touch.ox = x; touch.oy = y; touch.dx = 0; touch.dy = 0;
    }
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (touch.active && t.identifier === touch.id) {
      let dx = t.clientX - touch.ox, dy = t.clientY - touch.oy;
      const d = Math.hypot(dx, dy);
      if (d > JOY_R) { dx = dx / d * JOY_R; dy = dy / d * JOY_R; }
      touch.dx = dx / JOY_R; touch.dy = dy / JOY_R;
    }
  }
}, { passive: false });
const touchEnd = e => {
  for (const t of e.changedTouches) {
    if (touch.active && t.identifier === touch.id) {
      touch.active = false; touch.id = null; touch.dx = 0; touch.dy = 0;
    }
  }
};
canvas.addEventListener('touchend', touchEnd);
canvas.addEventListener('touchcancel', touchEnd);

/* ----------------------------------------------------- weapon / passive db -- */
const WEAPONS = {
  bullet:  { name:'Canhão Automático', icon:'w04', sheet:'s_bullet', flash:'fl_bullet', desc:'Disparos rápidos no alvo mais próximo.',
             cd:0.35, dmg:8, speed:460, spr:'bullet', pierce:0, count:1, spread:0 },
  spike:   { name:'Estilhaço de Cristal', icon:'w06', sheet:'s_spike', flash:'fl_spike', desc:'Atravessa vários inimigos em linha.',
             cd:0.9, dmg:14, speed:420, spr:'spike', pierce:4, count:1, spread:0 },
  feather: { name:'Leque de Penas', icon:'w07', sheet:'s_feather', flash:'fl_feather', desc:'Dispara um leque de projéteis.',
             cd:0.8, dmg:7, speed:420, spr:'feather', pierce:1, count:3, spread:0.5 },
  skull:   { name:'Caveira Caçadora', icon:'w05', sheet:'s_skull', flash:'fl_skull', desc:'Projétil veloz que persegue.',
             cd:0.7, dmg:10, speed:380, spr:'skull', pierce:0, count:3, spread:0.45, homing:true },
  missile: { name:'Foguete', icon:'w03', sheet:'s_missile', flash:'fl_missile', desc:'Lento, explode causando dano em área.',
             cd:1.4, dmg:22, speed:320, spr:'missile', pierce:0, count:1, spread:0, aoe:60 },
};
const PASSIVES = {
  pdmg:   { name:'Munição Pesada', icon:'w01', desc:'+20% de dano em tudo.' },
  pfire:  { name:'Sobrecarga',     icon:'w02', desc:'+15% de cadência de tiro.' },
  pspeed: { name:'Servo-Motores',  icon:'w08', desc:'+12% de velocidade de movimento.' },
  php:    { name:'Blindagem',      icon:'w09', desc:'+25 de HP máximo e cura.' },
  pmag:   { name:'Ímã de Sucata',  icon:'w02', desc:'+45% de alcance de coleta.' },
};

/* --------------------------------------------------------- enemy archetypes -- */
const ETYPES = [
  { run:'e1r', die:'e1d', hp:14, speed:48, dmg:8,  r:9,  xp:1, scale:1.0, icon:'ei01', name:'Zrk' },
  { run:'e2r', die:'e2d', hp:22, speed:40, dmg:10, r:10, xp:1, scale:1.0, icon:'ei02', name:'Glub' },
  { run:'e3r', die:'e3d', hp:34, speed:34, dmg:14, r:11, xp:2, scale:1.0, icon:'ei03', name:'Vrox' },
  { run:'e4r', die:'e4d', hp:18, speed:56, dmg:9,  r:9,  xp:2, scale:1.0, icon:'ei04', name:'Skiv' },
];

const BOSS_PHRASES = {
  Zrk: [
    'KZZT VRRL! ZRK TAKA SPLK GNRR! BZZK TVRK SHAA DROOP KLZZT!',
    'ZRK ZRK ZRK! VRRM TAKA GNOP SPLIK! DRAAT KZZL SHVOP BLRRT!',
    'SPLK GNRR TZZK! ZRK DRAAT VRRL KLOOP! BZZK SHVAA TAKA GNOP!',
  ],
  Glub: [
    'GLUB GLUB SHLOOP! BRRP TAKA VNRR SPLIK DRAAT! KZZL GNOOP BLRP SHVAA!',
    'BLRP GLUB TZZK VNRR! SHLOOP DRAAT KZZP GNRR SPLK! TAKA BRRP VZZL!',
    'GNOOP SHLOOP GLUB! SPLK VRRL TAKA BZZK DRAAT! KZZL BLRP SHVAA GNRR!',
  ],
  Vrox: [
    'VROX GNARR! TZZK SHVAK KZZL DRAAT SPLK! BRRM GNOOP TAKA BLRRT VRRM!',
    'KZZL VROX VROX! DRAAT GNARR SHVAK TAKA! BZZK SPLK GNOOP BLRP KZZP!',
    'GNARR TZZK VROX! SHVAK SPLK DRAAT BRRM KZZL! GNOOP TAKA VRRM BLRRT!',
  ],
  Skiv: [
    'SKIV TAKA BZZK! KZZL SPLK GNRR DRAAT SHVOP! VRRL BLRP TZZK GNOOP VZZL!',
    'TZZK SKIV SPLK VRRL! BZZK GNRR KZZL SHVOP DRAAT! BLRP TAKA GNOOP VZZP!',
    'KZZL BZZK SKIV! SPLK SHVOP TAKA GNRR DRAAT VRRL! TZZK BLRP GNOOP KZZP!',
  ],
};

let bossRadio = null;
function showBossRadio(enemyType) {
  const phrases = BOSS_PHRASES[enemyType.name] || BOSS_PHRASES.Zrk;
  const phrase = phrases[(Math.random() * phrases.length) | 0];
  bossRadio = {
    icon: enemyType.icon, name: enemyType.name,
    text: '', fullText: phrase,
    charTimer: 0, charIdx: 0, charAge: 0,
    life: 14, phase: 'typing',
    playerMsg: I18N[LANG]['tip_' + enemyType.name] ? t('tip_' + enemyType.name) : t('tip_default'),
  };
  beep(200, 0.15, 'sawtooth', 0.04);
}

/* ------------------------------------------------------------------ state -- */
let game;
function calcScore() {
  return Math.floor(game.kills * 10 + (game.level - 1) * 50 + game.t * 2);
}

function newGame(startWeapon) {
  ensureMeta();   // garante upgrades permanentes carregados antes de criar as armas
  game = {
    t: 0, running: false, paused: false, over: false,
    cam: { x: 0, y: 0 },
    player: {
      x: 0, y: 0, vx: 0, vy: 0, speed: 86, facing: 1,
      hp: 100, maxhp: 100, anim: 0, moving: false,
      invuln: 0, dead: false, deathAnim: 0,
      magnet: 46, overcharge: 0, ocMax: 100,
    },
    weapons: [ mkWeapon(startWeapon || 'bullet') ],
    passives: {},          // id -> level
    mult: { dmg: 1, fire: 1 },
    enemies: [], projs: [], gems: [], fx: [], blastRings: [], portals: [], footprints: [], healthPacks: [], droppods: [],
    kills: 0, level: 1, xp: 0, xpNext: 5,
    spawnAccu: 0, revives: 0, stepAccu: 0, coinsAwarded: false,
    shake: 0, weaponOrbit: 0,
    orbLevel: 0, orbPos: null, orbAnimF: 0, orbAnimT: 0, orbLevelFlash: 0,
    // sistema de hordas (por tempo)
    wave: 0, waveTimer: 1,
  };
}
function mkWeapon(id) {
  const u = META.up[id] || {};   // multiplicadores da meta-progressão (permanentes)
  return {
    id, level: 1, timer: Math.random() * 0.3, wx: 0, wy: 0, aim: 0, recoil: 0,
    mDmg:   1 + (u.dmg || 0) * WUP.dmg.per,     // dano permanente
    mFire:  1 + (u.fire || 0) * WUP.fire.per,   // cadência permanente
    mCount: (u.count || 0),                     // projéteis extras permanentes
  };
}

/* ---------------------------------------------------------------- spawning -- */
// horda baseada em ondas: cada onda spawna portais, inimigos saem deles, boss no final
const WAVE_BASE = 8;
const PORTAL_SPAWN_CD = 0.4;

function waveEnemyCount(w) { return Math.round(WAVE_BASE * Math.pow(1.2, w - 1)); }
function difficulty() { return 1 + game.t / 40; }

function spawnEnemy(px, py, isBoss) {
  const d = difficulty();
  let pool = [0, 1];
  if (game.wave >= 2) pool.push(3);
  if (game.wave >= 4) pool.push(2);
  if (game.wave >= 6) pool.push(2, 3);
  const t = ETYPES[pool[(Math.random() * pool.length) | 0]];
  const bm = isBoss ? 5 : 1;                    // boss = 5× stats
  // HP escala com o tempo (d) E com a wave — acompanha o poder do jogador
  const hp = Math.round(t.hp * (1 + (d - 1) * 0.7) * (1 + game.wave * 0.15) * bm);
  const sc = isBoss ? 1.8 : t.scale;
  game.enemies.push({
    x: px, y: py, t, hp, maxhp: hp, speed: t.speed * (isBoss ? 0.7 : (0.9 + Math.random() * 0.2)),
    dmg: Math.round(t.dmg * bm * 0.8), r: t.r * (isBoss ? 1.6 : 1), anim: Math.random() * 6, flip: false,
    dying: false, dt: 0, hitFlash: 0, boss: !!isBoss, scale: sc,
    xpValue: isBoss ? t.xp * 10 : t.xp,
  });
  if (isBoss) showBossRadio(t);
}

// portal: posição fixa, brota do chão, fica ativo spawnando, depois fecha
function spawnPortal(x, y) {
  game.portals.push({
    x, y, state: 'opening', anim: 0, spawnTimer: 0,
    toSpawn: 0, spawned: 0, closing: false,
  });
}

function updateWaves(dt) {
  const p = game.player;
  const g = game;

  // despawna inimigos muito longe
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i]; if (e.dying || e.boss) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) > 500) g.enemies.splice(i, 1);
  }

  // atualiza TODOS os portais (de qualquer onda, sempre)
  for (let i = g.portals.length - 1; i >= 0; i--) {
    const pt = g.portals[i];
    if (pt.state === 'opening') {
      pt.anim += dt * 8;
      if (pt.anim >= 6) { pt.state = 'active'; pt.anim = 0; }
      continue;
    }
    if (pt.state === 'active') {
      pt.anim += dt * 8;
      // boss portal: spawna o boss primeiro
      if (pt.isBoss && !pt.bossSpawned) {
        pt.spawnTimer -= dt;
        if (pt.spawnTimer <= 0) { spawnEnemy(pt.x, pt.y, true); pt.bossSpawned = true; pt.spawnTimer = PORTAL_SPAWN_CD / difficulty(); }
      }
      if (pt.spawned >= pt.toSpawn) { pt.state = 'closing'; pt.anim = 5.99; continue; }
      pt.spawnTimer -= dt;
      if (pt.spawnTimer <= 0 && game.enemies.length < 300) {
        pt.spawnTimer = PORTAL_SPAWN_CD / difficulty();
        spawnEnemy(pt.x + rand(-14, 14), pt.y + rand(-8, 8), false);
        pt.spawned++;
      }
    }
    if (pt.state === 'closing') {
      pt.anim -= dt * 8;
      if (pt.anim <= 0) g.portals.splice(i, 1);
    }
  }

  // === SPAWN CONTÍNUO: começa devagar, cresce com tempo ===
  if (!g.spawnAccu) g.spawnAccu = 0;
  const spawnRate = 0.3 + g.t / 80;    // 0.3/seg no início, ~1/seg em 60s, ~2.5/seg em 3min
  g.spawnAccu += dt * spawnRate;
  while (g.spawnAccu >= 1 && game.enemies.length < 300) {
    g.spawnAccu -= 1;
    const a = rand(0, Math.PI * 2);
    const r = 180 + rand(0, 60);
    spawnEnemy(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, false);
  }

  // === ONDAS: bursts extras com portais + boss a cada ~25s ===
  g.waveTimer -= dt;
  if (g.waveTimer <= 0) {
    g.wave++;
    g.waveTimer = Math.max(15, 25 - g.wave * 0.5);

    // burst de portais em todas as direções
    const nPortals = Math.min(8, 4 + Math.floor(g.wave / 2));
    const count = waveEnemyCount(g.wave);
    const ring = 200 + rand(0, 40);
    for (let i = 0; i < nPortals; i++) {
      const a = (i / nPortals) * Math.PI * 2 + rand(-0.2, 0.2);
      spawnPortal(p.x + Math.cos(a) * ring + rand(-20, 20), p.y + Math.sin(a) * ring + rand(-15, 15));
      g.portals[g.portals.length - 1].toSpawn = Math.ceil(count / nPortals);
    }

    // boss + escolta
    const escortCount = Math.ceil(count / 2);
    const nBossPortals = Math.min(4, 1 + Math.floor(g.wave / 3));
    for (let bp = 0; bp < nBossPortals; bp++) {
      const ba = rand(0, Math.PI * 2);
      spawnPortal(p.x + Math.cos(ba) * (ring + 30) + rand(-20, 20), p.y + Math.sin(ba) * (ring + 30) + rand(-15, 15));
      const pt = g.portals[g.portals.length - 1];
      pt.toSpawn = Math.ceil(escortCount / nBossPortals);
      if (bp === 0) { pt.isBoss = true; pt.toSpawn += 1; }
    }
  }
}

/* ------------------------------------------------------------------- math -- */
const rand = (a, b) => a + Math.random() * (b - a);
function nearestEnemy(x, y, maxD) {
  let best = null, bd = (maxD || 1e9) ** 2;
  for (const e of game.enemies) {
    if (e.dying) continue;
    const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/* ----------------------------------------------------- weapons (orbitam) -- */
const ORBIT_R = 27, MUZZLE = 12, WRANGE = 520;

// as armas ficam em posições FIXAS ao redor do robô e giram pra apontar EXATO no alvo
// Cada arma ocupa um SETOR fixo ao redor do robô. Os 9 frames são vistas em
// perspectiva (cima=f0 ... leste=f4 ... baixo=f8): escolher o frame pela direção
// + posicionar a arma nesse lado = efeito 3D do anel. Não rotaciona o sprite.
const FLAT = 0.6;   // achatamento vertical (visão de cima)
function updateWeapons(dt) {
  const p = game.player;
  const N = game.weapons.length;
  for (let i = 0; i < N; i++) {
    const w = game.weapons[i];
    const slot = -Math.PI / 2 + i * (Math.PI * 2 / N);   // setor fixo (não orbita)
    const half = Math.PI / N;
    // alvo: inimigo mais próximo DENTRO do setor da arma
    let tgt = null, bd = WRANGE * WRANGE;
    for (const e of game.enemies) {
      if (e.dying) continue;
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      const da = Math.atan2(Math.sin(a - slot), Math.cos(a - slot));
      if (Math.abs(da) > half) continue;                 // fora do setor desta arma
      const dx = e.x - p.x, dy = e.y - p.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; tgt = e; }
    }
    w.target = tgt;
    // aim suave em direção ao alvo (ou repouso apontando pro centro do setor)
    const want = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : slot;
    const cur = (w.aim === undefined) ? want : w.aim;
    const da = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
    w.aim = cur + da * Math.min(1, dt * 12);
    if (w.recoil > 0) w.recoil = Math.max(0, w.recoil - dt * 6);
    const r = ORBIT_R - w.recoil * 3;                     // recuo encolhe o raio
    const bob = Math.sin(game.t * 3 + i * 1.7) * 0.8;
    w.wx = p.x + Math.cos(w.aim) * r;
    w.wy = p.y + Math.sin(w.aim) * (r * FLAT) + bob - 4;
  }
}

// frame (perspectiva) e espelhamento a partir da direção. O cano varre
// anti-horário: BAIXO(sul)=f0, LESTE=f4, CIMA(norte)=f8; oeste = espelhado.
function aimFrame(a) {
  const dx = Math.cos(a), dy = Math.sin(a);
  const flip = dx < 0;
  const b = Math.atan2(dy, Math.abs(dx));               // -π/2 (cima) .. π/2 (baixo)
  const frame = Math.round(4 - b * 8 / Math.PI);        // sul=0, leste=4, norte=8
  return { frame: Math.max(0, Math.min(8, frame)), flip };
}

/* ----------------------------------------------------------------- firing -- */
const FLASH_SCALE = 0.4;
// bico exato do frame atual (medido do sprite), relativo ao centro da arma
function muzzleOf(w) {
  const def = WEAPONS[w.id];
  const { frame, flip } = aimFrame(w.aim);
  const mo = (MUZZLE_OFF[def.sheet] && MUZZLE_OFF[def.sheet][frame]) || [12, 0];
  return { mx: w.wx + (flip ? -mo[0] : mo[0]), my: w.wy + mo[1] };
}
function fireWeapon(w) {
  const def = WEAPONS[w.id];
  if (!w.target) return;                       // só atira se a arma tem alvo
  const aim = w.aim;
  const { mx, my } = muzzleOf(w);              // ponta REAL da arma neste frame
  const lvl = w.level;
  const count = def.count + (def.id === 'feather' ? (lvl - 1) : 0) + (w.mCount || 0);
  const dmg = (def.dmg + (lvl - 1) * Math.max(2, def.dmg * 0.35)) * game.mult.dmg * (w.mDmg || 1);
  for (let i = 0; i < count; i++) {
    let ang = aim;
    if (count > 1) ang += (i - (count - 1) / 2) * (def.spread || 0.18);
    game.projs.push({
      x: mx, y: my, vx: Math.cos(ang) * def.speed, vy: Math.sin(ang) * def.speed,
      dmg, spr: def.spr, pierce: def.pierce + (lvl - 1 >= 3 ? 1 : 0), life: 1.6,
      rot: ang, aoe: def.aoe || 0, homing: def.homing || false, hit: new Set(),
    });
  }
  w.recoil = 1;
  // flash: empurra o centro p/ frente o tanto que a borda traseira do efeito caia no bico
  const back = (FLASH_BACK[def.flash] || 44) * FLASH_SCALE;
  spawnFx(def.flash, mx + Math.cos(aim) * back, my + Math.sin(aim) * back, FLASH_SCALE, aim);
  beep(420 + lvl * 20, 0.03, 'square', 0.04);
}

/* aviso flutuante no centro (não pausa o jogo) */
function showToast(text, color) {
  game.toast = { text, color: color || '#ffd54a', life: 2.4, max: 2.4 };
}

/* --------------------------------------------------------------------- fx -- */
function spawnFx(sheet, x, y, scale, rot, fs) {
  game.fx.push({ sheet, x, y, scale: scale || 1, rot: rot || 0, f: 0, ft: 0, fs: fs || 96 });
}

/* ------------------------------------------------------------- xp / level -- */
function gainXp(v) {
  game.xp += v;
  while (game.xp >= game.xpNext) {
    game.xp -= game.xpNext;
    game.level++;
    game.xpNext = Math.round(5 + game.level * 3.2 + game.level * game.level * 0.35);
    openLevelUp();
  }
}

/* ----------------------------------------------------------- level-up menu -- */
function rewardPool() {
  const out = [];
  for (const id in WEAPONS) {
    const owned = game.weapons.find(w => w.id === id);
    if (owned) { if (owned.level < 5) out.push({ kind: 'wlvl', id, lvl: owned.level + 1 }); }
    else out.push({ kind: 'wnew', id });
  }
  for (const id in PASSIVES) {
    const lvl = (game.passives[id] || 0) + 1;
    if (lvl <= 5) out.push({ kind: 'passive', id, lvl });
  }
  // embaralha
  for (let i = out.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[out[i], out[j]] = [out[j], out[i]]; }
  return out.slice(0, 3);
}
let pendingLevelUps = 0;
function openLevelUp() {
  pendingLevelUps++;
  if (game.paused) return;
  showLevelUp();
}
function showLevelUp() {
  const choices = rewardPool();
  if (choices.length === 0) {   // tudo no máximo: sem cards → cura + aviso claro (não trava)
    const p = game.player;
    const before = p.hp;
    p.hp = Math.min(p.maxhp, p.hp + Math.round(p.maxhp * 0.12));
    const healed = Math.round(p.hp - before);
    showToast(t('all_maxed', healed), '#6ad06a');
    spawnFx('boom', p.x, p.y, 1.4, 0);   // pulso verde de cura no player
    beep(880, 0.06, 'sine', 0.05); beep(1100, 0.05, 'sine', 0.04);
    pendingLevelUps = Math.max(0, pendingLevelUps - 1);
    if (pendingLevelUps > 0) { showLevelUp(); return; }
    game.paused = false;
    CG.gameplayStart();
    return;
  }
  game.paused = true;
  const box = document.getElementById('cards');
  box.innerHTML = '';
  choices.forEach(c => {
    let icon, name, desc, tag, lvlTxt = '';
    if (c.kind === 'wnew') { const d = WEAPONS[c.id]; icon = d.icon; name = d.name; desc = d.desc; tag = t('new_weapon'); }
    else if (c.kind === 'wlvl') { const d = WEAPONS[c.id]; icon = d.icon; name = d.name; desc = d.desc; tag = t('upgrade'); lvlTxt = t('level') + ' ' + c.lvl; }
    else { const d = PASSIVES[c.id]; icon = d.icon; name = d.name; desc = d.desc; tag = t('passive'); lvlTxt = t('level') + ' ' + c.lvl; }
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<div class="ctag">${tag}</div>
      <img src="${SRC[icon]}" alt="">
      <div class="cname">${name}</div>
      <div class="cdesc">${desc}</div>
      <div class="clevel">${lvlTxt}</div>`;
    el.onclick = () => { applyReward(c); closeLevelUp(); };
    box.appendChild(el);
  });
  document.getElementById('ui-levelup').classList.add('show');
  CG.gameplayStop();   // menu de recompensa = pausa de gameplay
  beep(660, 0.08, 'square', 0.05);
}
function applyReward(c) {
  if (c.kind === 'wnew') game.weapons.push(mkWeapon(c.id));
  else if (c.kind === 'wlvl') game.weapons.find(w => w.id === c.id).level++;
  else {
    const id = c.id; game.passives[id] = (game.passives[id] || 0) + 1;
    if (id === 'pdmg') game.mult.dmg += 0.20;
    if (id === 'pfire') game.mult.fire += 0.15;
    if (id === 'pspeed') game.player.speed *= 1.12;
    if (id === 'php') { game.player.maxhp += 25; game.player.hp = Math.min(game.player.maxhp, game.player.hp + 25); }
    if (id === 'pmag') game.player.magnet *= 1.45;
  }
}
function closeLevelUp() {
  document.getElementById('ui-levelup').classList.remove('show');
  pendingLevelUps--;
  if (pendingLevelUps > 0) showLevelUp();
  else { game.paused = false; CG.gameplayStart(); }
}

/* ----------------------------------------------------------------- update -- */
function update(dt) {
  const p = game.player;
  game.t += dt;
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 60);
  if (game.toast) { game.toast.life -= dt; if (game.toast.life <= 0) game.toast = null; }

  /* --- player move --- */
  let mx = 0, my = 0;
  if (keys['a'] || keys['arrowleft']) mx -= 1;
  if (keys['d'] || keys['arrowright']) mx += 1;
  if (keys['w'] || keys['arrowup']) my -= 1;
  if (keys['s'] || keys['arrowdown']) my += 1;
  // joystick touch (analógico: inclinação leve = andar devagar)
  if (touch.active) { mx = touch.dx; my = touch.dy; }
  let ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; ml = 1; }
  if (touch.active && ml < 0.14) { mx = 0; my = 0; ml = 0; }   // zona morta
  p.moving = ml > 0;
  p.x += mx * p.speed * dt;
  p.y += my * p.speed * dt;
  if (mx) p.facing = mx > 0 ? 1 : -1;
  if (p.moving) p.anim += dt * 10; else p.anim = 0;
  if (p.invuln > 0) p.invuln -= dt;

  /* --- pegadas (poeira ao andar) --- */
  if (p.moving && !p.dead) {
    game.stepAccu += dt;
    if (game.stepAccu > 0.06) {
      game.stepAccu = 0;
      // poeira nasce ATRÁS do robô (oposto ao movimento) + spread perpendicular
      const mag = Math.hypot(mx, my) || 1;
      const bx = -mx / mag, by = -my / mag;     // direção de trás
      const px = -by, py = bx;                    // perpendicular
      for (let n = 0; n < 3; n++) {
        const back = rand(3, 8), perp = rand(-5, 5);
        game.footprints.push({
          x: p.x + bx * back + px * perp + rand(-1, 1),
          y: p.y + by * back + py * perp,
          life: 0.6 + rand(0, 0.5), maxlife: 1.1,
          r: rand(2.0, 4.0),
          vy: rand(-14, -5),
          vx: bx * rand(4, 12) + rand(-3, 3),
        });
      }
    }
  }
  for (let i = game.footprints.length - 1; i >= 0; i--) {
    const fp = game.footprints[i];
    fp.life -= dt;
    fp.x += (fp.vx || 0) * dt;
    fp.y += (fp.vy || 0) * dt;
    fp.r += dt * 2.5;
    if (fp.life <= 0) game.footprints.splice(i, 1);
  }

  /* --- overcharge: carrega por TEMPO (não por kills) --- */
  const OC_RECHARGE = 14;   // segundos para encher a descarga
  if (!p.dead && p.overcharge < p.ocMax) p.overcharge = Math.min(p.ocMax, p.overcharge + (p.ocMax / OC_RECHARGE) * dt);
  if (keys[' '] && p.overcharge >= p.ocMax) { overchargeBlast(); p.overcharge = 0; }

  /* --- camera --- */
  game.cam.x += (p.x - game.cam.x) * Math.min(1, dt * 7);
  game.cam.y += (p.y - game.cam.y) * Math.min(1, dt * 7);

  /* --- sistema de hordas (portais fixos, ondas, boss) --- */
  updateWaves(dt);

  /* --- weapons: posiciona/mira e dispara --- */
  updateWeapons(dt);
  for (const w of game.weapons) {
    w.timer -= dt;
    const cd = WEAPONS[w.id].cd / game.mult.fire / (w.mFire || 1);
    if (w.timer <= 0) { fireWeapon(w); w.timer = cd; }
  }

  /* --- projectiles --- */
  for (let i = game.projs.length - 1; i >= 0; i--) {
    const pr = game.projs[i];
    pr.life -= dt;
    if (pr.homing) {
      const tg = nearestEnemy(pr.x, pr.y, 240);
      if (tg) {
        const want = Math.atan2(tg.y - pr.y, tg.x - pr.x);
        const cur = Math.atan2(pr.vy, pr.vx);
        let diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
        const na = cur + diff * Math.min(1, dt * 6);
        const sp = Math.hypot(pr.vx, pr.vy);
        pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp; pr.rot = na;
      }
    }
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (pr.life <= 0) { game.projs.splice(i, 1); continue; }
    // colisão
    for (const e of game.enemies) {
      if (e.dying || pr.hit.has(e)) continue;
      const dx = e.x - pr.x, dy = e.y - pr.y;
      if (dx * dx + dy * dy < (e.r + 6) ** 2) {
        damageEnemy(e, pr.dmg);
        pr.hit.add(e);
        if (pr.aoe) {
          spawnFx('boom1expl', e.x, e.y - 6, pr.aoe / 24, 0, 48);
          game.shake = 6; beep(120, 0.12, 'sawtooth', 0.06);
          for (const e2 of game.enemies) {
            if (e2 === e || e2.dying) continue;
            const ddx = e2.x - e.x, ddy = e2.y - e.y;
            if (ddx * ddx + ddy * ddy < pr.aoe * pr.aoe) damageEnemy(e2, pr.dmg * 0.6);
          }
        }
        // (sem efeito de impacto nos inimigos)
        if (pr.pierce > 0 && !pr.aoe) { pr.pierce--; }
        else { game.projs.splice(i, 1); break; }
      }
    }
  }

  /* --- enemies --- */
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const e = game.enemies[i];
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.dying) {
      e.dt += dt; e.anim += dt * 12;
      if (e.dt > 0.34) game.enemies.splice(i, 1);
      continue;
    }
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;

    // --- IA: fica mais inteligente com o tempo ---
    let mx = dx / d, my = dy / d;
    const smartness = Math.min(1, game.t / 180);     // 0→1 ao longo de 3 min

    // separação (sempre ativa — evita bolinho)
    const sepR = 16 + smartness * 6, sepR2 = sepR * sepR;
    let sepCount = 0;
    for (let j = (i + 1) % game.enemies.length; sepCount < 10 && j !== i; j = (j + 1) % game.enemies.length) {
      const e2 = game.enemies[j]; sepCount++;
      if (e2.dying) continue;
      const sx = e.x - e2.x, sy = e.y - e2.y, sd2 = sx * sx + sy * sy;
      if (sd2 < sepR2 && sd2 > 1) {
        const sd = Math.sqrt(sd2), force = (sepR - sd) / sepR * (0.4 + smartness * 0.4);
        mx += (sx / sd) * force; my += (sy / sd) * force;
      }
    }

    // flanqueamento: chance e força crescem com o tempo
    if (e.flankSide === undefined) e.flankSide = (Math.random() < 0.2 + smartness * 0.4) ? (Math.random() < 0.5 ? 1 : -1) : 0;
    if (e.flankSide && d > 30) {
      const flankStr = 0.3 + smartness * 0.5;
      mx += (-dy / d) * e.flankSide * flankStr;
      my += (dx / d) * e.flankSide * flankStr;
    }

    // interceptação: com o tempo, TODOS tentam prever (não só rápidos)
    if (d > 50 && smartness > 0.15) {
      const lookAhead = Math.min(d / e.speed, 0.4 + smartness * 0.4);
      const inputX = (keys['d']||keys['arrowright']?1:0)-(keys['a']||keys['arrowleft']?1:0);
      const inputY = (keys['s']||keys['arrowdown']?1:0)-(keys['w']||keys['arrowup']?1:0);
      if (inputX || inputY) {
        const predX = p.x + inputX * p.speed * lookAhead;
        const predY = p.y + inputY * p.speed * lookAhead;
        const pdx = predX - e.x, pdy = predY - e.y, pd = Math.hypot(pdx, pdy) || 1;
        const blend = smartness * 0.6;
        mx = mx * (1 - blend) + (pdx / pd) * blend;
        my = my * (1 - blend) + (pdy / pd) * blend;
      }
    }

    // velocidade base sobe levemente com o tempo
    const speedMult = 1 + smartness * 0.25;
    const ml = Math.hypot(mx, my) || 1;
    e.x += (mx / ml) * e.speed * speedMult * dt;
    e.y += (my / ml) * e.speed * speedMult * dt;
    e.flip = dx < 0;
    e.anim += dt * 8;
    // toca o jogador
    if (d < e.r + 10 && p.invuln <= 0 && !p.dead) {
      p.hp -= e.dmg; p.invuln = 0.7; game.shake = 5;
      beep(90, 0.1, 'sawtooth', 0.07);
      if (p.hp <= 0) { p.hp = 0; gameOver(); }
    }
  }

  /* --- gems --- */
  for (let i = game.gems.length - 1; i >= 0; i--) {
    const g = game.gems[i];
    const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy) || 1;
    if (d < p.magnet || g.vac) { g.vac = true; const s = 240; g.x += (dx / d) * s * dt; g.y += (dy / d) * s * dt; }
    if (d < 12) { gainXp(g.value); game.gems.splice(i, 1); beep(800, 0.04, 'square', 0.03); }
  }

  /* --- health packs: spawn periódico + coleta --- */
  if (!game.hpTimer) game.hpTimer = 60;
  game.hpTimer -= dt;
  if (game.hpTimer <= 0) {
    game.hpTimer = 60;
    const a = rand(0, Math.PI * 2), r = 100 + rand(0, 120);
    game.healthPacks.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, life: 30, anim: 0, spawnT: 1.0 });
  }
  for (let i = game.healthPacks.length - 1; i >= 0; i--) {
    const hp = game.healthPacks[i];
    hp.anim += dt; hp.life -= dt; if ((hp.spawnT || 0) > 0) hp.spawnT -= dt;
    if (hp.life <= 0) { game.healthPacks.splice(i, 1); continue; }
    const dx = p.x - hp.x, dy = p.y - hp.y, d = Math.hypot(dx, dy);
    if (d < 18) {
      p.hp = Math.min(p.maxhp, p.hp + 30);
      game.healthPacks.splice(i, 1);
      beep(600, 0.08, 'sine', 0.06); beep(900, 0.06, 'sine', 0.04);
      game.shake = 3;
    }
  }

  /* --- DropPods: cai do céu, jogador fica na área pra capturar, ganha XP --- */
  if (!game.dpTimer) game.dpTimer = 45 + rand(0, 15);
  game.dpTimer -= dt;
  if (game.dpTimer <= 0 && game.droppods.length < 2) {
    game.dpTimer = 60 + rand(0, 20);
    const a = rand(0, Math.PI * 2), r = 80 + rand(0, 100);
    game.droppods.push({
      x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r,
      state: 'warning', warningT: 2, fallY: -120, fallSpeed: 200,
      captureTime: 0, captureNeed: 5,     // 5s na área pra capturar
      captureR: 60,                       // raio da zona
      xpReward: 8 + game.wave * 3,
      anim: 0, dustAnim: -1, life: 40,   // desaparece em 40s se não capturar
    });
  }
  for (let i = game.droppods.length - 1; i >= 0; i--) {
    const dp = game.droppods[i];
    dp.anim += dt;
    dp.life -= dt;

    if (dp.state === 'warning') {
      dp.warningT -= dt;
      if (dp.warningT <= 0) dp.state = 'falling';
      continue;
    }
    if (dp.state === 'falling') {
      dp.fallY += dp.fallSpeed * dt;
      if (dp.fallY >= 0) {
        dp.fallY = 0; dp.state = 'landed'; dp.dustAnim = 0;
        game.shake = 8; beep(80, 0.2, 'sawtooth', 0.08);
      }
      continue;
    }
    if (dp.state === 'landed') {
      // poeira de impacto
      if (dp.dustAnim >= 0) { dp.dustAnim += dt * 12; if (dp.dustAnim > 6) dp.dustAnim = -1; }

      // base do pod (centro inferior do sprite) — colisão e zona partem daqui
      const baseX = dp.x, baseY = dp.y + 18;
      const colR = 22;

      // colisão na base: empurra inimigos E jogador
      for (const e of game.enemies) {
        if (e.dying) continue;
        const ex = e.x - baseX, ey = e.y - baseY, ed = Math.hypot(ex, ey);
        if (ed < colR && ed > 0.5) { e.x += (ex / ed) * 3; e.y += (ey / ed) * 3; }
      }
      const px2 = p.x - baseX, py2 = p.y - baseY, pd = Math.hypot(px2, py2);
      if (pd < colR && pd > 0.5) { p.x += (px2 / pd) * 3; p.y += (py2 / pd) * 3; }

      // captura: jogador dentro da ZONA (centrada na base)
      const dd = Math.hypot(p.x - baseX, p.y - baseY);
      if (dd < dp.captureR) {
        dp.captureTime += dt;
        if (dp.captureTime >= dp.captureNeed) {
          dp.state = 'captured';
          for (let g = 0; g < 8; g++) game.gems.push({ x: baseX + (Math.random()-0.5)*30, y: baseY + (Math.random()-0.5)*30, value: 5 });
          game.shake = 5; beep(660, 0.1, 'square', 0.05); beep(880, 0.08, 'square', 0.04);
        }
      }

      // timeout: desaparece se não capturar a tempo
      if (dp.life <= 0) { dp.state = 'captured'; }
    }
    if (dp.state === 'captured') {
      dp.dustAnim = dp.dustAnim < 0 ? 0 : dp.dustAnim;
      dp.dustAnim += dt * 10;
      if (dp.dustAnim > 6) game.droppods.splice(i, 1);
    }
  }

  /* --- sub-acoplamento (drone de choque) --- */
  {
    const newLvl = Math.min(20, Math.floor(calcScore() / 2000));   // drone: nível máx = 20
    if (newLvl > game.orbLevel) {
      game.orbLevel = newLvl;
      game.orbLevelFlash = 1.2;
      game.shake = 5;
      beep(880, 0.12, 'sine', 0.06); beep(1100, 0.1, 'sine', 0.05);
    }
    if (game.orbLevelFlash > 0) game.orbLevelFlash = Math.max(0, game.orbLevelFlash - dt);
    if (game.orbLevel > 0) {
      // inicializa posição na primeira ativação
      if (!game.orbPos) game.orbPos = { x: p.x, y: p.y - 10 };
      // animação de choque (cicla frames)
      game.orbAnimT = (game.orbAnimT || 0) + dt;
      if (game.orbAnimT > 0.055) { game.orbAnimT = 0; game.orbAnimF = ((game.orbAnimF || 0) + 1) % 6; }
      // seguir o jogador com mola elástica
      const tx = p.x + Math.sin(game.t * 1.4) * 8;   // leve deriva lateral
      const ty = p.y - 14 + Math.sin(game.t * 2.1) * 4;
      const fdx = tx - game.orbPos.x, fdy = ty - game.orbPos.y;
      const fdist = Math.hypot(fdx, fdy);
      const spd = Math.min(fdist, (4 + fdist * 3) * dt);
      if (fdist > 0.5) { game.orbPos.x += (fdx / fdist) * spd; game.orbPos.y += (fdy / fdist) * spd; }
      // dano AOE ao redor do drone
      const aoeR = 18 + game.orbLevel * 3, dmg = 3 + (game.orbLevel - 1) * 3;
      for (const e of game.enemies) {
        if ((e.orbHitCd || 0) > 0) { e.orbHitCd -= dt; continue; }
        if (e.dying) continue;
        if (Math.hypot(e.x - game.orbPos.x, e.y - game.orbPos.y) < aoeR) {
          damageEnemy(e, dmg);
          e.orbHitCd = 0.7;
        }
      }
    }
  }

  /* --- fx --- */

  for (let i = game.fx.length - 1; i >= 0; i--) {
    const f = game.fx[i]; f.ft += dt;
    if (f.ft > 0.05) { f.ft = 0; f.f++; if (f.f >= 6) game.fx.splice(i, 1); }
  }
  /* --- blast rings (descarga) --- */
  for (let i = game.blastRings.length - 1; i >= 0; i--) {
    const br = game.blastRings[i];
    br.t += dt;
    br.r = br.maxR * Math.min(1, br.t / br.dur);
    br.ft += dt;
    if (br.ft > 0.048) { br.ft = 0; br.f = Math.min(br.f + 1, 5); }
    if (br.t >= br.dur + 0.29) game.blastRings.splice(i, 1);
  }

  /* --- boss radio typewriter (letra por letra, bem visível) --- */
  if (bossRadio) {
    bossRadio.life -= dt;
    if (bossRadio.phase === 'typing') {
      bossRadio.charAge += dt;
      bossRadio.charTimer += dt;
      const CHAR_DELAY = 0.06;
      if (bossRadio.charTimer >= CHAR_DELAY) {
        bossRadio.charTimer = 0;   // reset total — não acumula crédito
        bossRadio.charAge = 0;
        bossRadio.charIdx = Math.min(bossRadio.charIdx + 1, bossRadio.fullText.length);
        const freq = 120 + (bossRadio.charIdx % 5) * 30 + Math.random() * 40;
        beep(freq, 0.04, 'square', 0.025);
        if (bossRadio.charIdx >= bossRadio.fullText.length) {
          bossRadio.phase = 'done';
          beep(300, 0.1, 'sine', 0.04);
        }
      }
      bossRadio.text = bossRadio.fullText.substring(0, bossRadio.charIdx);
    }
    if (bossRadio.life <= 0) bossRadio = null;
  }

  /* --- player death anim --- */
  if (p.dead) { p.deathAnim += dt * 8; }
}

function damageEnemy(e, dmg) {
  e.hp -= dmg; e.hitFlash = 0.08;
  if (e.hp <= 0 && !e.dying) {
    e.dying = true; e.dt = 0; e.anim = 0;
    game.kills++;
    if (Math.random() < 0.92) game.gems.push({ x: e.x, y: e.y, value: e.xpValue || e.t.xp, vac: false });
  }
}

function overchargeBlast() {
  const p = game.player;
  game.shake = 12;
  spawnFx('boom', p.x, p.y, 3.4, 0);
  beep(70, 0.35, 'sawtooth', 0.09);
  const R = 190;
  const R_VIS = Math.min(R, Math.floor(Math.min(W, H) / (ZOOM * 2)) - 20);
  game.blastRings.push({ x: p.x, y: p.y, r: 0, maxR: R_VIS, t: 0, dur: 0.45, f: 0, ft: 0 });
  for (const e of game.enemies) {
    if (e.dying) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    if (dx * dx + dy * dy < R * R) {
      const d = Math.hypot(dx, dy) || 1;
      e.x += dx / d * 40; e.y += dy / d * 40;       // empurrão
      damageEnemy(e, 60 * game.mult.dmg);
    }
  }
}

/* ------------------------------------------------------------- game over -- */
function gameOver() {
  const p = game.player; p.dead = true; p.deathAnim = 0;
  game.over = true; game.paused = true;
  CG.gameplayStop();
  const min = Math.floor(game.t / 60), sec = Math.floor(game.t % 60);
  const score = calcScore();
  const best = JSON.parse(CG.get('ss_best') || '{}');
  const isNewBest = score > (best.score || 0);
  if (isNewBest) CG.happytime();   // portal celebra o novo recorde
  CG.submitScore(score);           // envia ao leaderboard global (se configurado)
  const earned = coinsForScore(score);  // valor potencial (só credita quando a run termina)
  const prevScore = best.score || 0;
  const recordBanner = isNewBest
    ? `<div class="go-record-banner">${t('new_record')}</div>
       <div class="go-record-prev">${t('previous', nf(prevScore))}</div>`
    : '';
  document.getElementById('goStats').innerHTML =
    `${recordBanner}` +
    `<div class="go-score-wrap${isNewBest ? ' record' : ''}">` +
    `<div class="go-score${isNewBest ? ' record' : ''}">${nf(score)}</div>` +
    `<div class="go-score-lbl">${t('score')}</div>` +
    `</div>` +
    `<div class="go-coins">${t('scrap_earned')} <b>+${nf(earned)}</b> <span class="go-coin-ico">🪙</span></div>` +
    `<span class="stat-label">${t('time_survived')}</span><br/><b>${min}:${String(sec).padStart(2, '0')}</b><br/>` +
    `<span class="stat-label">${t('kills')}</span> <b>${game.kills}</b> &nbsp;&middot;&nbsp; <span class="stat-label">${t('level')}</span> <b>${game.level}</b>`;
  document.getElementById('btnRevive').style.display = game.revives < 1 ? 'inline-block' : 'none';
  saveBestStats();
  setTimeout(() => document.getElementById('ui-gameover').classList.add('show'), 600);
}
function revive() {
  // rewarded ad do CrazyGames; concede o revive ao terminar. Em erro de anúncio
  // (adblock/sem preenchimento) também concede — o revive já é limitado a 1/partida.
  const btn = document.getElementById('btnRevive');
  if (btn) btn.style.pointerEvents = 'none';   // evita duplo toque durante o ad
  CG.requestAd('rewarded', () => { doRevive(); if (btn) btn.style.pointerEvents = ''; });
}
function doRevive() {
  game.revives++;
  const p = game.player;
  p.dead = false; p.hp = p.maxhp; p.invuln = 2.5;
  game.over = false; game.paused = false;
  game.shake = 10; spawnFx('boom', p.x, p.y, 3, 0);
  // limpa inimigos perto
  for (const e of game.enemies) {
    const dx = e.x - p.x, dy = e.y - p.y;
    if (dx * dx + dy * dy < 170 * 170 && !e.dying) damageEnemy(e, 9999);
  }
  document.getElementById('ui-gameover').classList.remove('show');
  CG.gameplayStart();   // voltou a jogar
}

/* ------------------------------------------------------------------ render -- */
const GROUND = ['g1', 'g2', 'g3'];
function hash(x, y) { let h = (x * 73856093) ^ (y * 19349663); h = (h ^ (h >> 13)) >>> 0; return h; }

function render() {
  ctx.fillStyle = '#3a2530';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  let shx = 0, shy = 0;
  if (game.shake > 0) { shx = rand(-game.shake, game.shake); shy = rand(-game.shake, game.shake); }
  // origem alinhada ao pixel do dispositivo -> tiles sem costura
  const ox = Math.floor(W / 2 - game.cam.x * ZOOM + shx);
  const oy = Math.floor(H / 2 - game.cam.y * ZOOM + shy);
  ctx.setTransform(ZOOM, 0, 0, ZOOM, ox, oy);

  /* --- ground --- */
  const vw = W / ZOOM, vh = H / ZOOM, T = 32;
  const x0 = Math.floor((game.cam.x - vw / 2) / T) - 1, x1 = Math.ceil((game.cam.x + vw / 2) / T) + 1;
  const y0 = Math.floor((game.cam.y - vh / 2) / T) - 1, y1 = Math.ceil((game.cam.y + vh / 2) / T) + 1;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const h = hash(tx, ty);
      const img = IMG[GROUND[h % 3]];
      if (img.complete) ctx.drawImage(img, tx * T, ty * T);
      // decals esparsos
      const dh = hash(tx + 7, ty - 3);
      if (dh % 11 === 0) drawImg(IMG.grass, tx * T + 16, ty * T + 22, 0, 1, false);
      else if (dh % 17 === 0) drawImg(IMG.rock, tx * T + 16, ty * T + 18, 0, 1, false);
    }
  }

  /* --- portais (animação real: Start=brotar, Idle=ativo, Start reverso=fechar) --- */
  for (const pt of game.portals) {
    if (pt.state === 'opening') {
      const f = Math.min(5, Math.floor(pt.anim));
      drawFrame(IMG.pt_start, 96, 96, f, pt.x, pt.y, 0, 1, false);
    } else if (pt.state === 'active') {
      const f = Math.floor(pt.anim) % 4;
      drawFrame(IMG.pt_idle, 96, 96, f, pt.x, pt.y, 0, 1, false);
    } else if (pt.state === 'closing') {
      const f = Math.max(0, Math.min(5, Math.floor(pt.anim)));
      drawFrame(IMG.pt_start, 96, 96, f, pt.x, pt.y, 0, 1, false);
    }
  }

  /* --- DropPods: ZONA no chão (atrás de tudo) --- */
  for (const dp of game.droppods) {
    const baseX = dp.x, baseY = dp.y + 18;     // base do pod

    if (dp.state === 'landed') {
      const pulse = 1 + Math.sin(dp.anim * 4) * 0.08;
      const frac = dp.captureTime / dp.captureNeed;
      // zona preenchida na BASE
      ctx.save(); ctx.globalAlpha = 0.12 + frac * 0.15;
      ctx.fillStyle = frac >= 1 ? '#5cd85c' : '#8a96e8';
      ctx.beginPath(); ctx.arc(baseX, baseY, dp.captureR * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // borda tracejada
      ctx.save(); ctx.globalAlpha = 0.5;
      ctx.strokeStyle = frac >= 1 ? '#5cd85c' : '#8a96e8';
      ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(baseX, baseY, dp.captureR * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
      // arco de progresso
      if (frac > 0 && frac < 1) {
        ctx.strokeStyle = '#5cd85c'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(baseX, baseY, dp.captureR * pulse, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      // timer (pisca nos últimos 10s)
      if (dp.life < 10) {
        ctx.globalAlpha = 0.5 + Math.sin(dp.anim * 8) * 0.3;
        ctx.font = '900 7px "Press Start 2P", monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = '#f08080'; ctx.fillText(Math.ceil(dp.life) + 's', baseX, baseY - dp.captureR - 6);
        ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      }
    }
    // alvo no chão (warning + falling), some quando pousa
    if (dp.state === 'warning' || dp.state === 'falling') {
      const pulse = 1 + Math.sin(dp.anim * 5) * 0.1;
      const alpha = dp.state === 'warning' ? 0.55 + Math.sin(dp.anim * 6) * 0.3 : 0.9;
      ctx.save(); ctx.globalAlpha = alpha;
      drawImg(IMG.target, baseX, baseY, 0, pulse, false);
      ctx.restore();
    }
    // sombra (quando caindo)
    if (dp.state === 'falling') {
      const shadowScale = 1 - Math.abs(dp.fallY) / 120;
      ctx.save(); ctx.globalAlpha = 0.25 * shadowScale;
      ctx.fillStyle = '#000'; ctx.beginPath();
      ctx.ellipse(baseX, baseY, 12 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* --- health packs no chão --- */
  for (const hp of game.healthPacks) {
    const bob = Math.sin(hp.anim * 4) * 2;
    const pulse = 1 + Math.sin(hp.anim * 6) * 0.1;
    const fade = hp.life < 5 ? (hp.life / 5) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    // glow
    ctx.fillStyle = 'rgba(100,230,100,.2)';
    ctx.beginPath(); ctx.arc(hp.x, hp.y + bob, 14 * pulse, 0, Math.PI * 2); ctx.fill();
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(hp.x, hp.y + 10, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    // cruz de vida
    ctx.fillStyle = '#5cd85c';
    ctx.fillRect(hp.x - 5 * pulse, hp.y + bob - 2, 10 * pulse, 4);
    ctx.fillRect(hp.x - 2, hp.y + bob - 5 * pulse, 4, 10 * pulse);
    // borda
    ctx.strokeStyle = '#2a6a2a'; ctx.lineWidth = 1;
    ctx.strokeRect(hp.x - 5 * pulse, hp.y + bob - 2, 10 * pulse, 4);
    ctx.strokeRect(hp.x - 2, hp.y + bob - 5 * pulse, 4, 10 * pulse);
    ctx.restore();
  }

  /* --- pegadas/poeira no chão (atrás de tudo) --- */
  for (const fp of game.footprints) {
    const a = (fp.life / fp.maxlife) * 0.55;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#e8ddd0';
    ctx.beginPath();
    ctx.ellipse(fp.x, fp.y, fp.r, fp.r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* --- gems --- */
  for (const g of game.gems) {
    const bob = Math.sin(game.t * 6 + g.x) * 1.2;
    drawImg(IMG.gem, g.x, g.y + bob, 0, 1.2, false);
  }

  /* --- TODAS as entidades por Y (inimigos + player + droppods) --- */
  const ents = [];
  for (const e of game.enemies) ents.push({ type: 'enemy', y: e.y, e });
  ents.push({ type: 'player', y: game.player.y });
  for (const dp of game.droppods) {
    if (dp.state === 'captured' || dp.state === 'warning') continue;
    ents.push({ type: 'droppod', y: dp.y + 18, dp });   // ordena pela BASE
  }
  ents.sort((a, b) => a.y - b.y);

  for (const ent of ents) {
    if (ent.type === 'enemy') { drawEnemy(ent.e); }
    else if (ent.type === 'player') {
      if (!game.player.dead) drawWeapons('back');
      drawPlayer();
      if (!game.player.dead) drawWeapons('front');
    }
    else if (ent.type === 'droppod') {
      const dp = ent.dp;
      const py = dp.y + dp.fallY;
      drawImg(IMG.droppod, dp.x, py, 0, 1, false);
      // poeira
      if (dp.dustAnim >= 0 && dp.dustAnim < 6) {
        const f = Math.min(5, Math.floor(dp.dustAnim));
        drawFrame(IMG.dust, 64, 64, f, dp.x, dp.y + 18, 0, 1.2, false);
      }
      // barra de captura acima do pod
      if (dp.state === 'landed' && dp.captureTime > 0) {
        const bw = 30, bh = 4, bx2 = dp.x - bw / 2, by2 = py - 28;
        const frac = dp.captureTime / dp.captureNeed;
        ctx.fillStyle = '#1a1430'; ctx.fillRect(bx2 - 1, by2 - 1, bw + 2, bh + 2);
        ctx.fillStyle = '#3a2a50'; ctx.fillRect(bx2, by2, bw, bh);
        ctx.fillStyle = '#5cd85c'; ctx.fillRect(bx2, by2, bw * frac, bh);
      }
    }
  }

  /* --- projéteis voando --- */
  for (const pr of game.projs) drawImg(IMG[pr.spr], pr.x, pr.y, pr.rot + Math.PI / 2, 1.15, false);

  /* --- efeitos (flash no bico das armas) --- */
  for (const f of game.fx) drawFrame(IMG[f.sheet], f.fs, f.fs, Math.min(f.f, 5), f.x, f.y, f.rot, f.scale, false);
  /* --- anel da descarga --- */
  for (const br of game.blastRings) {
    if (!IMG.dust?.complete || br.r < 8) continue;
    const prog = br.t / (br.dur + 0.29);
    const alpha = prog < 0.55 ? 0.95 : 0.95 * (1 - (prog - 0.55) / 0.45);
    const fScale = 0.52;
    const spacing = 64 * fScale * 0.88;
    const N = Math.max(6, Math.round((2 * Math.PI * br.r) / spacing));
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2;
      drawFrame(IMG.dust, 64, 64, br.f, br.x + Math.cos(ang) * br.r, br.y + Math.sin(ang) * br.r, ang + Math.PI / 2, fScale, false);
    }
    ctx.restore();
  }

  /* --- sub-acoplamento: drone de choque (world space) --- */
  if (game.orbLevel > 0 && game.orbPos) {
    const ox = game.orbPos.x, oy = game.orbPos.y;
    // sombra no chão (elipse achatada, mesmo estilo das armas)
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#0a0515';
    ctx.beginPath();
    ctx.ellipse(ox, oy + 10, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    const glowR = 12 + game.orbLevel * 0.5;
    const spinA = game.t * 2.2;
    const N = 4;

    // anel de brilho externo (pulsante)
    const ringAlpha = 0.18 + Math.sin(game.t * 7) * 0.08;
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = '#60d8ff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ox, oy, glowR, 0, Math.PI * 2); ctx.stroke();

    // nós que giram no anel
    const nodes = [];
    for (let i = 0; i < N; i++) {
      const a = spinA + (i / N) * Math.PI * 2;
      nodes.push({ x: ox + Math.cos(a) * glowR, y: oy + Math.sin(a) * glowR });
    }

    // relâmpagos entre nós consecutivos (com jitter por frame → efeito elétrico)
    ctx.lineWidth = 0.8;
    for (let i = 0; i < N; i++) {
      const n1 = nodes[i], n2 = nodes[(i + 1) % N];
      const mx = (n1.x + n2.x) / 2 + (Math.random() - 0.5) * 7;
      const my = (n1.y + n2.y) / 2 + (Math.random() - 0.5) * 7;
      ctx.globalAlpha = 0.5 + Math.random() * 0.4;
      ctx.strokeStyle = i % 2 === 0 ? '#b0eeff' : '#ffffff';
      ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(mx, my); ctx.lineTo(n2.x, n2.y); ctx.stroke();
    }

    // faísca brilhante nos nós
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    for (const n of nodes) {
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.2, 0, Math.PI * 2); ctx.fill();
    }

    // orb sprite no centro
    if (IMG.orb8?.complete) drawImg(IMG.orb8, ox, oy, 0, 0.65, false);
    ctx.restore();
  }

  /* --- barra de vida na FRENTE de tudo --- */
  drawPlayerHP();

  ctx.restore();

  drawHUD();
  drawBossRadio();
  drawMinimap();
  drawOffscreenIndicators();
  drawCursor();
}

function drawPlayer() {
  const p = game.player;
  if (p.dead) {
    const f = Math.min(3, Math.floor(p.deathAnim));
    drawFrame(IMG.death, 48, 48, f, p.x, p.y - 6, 0, 1, p.facing < 0);
    return;
  }
  const f = p.moving ? (Math.floor(p.anim) % 4) : 0;
  // pisca quando invulnerável
  if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.4;
  drawFrame(IMG.walk, 48, 48, f, p.x, p.y - 6, 0, 1, p.facing < 0);
  ctx.globalAlpha = 1;
}
// barra de vida do jogador — desenhada DEPOIS das armas (fica na frente)
function drawPlayerHP() {
  const p = game.player;
  if (p.dead) return;
  hpbar(p.x, p.y - 26, p.hp / p.maxhp, 22);
}
function drawEnemy(e) {
  if (e.dying) {
    const f = Math.min(3, Math.floor(e.anim));
    drawFrame(IMG[e.t.die], 48, 48, f, e.x, e.y - 6, 0, e.scale||e.t.scale, e.flip);
    return;
  }
  const f = Math.floor(e.anim) % 6;
  if (e.hitFlash > 0) {
    drawFrame(IMG[e.t.run], 48, 48, f, e.x, e.y - 6, 0, e.scale||e.t.scale, e.flip);
    // flash branco
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
    drawFrame(IMG[e.t.run], 48, 48, f, e.x, e.y - 6, 0, e.scale||e.t.scale, e.flip);
    ctx.restore();
  } else {
    drawFrame(IMG[e.t.run], 48, 48, f, e.x, e.y - 6, 0, e.scale||e.t.scale, e.flip);
  }
  if (e.hp < e.maxhp) hpbar(e.x, e.y - 22, e.hp / e.maxhp, 18);
}
// which: 'back' (acima do robô -> atrás) | 'front' (abaixo -> na frente) | undefined (todas)
function drawWeapons(which) {
  const py = game.player.y;
  for (const w of game.weapons) {
    if (which === 'back' && w.wy >= py) continue;
    if (which === 'front' && w.wy < py) continue;
    const def = WEAPONS[w.id];
    const sheet = IMG[def.sheet];
    if (!sheet || !sheet.complete) continue;
    // sombra no chão (elipse achatada)
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#0a0515';
    ctx.beginPath();
    ctx.ellipse(w.wx, w.wy + 10, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // arma: frame de perspectiva sem rotação
    const { frame, flip } = aimFrame(w.aim);
    drawFrame(sheet, 48, 48, frame, w.wx, w.wy, 0, 1, flip);
  }
}
function hpbar(wx, wy, frac, w) {
  frac = Math.max(0, Math.min(1, frac));
  const h = 3;
  ctx.fillStyle = '#2a1d30'; ctx.fillRect(wx - w / 2 - 1, wy - 1, w + 2, h + 2);
  ctx.fillStyle = '#7a2b3a'; ctx.fillRect(wx - w / 2, wy, w, h);
  ctx.fillStyle = frac > 0.5 ? '#6ad06a' : (frac > 0.25 ? '#e8c84a' : '#e8728a');
  ctx.fillRect(wx - w / 2, wy, w * frac, h);
}

/* -------------------------------------------------------------------- HUD -- */
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function drawBar(x, y, w, h, frac, fg, bg, r) {
  frac = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = bg; roundRect(x, y, w, h, r); ctx.fill();
  if (frac > 0) { ctx.fillStyle = fg; roundRect(x, y, w * frac, h, r); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; roundRect(x, y, w, h, r); ctx.stroke();
}

function drawHUD() {
  const p = game.player;
  ctx.imageSmoothingEnabled = true;
  const min = Math.floor(game.t / 60), sec = Math.floor(game.t % 60);

  /* === TOPO: barra de XP + painel de info === */
  // fundo gradiente do topo
  const grad = ctx.createLinearGradient(0, 0, 0, 52);
  grad.addColorStop(0, 'rgba(14,8,20,.8)'); grad.addColorStop(1, 'rgba(14,8,20,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 52);

  // barra de XP no topo
  drawBar(0, 0, W, 5, game.xp / game.xpNext, '#8a96e8', '#1a1430', 0);
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(0, 0, W * (game.xp / game.xpNext), 2);

  // linha de info: [timer] [onda] [nível] [abates] — tudo na mesma linha
  const infoY = 28;
  ctx.font = '900 9px "Press Start 2P", monospace';
  const pillH = 20, pillR = 8;

  // onda
  const waveTxt = game.wave === 0 ? t('prepare') : t('wave', game.wave);

  // mede tudo pra centralizar o bloco inteiro
  const timeTxt = `${min}:${String(sec).padStart(2, '0')}`;
  const lvlTxt = t('lvl_short', game.level);
  const killTxt = t('kills_count', game.kills);
  ctx.font = '900 12px "Press Start 2P", monospace';
  const timeW = ctx.measureText(timeTxt).width + 20;
  ctx.font = '900 9px "Press Start 2P", monospace';
  const waveW = ctx.measureText(waveTxt).width + 20;
  const lvlW = ctx.measureText(lvlTxt).width + 20;
  const killW = ctx.measureText(killTxt).width + 20;
  const gap = 6;
  // espaço útil: depois do pill de PTS (esquerda) e antes do radar (direita);
  // em telas estreitas descarta os pills menos importantes (abates, nível)
  ctx.font = '900 11px "Press Start 2P", monospace';
  const scorePillW = ctx.measureText(nf(calcScore())).width + 22;
  const hudLeft = 8 + scorePillW + 10;
  const radarLeft = W - 148;
  const pillWidths = [timeW, waveW, lvlW, killW];
  let nPills = 4;
  let totalW = timeW + gap + waveW + gap + lvlW + gap + killW;
  while (nPills > 2 && totalW > radarLeft - hudLeft) {
    nPills--;
    totalW -= pillWidths[nPills] + gap;
  }
  let cx2 = Math.max(hudLeft, Math.min(W / 2 - totalW / 2, radarLeft - totalW));
  ctx.font = '900 9px "Press Start 2P", monospace';

  // timer (branco, maior)
  ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRect(cx2, infoY - pillH / 2, timeW, pillH, pillR); ctx.fill();
  ctx.font = '900 12px "Press Start 2P", monospace';
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText(timeTxt, cx2 + timeW / 2, infoY + 5);
  cx2 += timeW + gap;

  // onda (roxo/vermelho)
  ctx.font = '900 9px "Press Start 2P", monospace';
  const wvBg = '#4a2030', wvBr = '#c85868', wvFg = '#f08080';
  ctx.fillStyle = wvBg; roundRect(cx2, infoY - pillH / 2, waveW, pillH, pillR); ctx.fill();
  ctx.strokeStyle = wvBr; ctx.lineWidth = 1.5; roundRect(cx2, infoY - pillH / 2, waveW, pillH, pillR); ctx.stroke();
  ctx.fillStyle = wvFg; ctx.textAlign = 'center';
  ctx.fillText(waveTxt, cx2 + waveW / 2, infoY + 4);
  cx2 += waveW + gap;

  // nível (verde)
  if (nPills > 2) {
    ctx.fillStyle = '#1a3a1a'; roundRect(cx2, infoY - pillH / 2, lvlW, pillH, pillR); ctx.fill();
    ctx.strokeStyle = '#4cc84c'; ctx.lineWidth = 1.5; roundRect(cx2, infoY - pillH / 2, lvlW, pillH, pillR); ctx.stroke();
    ctx.fillStyle = '#8eea8e'; ctx.textAlign = 'center';
    ctx.fillText(lvlTxt, cx2 + lvlW / 2, infoY + 4);
    cx2 += lvlW + gap;
  }

  // abates (vermelho)
  if (nPills > 3) {
    ctx.fillStyle = '#3a1820'; roundRect(cx2, infoY - pillH / 2, killW, pillH, pillR); ctx.fill();
    ctx.strokeStyle = '#d85050'; ctx.lineWidth = 1.5; roundRect(cx2, infoY - pillH / 2, killW, pillH, pillR); ctx.stroke();
    ctx.fillStyle = '#f08080'; ctx.textAlign = 'center';
    ctx.fillText(killTxt, cx2 + killW / 2, infoY + 4);
  }

  ctx.textAlign = 'left';

  /* === SCORE (canto superior esquerdo) === */
  const score = calcScore();
  const scoreTxt = nf(score);
  ctx.font = '900 11px "Press Start 2P", monospace';
  const scoreW = ctx.measureText(scoreTxt).width + 22;
  const scoreX = 8, scoreY = infoY, scorePH = 22;
  ctx.fillStyle = 'rgba(40,28,8,.65)';
  roundRect(scoreX, scoreY - scorePH / 2, scoreW, scorePH, 7); ctx.fill();
  ctx.strokeStyle = '#e8c84a'; ctx.lineWidth = 1.5;
  roundRect(scoreX, scoreY - scorePH / 2, scoreW, scorePH, 7); ctx.stroke();
  ctx.fillStyle = '#e8c84a'; ctx.textAlign = 'center';
  ctx.fillText(scoreTxt, scoreX + scoreW / 2, scoreY + 4);
  ctx.font = '500 5px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(232,200,74,.5)';
  ctx.fillText(t('pts'), scoreX + scoreW / 2, scoreY - scorePH / 2 - 2);
  ctx.textAlign = 'left';

  /* === CARD DO DRONE — estilo objetivo === */
  {
    const cW = 54, cH = 76, cR = 6;
    const cX = scoreX, cY = scoreY - scorePH / 2 + scorePH + 4;
    const unlocked = game.orbLevel > 0;
    const maxed = game.orbLevel >= 20;
    const frac = maxed ? 1 : (unlocked
      ? Math.min(1, (score - game.orbLevel * 2000) / 2000)
      : Math.min(1, score / 2000));
    const flash = game.orbLevelFlash || 0;
    const fp = flash > 0 ? Math.abs(Math.sin(flash * Math.PI * 7)) : 0;  // 0..1 pulsando

    ctx.save();
    // clip ao shape arredondado — nada vaza
    roundRect(cX, cY, cW, cH, cR); ctx.clip();

    // fundo
    ctx.fillStyle = unlocked ? '#1a1228' : '#131020';
    ctx.fillRect(cX, cY, cW, cH);

    // header stripe (dourado quando ativo)
    const hH = 13;
    ctx.fillStyle = unlocked
      ? `rgba(${180 + fp * 75},${130 + fp * 60},${30 + fp * 20},1)`
      : 'rgba(60,45,80,.9)';
    ctx.fillRect(cX, cY, cW, hH);

    ctx.font = '700 5px "Press Start 2P", monospace';
    ctx.fillStyle = unlocked ? '#1a1020' : 'rgba(160,140,200,.5)';
    ctx.textAlign = 'center';
    ctx.fillText(t('drone'), cX + cW / 2, cY + hH - 3);

    // ícone — w02 (orb icon) ocupa a maior parte do card
    const iconS = 42, iconX = cX + (cW - iconS) / 2, iconY = cY + hH + 3;
    if (IMG.w02?.complete) {
      ctx.globalAlpha = unlocked ? 1 : 0.2;
      ctx.drawImage(IMG.w02, iconX, iconY, iconS, iconS);
      ctx.globalAlpha = 1;
    }

    // flash overlay no ícone ao subir de nível
    if (fp > 0) {
      ctx.globalAlpha = fp * 0.45;
      ctx.fillStyle = '#ffe880';
      ctx.fillRect(iconX, iconY, iconS, iconS);
      ctx.globalAlpha = 1;
    }

    // progress bar
    const barX = cX + 4, barY = cY + hH + 3 + iconS + 3, barW = cW - 8, barH = 4;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = unlocked ? `rgba(255,${190 + fp * 65},${40 + fp * 30},1)` : '#403060';
    ctx.fillRect(barX, barY, barW * frac, barH);

    // label de nível no rodapé
    ctx.font = '600 6px "Press Start 2P", monospace';
    ctx.fillStyle = unlocked ? `rgba(255,${200 + fp * 55},80,1)` : 'rgba(140,120,170,.4)';
    ctx.textAlign = 'center';
    ctx.fillText(maxed ? 'MÁX' : (unlocked ? `NV ${game.orbLevel}` : '? ? ?'), cX + cW / 2, cY + cH - 4);

    ctx.restore();

    // borda por cima do clip
    ctx.strokeStyle = unlocked
      ? `rgba(${180 + fp * 75},${130 + fp * 60},50,${0.8 + fp * 0.2})`
      : 'rgba(80,60,100,.6)';
    ctx.lineWidth = unlocked ? 2 : 1;
    roundRect(cX, cY, cW, cH, cR); ctx.stroke();

    ctx.textAlign = 'left';
  }

  /* === PORTRAIT + SPEECH BUBBLES (bottom-left) === */
  const portSize = 80, portX = 10, portY = H - portSize - 10;
  const isLowHp = p.hp / p.maxhp < 0.3;
  const isRadioActive = !!bossRadio;
  const alertPulse = 0.7 + Math.sin(game.t * 6) * 0.3;

  // helper: word-wrap for bubble text
  const wrapBubText = (text, maxW) => {
    ctx.font = '700 8px "Press Start 2P", monospace';
    const words = text.split(' '), out = [];
    let cur = '';
    for (const wd of words) {
      const test = cur ? cur + ' ' + wd : wd;
      if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = wd; }
      else cur = test;
    }
    if (cur) out.push(cur);
    return out;
  };
  // helper: draw a speech bubble, returns new topY - gap
  const drawBub = (bx2, bottomY, bw2, lines, fillC, borderC, textC) => {
    const lineH = 13, pad = 9;
    const bh2 = lines.length * lineH + pad * 2;
    const ty = bottomY - bh2 - 8;
    ctx.fillStyle = fillC; roundRect(bx2, ty, bw2, bh2, 7); ctx.fill();
    ctx.strokeStyle = borderC; ctx.lineWidth = 1.5; roundRect(bx2, ty, bw2, bh2, 7); ctx.stroke();
    // tail triangle pointing down-left
    ctx.beginPath();
    ctx.moveTo(bx2 + 10, ty + bh2);
    ctx.lineTo(bx2 + 22, ty + bh2);
    ctx.lineTo(bx2 + 14, ty + bh2 + 7);
    ctx.closePath();
    ctx.fillStyle = fillC; ctx.fill();
    ctx.font = '700 8px "Press Start 2P", monospace';
    ctx.fillStyle = textC; ctx.textAlign = 'left';
    lines.forEach((ln, i) => ctx.fillText(ln, bx2 + pad, ty + pad + 8 + lineH * i));
    return ty - 4;
  };

  // portrait image: radio > alert > normal
  let portImg = IMG.main;
  if (isRadioActive) portImg = IMG.main_radio;
  else if (isLowHp) portImg = IMG.main_alert;

  // portrait frame
  ctx.fillStyle = '#0d0818'; roundRect(portX, portY, portSize, portSize, 8); ctx.fill();
  if (isLowHp && !isRadioActive) ctx.globalAlpha = alertPulse;
  ctx.strokeStyle = isRadioActive ? '#9060e0' : (isLowHp ? '#e85858' : '#5a4e74');
  ctx.lineWidth = 2; roundRect(portX, portY, portSize, portSize, 8); ctx.stroke();
  ctx.globalAlpha = 1;
  if (portImg && portImg.complete) ctx.drawImage(portImg, portX, portY, portSize, portSize);
  // glass shine
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(portX + 1, portY + 1, portSize - 2, portSize / 3, 8); ctx.fill();

  // label "PILOTO" below portrait
  ctx.font = '900 6px "Press Start 2P", monospace';
  ctx.fillStyle = '#6a5e84'; ctx.textAlign = 'center';
  ctx.fillText(t('pilot'), portX + portSize / 2, portY + portSize + 10);
  ctx.textAlign = 'left';

  // speech bubbles stacked above portrait (mín. 170px p/ não espremer o texto)
  const bubW = Math.min(240, Math.max(170, W * 0.3));
  let bubY = portY - 2;

  if (isRadioActive && bossRadio.playerMsg) {
    const lns = wrapBubText(bossRadio.playerMsg, bubW - 18);
    bubY = drawBub(portX, bubY, bubW, lns, 'rgba(22,10,42,0.93)', '#8a5edc', '#d0b0ff');
  }
  if (isLowHp) {
    const secs = Math.ceil(game.hpTimer || 0);
    const lns = wrapBubText(t('low_hp', secs), bubW - 18);
    ctx.globalAlpha = alertPulse;
    bubY = drawBub(portX, bubY, bubW, lns, 'rgba(50,8,14,0.93)', '#e85858', '#f09090');
    ctx.globalAlpha = 1;
  }

  /* === EMBAIXO ESQUERDA: HP + Descarga === */
  const bw = Math.min(200, W * 0.25);
  const bx = portX + portSize + 12;
  const by = H - 70;

  // painel
  ctx.fillStyle = 'rgba(14,8,20,.6)';
  roundRect(bx - 10, by - 24, bw + 20, 88, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(160,140,200,.15)'; ctx.lineWidth = 1;
  roundRect(bx - 10, by - 24, bw + 20, 88, 10); ctx.stroke();

  // HP label + valor
  ctx.textAlign = 'left';
  ctx.font = '900 10px "Press Start 2P", monospace';
  ctx.fillStyle = '#e8e0f4';
  ctx.fillText('❤ HP', bx, by - 8);
  ctx.font = '900 10px "Inter", sans-serif';
  ctx.fillStyle = '#a098b8';
  ctx.textAlign = 'right'; ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxhp}`, bx + bw, by - 8); ctx.textAlign = 'left';

  // barra de HP
  const hf = p.hp / p.maxhp;
  const hpColor = hf > 0.5 ? '#5cd85c' : (hf > 0.25 ? '#e8c84a' : '#e85858');
  drawBar(bx, by, bw, 18, hf, hpColor, '#2a1535', 5);
  ctx.fillStyle = 'rgba(255,255,255,.14)'; roundRect(bx, by, bw * hf, 8, 5); ctx.fill();

  // Descarga
  const ocy = by + 28;
  const ocf = p.overcharge / p.ocMax;
  ctx.textAlign = 'left';
  ctx.font = '900 9px "Press Start 2P", monospace';
  if (ocf >= 1) {
    const pulse = 0.7 + Math.sin(game.t * 10) * 0.3;
    ctx.fillStyle = `rgba(255,213,74,${pulse})`;
    ctx.fillText(t('ready'), bx, ocy + 2);
  } else {
    ctx.fillStyle = '#b0a4c8';
    ctx.fillText(bw < 130 ? t('charge_short') : t('discharge'), bx, ocy + 2);
  }
  if (bw >= 130 || ocf < 1) {
    ctx.font = '700 9px "Inter", sans-serif'; ctx.fillStyle = '#a098b8';
    ctx.textAlign = 'right'; ctx.fillText(Math.floor(ocf * 100) + '%', bx + bw, ocy + 2); ctx.textAlign = 'left';
  }
  drawBar(bx, ocy + 5, bw, 12, ocf, ocf >= 1 ? '#ffd54a' : '#d08840', '#1a1028', 4);
  if (ocf >= 1) {
    ctx.fillStyle = 'rgba(255,213,74,' + (0.15 + Math.sin(game.t * 8) * 0.1) + ')';
    roundRect(bx, ocy + 5, bw, 12, 4); ctx.fill();
  }

  /* === EMBAIXO DIREITA: Armas (com nome) === */
  let slotW = 54, slotH = 66, slotGap = 6, slotR = 7;
  const nw = game.weapons.length;
  let totalSlotW = nw * (slotW + slotGap) - slotGap;
  // em telas estreitas encolhe os slots p/ não invadir o painel de HP
  const maxSlotsW = W - (bx + bw) - 34;
  if (totalSlotW > maxSlotsW && maxSlotsW > 0) {
    const k = Math.max(0.55, maxSlotsW / totalSlotW);
    slotW *= k; slotH *= k; slotGap *= k; slotR *= k;
    totalSlotW = nw * (slotW + slotGap) - slotGap;
  }
  const sx = W - 14 - totalSlotW;
  const sy = H - 14 - slotH;

  // painel de armas
  ctx.fillStyle = 'rgba(14,8,20,.6)';
  roundRect(sx - 10, sy - 10, totalSlotW + 20, slotH + 20, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(160,140,200,.15)'; ctx.lineWidth = 1;
  roundRect(sx - 10, sy - 10, totalSlotW + 20, slotH + 20, 10); ctx.stroke();

  for (let i = 0; i < nw; i++) {
    const w = game.weapons[i];
    const def = WEAPONS[w.id];
    const icon = IMG[def.icon];
    const x = sx + i * (slotW + slotGap), y = sy;

    // slot fundo
    ctx.fillStyle = '#2a2240'; roundRect(x, y, slotW, slotH, slotR); ctx.fill();
    ctx.strokeStyle = '#5a4e74'; ctx.lineWidth = 1.5; roundRect(x, y, slotW, slotH, slotR); ctx.stroke();

    // ícone (quadrado acima)
    if (icon && icon.complete) ctx.drawImage(icon, x + 3, y + 3, slotW - 6, slotW - 6);

    // nível badge (canto superior direito)
    const bw2 = Math.max(13, slotW * 0.33), bh2 = Math.max(11, slotH * 0.21);
    ctx.fillStyle = '#8eea8e'; roundRect(x + slotW - bw2, y, bw2, bh2, 4); ctx.fill();
    ctx.fillStyle = '#1a1430'; ctx.font = `900 ${slotW < 44 ? 7 : 8}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center'; ctx.fillText(w.level, x + slotW - bw2 / 2, y + bh2 - 3); ctx.textAlign = 'left';

    // cooldown indicator (arco fino ao redor)
    const cd = def.cd / game.mult.fire / (w.mFire || 1);
    const cdFrac = Math.min(1, w.timer / cd);
    if (cdFrac > 0.05) {
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x + slotW / 2, y + slotW / 2, slotW / 2 - 2, -Math.PI / 2, -Math.PI / 2 + cdFrac * Math.PI * 2);
      ctx.stroke();
    }
  }

  /* === TOUCH: joystick virtual + botões === */
  if (IS_TOUCH) {
    // botão de descarga (acima dos slots de arma)
    const ocf2 = Math.min(1, p.overcharge / p.ocMax);
    const ob = touch.btnOC;
    ob.x = W - 48; ob.y = sy - 54;
    ctx.save();
    ctx.fillStyle = ocf2 >= 1 ? 'rgba(80,60,20,.85)' : 'rgba(20,14,34,.75)';
    ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r, 0, Math.PI * 2); ctx.fill();
    // anel de progresso da carga
    ctx.strokeStyle = ocf2 >= 1 ? '#ffd54a' : '#d08840';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r - 3, -Math.PI / 2, -Math.PI / 2 + ocf2 * Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,140,200,.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r, 0, Math.PI * 2); ctx.stroke();
    if (ocf2 >= 1) {
      const pulse2 = 0.6 + Math.sin(game.t * 9) * 0.4;
      ctx.strokeStyle = `rgba(255,213,74,${pulse2})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r + 5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = ocf2 >= 1 ? '#ffd54a' : 'rgba(190,170,220,.6)';
    ctx.fillText('⚡', ob.x, ob.y + 2);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.restore();

    // botão de pausa: abaixo do radar em telas largas; à esquerda (sob o card
    // do drone) em telas estreitas, onde o diálogo do boss ocupa o centro-topo
    const pb = touch.btnPause;
    if (W < 520) { pb.x = 35; pb.y = 152; }
    else {
      // abaixo do radar, mas nunca encostando no botão de descarga (telas baixas)
      pb.x = W - 80;
      pb.y = Math.min(196, ob.y - ob.r - pb.r - 10);
    }
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = 'rgba(20,14,34,.75)';
    ctx.beginPath(); ctx.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(160,140,200,.3)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(200,190,230,.85)';
    ctx.fillRect(pb.x - 6, pb.y - 7, 4, 14);
    ctx.fillRect(pb.x + 2, pb.y - 7, 4, 14);
    ctx.restore();

    // joystick (aparece onde o dedo pousa)
    if (touch.active) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#c8d4f8'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(touch.ox, touch.oy, JOY_R, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#c8d4f8';
      ctx.beginPath(); ctx.arc(touch.ox, touch.oy, JOY_R, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#e8eeff';
      ctx.beginPath(); ctx.arc(touch.ox + touch.dx * JOY_R, touch.oy + touch.dy * JOY_R, 18, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* === TOAST central (aviso não-bloqueante, ex.: tudo no máximo → cura) === */
  if (game.toast) {
    const tt = game.toast, k = tt.life / tt.max;              // 1 → 0
    const a = k > 0.8 ? (1 - k) / 0.2 : Math.min(1, k / 0.35); // fade-in rápido, fade-out no fim
    const rise = (1 - k) * 16;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.font = '900 12px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    const tw = ctx.measureText(tt.text).width;
    const bw = tw + 30, bh = 32, bx = W / 2 - bw / 2, by = H * 0.34 - rise;
    ctx.fillStyle = 'rgba(14,8,20,.88)'; roundRect(bx, by, bw, bh, 9); ctx.fill();
    ctx.strokeStyle = tt.color; ctx.lineWidth = 2; roundRect(bx, by, bw, bh, 9); ctx.stroke();
    ctx.fillStyle = tt.color; ctx.fillText(tt.text, W / 2, by + bh / 2 + 4);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}
function drawBossRadio() {
  if (!bossRadio) return;
  const elapsed = 14 - bossRadio.life;
  const fade = bossRadio.life < 1 ? bossRadio.life
             : elapsed < 0.4 ? elapsed / 0.4
             : 1;
  if (fade <= 0) return;
  ctx.save();
  ctx.globalAlpha = fade;

  // painel — altura acompanha o texto; em tela estreita desce p/ baixo do radar
  const pw = Math.min(340, W * 0.7);
  const px = W / 2 - pw / 2;
  const wrapW = pw - 48 - 26;                       // mesmo maxW do texto abaixo
  ctx.font = '700 10px "Press Start 2P", monospace';
  let nLines = 1, lw = 0;
  for (const wd of bossRadio.text.split(' ')) {
    const wW = ctx.measureText((lw ? ' ' : '') + wd).width;
    if (lw + wW > wrapW) { nLines++; lw = ctx.measureText(wd).width; }
    else lw += wW;
  }
  const ph = Math.max(64, 38 + nLines * 15);
  const py = (px + pw > W - 152) ? 170 : 72;        // 170 = abaixo do radar
  ctx.fillStyle = 'rgba(10,6,16,.85)';
  roundRect(px, py, pw, ph, 10); ctx.fill();
  ctx.strokeStyle = '#6a5e84'; ctx.lineWidth = 2;
  roundRect(px, py, pw, ph, 10); ctx.stroke();

  // barra de interferência (estática) no topo do painel
  ctx.fillStyle = 'rgba(140,120,200,.15)';
  for (let i = 0; i < 8; i++) {
    const bx = px + 6 + i * (pw - 12) / 8, bw2 = Math.random() * ((pw - 12) / 8 - 2);
    ctx.fillRect(bx, py + 2, bw2, 2);
  }

  // ícone do boss (esquerda)
  const icon = IMG[bossRadio.icon];
  const ix = px + 8, iy = py + 8, isize = 48;
  ctx.fillStyle = '#2a1e38'; roundRect(ix, iy, isize, isize, 6); ctx.fill();
  ctx.strokeStyle = '#c85868'; ctx.lineWidth = 1.5; roundRect(ix, iy, isize, isize, 6); ctx.stroke();
  if (icon && icon.complete) ctx.drawImage(icon, ix + 4, iy + 4, isize - 8, isize - 8);

  // indicador de rádio (onda pulsante)
  const radioX = ix + isize + 6, radioY = py + 12;
  ctx.fillStyle = '#c85868'; ctx.font = '900 8px "Press Start 2P", monospace';
  ctx.fillText('◄ ' + bossRadio.name.toUpperCase(), radioX, radioY);
  // barrinhas de sinal
  for (let b = 0; b < 4; b++) {
    const bh = 3 + b * 2;
    const on = Math.random() > 0.3;
    ctx.fillStyle = on ? '#c85868' : '#3a2040';
    ctx.fillRect(radioX + 80 + b * 6, radioY - bh + 2, 4, bh);
  }

  // texto alienígena (typewriter com animação por letra)
  const tx = radioX, ty = py + 30;
  const maxW = pw - isize - 26;
  const fontSize = 10;
  ctx.font = '700 ' + fontSize + 'px "Press Start 2P", monospace';

  // calcula posição de cada caractere com word-wrap
  const chars = bossRadio.text.split('');
  let cx2 = tx, ly = ty;
  for (let ci = 0; ci < chars.length; ci++) {
    const ch = chars[ci];
    const chW = ctx.measureText(ch).width;

    // word-wrap: verifica se a próxima palavra cabe
    if (ch === ' ') {
      let nextWord = '';
      for (let nj = ci + 1; nj < chars.length && chars[nj] !== ' '; nj++) nextWord += chars[nj];
      if (cx2 + ctx.measureText(' ' + nextWord).width > tx + maxW) {
        cx2 = tx; ly += 15; continue;
      }
    }

    // animação: a última letra digitada tem efeito especial
    const isLast = (ci === chars.length - 1) && bossRadio.phase === 'typing';
    const age = isLast ? bossRadio.charTimer / 0.09 : 1;   // 0→1 durante o intervalo

    const charAge = bossRadio.charAge || 0;
    const ageNorm = isLast ? Math.min(1, charAge / 0.12) : 1;

    if (isLast && ageNorm < 1) {
      // letra nova: escala grande→normal, cor brilhante, shake
      const s = 1.5 - ageNorm * 0.5;
      const shx = (Math.random() - 0.5) * (1 - ageNorm) * 4;
      const shy = (Math.random() - 0.5) * (1 - ageNorm) * 4;
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = '700 ' + Math.round(fontSize * s) + 'px "Press Start 2P", monospace';
      ctx.fillText(ch, cx2 + shx, ly + shy);
      ctx.restore();
      ctx.font = '700 ' + fontSize + 'px "Press Start 2P", monospace';
    } else {
      // letras antigas: cor normal com leve variação de brilho
      const bright = 0.7 + Math.sin(game.t * 3 + ci * 0.5) * 0.1;
      ctx.fillStyle = `rgba(208,196,228,${bright})`;
      ctx.fillText(ch, cx2, ly);
    }
    cx2 += chW;
  }

  // cursor piscante no final
  if (bossRadio.phase === 'typing') {
    const cursorOn = Math.floor(game.t * 8) % 2 === 0;
    if (cursorOn) {
      ctx.fillStyle = '#e8e0f4';
      ctx.fillRect(cx2 + 2, ly - 8, 6, 10);
    }
  }

  ctx.restore();
}

function drawMinimap() {
  // raio do radar: encolhe em telas estreitas p/ não dominar o topo
  const R = Math.min(68, Math.max(54, Math.round(W * 0.155)));
  const WORLD_R = 320;    // alcance em unidades de mundo
  const cx = W - R - 12; // centro X (canto superior direito)
  const cy = R + 12;     // centro Y
  const p = game.player;

  ctx.save();

  // fundo escuro com clip circular
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8,4,16,0.78)'; ctx.fill();

  // grade de linha fina
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(100,80,160,0.18)'; ctx.lineWidth = 1;
  for (let d = WORLD_R * 0.33; d < WORLD_R; d += WORLD_R * 0.33) {
    const pr = d / WORLD_R * R;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.stroke();
  }
  // cruz
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

  // linha de varredura rotativa
  const scanAng = (game.t * 1.8) % (Math.PI * 2);
  const grad = ctx.createConicalGradient
    ? null // API não existe — usa fillStyle sólido
    : null;
  // cone de varredura (sector preenchido)
  const sweepSpan = Math.PI * 0.52;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R, scanAng - sweepSpan, scanAng);
  ctx.closePath();
  const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  sweepGrad.addColorStop(0, 'rgba(80,220,120,0.0)');
  sweepGrad.addColorStop(1, 'rgba(80,220,120,0.13)');
  ctx.fillStyle = sweepGrad; ctx.fill();
  // linha principal do scan
  ctx.strokeStyle = 'rgba(100,255,140,0.55)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(scanAng) * R, cy + Math.sin(scanAng) * R);
  ctx.stroke();

  // DropPods (azul)
  for (const dp of game.droppods) {
    const dx = (dp.x - p.x) / WORLD_R, dy = (dp.y - p.y) / WORLD_R;
    const dist = Math.hypot(dx, dy);
    const mx = cx + dx * R, my = cy + dy * R;
    if (dist > 1) continue;
    ctx.fillStyle = '#8a96e8'; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Health packs (verde)
  for (const hp of game.healthPacks) {
    const dx = (hp.x - p.x) / WORLD_R, dy = (hp.y - p.y) / WORLD_R;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) continue;
    const mx = cx + dx * R, my = cy + dy * R;
    ctx.fillStyle = '#50e050'; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Inimigos
  for (const e of game.enemies) {
    if (e.dying) continue;
    const dx = (e.x - p.x) / WORLD_R, dy = (e.y - p.y) / WORLD_R;
    const dist = Math.hypot(dx, dy);
    const clamp = dist > 1 ? 1 / dist : 1;
    const mx = cx + dx * clamp * R, my = cy + dy * clamp * R;
    if (e.boss) {
      // boss: losango dourado
      const s = 5;
      ctx.fillStyle = '#ffd54a'; ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(mx, my - s); ctx.lineTo(mx + s, my);
      ctx.lineTo(mx, my + s); ctx.lineTo(mx - s, my);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff8c0'; ctx.lineWidth = 1; ctx.globalAlpha = 0.7;
      ctx.stroke(); ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = dist > 1 ? '#f04040' : '#ff8080';
      ctx.globalAlpha = dist > 1 ? 0.6 : 0.85;
      ctx.beginPath(); ctx.arc(mx, my, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore(); // remove clip

  // borda do radar
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(100,80,180,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  // brilho interno
  ctx.beginPath(); ctx.arc(cx, cy, R - 1, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(180,160,255,0.12)'; ctx.lineWidth = 2; ctx.stroke();

  // jogador no centro (ponto branco)
  ctx.fillStyle = '#fff'; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(180,160,255,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.stroke();

  // label
  ctx.font = '500 6px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(160,140,210,0.55)'; ctx.textAlign = 'center';
  ctx.fillText(t('radar'), cx, cy + R + 10);

  ctx.restore();
}

function drawOffscreenIndicators() {
  const margin = 28, arrowSize = 8, bossSize = 16;
  const cx = W / 2, cy = H / 2;
  const hw = W / 2 - margin, hh = H / 2 - margin;

  for (const e of game.enemies) {
    if (e.dying) continue;
    // posição do inimigo na tela
    const sx = cx + (e.x - game.cam.x) * ZOOM;
    const sy = cy + (e.y - game.cam.y) * ZOOM;
    if (sx > margin && sx < W - margin && sy > margin && sy < H - margin) continue;

    // ângulo do centro da tela pro inimigo
    const a = Math.atan2(sy - cy, sx - cx);
    // clamp na borda da tela
    const dx = Math.cos(a), dy = Math.sin(a);
    const tx = Math.max(-hw, Math.min(hw, dx * 9999));
    const ty = Math.max(-hh, Math.min(hh, dy * 9999));
    const scale = Math.min(hw / Math.abs(dx || 0.001), hh / Math.abs(dy || 0.001));
    const px = cx + dx * Math.min(scale, 9999);
    const py = cy + dy * Math.min(scale, 9999);
    const sz = e.boss ? bossSize : arrowSize;

    ctx.save();
    ctx.translate(px, py);
    if (e.boss) {
      // boss: caveira dourada
      const r = sz * 0.88;
      ctx.translate(-dx * (r + 5), -dy * (r + 5));
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#ffd54a';
      ctx.beginPath(); ctx.arc(0, -r * 0.12, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, r * 0.45, r * 0.6, 0, Math.PI); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.2, r * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( r * 0.3, -r * 0.2, r * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9;
      const tw = r * 0.17, th = r * 0.22;
      ctx.fillRect(-r * 0.35 - tw / 2, r * 0.46, tw, th);
      ctx.fillRect(-tw / 2, r * 0.46, tw, th);
      ctx.fillRect( r * 0.35 - tw / 2, r * 0.46, tw, th);
      ctx.strokeStyle = '#fff8c0'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(0, -r * 0.12, r, 0, Math.PI * 2); ctx.stroke();
    } else {
      // inimigo comum: seta vermelha original
      ctx.rotate(a);
      ctx.fillStyle = '#f06060'; ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.6, -sz * 0.7); ctx.lineTo(-sz * 0.6, sz * 0.7);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a03030'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }

  // setas para HEALTH PACKS fora da tela (verdes com cruz)
  for (const hp of game.healthPacks) {
    const sx = cx + (hp.x - game.cam.x) * ZOOM;
    const sy = cy + (hp.y - game.cam.y) * ZOOM;
    if (sx > margin && sx < W - margin && sy > margin && sy < H - margin) continue;
    const a = Math.atan2(sy - cy, sx - cx);
    const adx = Math.cos(a), ady = Math.sin(a);
    const scale = Math.min(hw / Math.abs(adx || 0.001), hh / Math.abs(ady || 0.001));
    const px = cx + adx * Math.min(scale, 9999);
    const py = cy + ady * Math.min(scale, 9999);
    const pulse = 0.7 + Math.sin(game.t * 7) * 0.3;
    ctx.save();
    ctx.translate(px, py);
    // glow externo pulsante
    ctx.globalAlpha = 0.5 * pulse;
    ctx.fillStyle = '#30ff60';
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    // anel pulsante
    ctx.globalAlpha = 0.85 * pulse;
    ctx.strokeStyle = '#80ffaa';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.stroke();
    // cruz verde (sem fundo branco)
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#20e050';
    ctx.fillRect(-6, -13, 12, 26);
    ctx.fillRect(-13, -6, 26, 12);
    // borda escura para contraste
    ctx.strokeStyle = '#0a5a18'; ctx.lineWidth = 1.2;
    ctx.strokeRect(-6, -13, 12, 26);
    ctx.strokeRect(-13, -6, 26, 12);
    ctx.restore();
  }

  // setas para DROPPODS fora da tela (azul pulsante)
  for (const dp of game.droppods) {
    if (dp.state !== 'landed') continue;
    const sx = cx + (dp.x - game.cam.x) * ZOOM;
    const sy = cy + (dp.y - game.cam.y) * ZOOM;
    if (sx > margin && sx < W - margin && sy > margin && sy < H - margin) continue;
    const a = Math.atan2(sy - cy, sx - cx);
    const adx = Math.cos(a), ady = Math.sin(a);
    const scale = Math.min(hw / Math.abs(adx || 0.001), hh / Math.abs(ady || 0.001));
    const px = cx + adx * Math.min(scale, 9999);
    const py2 = cy + ady * Math.min(scale, 9999);
    const pulse = 0.6 + Math.sin(game.t * 5) * 0.4;
    ctx.save();
    ctx.translate(px, py2); ctx.rotate(a);
    ctx.fillStyle = `rgba(138,150,232,${pulse})`; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-7, -8); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4a50a0'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}
function drawCursor() {
  // cursor agora é HTML (fica na frente dos overlays)
}

/* ------------------------------------------------------------------- loop -- */
let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000) || 0; last = ts;
  if (game && game.running && !game.paused && !game.over) update(dt);
  if (game) render();
  requestAnimationFrame(loop);
}

/* -------------------------------------------------------------------- sfx -- */
let actx;
function beep(freq, dur, type, vol) {
  if (soundMuted || portalMuted) return;   // mute do portal tem prioridade
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.value = vol || 0.05;
    o.connect(g); g.connect(actx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (dur || 0.08));
    o.stop(actx.currentTime + (dur || 0.08));
  } catch (e) { }
}

/* ----------------------------------------------------------- menu music -- */
let menuMusic = null;
let _musicFade = null;       // requestAnimationFrame id do fade atual
const MUSIC_MAX = 0.10;      // volume máximo (10%)

function initMenuMusic() {
  if (menuMusic) return;
  try {
    menuMusic = new Audio('assets/main.mp3');
    menuMusic.loop = true;
    menuMusic.volume = 0;
  } catch(e) {}
}

/* faz fade do volume atual até |target| (0..1). Se target=0, pausa ao final. */
function _fadeMusicTo(target, done) {
  if (!menuMusic) return;
  if (_musicFade) { cancelAnimationFrame(_musicFade); _musicFade = null; }
  const start = menuMusic.volume;
  const d = 700; // ms do fade
  const t0 = performance.now();
  function step(now) {
    const p = Math.min(1, (now - t0) / d);
    // ease-in-out suave
    const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
    menuMusic.volume = start + (target - start) * e;
    if (p < 1) { _musicFade = requestAnimationFrame(step); return; }
    _musicFade = null;
    menuMusic.volume = target;
    if (target === 0) { menuMusic.pause(); menuMusic.currentTime = 0; }
    if (done) done();
  }
  _musicFade = requestAnimationFrame(step);
}

function startMenuMusic() {
  if (soundMuted || portalMuted) return;
  try {
    if (!menuMusic) initMenuMusic();
    if (!menuMusic) return;
    if (menuMusic.paused) {
      menuMusic.volume = 0;
      menuMusic.currentTime = 0;
      // play() pode falhar por autoplay — o listener de primeiro toque resolve
      menuMusic.play().then(() => { _fadeMusicTo(MUSIC_MAX); }).catch(() => {});
    } else if (menuMusic.volume < MUSIC_MAX - 0.01) {
      _fadeMusicTo(MUSIC_MAX);
    }
  } catch(e) {}
}

function stopMenuMusic() {
  if (_musicFade) { cancelAnimationFrame(_musicFade); _musicFade = null; }
  try {
    if (menuMusic && !menuMusic.paused) _fadeMusicTo(0);
  } catch(e) {}
}

/* autoplay: navegadores bloqueiam Audio.play() antes do primeiro gesto.
   no primeiro clique/toque/tecla, se o menu estiver visivel, tenta de novo. */
(function() {
  function _tryMusic() {
    const ov = document.getElementById('ui-start');
    if (ov && ov.classList.contains('show')) startMenuMusic();
  }
  const opts = { once: true };
  document.addEventListener('click',    _tryMusic, opts);
  document.addEventListener('touchstart', _tryMusic, opts);
  document.addEventListener('keydown',  _tryMusic, opts);
})();

/* -------------------------------------------------------- menu sfx -- */
function menuClickSound() {
  beep(660, 0.05, 'square', 0.035);
}
function menuHoverSound() {
  beep(1100, 0.025, 'sine', 0.018);
}

/* ------------------------------------------------------------------- boot -- */
let _menuMode = 'start'; // 'start' | 'resume'

function toggleSound() {
  soundMuted = !soundMuted;
  document.querySelectorAll('.btn-sound,.mbsound').forEach(b => {
    b.innerHTML = soundMuted ? '🔇' : '🔊';
  });
  // pausa/retoma música do menu conforme o mute
  try {
    if (menuMusic) {
      if (soundMuted || portalMuted) {
        if (_musicFade) { cancelAnimationFrame(_musicFade); _musicFade = null; }
        menuMusic.volume = 0;
        menuMusic.pause();
      } else {
        const startOv = document.getElementById('ui-start');
        if (startOv && startOv.classList.contains('show')) {
          startMenuMusic();
        }
      }
    }
  } catch(e) {}
}

function _animMenuOut(cb) {
  stopMenuMusic();
  const ov = document.getElementById('ui-start');
  ov.classList.add('closing');
  stopSpiderCanvas();
  setTimeout(() => { ov.classList.remove('show', 'closing'); cb(); }, 480);
}
function _animMenuIn() {
  const ov = document.getElementById('ui-start');
  ov.classList.remove('closing');
  ov.classList.add('show');
  setTimeout(initSpiderCanvas, 60); // wait for CSS transition to size the wrap
  startMenuMusic();
}

function pauseGame() {
  if (!game || !game.running || game.over) return;
  if (document.getElementById('ui-levelup').classList.contains('show')) return;
  game.paused = true;
  CG.gameplayStop();
  document.getElementById('ui-pause').classList.add('show');
}
function resumeGame() {
  document.getElementById('ui-pause').classList.remove('show');
  game.paused = false;
  CG.gameplayStart();
}
function goMainMenu() {
  document.getElementById('ui-gameover').classList.remove('show');
  document.getElementById('ui-pause').classList.remove('show');
  if (game) { game.running = false; game.paused = false; }
  CG.gameplayStop();
  _menuMode = 'start';
  document.getElementById('btnStart').innerHTML = '&#9654;&ensp;JOGAR';
  updateMenuStats();
  updateCoins(true);                    // sucata ganha na partida (com bump)
  showWeaponInfo(_lockedWeaponId);      // re-renderiza upgrades (custos vs. saldo novo)
  _animMenuIn();
}
function start() {
  _animMenuOut(() => { newGame(_lockedWeaponId); game.running = true; CG.gameplayStart(); });
}

function updateMenuStats() {
  ensureMeta();   // re-tenta carregar a sucata se o boot leu vazio (SDK.data tardio)
  const best = JSON.parse(CG.get('ss_best') || '{}');
  const t = best.time || 0;
  const m = String(Math.floor(t / 60)).padStart(2, '0');
  const s = String(Math.floor(t % 60)).padStart(2, '0');
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const setStyle = (id, prop, v) => { const el = document.getElementById(id); if (el) el.style[prop] = v; };
  set('mBestTime',  t ? `${m}:${s}` : '--:--');
  set('mBestLevel', best.level || '--');
  const hp = (best.maxhp || 100);
  set('mHpVal', hp);
  setStyle('mHpFill', 'width', Math.min(100, (hp / 200) * 100) + '%');
  set('mBestScore', best.score ? nf(best.score) : '--');
}

function saveBestStats() {
  const best = JSON.parse(CG.get('ss_best') || '{}');
  if (game.t > (best.time || 0)) best.time = game.t;
  if (game.level > (best.level || 1)) best.level = game.level;
  if (game.player.maxhp > (best.maxhp || 100)) best.maxhp = game.player.maxhp;
  const score = calcScore();
  if (score > (best.score || 0)) best.score = score;
  CG.set('ss_best', JSON.stringify(best));
}

let _spiderRAF = null;
let _spiderT   = 0;
let _selWeaponId = null;
let _lockedWeaponId = 'bullet';

function initSpiderCanvas() {
  const cnv = document.getElementById('mSpiderCanvas');
  if (!cnv || !IMG.walk) return;
  const sCtx = cnv.getContext('2d');
  const wrap = cnv.parentElement;
  const fit = () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (w && h && (cnv.width !== w || cnv.height !== h)) { cnv.width = w; cnv.height = h; }
  };
  fit();
  // canvas 1:1 com o painel — a área expande, mas os sprites mantêm a escala do jogo
  if (!cnv._fitBound) {
    cnv._fitBound = true;
    if (window.ResizeObserver) new ResizeObserver(fit).observe(wrap);
    else window.addEventListener('resize', fit);
  }

  if (_spiderRAF) { cancelAnimationFrame(_spiderRAF); _spiderRAF = null; }

  const T = 32;      // tile size (world units)
  const ZS = 3;      // zoom do showcase (3× pixel-perfect — mais perto que o jogo)

  function tick() {
    _spiderT += 0.016;
    const W = cnv.width, H = cnv.height;

    // câmera vagando pelo mapa — simula o robô caminhando (como no jogo)
    const camX = Math.sin(_spiderT * 0.22) * 80;
    const camY = Math.cos(_spiderT * 0.15) * 60;
    const cx   = (W / 2) | 0;
    const cy   = (H * 0.58) | 0;   // robô abaixo do centro (espaço p/ título)

    sCtx.fillStyle = '#3a2530';
    sCtx.fillRect(0, 0, W, H);

    sCtx.save();
    sCtx.imageSmoothingEnabled = false;
    sCtx.setTransform(ZS, 0, 0, ZS, cx - camX * ZS, cy - camY * ZS);

    const x0 = Math.floor((camX - cx/ZS) / T) - 1;
    const x1 = Math.ceil( (camX + cx/ZS) / T) + 1;
    const y0 = Math.floor((camY - cy/ZS) / T) - 1;
    const y1 = Math.ceil( (camY + (H-cy)/ZS) / T) + 1;

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const h = hash(tx, ty);
        const img = IMG[GROUND[h % 3]];
        if (img && img.complete) sCtx.drawImage(img, tx * T, ty * T);
        const dh = hash(tx + 7, ty - 3);
        if (dh % 11 === 0 && IMG.grass && IMG.grass.complete) {
          const iw = IMG.grass.naturalWidth, ih = IMG.grass.naturalHeight;
          sCtx.drawImage(IMG.grass, tx*T+16-iw/2, ty*T+22-ih/2);
        } else if (dh % 17 === 0 && IMG.rock && IMG.rock.complete) {
          const iw = IMG.rock.naturalWidth, ih = IMG.rock.naturalHeight;
          sCtx.drawImage(IMG.rock, tx*T+16-iw/2, ty*T+18-ih/2);
        }
      }
    }
    sCtx.restore();

    // vinheta suave para destacar o robô
    const vgr = sCtx.createRadialGradient(cx, cy, W*0.18, cx, cy, W*0.72);
    vgr.addColorStop(0, 'rgba(0,0,0,0)');
    vgr.addColorStop(1, 'rgba(0,0,0,.55)');
    sCtx.fillStyle = vgr;
    sCtx.fillRect(0, 0, W, H);

    // ── robô + arma renderizados como no jogo (escala fixa ZS, unidades do mundo) ──
    const FS = 48;
    sCtx.save();
    sCtx.imageSmoothingEnabled = false;
    sCtx.setTransform(ZS, 0, 0, ZS, cx, cy);   // origem = centro do robô

    const facing = Math.cos(_spiderT * 0.22) >= 0;   // anda junto com a câmera
    const f   = Math.floor(_spiderT * 8) % 4;
    const bob = Math.sin(_spiderT * 3) * 0.8;
    const aim = -Math.PI / 2 + _spiderT * 0.55;      // arma varre o anel de órbita
    const wx  = Math.cos(aim) * ORBIT_R;
    const wy  = Math.sin(aim) * (ORBIT_R * FLAT) + bob - 4;

    const wId   = _selWeaponId || 'bullet';
    const def   = WEAPONS[wId];
    const sheet = def && IMG[def.sheet];

    const drawW = () => {
      if (!sheet || !sheet.complete) return;
      // sombra da arma no chão (igual drawWeapons)
      sCtx.save();
      sCtx.globalAlpha = 0.25;
      sCtx.fillStyle = '#0a0515';
      sCtx.beginPath(); sCtx.ellipse(wx, wy + 10, 10, 4, 0, 0, Math.PI * 2); sCtx.fill();
      sCtx.restore();
      const { frame: wf, flip: wFlip } = aimFrame(aim);
      sCtx.save();
      sCtx.translate(wx, wy);
      sCtx.scale(wFlip ? -1 : 1, 1);
      sCtx.drawImage(sheet, wf*FS, 0, FS, FS, -FS/2, -FS/2, FS, FS);
      sCtx.restore();
    };

    if (wy < 0) drawW();                    // arma acima → atrás do robô
    sCtx.save();                            // robô (igual drawPlayer: y-6, flip)
    sCtx.translate(0, -6);
    sCtx.scale(facing ? 1 : -1, 1);
    sCtx.drawImage(IMG.walk, f*FS, 0, FS, FS, -FS/2, -FS/2, FS, FS);
    sCtx.restore();
    if (wy >= 0) drawW();                   // arma abaixo → na frente

    // barra de HP como no jogo
    sCtx.fillStyle = '#2a1d30'; sCtx.fillRect(-12, -27, 24, 5);
    sCtx.fillStyle = '#6ad06a'; sCtx.fillRect(-11, -26, 22, 3);

    sCtx.restore();

    _spiderRAF = requestAnimationFrame(tick);
  }
  tick();
}

function stopSpiderCanvas() {
  if (_spiderRAF) { cancelAnimationFrame(_spiderRAF); _spiderRAF = null; }
}

function setLockedWeapon(id) {
  _lockedWeaponId = id;
  _selWeaponId = id;
  document.querySelectorAll('.mupgr-cell.mlocked').forEach(c => c.classList.remove('mlocked'));
  const locked = document.querySelector(`.mupgr-cell[data-wid="${id}"]`);
  if (locked) locked.classList.add('mlocked');
}

function rebuildMenuGrid() {
  const wGrid = document.getElementById('mWeapGrid');
  const pGrid = document.getElementById('mPassGrid');
  if (wGrid) wGrid.innerHTML = '';
  if (pGrid) pGrid.innerHTML = '';

  function makeCell(iconKey, id, name, desc, isWeapon, gridEl) {
    const cell = document.createElement('div');
    cell.className = 'mupgr-cell';
    if (isWeapon) cell.dataset.wid = id;
    const img = document.createElement('img');
    img.src = (SRC[iconKey] || '') + '?v=' + ASSET_VER;
    img.alt = name;
    cell.appendChild(img);
    if (isWeapon) {
      const nm = document.createElement('div');
      nm.className = 'wname';
      nm.textContent = name;
      cell.appendChild(nm);
      const ck = document.createElement('div');
      ck.className = 'wcheck';
      ck.textContent = '✓';
      cell.appendChild(ck);
    }
    // seleção por clique/toque (sem hover: evita o "1º toque = hover" no mobile
    // e o mouseleave que revertia o painel antes de chegar no botão de comprar)
    if (isWeapon) cell.addEventListener('click', () => { setLockedWeapon(id); showWeaponInfo(id); });
    gridEl.appendChild(cell);
  }

  Object.entries(WEAPONS).forEach(([id, w]) => makeCell(w.icon, id, w.name, w.desc, true, wGrid));
  Object.entries(PASSIVES).forEach(([id, p]) => makeCell(p.icon, id, p.name, p.desc, false, pGrid));

  // marca arma padrão como selecionada e mostra sua info + upgrades
  setLockedWeapon(_lockedWeaponId);
  showWeaponInfo(_lockedWeaponId);
  updateCoins();
}

/* mostra info + árvore de upgrades da arma selecionada no menu */
function showWeaponInfo(id) {
  const w = WEAPONS[id];
  document.getElementById('mSelType').textContent = t('weapon_label');
  document.getElementById('mSelName').textContent = w ? w.name : t('hover_weapon');
  document.getElementById('mSelDesc').textContent = w ? w.desc : '';
  renderUpgrades(id);
}
function updateCoins(bump) {
  const el = document.getElementById('mCoins');
  if (el) el.textContent = nf(META.coins);
  if (bump && el) {
    const box = el.closest('.mcoins');
    if (box) { box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump'); }
  }
}
function renderUpgrades(id) {
  const box = document.getElementById('mUpgrades');
  if (!box) return;
  box.innerHTML = '';
  if (!WEAPONS[id]) return;
  const hdr = document.createElement('div');
  hdr.className = 'uphdr';
  hdr.textContent = t('upgrades_hdr');
  box.appendChild(hdr);
  WUP_ORDER.forEach(tr => {
    const d = WUP[tr];
    const lvl = upLvl(id, tr);
    const cost = upCost(tr, lvl);
    let pips = '';
    for (let i = 0; i < d.max; i++) pips += `<div class="uppip${i < lvl ? ' on' : ''}"></div>`;
    const canBuy = cost != null && META.coins >= cost;
    const btn = cost == null
      ? `<div class="upbuy maxed">${t('up_max')}</div>`
      : `<button class="upbuy${canBuy ? '' : ' cant'}" data-wid="${id}" data-tr="${tr}">${cost}<span class="upbuy-ico">🪙</span></button>`;
    const row = document.createElement('div');
    row.className = 'uprow';
    row.innerHTML =
      `<div class="uprow-info">
         <div class="uprow-top"><span class="uprow-lbl">${t(d.key)}</span><span class="uprow-eff">${lvl > 0 ? d.fmt(lvl * d.per) : ''}</span></div>
         <div class="uppips">${pips}</div>
       </div>${btn}`;
    box.appendChild(row);
  });
  box.querySelectorAll('.upbuy[data-wid]').forEach(b => {
    b.onclick = () => {
      const wid = b.getAttribute('data-wid'), tr = b.getAttribute('data-tr');
      if (buyUpgrade(wid, tr)) {
        beep(880, 0.05, 'square', 0.05); beep(1180, 0.05, 'square', 0.04);
        updateCoins(true); renderUpgrades(wid);
      } else { beep(150, 0.12, 'sawtooth', 0.05); }
    };
  });
}

(async () => {
  await CG.init();          // inicializa o SDK (no-op fora do portal)
  CG.initMute(m => {
    portalMuted = m;
    // para/retoma música do menu quando o portal muda o mute
    try {
      if (menuMusic) {
        if (m || soundMuted) {
          if (_musicFade) { cancelAnimationFrame(_musicFade); _musicFade = null; }
          menuMusic.volume = 0;
          menuMusic.pause();
        } else if (document.getElementById('ui-start').classList.contains('show')) {
          startMenuMusic();
        }
      }
    } catch(e) {}
  });   // respeita o mute do player do portal
  LANG = detectLang();      // idioma pelo locale do portal / navegador / escolha salva
  metaLoad();               // sucata + upgrades permanentes (localStorage)
  localizeDefs();           // nomes+descrições de armas/passivas no idioma atual
  applyStaticI18n();        // textos estáticos do HTML (menu, pause, game-over)
  CG.loadingStart();        // avisa o portal que o carregamento começou
  loadAll(() => {
    measureSprites();
    const logoEl = document.getElementById('logoImg');
    const loadEl = document.getElementById('loading');
    logoEl.src = SRC.main + '?v=' + ASSET_VER;
    logoEl.style.display = 'block';
    if (loadEl) loadEl.style.display = 'none';
    rebuildMenuGrid();
    updateMenuStats();
    newGame();
    initSpiderCanvas();
    CG.loadingStop();       // carregamento concluído — portal esconde o loader
    hideBootScreen();       // esconde nossa tela de loading (standalone/ngrok)
    startMenuMusic();       // música de fundo do menu
    requestAnimationFrame(loop);
  }, setBootProgress);
})();
// seletor de idioma no menu
document.querySelectorAll('.lang-btn').forEach(b => {
  b.onclick = () => setLang(b.getAttribute('data-lang'));
});

document.getElementById('btnStart').onclick      = start;
document.getElementById('btnResume').onclick     = resumeGame;
document.getElementById('btnPauseMenu').onclick  = () => { finalizeRun(); saveBestStats(); goMainMenu(); };
document.getElementById('btnRestart').onclick    = () => {
  finalizeRun();   // credita a sucata da run agora que ela terminou de fato
  saveBestStats();
  document.getElementById('ui-gameover').classList.remove('show');
  // midgame ad na virada de partida (pausa natural); o portal já limita a
  // frequência, então não há risco de spam. Segue pro menu ao fim/erro.
  CG.requestAd('midgame', () => goMainMenu());
};
document.getElementById('btnRevive').onclick = revive;

/* sons de clique/selecao nos botoes do menu (delegado) */
(function() {
  const startOv = document.getElementById('ui-start');
  if (!startOv) return;
  const SEL = '.mpbtn, .mbsound, .lang-btn, .btn, .upbuy, .mupgr-cell';

  // click
  startOv.addEventListener('click', (e) => {
    if (e.target.closest(SEL)) menuClickSound();
  });

  // hover (mouseover bolha, delegamos no overlay)
  let _hovered = null;
  startOv.addEventListener('mouseover', (e) => {
    const el = e.target.closest(SEL);
    if (el && el !== _hovered) { _hovered = el; menuHoverSound(); }
  });
  startOv.addEventListener('mouseout', (e) => {
    const el = e.target.closest(SEL);
    if (el === _hovered) _hovered = null;
  });
})();
