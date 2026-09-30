import { BOARD, CARDS, GROUPS, LEVELS, type State, type Tile } from './engine';
export type Language='uz'|'ru'|'en';
export type Currency='UZS'|'RUB'|'USD';
export type Zone='main'|'samarkand';
export const locales={uz:'uz-UZ',ru:'ru-RU',en:'en-US'};
export const choose=(lang:Language,uz:string,ru:string,en:string)=>lang==='ru'?ru:lang==='en'?en:uz;
// Fixed game display rates, not live financial exchange rates. The ledger stays in UZS.
export const CURRENCY_SCALE:Record<Currency,number>={UZS:1,RUB:150,USD:12000};
export function formatMoney(value:number,currency:Currency,lang:Language,short=false){
 const amount=value/CURRENCY_SCALE[currency];
 const num=new Intl.NumberFormat(locales[lang],{maximumFractionDigits:currency==='UZS'?0:2,...(short?{notation:'compact' as const,maximumFractionDigits:1}:{})}).format(amount);
 return currency==='USD'?'$'+num:currency==='RUB'?num+' ₽':num+' '+choose(lang,'so‘m','сум','UZS');
}
const tileNames:Record<'ru'|'en',string[]>={
 ru:['Старт — начало успеха','Рынок Чорсу','Судьба','Рынок Урикзор','Налоговая инспекция','Ташкентский метрополитен','Рынок Куйлюк','Шанс','Абу Сахий','Электросеть HETK','Тюрьма / В гостях','Хорезм — Ичан-Кала','Газоснабжение','Бухара — Минарет Калян','Самарканд — Регистан','Поезд Афросиаб','Korzinka','Судьба','Makro','Havas','Отдых за чаем','Artel','Шанс','Akfa','Imzo','Uzbekistan Airways','UzAuto Motors','SamAvto','Ташкентское водоснабжение','BYD Uzbekistan','Отправляйтесь в тюрьму','Сквер Амира Темура','Tashkent City','Судьба','Magic City','Yandex Go','Шанс','IT Park Uzbekistan','Налог на имущество','Humo Arena'],
 en:['Start — new beginnings','Chorsu Bazaar','Destiny','Urikzor Bazaar','Tax inspection','Tashkent Metro','Kuyluk Bazaar','Opportunity','Abu Sahiy','HETK Electricity','Jail / Just visiting','Khorezm — Ichan Kala','Gas supply','Bukhara — Kalyan Minaret','Samarkand — Registan','Afrosiyob train','Korzinka','Destiny','Makro','Havas','Tea break','Artel','Opportunity','Akfa','Imzo','Uzbekistan Airways','UzAuto Motors','SamAvto','Tashkent water supply','BYD Uzbekistan','Go to jail','Amir Temur Square','Tashkent City','Destiny','Magic City','Yandex Go','Opportunity','IT Park Uzbekistan','Property tax','Humo Arena']};
