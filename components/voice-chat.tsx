'use client';
import { useEffect, useRef, useState } from 'react';
import { Headphones, Mic, MicOff, Volume2, VolumeX, PhoneOff, Loader2, AudioLines } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { VoiceEffect } from '@/game/voice-effects';
import { VoiceClient, emptyVoice } from '@/game/voice-client';
import { usePresentation } from '@/game/preferences';
import type { Room, Session } from '@/game/room';

export function VoiceChat({ session, room, onActiveChange }: { session: Session; room: Room; onActiveChange: (active: boolean) => void }) {
  const { t } = usePresentation();
  const [voice, setVoice] = useState(emptyVoice), [changing, setChanging] = useState(false);
  const client = useRef<VoiceClient | null>(null);
  const leaving = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => () => { client.current?.close(); client.current = null; onActiveChange(false); }, [session.code, session.playerId, onActiveChange]);
  const join = () => {
    const previousLeave = client.current?.close() || leaving.current;
    const next = new VoiceClient(session, state => { if (client.current === next) { setVoice(state); onActiveChange(state.status !== 'off'); } });
    client.current = next; void next.join(previousLeave);
  };
  const leave = () => { leaving.current = client.current?.close() || leaving.current; client.current = null; setVoice(emptyVoice()); onActiveChange(false); };
  const error = voice.error === 'NotAllowedError' || voice.error === 'PermissionDeniedError'
    ? t('Mikrofonga ruxsat berilmadi. Brauzerning sayt sozlamalarida ruxsatni yoqing va qayta urining.','Разрешите микрофон в настройках сайта и попробуйте снова.','Allow microphone access in your browser’s site settings, then try again.')
    : voice.error === 'NotFoundError' || voice.error === 'DevicesNotFoundError'
    ? t('Mikrofon topilmadi. Mikrofon yoki naushnikni ulang.','Микрофон не найден. Подключите микрофон или гарнитуру.','No microphone found. Connect a microphone or headset.')
    : voice.error === 'NotReadableError' || voice.error === 'TrackStartError'
    ? t('Mikrofon band yoki ishlamayapti. Uni ishlatayotgan boshqa ilovani yoping.','Микрофон занят или недоступен. Закройте другое приложение, использующее его.','Microphone is busy or unavailable. Close other apps using it.')
    : voice.error === 'unsupported'
    ? t('Ovozni ulash uchun havolani Chrome, Safari yoki Edge brauzerida oching.','Откройте ссылку в Chrome, Safari или Edge для голосового чата.','Open the link in Chrome, Safari or Edge to use voice chat.')
    : voice.error === 'already-connected'
    ? t('Suhbat boshqa oynada ochiq. O‘sha oynada suhbatdan chiqing yoki 20 soniya kuting.','Чат открыт в другой вкладке. Выйдите там или подождите 20 секунд.','Voice is active in another tab. Leave there or wait 20 seconds.')
    : voice.error === 'forbidden'
    ? t('Xonaga qayta kiring, keyin suhbatga ulaning.','Войдите в комнату заново и подключите голос.','Rejoin the room, then connect to voice.')
    : voice.error === 'microphone-ended'
    ? t('Mikrofon uzildi. Qurilmangizni tekshirib, qayta ulaning.','Микрофон отключён. Проверьте устройство и подключитесь снова.','Microphone disconnected. Check your device and rejoin.')
    : voice.error === 'device'
    ? t('Bu mikrofonni tanlab bo‘lmadi. Avvalgi mikrofon saqlandi.','Не удалось выбрать микрофон. Предыдущий оставлен.','Could not switch microphone. Your previous microphone is still selected.')
    : voice.error === 'reconnecting'
    ? t('Aloqa tiklanmoqda…','Восстанавливаем соединение…','Reconnecting…')
    : t('Ovozli suhbatga ulanib bo‘lmadi. Internetni tekshirib, qayta urining.','Не удалось подключить голос. Проверьте интернет и попробуйте снова.','Could not connect voice. Check your internet and try again.');
  const joined = voice.status === 'joined', active = voice.status !== 'off';
  const failed = Object.values(voice.connections).some(s => s === 'failed' || s === 'disconnected');
  return <section className={'panel voice-panel ' + (joined ? 'voice-on' : '')} aria-label={t('Ovozli suhbat','Голосовой чат','Voice chat')}>
    <div className="panel-heading"><h2><Headphones size={19}/>{t('Jonli suhbat','Голосовой чат','Live voice')}</h2><span className={'voice-badge ' + (joined ? 'is-live' : '')}>{joined ? t('Ulangan','В эфире','Live') : t('Do‘stlar','Друзья','Friends')}</span></div>
    {!active && <><p className="voice-hint">{t('Do‘stlaringiz bilan gaplashib o‘ynang. Mikrofonni o‘zingiz yoqasiz.','Играйте и общайтесь с друзьями. Микрофон включается только вами.','Play and talk with friends. You choose when to turn on your microphone.')}</p><button className="gold-btn full" onClick={join}><Mic size={18}/>{t('Suhbatga ulanish','Подключить голос','Join voice chat')}</button></>}
    {voice.status === 'joining' && <div className="voice-joining"><Loader2 className="voice-spin" size={20}/><span>{t('Mikrofonga ruxsat bering…','Разрешите доступ к микрофону…','Allow microphone access…')}</span><button className="icon-btn" onClick={leave} aria-label={t('Bekor qilish','Отмена','Cancel')}><PhoneOff size={18}/></button></div>}
    {joined && <>
      <div className="voice-controls">
        <button className={'voice-mic ' + (voice.muted ? 'is-muted' : '')} onClick={() => client.current?.toggleMute()} aria-pressed={!voice.muted}>{voice.muted ? <MicOff size={20}/> : <Mic size={20}/>}<span>{voice.muted ? t('Mikrofonni yoqish','Включить микрофон','Unmute') : t('Mikrofonni o‘chirish','Выключить микрофон','Mute microphone')}</span></button>
        <button className="voice-control voice-listen" onClick={() => client.current?.toggleSpeakers()} aria-pressed={voice.speakers}>{voice.speakers ? <Volume2 size={20}/> : <VolumeX size={20}/>}<span>{voice.speakers ? t('Do‘stlar ovozini o‘chirish','Не слышать друзей','Mute friends') : t('Do‘stlar ovozini yoqish','Слышать друзей','Hear friends')}</span></button>
        <button className="voice-control voice-leave" onClick={leave} aria-label={t('Suhbatdan chiqish','Отключить голос','Leave voice chat')}><PhoneOff size={19}/></button>
      </div>
      <div className="voice-noise-control"><button className="outline-btn full" aria-pressed={voice.noiseActive} disabled={voice.noiseBusy||voice.effectBusy||changing} onClick={()=>void client.current?.setNoise(!voice.noiseActive)}>{voice.noiseBusy ? t('Shovqin filtri ulanmoqda…','Подключаем фильтр…','Connecting noise filter…') : voice.noiseActive ? t('Shovqinni kamaytirish: yoqilgan','Шумоподавление: включено','Noise reduction: on') : t('Shovqinni kamaytirish: yoqish','Включить шумоподавление','Enable noise reduction')}</button>{voice.noiseActive&&<p className="voice-hint">{t('Gapirmaganingizda fon tovushi pasayadi. Mikrofonni og‘zingizga yaqinroq tuting.','В паузах фон приглушается. Держите микрофон ближе ко рту.','Background sound is reduced during pauses. Keep the microphone close to your mouth.')}</p>}{voice.noiseError&&<p className="voice-hint" role="status">{t('Kuchli filtr ulanmagan. Brauzerning odatiy ovoz tozalashi ishlatiladi.','Усиленный фильтр недоступен. Используется обработка браузера.','Enhanced filter unavailable. Using browser audio processing.')}</p>}</div>
      <details className="voice-devices voice-effect-picker"><summary><AudioLines size={15}/>{t('Ovozni o‘zgartirish','Изменить голос','Voice changer')}</summary>{voice.effectsAvailable ? <><Select value={voice.effect} disabled={voice.effectBusy||voice.noiseBusy||changing} onValueChange={value=>void client.current?.selectEffect(value as VoiceEffect)}><SelectTrigger className="voice-device-select" aria-label={t('Ovoz effekti','Эффект голоса','Voice effect')}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="natural">{t('Tabiiy ovoz','Обычный голос','Natural voice')}</SelectItem><SelectItem value="girl">{t('Ayol ovozi — effekt','Женский — эффект','Woman — effect')}</SelectItem><SelectItem value="child">{t('Bola ovozi — effekt','Детский — эффект','Child — effect')}</SelectItem><SelectItem value="man">{t('Erkak ovozi — effekt','Мужской — эффект','Man — effect')}</SelectItem></SelectContent></Select><p className="voice-hint">{t('Bular ovoz effektlari. Haqiqiy boshqa inson ovozini yaratmaydi.','Это голосовые эффекты. Они не создают настоящий голос другого человека.','These are voice effects. They do not recreate another person’s voice.')}</p></> : <p className="voice-hint">{t('Bu brauzerda ovoz effektlari ishlamaydi. Tabiiy ovozdan foydalanishingiz mumkin.','Этот браузер не поддерживает эффекты. Обычный голос доступен.','Voice effects are unavailable in this browser. Natural voice is still available.')}</p>}</details>
      {voice.effectBusy && <p className="voice-hint" role="status">{t('Ovoz effekti ulanmoqda…','Подключаем эффект…','Connecting voice effect…')}</p>}
      {voice.effectError && <p className="voice-error" role="status">{t('Effekt ishga tushmadi. Suhbat tabiiy ovozda davom etadi. Qayta tanlab ko‘rishingiz mumkin.','Эффект не запустился. Чат продолжится обычным голосом. Можно выбрать эффект снова.','The effect could not start. Chat continues with your natural voice. You can try selecting it again.')}</p>}
      <div className="voice-members">{room.seats.filter(p => !p.bot).map(p => {
        const self = p.id === session.playerId, member = voice.members[p.id], connected = self || voice.connections[p.id] === 'connected';
        const muted = self ? voice.muted : member?.muted, speaking = connected && voice.speaking[p.id] && !muted;
        const broken = ['failed','disconnected'].includes(voice.connections[p.id]);
        return <div key={p.id} className={'voice-member ' + (speaking ? 'is-speaking' : '')}><span className="voice-person">{speaking ? <AudioLines size={17}/> : muted ? <MicOff size={16}/> : <Mic size={16}/>}</span><strong>{p.name}{self && <small> · {t('Siz','Вы','You')}</small>}</strong><span className="voice-state">{!member ? t('Ulanmagan','Не в чате','Offline') : broken && !self ? t('Aloqa uzildi','Нет связи','Disconnected') : !connected ? t('Ulanmoqda','Соединение','Connecting') : muted ? t('O‘chirilgan','Без микрофона','Muted') : speaking ? t('Gapiryapti','Говорит','Speaking') : t('Tinglayapti','Слушает','Listening')}</span></div>;
      })}</div>
      {voice.devices.length > 0 && <details className="voice-devices"><summary><Headphones size={15}/>{t('Mikrofon / naushnik','Микрофон / гарнитура','Microphone / headset')}</summary><Select value={voice.device} disabled={changing||voice.effectBusy||voice.noiseBusy} onValueChange={async device => { setChanging(true); await client.current?.selectDevice(device); setChanging(false); }}><SelectTrigger className="voice-device-select" aria-label={t('Mikrofonni tanlang','Выберите микрофон','Choose microphone')}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="default">{t('Qurilma tanlovi','По умолчанию','System default')}</SelectItem>{voice.devices.filter(d => d.id && d.id !== 'default').map((d,i) => <SelectItem key={d.id} value={d.id}>{d.label || `${t('Mikrofon','Микрофон','Microphone')} ${i+1}`}</SelectItem>)}</SelectContent></Select><p className="voice-hint">{t('Naushnikni qurilmangizga ulang, so‘ng uning mikrofonini tanlang.','Подключите гарнитуру к устройству и выберите её микрофон.','Connect your headset to your device, then choose its microphone.')}</p></details>}
      {voice.blocked && <button className="outline-btn full" onClick={() => void client.current?.unlock()}><Volume2 size={17}/>{t('Do‘stlar ovozini eshitish','Включить звук друзей','Enable friends’ audio')}</button>}
      {failed && <div className="voice-error" role="status"><p>{t('Bu tarmoqda ovoz ulanmayapti. Qayta ulaning yoki boshqa Wi-Fi / mobil internetda urinib ko‘ring.','В этой сети голос не подключается. Переподключитесь или попробуйте другую сеть.','Voice could not connect on this network. Rejoin or try another Wi-Fi / mobile network.')}</p><button className="text-btn" onClick={join}>{t('Qayta ulanish','Переподключиться','Reconnect')}</button></div>}
      <p className="voice-footnote">{t('Suhbat vaqtida fon musiqasi to‘xtaydi.','Фоновая музыка приостановлена на время чата.','Background music pauses during voice chat.')}</p>
    </>}
    {voice.error && <p className="voice-error" role="status">{error}</p>}
  </section>;
}
