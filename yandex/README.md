# Yandex Games arxivi

`pnpm build:yandex` statik o‘yinni `dist-yandex/` ichida yig‘adi. Shu papka **ichidagi** fayllarni ZIP arxivning ildiziga joylang (`index.html` ZIP ildizida bo‘lsin). `sdk.js` faylini qo‘shmang: Yandex arxivga `/sdk.js` xizmatini o‘zi beradi.

Bot va bitta qurilmadagi do‘stlar rejimi to‘liq arxivda ishlaydi. Onlayn xonalar va WebRTC ovozli suhbat saytdagi HTTPS APIga ulanadi. Arxivdagi `main.tsx` ichida server manzili yozilgan; serverni ko‘chirsangiz shu manzilni yangilang va qayta build qiling. O‘yin serveridagi `/api/rooms` va `/api/voice` yo‘llari Yandex originlari uchun CORS ni yoqadi.

Yandex Games Console → Draft → General → Archive: ZIPni yuklang. CSP/Allowed hosts bo‘limida `ozbekona-biznes-shahzod.uzamotors.chatgpt.site` ni va sabab sifatida “real-time multiplayer room and WebRTC voice signaling” ni kiriting. To‘liq URL yoki path yozmang. Bu host tasdiqlanmaguncha onlayn xona moderatsiya oynasida ishlamasligi mumkin.

SDK `LoadingAPI.ready`, `GameplayAPI`, til aniqlash, pauza va bot o‘yinini boshlashdagi fullscreen reklama chaqiruvini o‘z ichiga oladi. Mahalliy saqlash `localStorage` da, do‘stlar xonasi serverda. Joylashdan keyin Yandex debug panelida mobil va desktop rejimini, reklama, til va do‘stlar xonasini ikki qurilmada sinang. Mikrofon ruxsati va TURN/WebRTC aloqa turli tarmoq va qurilmalarda alohida tekshiriladi.
