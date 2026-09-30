type YandexSDK = {
  environment?: { i18n?: { lang?: string } };
  features: {
    LoadingAPI?: { ready: () => void };
    GameplayAPI?: { start: () => void; stop: () => void };
  };
  adv?: { showFullscreenAdv: (options: { callbacks: {
    onOpen: () => void; onClose: () => void; onError: () => void;
  } }) => void };
  on?: (name: string, callback: () => void) => void;
};

let sdk: YandexSDK | null = null;
let wantsGameplay = false;
let isPlaying = false;
let sdkPaused = false;
let adPaused = false;
let uiReady = false;
let isYandexArchive = false;
let detectedLanguage: 'uz' | 'ru' | 'en' | null = null;

function paused() { return document.hidden || sdkPaused || adPaused; }
function broadcastPause() {
  window.dispatchEvent(new CustomEvent('yandex-platform-pause', { detail: paused() }));
  updateGameplay();
}
function updateGameplay() {
  const shouldPlay = wantsGameplay && !paused();
  if (!sdk || shouldPlay === isPlaying) return;
  isPlaying = shouldPlay;
  if (shouldPlay) sdk.features.GameplayAPI?.start();
  else sdk.features.GameplayAPI?.stop();
}

export function setGameplayActive(active: boolean) { wantsGameplay = active; updateGameplay(); }
export function platformIsPaused() { return isYandexArchive && paused(); }
export function yandexLanguage() { return detectedLanguage; }

/** Only the standalone archive invokes this. The main site keeps its own behavior. */
export function initYandexArchive() {
  isYandexArchive = true;
  document.addEventListener('visibilitychange', broadcastPause);
  if (!window.YaGames) return;
  void window.YaGames.init().then(result => {
    sdk = result;
    const detected = result.environment?.i18n?.lang;
    if (!localStorage.getItem('biznes-language')) {
      const lang = detected === 'ru' ? 'ru' : detected === 'uz' ? 'uz' : 'en';
      detectedLanguage = lang;
      window.dispatchEvent(new CustomEvent('yandex-language', { detail: lang }));
    }
    result.on?.('game_api_pause', () => { sdkPaused = true; broadcastPause(); });
    result.on?.('game_api_resume', () => { sdkPaused = false; broadcastPause(); });
    if (uiReady) result.features.LoadingAPI?.ready();
    updateGameplay();
  }).catch(() => { /* The game remains playable if the SDK is unavailable in local preview. */ });
}

export function gameUiReady() {
  if (uiReady) return;
  uiReady = true;
  sdk?.features.LoadingAPI?.ready();
}

export function showYandexAd(): Promise<void> {
  if (!isYandexArchive || !sdk?.adv) return Promise.resolve();
  return new Promise(resolve => {
    let finished = false;
    const finish = () => { if (finished) return; finished = true; clearTimeout(timeout); adPaused = false; broadcastPause(); resolve(); };
    // A failed ad request must never leave the player trapped before the game.
    const timeout = setTimeout(finish, 90000);
    try { sdk!.adv!.showFullscreenAdv({ callbacks: {
      onOpen: () => { adPaused = true; broadcastPause(); },
      onClose: finish,
      onError: finish,
    } }); } catch { finish(); }
  });
}

declare global {
  interface Window {
    YaGames?: { init: () => Promise<YandexSDK> };
    __gameApiBase?: string;
  }
}
