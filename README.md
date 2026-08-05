# Sucata Survivor 🤖

Protótipo HTML5 de um **survivor-like / shoot 'em up roguelike** (estilo Vampire Survivors / Brotato),
feito com o pacote gratuito **CraftPix "Free Roguelike Shoot 'em up Pixel Art Game Kit"**.

Um robô-aranha sozinho contra hordas que saem dos portais do deserto roxo.

## Como rodar

Precisa de um servidor local (por causa do carregamento dos sprites):

```bash
cd ~/development/SucataSurvivor
python3 -m http.server 8753
# abra http://localhost:8753 no navegador
```

> Sem dependências, sem build. É só HTML + Canvas + 1 arquivo `game.js`.

## Controles

| Ação | Tecla |
|------|-------|
| Mover | `WASD` ou setas |
| Atirar | automático (mira no inimigo mais próximo) |
| **Descarga** (limpa a tela) | `ESPAÇO` quando o medidor laranja enche |

## Loop do jogo

1. Sobreviva enquanto a horda cresce com o tempo.
2. Mate inimigos → eles soltam **gemas de XP** (ímã puxa pra você).
3. Encheu a barra de XP → **suba de nível** → escolha **1 de 3 recompensas**
   (nova arma, melhorar arma existente, ou passiva).
4. Morreu? → **reviver (ver anúncio)** 1× grátis, ou recomeçar.

## Conteúdo implementado

- **5 armas**: Canhão Automático, Estilhaço de Cristal (perfurante), Leque de Penas (spread),
  Caveira Caçadora (homing), Foguete (dano em área).
- **5 passivas**: dano, cadência, velocidade, blindagem (HP), ímã.
- **4 tipos de inimigo** com dificuldade escalando no tempo.
- **Descarga (overcharge)**: medidor que enche matando; `ESPAÇO` dispara um pulso que limpa a tela
  — é o *gancho/diferencial* de skill ativo sobre o auto-shooter.
- Chão pixel-perfect sem costuras, partículas de impacto, screen-shake, SFX por WebAudio.

## Ganchos de monetização (para web portals)

O jogo já está estruturado pro modelo que **mais converte sem orçamento de marketing**:
publicar em **CrazyGames / Poki** com rev-share de anúncios.

- SDKs da **CrazyGames** e **Poki** já integrados em `game.js` via o wrapper `PORTAL`
  (detecta qual dos dois está presente no host; sem nenhum, tudo vira no-op e o jogo
  roda normal em dev local). Cobre `init`, loading, `gameplayStart/Stop`,
  `commercialBreak`/`rewardedBreak` (Poki) e `ad.requestAd` (CrazyGames).
- `revive()` em `game.js` → dispara o **rewarded ad** do portal ativo. Hoje dá 1 revive grátis.
- "Recomeçar" na tela de game over → dispara um ad comercial (`midgame`) antes de voltar ao menu.
- Sessões longas (survivor) = mais ad breaks = mais receita de rev-share.
- Wrap mobile depois (mesmo HTML em Capacitor) pra Play Store.

## Próximos passos sugeridos

- [ ] Boss a cada 2 min (sprite de inimigo escalado).
- [ ] Mais armas das 9 do kit (escudo orbital, martelo melee, granada).
- [ ] Altar do kit como "loja" entre ondas.
- [ ] Música.
- [ ] ⚠️ Para Steam: trocar a arte da CraftPix por arte original (evita flag de "asset flip").

## Créditos de arte

CraftPix.net — Free Roguelike Shoot 'em up Pixel Art Game Kit.
Verifique a licença em <https://craftpix.net/file-licenses/> antes de publicar comercialmente.