const shortNames:Record<'ru'|'en',string[]>={ru:['СТАРТ','Чорсу','Судьба','Урикзор','Налог','Метро','Куйлюк','Шанс','Абу Сахий','Свет','Тюрьма','Хорезм','Газ','Бухара','Самарканд','Афросиаб','Korzinka','Судьба','Makro','Havas','Отдых','Artel','Шанс','Akfa','Imzo','Airways','UzAuto','SamAvto','Вода','BYD','В тюрьму','Амир Темур','Tashkent City','Судьба','Magic City','Yandex Go','Шанс','IT Park','Налог','Humo Arena'],en:['START','Chorsu','Destiny','Urikzor','Tax','Metro','Kuyluk','Chance','Abu Sahiy','Power','Jail','Khorezm','Gas','Bukhara','Samarkand','Afrosiyob','Korzinka','Destiny','Makro','Havas','Tea break','Artel','Chance','Akfa','Imzo','Airways','UzAuto','SamAvto','Water','BYD','Go to jail','Amir Temur','Tashkent City','Destiny','Magic City','Yandex Go','Chance','IT Park','Tax','Humo Arena']};
export const tileName=(tile:Tile,lang:Language,short=false)=>lang==='uz'?(short?tile.short:tile.name):(short?shortNames:tileNames)[lang][tile.id];
export const groupName=(id:number,lang:Language)=>lang==='uz'?GROUPS[id]:(lang==='ru'?['Рынки','Торговые центры','Исторические города','Супермаркеты','Промышленность','Автопром','Городские пространства','Премиум-объекты']:['Bazaars','Shopping centers','Historic cities','Supermarkets','Industry','Automotive','City attractions','Premium properties'])[id];
export const levelName=(id:number,lang:Language)=>lang==='uz'?LEVELS[id]:(lang==='ru'?['Без построек','Чайхана','Кафе','Ресторан','Свадебный зал']:['Undeveloped','Teahouse','Café','Restaurant','Wedding hall'])[id];
export const TOKEN_NAMES=['Oltin avtomobil','Moviy lochin','Yoqut toj','Zumrad piyola','Kumush ot','Lokomotiv','Samolyot','Yaxta','Mototsikl','Arslon','Tuya','Burgut','Do‘ppi','Futbol to‘pi','Gitara','Fotoapparat','Raketa','Shaxmat oti','Oltin kalit','Kubok'];
export const tokenName=(id:number,lang:Language)=>lang==='uz'?TOKEN_NAMES[id]:(lang==='ru'?['Золотой автомобиль','Синий сокол','Рубиновая корона','Изумрудная чашка','Серебряный конь','Локомотив','Самолёт','Яхта','Мотоцикл','Лев','Верблюд','Орёл','Тюбетейка','Футбольный мяч','Гитара','Фотоаппарат','Ракета','Шахматный конь','Золотой ключ','Кубок']:['Golden car','Blue falcon','Ruby crown','Emerald cup','Silver horse','Locomotive','Airplane','Yacht','Motorcycle','Lion','Camel','Eagle','Doppi hat','Football','Guitar','Camera','Rocket','Chess knight','Golden key','Trophy'])[id];
const cardCopies:Record<'ru'|'en',[string,string][]>={ru:[
 ['Государственный грант','Ваш бизнес-проект выиграл государственный грант!'],['Товар на таможне','Ваш товар задержали на таможне. Оплатите импортный сбор.'],['Поздравляем с Gentra!','Вы взяли автомобиль в кредит. Внесите разовый платёж банку.'],['Сезон дынь','Вы получили хорошую прибыль от урожая.'],['Попались на радар','Нарушение правил дорожного движения. Оплатите штраф.'],['Свадьба племянника','Подарки и расходы на семейную свадьбу.'],['Калым','Расходы на семейную церемонию.'],['Полезные связи','Сохраните карту. Она отменяет один налоговый платёж.'],['Началась проверка','Отправляйтесь в тюрьму без бонуса за Старт.'],['К новым успехам','Перейдите на Старт и получите бонус.'],['Экспортный контракт','Вы заключили выгодную сделку с новым клиентом!'],['Махаллинский хашар','Вы помогли благоустроить свою махаллю.'],['Торговля на Навруз','Дополнительная прибыль от праздничной торговли.'],['Ремонт крыши','Магазину требуется ремонт крыши.'],['Налоговый консультант','Получите карту полезных связей: отмените один налог.'],['Удачная инвестиция','Ваша инвестиция принесла прибыль.']],en:[
 ['Government grant','Your business project won a government grant!'],['Held at customs','Your goods were held at customs. Pay the import fee.'],['Enjoy your Gentra!','You bought a car on credit. Make a one-time bank payment.'],['Melon harvest','Your harvest earned a healthy profit.'],['Speed camera','A traffic violation: pay the fine.'],["Your nephew’s wedding",'Gifts and contributions to the family wedding.'],['Wedding contribution','Pay for a family ceremony.'],['Useful connections','Keep this card. It cancels one tax payment.'],['An inspection begins','Go to jail without a Start bonus.'],['A fresh start','Move to Start and collect the bonus.'],['Export contract','You signed a profitable deal with a new client!'],['Neighborhood cleanup','You helped improve your local neighborhood.'],['Navruz sales','Extra income from holiday trading.'],['Roof repairs','Your shop needs its roof repaired.'],['Tax advisor','Receive a connections card to cancel one tax payment.'],['Successful investment','Your investment earned a return.']]};
