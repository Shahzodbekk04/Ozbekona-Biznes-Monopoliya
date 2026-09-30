# O‘zbekona Biznes — Monopoliya

O‘zbekcha iqtisodiy stol o‘yini: 40 katak, 2–4 o‘yinchi, botlar, bir qurilmadagi hot-seat va xona kodi orqali onlayn davralar.

## O‘ynash

- Botlar: ism va o‘yinchi sonini tanlab «Davrani boshlash»ni bosing.
- Do‘stlar: bitta qurilmada 2–4 inson navbat bilan o‘ynaydi.
- Onlayn: xona yarating, o‘zingiz tanlagan 6 xonali raqamli kodni yoki taklif havolasini ulashing. Band kod bilan boshqa xona yaratilmaydi; boshidagi nollar saqlanadi. Eski 7 belgili havolalar ham ishlaydi. Bo‘sh o‘ringa bot qo‘shish mumkin. Kamida 2 o‘yinchidan so‘ng xona egasi boshlaydi.
- Katakni bosib mulk va ijara tafsilotlarini oching. Portfel orqali qurish, binoni sotish va garov amallarini bajaring.

## Tuzilish

- `game/engine.ts`: UIga bog‘liq bo‘lmagan o‘yin mantiqi.
- `components/game.tsx`: React/Motion interfeysi va bot/hot-seat boshqaruvi.
- `game/store.ts`: Zustand holat ombori.
- `app/api/rooms/route.ts`: server boshqaradigan onlayn buyruqlar.
- `db/rooms.ts`: D1 tayyorlangan so‘rovlari va revision bo‘yicha atomik yangilash.
- `db/schema.ts`, `drizzle/`: xonalar sxemasi va migratsiya.

Onlayn xona serverda saqlanadi. Qurilmaning tasodifiy kirish kaliti brauzerda, uning SHA-256 xeshi serverda saqlanadi. Zarik serverda tashlanadi. Kelajak kartalari va kalitlar ommaviy javobga kiritilmaydi. Botlar uchun pullik AI xizmati talab qilinmaydi.

Mahalliy bot/hot-seat davrasi localStorage orqali davom ettiriladi. Onlayn ulanish 1.4 soniyalik so‘rovlar bilan yangilanadi; kamida bir a’zo xonani ochib turganida botlar yuradi. 60 soniyadan ortiq uzilgan ishtirokchini xona egasi botga almashtirishi mumkin. Xonadan chiqish qurilmadagi qayta kirish kalitini o‘chiradi.

## Sinovlar

`node --experimental-strip-types tests/engine.test.ts`

`node tests/api.test.mjs`

`node node_modules/typescript/bin/tsc --noEmit`

Engine sinovlari: Start, dubl, qamoq, qarz, ijara, qurilish, auksion, inflyatsiya, soliq, bankrotlik va 3 yakunlangan bot davrasi. API sinovi ishlab turgan handlerlarni Node SQLite adapteri bilan tekshiradi: xona yaratish/qo‘shilish, huquqlar, navbat, takroriy so‘rov va bir vaqtdagi yozuvlar.

Brauzerda vizual yoki bir nechta haqiqiy qurilmada yakuniy tekshiruv bajarilmagan. WebMCP uchun faqat read-only `read_business_game` holat vositasi qo‘shilgan; mos ruxsatli browser konteksti mavjud bo‘lmagani uchun uning browser validatsiyasi bajarilmagan.

O‘yin narxlari va dollar kursi shartli. Barcha faol o‘yinchilar 5/10/15… aylana tugatganda ijara 10% oshadi. Qurilish 4 bosqich: Choyxona, Kafe, Restoran, To‘yxona.


## Realistik ko‘rinish yangilanishi

Yangi bosh menyu shahar dioramasi bilan ishlaydi. `components/game-art.tsx` bino va figura atlaslari, 6 yuzli animatsiyali CSS 3D zariklarni beradi; `app/premium.css` stol, kartalar, menyular va moslashuvchan ko‘rinishni boshqaradi.

