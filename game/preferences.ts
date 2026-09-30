'use client';
import { create } from 'zustand';
import { choose, formatMoney, type Language, type Currency, type Zone } from './localization';
import { yandexLanguage } from '@/yandex/bridge';
export const usePreferences=create<{language:Language;currency:Currency;zone:Zone;setLanguage:(v:Language)=>void;setCurrency:(v:Currency)=>void;setZone:(v:Zone)=>void;hydrate:()=>void}>((set)=>{
 const save=(key:string,value:string)=>{try{localStorage.setItem('biznes-'+key,value)}catch{}};
 return {language:'uz',currency:'UZS',zone:'main',setLanguage:v=>{set({language:v});save('language',v);document.documentElement.lang=v},setCurrency:v=>{set({currency:v});save('currency',v)},setZone:v=>{set({zone:v});save('zone',v);document.documentElement.dataset.zone=v},hydrate:()=>{try{const l=localStorage.getItem('biznes-language'),c=localStorage.getItem('biznes-currency'),z=localStorage.getItem('biznes-zone');const language:Language=l==='uz'||l==='ru'||l==='en'?l:(yandexLanguage()??'uz'),currency:Currency=c==='RUB'||c==='USD'?c:'UZS',zone:Zone=z==='samarkand'?'samarkand':'main';set({language,currency,zone});document.documentElement.lang=language;document.documentElement.dataset.zone=zone}catch{}}};
});
export function usePresentation(){const prefs=usePreferences();return {...prefs,t:(uz:string,ru:string,en:string)=>choose(prefs.language,uz,ru,en),money:(v:number)=>formatMoney(v,prefs.currency,prefs.language),compact:(v:number)=>formatMoney(v,prefs.currency,prefs.language,true),scene:prefs.zone==='samarkand'?'/art/samarkand-evening.webp':'/art/uzbek-city.webp'};}
