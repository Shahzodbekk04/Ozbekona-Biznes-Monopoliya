import { State } from './engine';
export type Seat={id:string;name:string;bot:boolean;token?:number};
export type Room={code:string;host:string;seats:Seat[];state:State|null;revision:number;lastAction:number;seen:Record<string,number>};
export type Session={code:string;token:string;playerId:string};