`public/art/uzbek-city.webp`, `business-atlas.webp`, `collectible-tokens.webp` — o‘yin uchun yaratilgan konsept rasmlar. Ular haqiqiy obyektlarning hujjatli fotosuratlari emas. Shahar, 16 ta bino/transport/kommunal miniatyurasi va 4 ta kolleksion figura built-in image generation bilan yaratilgan. Prompt yo‘nalishi: tilla yorug‘likdagi o‘zbek me’morchiligi va biznes shahri; bir xil kamera burchagidagi 4×4 bino atlasi; oltin avtomobil, moviy lochin, yoqut toj va zumrad piyoladan 2×2 figura atlasi. Rasmlar WebPga formatlandi, o‘lchami va shaffofligi saqlandi.

O‘yin qoidalari va onlayn xona saqlash sxemasi o‘zgarmadi. Yangi ko‘rinish/ovoz sozlamalari faqat qurilma afzalliklarini saqlaydi. Tarix oynasi oxirgi 100 hodisani ko‘rsatadi.


## Jonli ovozli suhbat

Onlayn xonada «Suhbatga ulanish» tugmasi brauzerdan mikrofon ruxsatini so‘raydi. Har bir ishtirokchi alohida ulanadi. Mikrofonni o‘chirish/yoqish, suhbat ovozini o‘chirish, kirish mikrofonini (shu jumladan naushnik mikrofonini) tanlash va suhbatdan chiqish mavjud. Ovoz telefon va kompyuterning WebRTC imkoniyatlari orqali uzatiladi. Bluetooth/naushnik ovoz chiqishi qurilmaning tizim sozlamalari orqali tanlanadi. Suhbat davomida fon musiqasi to‘xtaydi; menyuga qaytganda yoki sahifadan chiqqanda mikrofon to‘xtatiladi. Brauzer fon rejimida yoki ekran qulflanganda aloqani cheklashi mumkin.

`game/voice-client.ts` mikrofon, audio playback va to‘rt kishigacha mesh WebRTC aloqalarini boshqaradi. `app/api/voice/route.ts` o‘yin xonasining mavjud a’zolik kaliti bilan himoyalangan. D1 faqat ulanish metama’lumotlari (SDP), vaqt va mikrofon holatini saqlaydi; audio yozilmaydi va HTTP orqali uzatilmaydi. Metama’lumotlar keyingi so‘rovda tozalanadi: a’zo 20 soniya, SDP 45 soniyadan so‘ng eskiradi. Oxirgi odam odatiy tartibda chiqqanda SDP tozalanadi. Signallar faqat aniq qabul qiluvchi va uning joriy ulanishiga beriladi. Boshqa tabdagi faol ulanish almashtirilmaydi.

### Tarmoq sharti va TURN

Standart sozlama Google/Cloudflare STUN yordamida to‘g‘ridan-to‘g‘ri aloqa o‘rnatishga urinadi. TURN hozir sozlanmagan. Ayrim mobil operatorlar, korporativ tarmoqlar va cheklangan NAT ortida TURN serverisiz audio ulanmaydi. Barcha tarmoqlarda ishlashi tekshirilgan deb hisoblamang.

TURN xizmati egasidan olingan amaldagi server sozlamalarini Sites runtime secret `VOICE_ICE_SERVERS` sifatida JSON massivda kiriting. Element sxemasi RTCIceServer: `urls` (turn:/turns: manzillar), `username`, `credential`. Haqiqiy qiymatlarni Gitga joylamang. HTTPS/TLS 443 relay imkoniyati cheklangan tarmoqlar uchun foydali. Server bu sozlamani faqat tasdiqlangan xona a’zolariga qaytaradi; WebRTC mijozlari relay credentialni tabiiy ravishda oladi, shuning uchun muddatli credential, trafik limiti va muntazam yangilashni qo‘llang. Hujjat: https://webrtc.org/getting-started/turn-server

### Tekshiruv

- `node tests/voice.test.mjs`: haqiqiy route handler + SQLite orqali a’zolik, begona origin, signal maxfiyligi, takroriy signal, mute, eski ulanish, vaqt limiti, a’zolik bekor qilinishi va o‘yin state’i o‘zgarmasligi.
- `node tests/voice-client.test.mjs`: mock mikrofon bilan ruxsat, mute, chiqish, ruxsat/server javobi kelguncha chiqib ketish va mikrofonni almashtirish.

Haqiqiy telefon, naushnik yoki ikki alohida internet tarmog‘ida audio sinovi hali bajarilmagan.