export const cardCopy=(id:number,lang:Language)=>lang==='uz'?{title:CARDS[id].title,text:id===1?'Tovaringiz bojxonada qolib ketdi. Import to‘lovini to‘lang.':CARDS[id].text}:{title:cardCopies[lang][id][0],text:cardCopies[lang][id][1]};
export function localizedLog(entry:State['log'][number],state:State,lang:Language,currency:Currency){
 const t=(u:string,r:string,e:string)=>choose(lang,u,r,e),m=(n:number)=>formatMoney(n,currency,lang),raw=entry.text;
 // Logs are retained as language-neutral event data for every device in a room.
 const d=entry.event;if(d){const p=String(d.player??''),tile=d.tile!==undefined?tileName(BOARD[Number(d.tile)],lang):'',v=Number(d.amount??0);switch(d.key){
 case 'start':return t(`Davra boshlandi. Har bir o‘yinchiga ${m(15000000)}.`,`Игра началась. Каждый получил ${m(15000000)}.`,`Game started. Each player received ${m(15000000)}.`);
 case 'turn':return t(`Navbat: ${p}.`,`Ход: ${p}.`,`${p}'s turn.`);
 case 'land':return `${p} — ${tile}.`;
 case 'roll':return t(`${p} zarik tashladi: ${d.a} + ${d.b}${d.a===d.b?' — dubl!':''}`,`${p}: ${d.a} + ${d.b}${d.a===d.b?' — дубль!':''}`,`${p} rolled ${d.a} + ${d.b}${d.a===d.b?' — doubles!':''}`);
 case 'buy':return t(`${p} ${tile}ni ${m(v)}ga sotib oldi.`,`${p} купил(а) ${tile} за ${m(v)}.`,`${p} bought ${tile} for ${m(v)}.`);
 case 'rent':return t(`${p} ${d.other}ga ${m(v)} ijara to‘laydi.`,`${p} платит ${d.other} аренду: ${m(v)}.`,`${p} pays ${d.other} rent of ${m(v)}.`);
 case 'bonus':return t(`${p} Startdan o‘tdi: +${m(v)}.`,`${p} прошёл(ла) Старт: +${m(v)}.`,`${p} passed Start: +${m(v)}.`);
 case 'jail':return t(`${p} qamoqqa tushdi.`,`${p} отправляется в тюрьму.`,`${p} goes to jail.`);
 case 'jailFee':return t(`Qamoqdan chiqish: ${m(500000)}.`,`Выход из тюрьмы: ${m(500000)}.`,`Jail release: ${m(500000)}.`);
 case 'card':return `${p}: ${cardCopy(Number(d.card),lang).title}.`;
 case 'tax':return t(`${p}: ${m(v)} soliq.`,`${p}: налог ${m(v)}.`,`${p}: tax of ${m(v)}.`);
 case 'pass':return t(`${p} Tanish-bilish kartasini ishlatdi.`,`${p} использовал(а) полезные связи.`,`${p} used a connections card.`);
 case 'debt':return t(`${p}: ${m(v)} qarz. Mulklarni soting yoki garovga qo‘ying.`,`${p}: долг ${m(v)}. Продайте или заложите имущество.`,`${p} owes ${m(v)}. Sell or mortgage assets.`);
 case 'build':return t(`${p}: ${tile}da ${levelName(Number(d.level),lang)} qurildi.`,`${p}: ${tile} — построено: ${levelName(Number(d.level),lang)}.`,`${p}: built ${levelName(Number(d.level),lang)} at ${tile}.`);
 case 'sell':return t(`${tile}: bino bosqichi sotildi.`,`${tile}: постройка продана.`,`${tile}: a building level was sold.`);
 case 'mortgage':return t(`${tile} garovga qo‘yildi.`,`${tile} заложен.`,`${tile} was mortgaged.`);
 case 'redeem':return t(`${tile} garovdan chiqarildi.`,`${tile}: залог погашен.`,`${tile} was redeemed.`);
 case 'auction':return t(`${tile} auksionga qo‘yildi.`,`${tile} выставлен на аукцион.`,`${tile} is up for auction.`);
 case 'auctionBuy':return t(`${p} ${tile}ni auksionda ${m(v)}ga oldi.`,`${p} выиграл(а) ${tile} за ${m(v)}.`,`${p} won ${tile} at auction for ${m(v)}.`);
 case 'bid':return t(`${p}: auksion taklifi ${m(v)}.`,`${p}: ставка ${m(v)}.`,`${p}: bid ${m(v)}.`);
 case 'noBid':return t('Taklif bo‘lmadi. Mulk bankda qoldi.','Нет ставок. Объект остался у банка.','No bids. The bank keeps the property.');
 case 'inflation':return t(`Inflyatsiya! Ijara boshlang‘ich narxning ${d.percent}% iga yetdi.`,`Инфляция! Аренда составляет ${d.percent}% начальной цены.`,`Inflation! Rent is now ${d.percent}% of its starting value.`);
 case 'bankrupt':return t(`${p} bankrot bo‘ldi.`,`${p} обанкротился.`,`${p} went bankrupt.`);
 case 'win':return t(`${p} — davra g‘olibi!`,`${p} — победитель!`,`${p} wins the game!`);
 }}
 // Translate logs retained from earlier saved games too.
 let event:NonNullable<typeof entry.event>|undefined;
 const amount=(value:string)=>{const digits=value.match(/-?\d[\d\s\u00a0\u202f]*(?:[.,]\d+)?/)?.[0]??'0';const n=Number(digits.replace(/\s/g,'').replace(',','.'));return Math.round(n*(value.includes('mln')?1000000:value.includes('ming')?1000:1))};
 if(raw.startsWith('Davra boshlandi'))event={key:'start'};
 if(raw==='Taklif bo‘lmadi. Mulk bankda qoldi.')event={key:'noBid'};
 if(raw==='Qamoqdan chiqish: 500 ming so‘m.')event={key:'jailFee'};
 const inf=raw.match(/boshlang‘ich narxning ([0-9]+)%/);if(inf)event={key:'inflation',percent:Number(inf[1])};
 for(const p of state.players){
  const name=p.name;
  if(raw===`Navbat: ${name}.`)event={key:'turn',player:name};
  if(raw===`${name} qamoqqa tushdi.`)event={key:'jail',player:name};
  if(raw===`${name} bankrot bo‘ldi.`)event={key:'bankrupt',player:name};
  if(raw===`${name} — davra g‘olibi!`)event={key:'win',player:name};
  if(raw===`${name} Tanish-bilish kartasini ishlatdi.`)event={key:'pass',player:name};
  if(raw.startsWith(name+' zarik tashladi: ')){const dice=raw.slice(name.length).match(/([1-6]) \+ ([1-6])/);if(dice)event={key:'roll',player:name,a:Number(dice[1]),b:Number(dice[2])}}
  if(raw.startsWith(name+' Startdan o‘tdi: +'))event={key:'bonus',player:name,amount:amount(raw.slice((name+' Startdan o‘tdi: +').length))};
  if(raw.startsWith(name+': ')){const rest=raw.slice(name.length+2);if(rest.endsWith('so‘m soliq.'))event={key:'tax',player:name,amount:amount(rest)};if(rest.includes('so‘m qarz.'))event={key:'debt',player:name,amount:amount(rest.split('so‘m qarz.')[0])};if(rest.startsWith('auksion taklifi '))event={key:'bid',player:name,amount:amount(rest)};const c=CARDS.findIndex(c=>rest===c.title+'.');if(c>=0)event={key:'card',player:name,card:c};}
  for(const other of state.players){const prefix=`${name} ${other.name}ga `;if(raw.startsWith(prefix)&&raw.endsWith('ijara to‘laydi.'))event={key:'rent',player:name,other:other.name,amount:amount(raw.slice(prefix.length))};}
  for(const tile of BOARD){
   if(raw===`${name} — ${tile.name}.`)event={key:'land',player:name,tile:tile.id};
   const buy=`${name} ${tile.name}ni `,auction=`${name} auksionda ${tile.name}ni `;
   if(raw.startsWith(buy)&&raw.endsWith('sotib oldi.'))event={key:'buy',player:name,tile:tile.id,amount:amount(raw.slice(buy.length))};
   if(raw.startsWith(auction)&&raw.endsWith('oldi.'))event={key:'auctionBuy',player:name,tile:tile.id,amount:amount(raw.slice(auction.length))};
   for(let level=1;level<LEVELS.length;level++)if(raw===`${name}: ${tile.name}da ${LEVELS[level]} qurildi.`)event={key:'build',player:name,tile:tile.id,level};
  }
 }
 for(const tile of BOARD){for(const [suffix,key] of [[' auksionga qo‘yildi.','auction'],[': bino bosqichi sotildi.','sell'],[' garovga qo‘yildi.','mortgage'],[' garovdan chiqarildi.','redeem']])if(raw===tile.name+suffix)event={key,tile:tile.id}}
 if(event)return localizedLog({...entry,event},state,lang,currency);
 return raw;

}

