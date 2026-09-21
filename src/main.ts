import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/buttons.css';
import './styles/shell.css';
import './styles/map.css';
import './styles/exercise.css';
import './styles/economy.css';
import './styles/words.css';
import './styles/screens.css';

import { bootstrap } from './app';

bootstrap().catch((err) => {
  console.error('Приложение не запустилось:', err);
  const boot = document.getElementById('boot');
  if (boot) {
    boot.innerHTML =
      '<div style="padding:24px;color:#fff;font:700 15px/1.5 system-ui;text-align:center">' +
      'Не удалось запустить игру.<br>Попробуйте перезагрузить страницу.<br><br>' +
      '<span style="opacity:.7;font-size:13px">' +
      String(err instanceof Error ? err.message : err).replace(/[<>&]/g, '') +
      '</span></div>';
  }
});
