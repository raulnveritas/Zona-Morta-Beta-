export type GameOverlayState =
  | 'MENU'
  | 'PLAYING'
  | 'GAME_OVER'
  | 'VICTORY';

export type PlayPhase =
  | 'CUTSCENE_0_INTRO'
  | 'PHASE1_CITY'
  | 'CUTSCENE_1_BRIDGE'
  | 'PHASE1_BRIDGE'
  | 'CUTSCENE_2_CRASH'
  | 'PHASE2_TRUCK_DEFENSE'
  | 'PHASE2_CITY'
  | 'PHASE2_HOSPITAL'
  | 'PHASE2_ROOFTOP'
  | 'CUTSCENE_3_FINALE';

export type ProtagonistGender = 'male' | 'female';
export type DifficultyKey = 'easy' | 'normal' | 'hard';
export type WeaponId = 'pistol' | 'shotgun' | 'smg' | 'flamethrower';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  shortName: string;
  color: string;
  fireRate: number;
  damage: number;
  speed: number;
  spread: number;
  count: number;
  infinite: boolean;
  magSize: number;
  reloadTime: number;
}

export interface WeaponState {
  unlocked: boolean;
  mag: number;
  reserve: number;
}

export interface Player {
  x: number;
  y: number;
  z: number;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
  angle: number;
  animFrame: number;
  invulnTimer: number;
  weaponIndex: number;
  weapons: WeaponState[];
  fireCooldown: number;
  reloading: boolean;
  reloadTimer: number;
}

export type ZombieType =
  | 'walker'
  | 'runner'
  | 'toxic'
  | 'brute'
  | 'doctor'
  | 'nurse'
  | 'surgeon'
  | 'patient'
  | 'crawler'
  | 'riot'
  | 'fireman'
  | 'exploder';

export interface Zombie {
  x: number;
  y: number;
  type: ZombieType;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  score: number;
  color: string;
  angle: number;
  animTimer: number;
  hitFlash: number;
  burnTimer: number;
  groanTimer: number;
  alertTimer: number;
}

export type SurvivorKind = 'civilian' | 'police' | 'soldier';

export interface Survivor {
  id: number;
  kind: SurvivorKind;
  x: number;
  y: number;
  radius: number;
  rescued: boolean;
  hp: number;
  maxHp: number;
  invulnTimer: number;
  angle: number;
  animTimer: number;
  helpTimer: number;
  fireCooldown: number;
  shirtColor: string;
  hairColor: string;
}

export type BuildingCategory = 'house' | 'pharmacy' | 'police' | 'hospital_ext';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FurnitureKind =
  | 'bed'
  | 'table'
  | 'sofa'
  | 'counter'
  | 'shelf'
  | 'locker'
  | 'desk'
  | 'gurney'
  | 'operating_table'
  | 'monitor'
  | 'cabinet'
  | 'chairs';

export interface FurnitureItem {
  kind: FurnitureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
}

export interface Building {
  id: string;
  category: BuildingCategory;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  safe: boolean;
  roofAlpha: number;
  roofColor: string;
  roofTrim: string;
  wallColor: string;
  floorColor: string;
  floorAltColor: string;
  walls: Rect[];
  furniture: FurnitureItem[];
  doorways: Rect[];
}

export type CarVariant = 'sedan' | 'suv' | 'police';

export interface Obstacle {
  type: 'car' | 'tree' | 'wall' | 'ac_unit';
  x: number;
  y: number;
  w: number;
  h: number;
  horizontal?: boolean;
  color?: string;
  burning?: boolean;
  carVariant?: CarVariant;
}

export interface FireSpot {
  x: number;
  y: number;
  radius: number;
  seed: number;
}

export interface Barrel {
  x: number;
  y: number;
  radius: number;
  hp: number;
}

export type PickupType =
  | 'medkit'
  | 'shotgun_ammo'
  | 'smg_ammo'
  | 'flame_ammo'
  | 'crate_shotgun'
  | 'crate_smg'
  | 'crate_flamethrower'
  | 'fuse';

