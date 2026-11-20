import type { DifficultyKey, WeaponDef } from './types';

export const PALETTE = {
  // Desaturated midnight-blue base, with warm highlights for fire and interiors.
  asphalt: '#202536',
  asphaltDark: '#171c2a',
  asphaltHighlight: '#30394b',
  asphaltCrack: '#10141e',
  sidewalk: '#555b69',
  sidewalkLight: '#747b89',
  sidewalkShadow: '#343a47',
  grass: '#263d2c',
  grassLight: '#3a5940',
  grassDark: '#17271c',
  rubble: '#4d4745',
  rubbleLight: '#76685d',
  blood: '#741b25',
  bloodFresh: '#d3343b',
  heliPad: '#2c3040',
  heliYellow: '#f2c12e',
  water: '#12243c',
  waterLight: '#1c406b',
  waterFoam: '#557da0',
  bridgeDeck: '#272b3b',
  bridgeRail: '#7a849e',
  hospitalFloor: '#8c96a8',
  hospitalFloorAlt: '#7c8699',
  hospitalWall: '#3b4861',
  hospitalWallRight: '#2b354a',
  hospitalWallTop: '#566785',
};

export const TILE_SIZE = 52;

export const DIFFICULTIES: Record<
  DifficultyKey,
  { label: string; zombieMult: number; damageMult: number }
> = {
  easy: { label: 'RECRUTA', zombieMult: 0.78, damageMult: 0.7 },
  normal: { label: 'SOLDADO', zombieMult: 1.0, damageMult: 1.0 },
  hard: { label: 'PESADELO', zombieMult: 1.35, damageMult: 1.38 },
};

// Slightly snappier handling and reloads keep combat responsive, while the
// shotgun remains a high-impact close-range option and the SMG a sustained-fire choice.
export const WEAPONS: WeaponDef[] = [
  {
    id: 'pistol',
    name: 'PISTOLA TÁTICA',
    shortName: 'PISTOLA',
    color: '#73eff7',
    fireRate: 0.19,
    damage: 40,
    speed: 500,
    spread: 0.025,
    count: 1,
    infinite: true,
    magSize: 14,
    reloadTime: 0.7,
  },
  {
    id: 'shotgun',
    name: 'ESCOPETA 12',
    shortName: 'ESCOPETA',
    color: '#ffcd75',
    fireRate: 0.58,
    damage: 35,
    speed: 450,
    spread: 0.23,
    count: 6,
    infinite: false,
    magSize: 6,
    reloadTime: 1.0,
  },
  {
    id: 'smg',
    name: 'FUZIL TÁTICO',
    shortName: 'FUZIL',
    color: '#e43b44',
    fireRate: 0.08,
    damage: 25,
    speed: 540,
    spread: 0.07,
    count: 1,
    infinite: false,
    magSize: 32,
    reloadTime: 0.9,
  },
  {
    id: 'flamethrower',
    name: 'LANÇA-CHAMAS',
    shortName: 'CHAMAS',
    color: '#f77622',
    fireRate: 0.055,
    damage: 18,
    speed: 275,
    spread: 0.2,
    count: 2,
    infinite: false,
    magSize: 60,
    reloadTime: 1.25,
  },
];
