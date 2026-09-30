import { create } from 'zustand';
import { State } from './engine';
export const useGameStore=create<{game:State|null;setGame:(game:State|null)=>void}>((set)=>({game:null,setGame:(game)=>set({game})}));