## Mulk belgilari, ovoz effektlari va bayroq

Sotib olingan katak egasining rangi bilan hoshiyalanadi va 1–4 raqamli belgi oladi. Doska ostidagi rang/raqam ro‘yxati o‘yinchi ismini ko‘rsatadi; bu bot va onlayn davralarda bir xil state’dan chiziladi. Figuralar har qadamda mayin nota va manzilga kelganda ikki notali signal chiqaradi. Ovozlar bitta qayta ishlatiladigan AudioContext orqali ishlaydi, umumiy ovoz tugmasiga bo‘ysunadi va suhbat vaqtida pasayadi.

Yuborilgan O‘zbekiston bayrog‘i asl JPG ko‘rinishida ishlatiladi; harakat CSS transform orqali, reduced-motion sozlamasida o‘chadi. Asosiy o‘yin va menyu panellariga tilla hoshiyalar qo‘shilgan.

Mikrofon mute xom track, ishlov berilgan track, barcha WebRTC sender tracklari va chiqish gainini o‘chiradi. Do‘stlar ovozini o‘chirish HTMLAudioElementni ham mute, ham pause qiladi; kechikib tugagan play so‘rovi mute holatini buzmaydi. Suhbat ovozi va mikrofon alohida tugmalar bilan boshqariladi. Musiqa sozlamasi bu tugmalarni bloklamaydi.

«Ovozni o‘zgartirish» ichida tabiiy, qiz, bola va yo‘g‘on erkak effektlari bor. Bu AI ovoz klonlash emas: lokal AudioWorklet pitch-shift va EQ effektlari, natija manba ovoziga bog‘liq. Signalsmith Stretch 1.3.2 WASM fazaga mos pitch/formant ishlovini o‘yin render oqimidan alohida bajaradi. Tabiiy ovoz effektni chetlab, shovqin filtri yoqilgan bo‘lsa tozalangan track orqali uzatiladi. Effekt faqat tanlanganda yuklanadi; audio processor ishlab turgani tasdiqlangach barcha peer senderlari replaceTrack orqali almashtiriladi. Modul yuklanishi yoki processor ishga tushishi muvaffaqiyatsiz bo‘lsa, tabiiy ovoz va izohli xabar saqlanadi. Effekt tanlash paytidagi mute holati o‘zgarmaydi. Tabiiy rejimga qaytganda effekt chetlab o‘tiladi, shovqin filtri holati saqlanadi. Ovoz effektlari ishlaganda chiqish mono va mahalliy monitoring nol ovozli bo‘lib, foydalanuvchi o‘z ovozini eshitmaydi. Audio yozilmaydi va qo‘shimcha AI serveriga yuborilmaydi.

`node tests/voice-pitch.test.mjs` 44.1/48 kHz signalda haqiqiy chiqish pitchini, amplitudani, mute va oldingi audio bufferning tozalanishini tekshiradi. `tests/voice-client.test.mjs` mute/unmute, umumiy ovoz va kechikkan playback regressiyalarini ham qamrab oladi. Haqiqiy qurilmalarda tinglab baholash hali bajarilmagan; TURN haqidagi yuqoridagi tarmoq cheklovi saqlanadi.

Web Audio manbalari: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor va https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioDestinationNode


Ovoz regressiyasi tuzatildi: tabiiy yo‘l AudioWorkletga bog‘liq emas; o‘yin musiqasi suhbat tugmasini bloklamaydi; ovozni eshitishga ruxsat tugmasi play()ni bevosita foydalanuvchi bosgan vaqtda chaqiradi; audio elementlari sahifaga ulanadi va suhbat tugaganda olib tashlanadi. Effekt yuklanishi, raw/effect/raw almashish, barcha senderlar, mute va fallback testlari qo‘shildi. Haqiqiy qurilmalar o‘rtasida tinglash testi bajarilmagan.


## Nutq ravshanligi va shovqinni kamaytirish

