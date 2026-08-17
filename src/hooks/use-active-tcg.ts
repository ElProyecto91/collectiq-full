import { useState } from 'react';

const STORAGE_KEY = 'collectiq-active-tcg';

export type ActiveTCG =
  | 'all' | 'pokemon' | 'magic' | 'one-piece' | 'yugioh'
  | 'lorcana' | 'digimon' | 'dragonball' | 'gundam' | 'starwars'
  | 'riftbound' | 'weiss' | 'vanguard' | 'flesh-and-blood' | 'wow';

export interface TCGOption {
  key: ActiveTCG;
  label: string;
  emoji: string;
  available: boolean;
}

export const TCG_OPTIONS: TCGOption[] = [
  { key: 'all',             label: 'Todos',          emoji: '🌟', available: true },
  { key: 'pokemon',         label: 'Pokémon',        emoji: '🎴', available: true },
  { key: 'magic',           label: 'Magic',          emoji: '🔮', available: false },
  { key: 'one-piece',       label: 'One Piece',      emoji: '⚓', available: false },
  { key: 'yugioh',          label: 'Yu-Gi-Oh!',      emoji: '👁️', available: false },
  { key: 'lorcana',         label: 'Lorcana',        emoji: '🏰', available: false },
  { key: 'digimon',         label: 'Digimon',        emoji: '🦕', available: false },
  { key: 'dragonball',      label: 'Dragon Ball',    emoji: '🐉', available: false },
  { key: 'gundam',          label: 'Gundam',         emoji: '🤖', available: false },
  { key: 'starwars',        label: 'Star Wars',      emoji: '⚔️', available: false },
  { key: 'riftbound',       label: 'Riftbound',      emoji: '🌀', available: false },
  { key: 'weiss',           label: 'Weiss Schwarz',  emoji: '🌸', available: false },
  { key: 'vanguard',        label: 'Vanguard',       emoji: '🗡️', available: false },
  { key: 'flesh-and-blood', label: 'Flesh & Blood',  emoji: '⚔️', available: false },
  { key: 'wow',             label: 'World of Warcraft', emoji: '🐲', available: false },
];

export function useActiveTCG() {
  const [activeTCG, setActiveTCGState] = useState<ActiveTCG>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as ActiveTCG) ?? 'all';
    } catch {
      return 'all';
    }
  });

  const setActiveTCG = (tcg: ActiveTCG) => {
    setActiveTCGState(tcg);
    try {
      localStorage.setItem(STORAGE_KEY, tcg);
    } catch {}
  };

  return { activeTCG, setActiveTCG, TCG_OPTIONS };
}