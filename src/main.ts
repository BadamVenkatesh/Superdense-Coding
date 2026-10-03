/** THE OTHER HALF: entry point. */
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles/main.css';
import { registerScreen, startApp } from './ui/app';
import { titleScreen } from './ui/screens/title';
import { mapScreen } from './ui/screens/map';
import { levelScreen } from './ui/screens/level';
import { arcadeScreen } from './ui/screens/mission';
import { labScreen } from './ui/screens/lab';
import { howtoScreen } from './ui/screens/howto';
import { settingsScreen } from './ui/screens/settings';

// Older Safari/Firefox lack roundRect on canvas: a small fallback keeps the stage drawing.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    this.rect(x, y, w, h);
  } as CanvasRenderingContext2D['roundRect'];
}

registerScreen('title', titleScreen);
registerScreen('levels', mapScreen);
registerScreen('level', levelScreen);
registerScreen('arcade', arcadeScreen);
registerScreen('lab', labScreen);
registerScreen('how', howtoScreen);
registerScreen('settings', settingsScreen);

const root = document.getElementById('app');
if (root) {
  try {
    startApp(root);
  } catch (err) {
    console.error(err);
    root.innerHTML = '<p style="padding:24px;font-family:system-ui;color:#fff">THE OTHER HALF hit an unexpected error. Please refresh the page.</p>';
  }
}
