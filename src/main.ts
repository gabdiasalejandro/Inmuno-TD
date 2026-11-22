import Phaser from 'phaser';
import { levels } from './data';
import { openAlmanacFromSearch, startLevelFromSearch } from './game/boot';
import { AlmanacScene } from './game/AlmanacScene';
import { GameScene } from './game/GameScene';
import { MenuScene } from './game/MenuScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#DDBDB8',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [],
});

// The game is ready: the cover of index.html turns its button into "Jugar".
game.events.once(Phaser.Core.Events.READY, () => window.dispatchEvent(new Event('inmuno:ready')));

// `?level=<id>` boots straight into that level and `?almanac=1` into the almanac (development shortcuts);
// anything else opens the menu.
const bootLevel = startLevelFromSearch(window.location.search, levels);
const bootAlmanac = bootLevel === null && openAlmanacFromSearch(window.location.search);

game.scene.add('menu', MenuScene, bootLevel === null && !bootAlmanac);
game.scene.add('almanac', AlmanacScene, bootAlmanac);
game.scene.add('game', GameScene, bootLevel !== null, { levelId: bootLevel ?? '1-1' });