const errorCopies:Record<string,[string,string]>={
 'Serverga ulanib bo‘lmadi. Qayta urinib ko‘ring.':['Не удалось подключиться. Повторите попытку.','Could not connect. Please try again.'],
 'Xatolik yuz berdi.':['Произошла ошибка.','An error occurred.'],
 'Aloqa uzildi.':['Соединение прервано.','Connection lost.'],
 'Amal bajarilmadi.':['Действие не выполнено.','The action could not be completed.'],
 'Saqlangan o‘yin ochilmadi. Yangi davra boshlashingiz mumkin.':['Не удалось открыть сохранение. Вы можете начать новую игру.','Could not load the saved game. You can start a new one.'],
 'O‘yinni qurilmada saqlab bo‘lmadi.':['Не удалось сохранить игру на устройстве.','Could not save the game on this device.'],
 'Ismingizni kiriting (1–24 belgi).':['Введите имя (1–24 символа).','Enter a name (1–24 characters).'],
 'Figurani tanlang (1–20).':['Выберите фигурку (1–20).','Choose a piece (1–20).'],
 '6 ta harf yoki raqamdan iborat kod kiriting.':['Введите код из 6 букв или цифр.','Enter a 6-character letter/number code.'],
 'Bu kod oxirgi 24 soatda ishlatilgan. Boshqa kod tanlang.':['Этот код использовался в последние 24 часа. Выберите другой.','This code was used within the last 24 hours. Choose another.'],
 '6 xonali raqamli kod kiriting.':['Введите код из 6 цифр.','Enter a 6-digit code.'],
 'Bu kod band. Boshqa 6 xonali kod tanlang.':['Этот код занят. Выберите другой код из 6 цифр.','This code is taken. Choose another 6-digit code.'],
 'Xona kodini tekshiring.':['Проверьте код комнаты.','Check the room code.'],
 '7 belgili xona kodini tekshiring.':['Проверьте 7-значный код комнаты.','Check the 7-character room code.'],
 'Xona topilmadi. Kodni tekshiring.':['Комната не найдена. Проверьте код.','Room not found. Check the code.'],
 'Bu xonada o‘yin allaqachon boshlangan.':['В этой комнате игра уже началась.','The game in this room has already started.'],
 'Xona to‘la (4 o‘yinchi).':['Комната заполнена (4 игрока).','The room is full (4 players).'],
 'Xona yangilandi. Qayta qo‘shiling.':['Комната обновилась. Попробуйте войти снова.','The room changed. Please try joining again.'],
 'Xonaga kirish huquqi yo‘q. Qayta qo‘shiling.':['Нет доступа к комнате. Войдите заново.','No access to this room. Please rejoin.'],
 'Bot qo‘shib bo‘lmaydi.':['Невозможно добавить бота.','Cannot add a bot.'],
 'Bu amal mumkin emas.':['Это действие недоступно.','This action is unavailable.'],
 'Bu amal hozir mumkin emas.':['Сейчас это действие недоступно.','This action is not available now.'],
 'Boshlash uchun kamida 2 o‘yinchi kerak.':['Для начала нужны минимум 2 игрока.','At least 2 players are needed to start.'],
 'O‘yinchi yaqinda onlayn edi. 60 soniya kuting.':['Игрок недавно был онлайн. Подождите 60 секунд.','The player was recently online. Wait 60 seconds.'],
 'O‘yinchi topilmadi.':['Игрок не найден.','Player not found.'],
 'O‘yin boshlanmagan.':['Игра ещё не началась.','The game has not started.'],
 'O‘yin yangilandi. Amalni qayta tanlang.':['Игра обновилась. Повторите действие.','The game changed. Please choose your action again.'],
 'Navbat botga topshirilgan.':['Ход передан боту.','This seat is now controlled by a bot.'],
 'Amalni tanlang.':['Выберите действие.','Choose an action.'],
 'Xona yangilandi. Qayta urinib ko‘ring.':['Комната обновилась. Повторите попытку.','The room changed. Please try again.'],
 'Xona bilan aloqa uzildi. Birozdan keyin qayta urinib ko‘ring.':['Связь с комнатой прервана. Повторите попытку чуть позже.','Connection to the room was lost. Try again shortly.'],
 'O‘yin yakunlangan.':['Игра завершена.','The game is over.'],
 'Hozir sizning navbatingiz emas.':['Сейчас не ваш ход.','It is not your turn.'],
 'Xarid uchun pul yetarli emas.':['Недостаточно денег для покупки.','Not enough money to buy this.'],
 'Taklif uchun mablag‘ yetmaydi.':['Недостаточно денег для ставки.','Not enough money for this bid.'],
 'Tanish-bilish kartasi yo‘q.':['Нет карты связей.','You have no connections card.'],
 'Bu mulk sizniki emas.':['Этот объект вам не принадлежит.','You do not own this property.'],
 'Qurish uchun to‘liq garovsiz guruh, teng daraja va mablag‘ kerak.':['Для строительства нужен полный незаложенный комплект, равные уровни и деньги.','Building requires a complete unmortgaged set, even levels and sufficient funds.'],
 'Avval eng yuqori darajali binoni soting.':['Сначала продайте самую высокую постройку.','Sell the highest building level first.'],
 'Guruhdagi binolarni avval soting.':['Сначала продайте постройки в группе.','Sell the buildings in this set first.'],
 'Garovni qaytarish uchun pul yetmaydi.':['Недостаточно денег для выкупа залога.','Not enough money to redeem the mortgage.'],
 'Ruxsat berilmadi.':['Доступ запрещён.','Access denied.'],
 'Noma’lum amal.':['Неизвестное действие.','Unknown action.'],
 'Noma’lum so‘rov.':['Неизвестный запрос.','Unknown request.']
};
export function translateError(error:string,lang:Language){if(!error||lang==='uz')return error;const found=errorCopies[error];if(found)return found[lang==='ru'?0:1];if(error.startsWith('Taklif havolasini nusxalab bo‘lmadi.'))return choose(lang,error,'Не удалось скопировать ссылку. Сообщите другу код: ','Could not copy the link. Share this code: ')+error.split(': ').at(-1);return error;}
