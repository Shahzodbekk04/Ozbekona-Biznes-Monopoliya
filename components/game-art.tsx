'use client';
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { Tile } from '@/game/engine';
import { usePresentation } from '@/game/preferences';
import { tokenName, tileName } from '@/game/localization';
export const TOKEN_NAMES=['Oltin avtomobil','Moviy lochin','Yoqut toj','Zumrad piyola','Kumush ot','Lokomotiv','Samolyot','Yaxta','Mototsikl','Arslon','Tuya','Burgut','Do‘ppi','Futbol to‘pi','Gitara','Fotoapparat','Raketa','Shaxmat oti','Oltin kalit','Kubok'];
export const TOKEN_COLORS=['#e4ba6e','#7eb2ea','#d88593','#71c6a9'];
export function artIndex(t:Tile){if(t.id===39)return 15;if(t.group!==undefined)return t.group;if(t.kind==='transport')return ({5:8,15:9,25:10,35:11} as Record<number,number>)[t.id]??8;if(t.kind==='utility')return ({9:14,12:12,28:13} as Record<number,number>)[t.id]??12;return null}
export function PropertyArt({tile,className=''}:{tile:Tile;className?:string}){const {language}=usePresentation();const index=artIndex(tile);if(index===null)return null;return <span role="img" aria-label={tileName(tile,language)} className={'property-art '+className} style={{'--art-x':`${(index%4)/3*100}%`,'--art-y':`${Math.floor(index/4)/3*100}%`} as CSSProperties}/>}
export function TokenArt({index,className=''}:{index:number;className?:string}){const {language}=usePresentation();const i=((index%20)+20)%20;return <span role="img" aria-label={tokenName(i,language)} className={'token-art '+className} style={{'--token-x':`${i%5/4*100}%`,'--token-y':`${Math.floor(i/5)/3*100}%`,'--token-color':TOKEN_COLORS[i%4]} as CSSProperties}/>}
const pips:Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const rotations:Record<number,[number,number]>={1:[0,0],2:[0,-90],3:[-90,0],4:[90,0],5:[0,90],6:[0,180]};
export function RealDice({value,rolling,second=false}:{value:number;rolling:boolean;second?:boolean}){const {t}=usePresentation();const reduced=useReducedMotion(),[x,y]=rotations[value];return <div className={'dice-scene '+(second?'dice-dark':'')} role="img" aria-label={t(`Zarik: ${value}`,`Кубик: ${value}`,`Die: ${value}`)}><motion.div className="dice-cube" animate={{rotateX:rolling&&!reduced?[x+120,x+480,x+720]:x,rotateY:rolling&&!reduced?[y+90,y+360,y+720]:y,rotateZ:second?12:-9,y:rolling&&!reduced?[0,-18,0,-7,0]:0}} transition={{duration:reduced?0:rolling?.65:.3,ease:'easeInOut'}}>{[1,2,3,4,5,6].map(v=><div key={v} className={'dice-face face-'+v} aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i} className={pips[v].includes(i)?'dice-dot visible':'dice-dot'}/>)}</div>)}</motion.div><span className="dice-shadow"/></div>}
