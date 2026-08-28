import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'collectiq-active-tcg';

export type ActiveTCG =
  | 'all' | 'pokemon' | 'magic' | 'one-piece' | 'yugioh'
  | 'lorcana' | 'digimon' | 'dragonball' | 'gundam' | 'starwars'
  | 'riftbound' | 'weiss' | 'vanguard' | 'flesh-and-blood' | 'wow';

export interface TCGOption {
  key: ActiveTCG;
  label: string;
  icon: string;
  color: string;
  available: boolean;
  /** Si está definido, al hacer clic navega aquí en vez de mostrar la colección genérica */
  route?: string;
}

export const TCG_OPTIONS: TCGOption[] = [
  {
    key: 'all',
    label: 'Todos',
    color: '#6366f1',
    available: true,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 2C12 2 8 6 8 12C8 18 12 22 12 22" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 2C12 2 16 6 16 12C16 18 12 22 12 22" stroke="currentColor" stroke-width="1.5"/>
      <path d="M2 12H22" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
    </svg>`,
  },
  {
    key: 'pokemon',
    label: 'Pokémon',
    color: '#FFCC00',
    available: true,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
      <path d="M2 12H22" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="currentColor" stroke-width="1"/>
      <circle cx="12" cy="12" r="1.5" fill="white"/>
      <path d="M2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12" fill="currentColor" fill-opacity="0.15"/>
    </svg>`,
  },
  {
    key: 'magic',
    label: 'Magic',
    color: '#9B59B6',
    available: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L14.5 9H22L16 13.5L18.5 21L12 16.5L5.5 21L8 13.5L2 9H9.5L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    key: 'one-piece',
    label: 'One Piece',
    color: '#E74C3C',
    available: true,
    route: '/onepiece/collection',
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C10 3 8 4 8 6C8 8 10 9 12 9C14 9 16 8 16 6C16 4 14 3 12 3Z" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 9V21" stroke="currentColor" stroke-width="1.5"/>
      <path d="M7 14L12 21L17 14" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M4 6C4 6 2 8 2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M20 6C20 6 22 8 22 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    key: 'yugioh',
    label: 'Yu-Gi-Oh!',
    color: '#F39C12',
    available: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L22 8.5V15.5L12 22L2 15.5V8.5L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 6L18 9.5V16.5L12 20L6 16.5V9.5L12 6Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-opacity="0.5"/>
      <circle cx="12" cy="13" r="2" fill="currentColor"/>
      <path d="M12 7V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    key: 'lorcana',
    label: 'Lorcana',
    color: '#3498DB',
    available: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C12 2 4 7 4 13C4 17.42 7.58 21 12 21C16.42 21 20 17.42 20 13C20 7 12 2 12 2Z" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 6C12 6 8 9 8 13C8 15.21 9.79 17 12 17C14.21 17 16 15.21 16 13C16 9 12 6 12 6Z" stroke="currentColor" stroke-width="1" stroke-opacity="0.6"/>
      <circle cx="12" cy="13" r="2" fill="currentColor"/>
    </svg>`,
  },
  {
    key: 'digimon',
    label: 'Digimon',
    color: '#2ECC71',
    available: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="9" cy="10" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="10" r="1.5" fill="currentColor"/>
      <path d="M8 15C8 15 10 17 12 17C14 17 16 15 16 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 3V5M12 19V21M3 12H5M19 12H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    key: 'dragonball',
    label: 'Dragon Ball',
    color: '#FF6B35',
    available: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="10" cy="10" r="1" fill="currentColor"/>
      <circle cx="14" cy="10" r="1" fill="currentColor"/>
      <circle cx="12" cy="14" r="1" fill="currentColor"/>
    </svg>`,
  },
  {
    key: 'gundam',
    label: 'Gundam',
    color: '#E74C3C',
    available: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L15 5H20V10L22 12L20 14V19H15L12 22L9 19H4V14L2 12L4 10V5H9L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
      <path d="M9 9L12 7L15 9" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    key: 'starwars',
    label: 'Star Wars',
    color: '#F1C40F',
    available: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L13.5 8H19L14.5 11.5L16 16.5L12 13.5L8 16.5L9.5 11.5L5 8H10.5L12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M6 20L12 17L18 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    key: 'riftbound',
    label: 'Riftbound',
    color: '#8E44AD',
    available: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M8 12C8 12 10 9 12 12C14 15 16 12 16 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    key: 'weiss',
    label: 'Weiss Schwarz',
    color: '#E91E8C',
    available: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3Z" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 8L12 16L16 8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M8 12H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    key: 'vanguard',
    label: 'Vanguard',
    color: '#1ABC9C',
    available: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L22 12L12 22L2 12L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 6L18 12L12 18L6 12L12 6Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-opacity="0.5"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>`,
  },
  {
    key: 'flesh-and-blood',
    label: 'Flesh & Blood',
    color: '#C0392B',
    available: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 3L19 8L13 14L11 22L5 16L11 10L14 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M9 9L15 15" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-opacity="0.5"/>
    </svg>`,
  },
  {
    key: 'wow',
    label: 'World of Warcraft',
    color: '#F39C12',
    available: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 8L10 16H12L14 10L16 16H18L20 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6 8H18" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-opacity="0.4"/>
    </svg>`,
  },
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