export interface Pickup {
  x: number;
  y: number;
  z: number;
  type: PickupType;
  weaponId?: WeaponId;
  bob: number;
}

export interface GeneratorObject {
  x: number;
  y: number;
  fusesInserted: number;
  fusesRequired: number;
  activated: boolean;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  isFlame: boolean;
  life: number;
  color: string;
  fromAlly?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  z?: number;
  vx: number;
  vy: number;
  vz?: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface Decal {
  type: 'sidewalk' | 'park' | 'blood' | 'green_splat' | 'toxic_puddle' | 'crater' | 'rubble' | 'river';
  x: number;
  y: number;
  w?: number;
  h?: number;
  size?: number;
}

export interface StreetLamp {
  x: number;
  y: number;
  broken: boolean;
  flickering?: boolean;
  flickerSeed: number;
  isHospitalLamp?: boolean;
}

export interface DynamicFlash {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export type BridgeObstacleKind = 'wrecked_car' | 'barrier';

export interface BridgeObstacle {
  id: number;
  lane: -1 | 0 | 1;
  z: number;
  kind: BridgeObstacleKind;
  color: string;
  burning: boolean;
  carVariant?: CarVariant;
  hit: boolean;
}

export interface BridgeState {
  timeRemaining: number;
  totalDuration: number;
  lane: -1 | 0 | 1;
  lanePos: number;
  turboTimer: number;
  brakeTimer: number;
  slowTimer: number;
  recoverTimer: number;
  hitsWithoutRecovery: number;
  scrollOffset: number;
  spawnTimer: number;
  soldierFireTimer: number;
  obstacles: BridgeObstacle[];
  chasingZombies: { lanePos: number; z: number; anim: number }[];
  tracers: { x1: number; y1: number; x2: number; y2: number; life: number }[];
  exploderSpawned: boolean;
  exploderZ: number;
}

export interface TruckDefenseState {
  x: number;
  y: number;
  totalToExtract: number;
  extractedCount: number;
  extractTimer: number;
  extractInterval: number;
  completed: boolean;
  savedRoster: { kind: SurvivorKind; shirtColor: string; hairColor: string }[];
}

export interface RooftopBoardingState {
  active: boolean;
  boardingSurvivorId: number | null;
  boardedCount: number;
  totalToBoard: number;
  boardTimer: number;
  spawnTimer: number;
  completed: boolean;
}

export interface HelicopterState {
  x: number;
  y: number;
  z: number;
  rotorAngle: number;
  searchlightAngle: number;
  bladeSoundTimer: number;
  rappelRopeLength: number;
}

export interface CutsceneDialogue {
  speaker: string;
  text: string;
  duration: number;
}

export interface GameStats {
  score: number;
  kills: number;
  rescued: number;
  policeRescued: number;
  startTime: number;
  elapsedTime: number;
}

export interface HudSnapshot {
  overlay: GameOverlayState;
  playPhase: PlayPhase;
  gender: ProtagonistGender;
  score: number;
  kills: number;
  rescued: number;
  policeRescued: number;
  elapsedTime: number;
  hospitalFloor: number;
  fusesCollected: number;
  fusesRequired: number;
  generatorActive: boolean;
  hasCheckpoint: boolean;
  bridgeActive: boolean;
  bridgeTimeRemaining: number;
  bridgeHits: number;
  bridgeSlowed: boolean;
  cutsceneActive: boolean;
  cutsceneSpeaker: string | null;
  cutsceneText: string | null;
  cutsceneBanner: string | null;
  cutsceneFadeColor: string | null;
  cutsceneFadeAlpha: number;
  playerHp: number;
  rank: 'S' | 'A' | 'B' | 'C';
  rescueBonus: number;
  rooftopBoardingActive: boolean;
  rooftopBoarded: number;
  rooftopTotalToBoard: number;
  finaleFlyover: boolean;
  finaleScoreStep: number;
}
