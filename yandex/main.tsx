import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Game from '../components/game';
import { initYandexArchive, gameUiReady } from './bridge';
import '../app/globals.css';
import '../app/premium.css';
import '../app/experience.css';

window.__gameApiBase = 'https://ozbekona-biznes-shahzod.uzamotors.chatgpt.site';
initYandexArchive();

function App() {
  useEffect(() => {
    // The first screen and its image are ready before dismissing Yandex's loader.
    const cover = document.querySelector<HTMLImageElement>('.launch-background');
    if (!cover || cover.complete) requestAnimationFrame(gameUiReady);
    else {
      cover.addEventListener('load', gameUiReady, { once: true });
      cover.addEventListener('error', gameUiReady, { once: true });
    }
  }, []);
  return <Game />;
}

createRoot(document.getElementById('root')!).render(<App />);