RNNoise filtri 44.1 yoki 48 kHz kontekst qo‘llanganda suhbatga kirgandan keyin avtomatik ulanadi; dastlab mikrofon oddiy yo‘l orqali ishlashni boshlaydi. WASM model va audio processor shu sayt ichida saqlanadi, tashqi ovoz serveriga yoki AI xizmatiga audio yuborilmaydi. Alohida tugma filtrni o‘chirish va yoqishga imkon beradi. Brauzerning echoCancellation/noiseSuppression sozlamalari ham saqlangan. Model tayyorligi tasdiqlanmasa oddiy mikrofon yo‘li saqlanadi. Bu mutlaq shovqinsizlik yoki faqat bitta odam ovozini ajratish kafolati emas; yoningizdagi boshqa odam gapirsa, uning ovozi ham qolishi mumkin.

Oldingi delay-head va dry/wet aralashmasi olib tashlandi: bu qo‘shaloq ovoz/chorus hosil qilardi. Signalsmith Stretch 1.3.2 (MIT, `public/audio/signalsmith`) 60 ms blok, 15 ms interval, split computation, formant compensation orqali ishlaydi. Presetlar: ayol +2.5 semitone / +0.8 formant, bola +4 / +1.2, erkak -2.5 / -0.8. Bular stilizatsiyalangan effektlar, AI ovoz kloni emas. Tabiiy ovoz pitch protsessorini chetlab o‘tadi. Mute har ikkala DSP bufferini tozalaydi; bir xil mute qayta kelishi nutqni uzmaydi.

Shovqin filtri RNNoise nutq ehtimoli va oxirgi bir soniyadagi fon darajasi bilan boshqariladigan yumshoq gate qo‘llaydi. 20 ms oldindan qarash va 220 ms tutib turish undosh/so‘z oxirini saqlash uchun. Jimlikda gain 0.008 gacha tushadi; bu barcha shovqinda aniq 42 dB natija kafolati emas. Brauzer AGC o‘chirilgan: jimlikdagi muhit shovqinini avtomatik kuchaytirmaydi. Effekt tanlanganda noiseActive holatini adashib o‘chirayotgan xato tuzatildi.

`public/audio/rnnoise` @sapphi-red/web-noise-suppressor 0.4.1, @shiguredo/rnnoise-wasm 2022.2.0 va RNNoise kodini litsenziyalari bilan o‘z ichiga oladi. Model standart (SIMD talab qilmaydigan) binar. `tests/voice-noise.test.mjs` aynan tarqatiladigan JS va WASMni ishlatib, takrorlanuvchi doimiy shovqin signali kamayishini, tayyorlik va to‘xtatishni tekshiradi. Haqiqiy telefondagi nutq tushunarliligi va barcha shovqin turlari sinovdan o‘tgan deb hisoblanmaydi.


## Harf-raqamli xona kodi va ovoz holati

Yangi xona kodi 6 ta ASCII lotin harfi yoki raqam: A–Z, 0–9. Kichik harflar katta harfga aylantiriladi; `uz2026` va `UZ2026` bir kod. Faqat raqamli 6 belgili va eski 7 belgili takliflar saqlanadi. Server bitta atomik UPSERT orqali kodni oxirgi xona faolligidan 24 soatgacha band qiladi. Faol xonaning sync so‘rovlari bandlik muddatini uzaytiradi. Bu kirish kodidir, alohida hisob paroli emas; do‘stlar shu kod bilan mavjud xonaga kirishi mumkin. Yangi xona sifatida qayta ishlatishgina cheklangan. Eski sessiya yangi xona a’zolariga kira olmaydi; host ID bilan yozish tekshiruvi kechikkan eski yozuvning yangi xonani buzishidan himoya qiladi.

Ovoz effektining ishga tushishi va tanlangan profil audio oqimidan tasdiqlanadi. Tasdiq kelmasa tabiiy ovoz tiklanadi va keyingi urinish yangi protsessor ochadi. Worklet WASM zavodi bilan bitta faylda yetkaziladi, ichki `.mjs` yuklashiga bog‘liq emas. Mikrofon, shovqin filtri va WebRTC a’zolik qoidalari o‘zgarmagan. Hozirgi ayol/bola/erkak tanlovlari pitch/formant effektlari; haqiqiy AI personaj ovozi sifatida ko‘rsatilmaydi. Neyron speech-to-speech modeli/xizmati ulanmagan, shuning uchun insondek ayol, bola yoki katta yoshli erkak ovozini qayta yaratish talabi hali bajarilmagan.
