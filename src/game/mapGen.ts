import { DIFFICULTIES, PALETTE } from './constants';
import type {
  Barrel,
  Building,
  BuildingCategory,
  CarVariant,
  Decal,
  DifficultyKey,
  FireSpot,
  FurnitureItem,
  GeneratorObject,
  Obstacle,
  Pickup,
  Rect,
  StreetLamp,
  Survivor,
  Zombie,
  ZombieType,
} from './types';

export interface GeneratedWorld {
  worldWidth: number;
  worldHeight: number;
  buildings: Building[];
  obstacles: Obstacle[];
  barrels: Barrel[];
  pickups: Pickup[];
  decals: Decal[];
  fires: FireSpot[];
  survivors: Survivor[];
  zombies: Zombie[];
  streetLamps: StreetLamp[];
  riverX: number | null;
  bridgeEntryY: number | null;
  truckPos: { x: number; y: number } | null;
  hospitalDoor: Rect | null;
  stairExit: Rect | null;
  generator: GeneratorObject | null;
  helipadPos: { x: number; y: number } | null;
}

let nextSurvivorId = 1;

const SURVIVOR_SHIRTS = [
  '#73eff7',
  '#ffcd75',
  '#ff77a8',
  '#a7f070',
  '#f4f4f4',
  '#f77622',
  '#b6d53c',
];
const HAIR_COLORS = ['#3b2518', '#1e1b24', '#8f563b', '#d9a066', '#4a3028'];

export function createZombie(
  x: number,
  y: number,
  type: ZombieType,
  diff: DifficultyKey,
  floorLevel = 1
): Zombie {
  const mult = DIFFICULTIES[diff].zombieMult * (1 + (floorLevel - 1) * 0.18);
  const spdMult = 1 + (floorLevel - 1) * 0.08;
  const dmgMult = DIFFICULTIES[diff].damageMult * (1 + (floorLevel - 1) * 0.1);
  const configs: Record<
    ZombieType,
    { hp: number; speed: number; radius: number; damage: number; score: number; color: string }
  > = {
    walker: { hp: 52 * mult, speed: 64 + Math.random() * 14, radius: 10, damage: 13, score: 100, color: '#4b7236' },
    runner: { hp: 36 * mult, speed: 94 + Math.random() * 14, radius: 9, damage: 12, score: 150, color: '#9e3838' },
    toxic: { hp: 62 * mult, speed: 66 + Math.random() * 12, radius: 10, damage: 17, score: 200, color: '#38b764' },
    brute: { hp: 168 * mult, speed: 50 + Math.random() * 8, radius: 14, damage: 24, score: 350, color: '#4c3b78' },
    crawler: { hp: 32 * mult, speed: 86 + Math.random() * 14, radius: 8, damage: 11, score: 140, color: '#6b4f35' },
    riot: { hp: 115 * mult, speed: 62 + Math.random() * 10, radius: 11, damage: 16, score: 260, color: '#273b66' },
    fireman: { hp: 92 * mult, speed: 70 + Math.random() * 10, radius: 11, damage: 16, score: 230, color: '#b8761a' },
    // Zumbis do hospital mais rápidos e variados!
    doctor: { hp: 64 * mult, speed: (58 + Math.random() * 10) * spdMult, radius: 10, damage: 15, score: 180, color: '#e2e8f0' },
    nurse: { hp: 52 * mult, speed: (68 + Math.random() * 12) * spdMult, radius: 10, damage: 14, score: 170, color: '#4db8b8' },
    surgeon: { hp: 58 * mult, speed: (82 + Math.random() * 12) * spdMult, radius: 9, damage: 16, score: 210, color: '#2b9985' },
    patient: { hp: 44 * mult, speed: (64 + Math.random() * 14) * spdMult, radius: 9, damage: 13, score: 155, color: '#94a3b8' },
    exploder: { hp: 110 * mult, speed: 70, radius: 13, damage: 30, score: 400, color: '#8ae234' },
  };
  const cfg = configs[type];
  return {
    x,
    y,
    type,
    hp: cfg.hp,
    maxHp: cfg.hp,
    speed: cfg.speed,
    radius: cfg.radius,
    damage: cfg.damage * dmgMult,
    score: cfg.score,
    color: cfg.color,
    angle: Math.random() * Math.PI * 2,
    animTimer: Math.random() * 10,
    hitFlash: 0,
    burnTimer: 0,
    groanTimer: 2 + Math.random() * 8,
    alertTimer: 0,
  };
}

function buildEnterableBuilding(
  id: string,
  category: BuildingCategory,
  x: number,
  y: number,
  w: number,
  h: number,
  doorSide: 'south' | 'north' | 'east' | 'west'
): Building {
  const wallT = 10;
  const doorW = 50;
  const walls: Rect[] = [];
  const doorways: Rect[] = [];
  const furniture: FurnitureItem[] = [];

  if (doorSide === 'south') {
    const dx = x + Math.floor(w / 2 - doorW / 2);
    walls.push({ x, y, w, h: wallT });
    walls.push({ x, y, w: wallT, h });
    walls.push({ x: x + w - wallT, y, w: wallT, h });
    walls.push({ x, y: y + h - wallT, w: dx - x, h: wallT });
    walls.push({ x: dx + doorW, y: y + h - wallT, w: x + w - (dx + doorW), h: wallT });
    doorways.push({ x: dx, y: y + h - wallT, w: doorW, h: wallT });
  } else if (doorSide === 'north') {
    const dx = x + Math.floor(w / 2 - doorW / 2);
    walls.push({ x, y, w: dx - x, h: wallT });
    walls.push({ x: dx + doorW, y, w: x + w - (dx + doorW), h: wallT });
    walls.push({ x, y, w: wallT, h });
    walls.push({ x: x + w - wallT, y, w: wallT, h });
    walls.push({ x, y: y + h - wallT, w, h: wallT });
    doorways.push({ x: dx, y, w: doorW, h: wallT });
  } else if (doorSide === 'east') {
    const dy = y + Math.floor(h / 2 - doorW / 2);
    walls.push({ x, y, w, h: wallT });
    walls.push({ x, y: y + h - wallT, w, h: wallT });
    walls.push({ x, y, w: wallT, h });
    walls.push({ x: x + w - wallT, y, w: wallT, h: dy - y });
    walls.push({ x: x + w - wallT, y: dy + doorW, w: wallT, h: y + h - (dy + doorW) });
    doorways.push({ x: x + w - wallT, y: dy, w: wallT, h: doorW });
  } else {
    const dy = y + Math.floor(h / 2 - doorW / 2);
    walls.push({ x, y, w, h: wallT });
    walls.push({ x, y: y + h - wallT, w, h: wallT });
    walls.push({ x, y, w: wallT, h: dy - y });
    walls.push({ x, y: dy + doorW, w: wallT, h: y + h - (dy + doorW) });
    walls.push({ x: x + w - wallT, y, w: wallT, h });
    doorways.push({ x, y: dy, w: wallT, h: doorW });
  }

  let label = 'CASA';
  let roofColor = '#4f382e';
  let roofTrim = '#6e4a3a';
  let wallColor = '#6e382d';
  let floorColor = '#5b3f29';
  let floorAltColor = '#47301e';

  if (category === 'house') {
    label = 'CASA';
    walls.push({ x: x + Math.floor(w * 0.48), y: y + wallT, w: 7, h: Math.floor(h * 0.44) });
    furniture.push({ kind: 'bed', x: x + 22, y: y + 22, w: 44, h: 26, color: '#8f937a' });
    furniture.push({ kind: 'table', x: x + 24, y: y + h - 54, w: 38, h: 24 });
    furniture.push({ kind: 'sofa', x: x + w - 62, y: y + 24, w: 42, h: 20, color: '#8f3038' });
    furniture.push({ kind: 'cabinet', x: x + w - 46, y: y + h - 46, w: 28, h: 20 });
  } else if (category === 'pharmacy') {
    label = 'FARMÁCIA';
    roofColor = '#4a525e';
    roofTrim = '#36a892';
    wallColor = '#444d5c';
    floorColor = '#8d98a3';
    floorAltColor = '#78828d';

    walls.push({ x: x + Math.floor(w * 0.56), y: y + wallT, w: 7, h: Math.floor(h * 0.44) });
    furniture.push({ kind: 'counter', x: x + 24, y: y + 26, w: 68, h: 18, color: '#2e8a77' });
    furniture.push({ kind: 'shelf', x: x + 24, y: y + 70, w: 58, h: 16 });
    furniture.push({ kind: 'table', x: x + w - 64, y: y + 28, w: 42, h: 22 });
    furniture.push({ kind: 'cabinet', x: x + w - 48, y: y + h - 48, w: 28, h: 22 });
  } else if (category === 'police') {
    label = 'DELEGACIA';
    roofColor = '#2f394a';
    roofTrim = '#4d6ea8';
    wallColor = '#3f4c63';
    floorColor = '#7b8494';
    floorAltColor = '#666f7e';

    walls.push({ x: x + Math.floor(w * 0.52), y: y + wallT, w: 8, h: Math.floor(h * 0.46) });
    furniture.push({ kind: 'desk', x: x + 22, y: y + 24, w: 48, h: 22 });
    furniture.push({ kind: 'locker', x: x + w - 54, y: y + 20, w: 38, h: 18, color: '#475569' });
    furniture.push({ kind: 'locker', x: x + w - 54, y: y + 46, w: 38, h: 18, color: '#475569' });
    furniture.push({ kind: 'table', x: x + 24, y: y + h - 56, w: 46, h: 24 });
  } else {
    label = 'HOSPITAL CENTRAL';
    roofColor = '#3a4963';
    roofTrim = '#e43b44';
    wallColor = '#43536b';
    floorColor = PALETTE.hospitalFloor;
    floorAltColor = PALETTE.hospitalFloorAlt;
  }

  return {
    id,
    category,
    label,
    x,
    y,
    w,
    h,
    safe: category !== 'hospital_ext',
    roofAlpha: 1,
    roofColor,
    roofTrim,
    wallColor,
    floorColor,
    floorAltColor,
    walls,
    furniture,
    doorways,
  };
}

function pointBlocked(
  x: number,
  y: number,
  radius: number,
  buildings: Building[],
  obstacles: Obstacle[],
  worldW: number,
  worldH: number,
  riverX: number | null
): boolean {
  const maxX = riverX !== null ? riverX - 36 : worldW - 40;
  if (x < radius + 36 || y < radius + 36 || x > maxX - radius || y > worldH - radius - 36) {
    return true;
  }
  for (const b of buildings) {
    if (
      x + radius > b.x - 16 &&
      x - radius < b.x + b.w + 16 &&
      y + radius > b.y - 16 &&
      y - radius < b.y + b.h + 16
    ) {
      return true;
    }
  }
  for (const obs of obstacles) {
    if (
      x + radius > obs.x - 8 &&
      x - radius < obs.x + obs.w + 8 &&
      y + radius > obs.y - 8 &&
      y - radius < obs.y + obs.h + 8
    ) {
      return true;
    }
  }
  return false;
}

export function generatePhase1City(diff: DifficultyKey): GeneratedWorld {
  const worldWidth = 4200;
  const worldHeight = 2500;
  const riverX = 3780;
  const bridgeEntryY = 1250;

  const buildings: Building[] = [];
  const obstacles: Obstacle[] = [];
  const barrels: Barrel[] = [];
  const pickups: Pickup[] = [];
  const decals: Decal[] = [];
  const fires: FireSpot[] = [];
  const survivors: Survivor[] = [];
  const zombies: Zombie[] = [];
  const streetLamps: StreetLamp[] = [];

  const playerStart = { x: 260, y: 1250 };
  const truckPos = { x: 3670, y: bridgeEntryY };

  decals.push({ type: 'river', x: riverX, y: 0, w: worldWidth - riverX, h: worldHeight });

  // Expanded City: 12 Safe enterable buildings (houses, pharmacies, police stations)
  const buildingSpecs: {
    cat: BuildingCategory;
    x: number;
    y: number;
    w: number;
    h: number;
    door: 'south' | 'north' | 'east' | 'west';
    loot: Pickup['type'][];
  }[] = [
    { cat: 'house', x: 380, y: 420, w: 205, h: 170, door: 'south', loot: ['medkit', 'shotgun_ammo'] },
    { cat: 'pharmacy', x: 420, y: 1580, w: 220, h: 175, door: 'north', loot: ['medkit', 'medkit', 'medkit'] },
    { cat: 'house', x: 560, y: 2020, w: 205, h: 170, door: 'north', loot: ['medkit', 'smg_ammo'] },
    { cat: 'police', x: 1020, y: 340, w: 235, h: 190, door: 'south', loot: ['crate_shotgun', 'shotgun_ammo', 'smg_ammo'] },
    { cat: 'house', x: 1040, y: 1060, w: 205, h: 170, door: 'west', loot: ['medkit', 'smg_ammo'] },
    { cat: 'pharmacy', x: 1560, y: 440, w: 220, h: 175, door: 'south', loot: ['medkit', 'medkit', 'flame_ammo'] },
    { cat: 'police', x: 1600, y: 1620, w: 235, h: 190, door: 'north', loot: ['crate_smg', 'crate_flamethrower', 'shotgun_ammo'] },
    { cat: 'house', x: 2140, y: 420, w: 205, h: 170, door: 'south', loot: ['medkit', 'smg_ammo'] },
    { cat: 'pharmacy', x: 2200, y: 1860, w: 220, h: 175, door: 'north', loot: ['medkit', 'medkit', 'shotgun_ammo'] },
    { cat: 'police', x: 2740, y: 520, w: 235, h: 190, door: 'south', loot: ['crate_shotgun', 'smg_ammo', 'flame_ammo'] },
    { cat: 'house', x: 2780, y: 1520, w: 205, h: 170, door: 'north', loot: ['medkit', 'shotgun_ammo'] },
    { cat: 'house', x: 3240, y: 760, w: 205, h: 170, door: 'south', loot: ['medkit', 'smg_ammo'] },
  ];

  buildingSpecs.forEach((spec, idx) => {
    const b = buildEnterableBuilding(
      `p1_b_${idx}`,
      spec.cat,
      spec.x,
      spec.y,
      spec.w,
      spec.h,
      spec.door
    );
    buildings.push(b);

    decals.push({
      type: 'sidewalk',
      x: spec.x - 24,
      y: spec.y - 24,
      w: spec.w + 48,
      h: spec.h + 48,
    });

    streetLamps.push({
      x: spec.x - 18,
      y: spec.y + spec.h + 16,
      broken: Math.random() < 0.25,
      flickerSeed: Math.random() * 100,
    });

    spec.loot.forEach((lootType, li) => {
      const anchor = b.furniture[li % b.furniture.length];
      const lx = anchor ? anchor.x + anchor.w / 2 : spec.x + spec.w / 2;
      const ly = anchor ? anchor.y + anchor.h / 2 : spec.y + spec.h / 2;
      const weaponId = lootType.startsWith('crate_')
        ? (lootType.replace('crate_', '') as Pickup['weaponId'])
        : undefined;
      pickups.push({
        x: lx,
        y: ly,
        z: 10,
        type: lootType,
        weaponId,
        bob: li * 1.1,
      });
    });
  });

  // Parks & trees
  const parkCoords = [
    { x: 720, y: 720 },
    { x: 1320, y: 920 },
    { x: 1940, y: 840 },
    { x: 2520, y: 1020 },
    { x: 3080, y: 1680 },
  ];
  parkCoords.forEach((pk) => {
    decals.push({ type: 'park', x: pk.x, y: pk.y, w: 185, h: 155 });
    for (let t = 0; t < 3; t++) {
      obstacles.push({
        type: 'tree',
        x: pk.x + 26 + t * 52,
        y: pk.y + 32 + (t % 2) * 52,
        w: 24,
        h: 24,
      });
    }
  });

  // Detailed Wrecked & Police Vehicles (sedan, suv, police)
  const carColors = ['#b82535', '#3259b8', '#d9a31e', '#5d687a', '#2b7a44'];
  const variants: CarVariant[] = ['sedan', 'suv', 'police'];
  for (let i = 0; i < 38; i++) {
    const cx = 360 + Math.random() * (riverX - 600);
    const cy = 120 + Math.random() * (worldHeight - 240);
    if (Math.hypot(cx - playerStart.x, cy - playerStart.y) < 180) continue;
    if (Math.hypot(cx - truckPos.x, cy - truckPos.y) < 260) continue;
    const horizontal = Math.random() > 0.45;
    const w = horizontal ? 54 : 30;
    const h = horizontal ? 30 : 54;
    const variant = variants[i % 5 === 0 ? 2 : i % 2];
    if (!pointBlocked(cx + w / 2, cy + h / 2, 34, buildings, obstacles, worldWidth, worldHeight, riverX)) {
      const burning = Math.random() < 0.38;
      obstacles.push({
        type: 'car',
        x: cx,
        y: cy,
        w,
        h,
        horizontal,
        color: variant === 'police' ? '#1e293b' : carColors[i % carColors.length],
        burning,
        carVariant: variant,
      });
      if (burning) {
        fires.push({
          x: cx + w * 0.65,
          y: cy + h * 0.5,
          radius: 75,
          seed: i * 3.7,
        });
      }
    }
  }

  // Dynamic City Street Fires & Rubble Debris
  for (let i = 0; i < 24; i++) {
    const fx = 420 + Math.random() * (riverX - 580);
    const fy = 150 + Math.random() * (worldHeight - 300);
    if (Math.hypot(fx - playerStart.x, fy - playerStart.y) < 200) continue;
    if (!pointBlocked(fx, fy, 26, buildings, obstacles, worldWidth, worldHeight, riverX)) {
      fires.push({ x: fx, y: fy, radius: 85 + Math.random() * 25, seed: i * 5.3 });
      decals.push({ type: 'rubble', x: fx, y: fy, size: 20 });
    }
  }

  // Explosive barrels
  for (let i = 0; i < 28; i++) {
    const bx = 340 + Math.random() * (riverX - 540);
    const by = 120 + Math.random() * (worldHeight - 240);
    if (Math.hypot(bx - playerStart.x, by - playerStart.y) < 200) continue;
    if (Math.hypot(bx - truckPos.x, by - truckPos.y) < 220) continue;
    if (!pointBlocked(bx, by, 18, buildings, obstacles, worldWidth, worldHeight, riverX)) {
      barrels.push({ x: bx, y: by, radius: 9, hp: 20 });
    }
  }

  // 8 Civilian Survivors across expanded city
  const civSpots = [
    { x: 600, y: 740 },
    { x: 860, y: 1740 },
    { x: 1380, y: 580 },
    { x: 1520, y: 1320 },
    { x: 2040, y: 640 },
    { x: 2360, y: 1480 },
    { x: 2940, y: 880 },
    { x: 3260, y: 1520 },
  ];
  civSpots.forEach((pos, idx) => {
    survivors.push({
      id: nextSurvivorId++,
      kind: 'civilian',
      x: pos.x,
      y: pos.y,
      radius: 10,
      rescued: false,
      hp: 100,
      maxHp: 100,
      invulnTimer: 0,
      angle: 0,
      animTimer: Math.random() * 10,
      helpTimer: 1.5 + Math.random() * 3,
      fireCooldown: 0,
      shirtColor: SURVIVOR_SHIRTS[idx % SURVIVOR_SHIRTS.length],
      hairColor: HAIR_COLORS[idx % HAIR_COLORS.length],
    });
    for (let g = 0; g < 3; g++) {
      const ang = (Math.PI * 2 * g) / 3;
      const zx = pos.x + Math.cos(ang) * 86;
      const zy = pos.y + Math.sin(ang) * 86;
      if (!pointBlocked(zx, zy, 14, buildings, obstacles, worldWidth, worldHeight, riverX)) {
        zombies.push(createZombie(zx, zy, g === 0 ? 'runner' : g === 1 ? 'crawler' : 'walker', diff));
      }
    }
  });

  // 4 Police Officers
  const policeSpots = [
    { x: 920, y: 640 },
    { x: 1580, y: 1950 },
    { x: 2380, y: 720 },
    { x: 3080, y: 1180 },
  ];
  policeSpots.forEach((pos) => {
    survivors.push({
      id: nextSurvivorId++,
      kind: 'police',
      x: pos.x,
      y: pos.y,
      radius: 10,
      rescued: false,
      hp: 140,
      maxHp: 140,
      invulnTimer: 0,
      angle: 0,
      animTimer: Math.random() * 10,
      helpTimer: 2 + Math.random() * 3,
      fireCooldown: 0.2,
      shirtColor: '#25428a',
      hairColor: '#1a1c2c',
    });
    for (let g = 0; g < 3; g++) {
      const ang = (Math.PI * 2 * g) / 3 + 0.5;
      const zx = pos.x + Math.cos(ang) * 115;
      const zy = pos.y + Math.sin(ang) * 115;
      if (!pointBlocked(zx, zy, 14, buildings, obstacles, worldWidth, worldHeight, riverX)) {
        zombies.push(createZombie(zx, zy, g === 0 ? 'riot' : 'walker', diff));
      }
    }
  });

  // Allied Army Soldier beside truck
  survivors.push({
    id: nextSurvivorId++,
    kind: 'soldier',
    x: truckPos.x - 130,
    y: truckPos.y + 45,
    radius: 10,
    rescued: false,
    hp: 9999,
    maxHp: 9999,
    invulnTimer: 0,
    angle: Math.PI,
    animTimer: 0,
    helpTimer: 1.5,
    fireCooldown: 0.2,
    shirtColor: '#3f5932',
    hairColor: '#2d4023',
  });

  // Rich Street Zombie Hordes with expanded variety!
  const hordeCenters = [
    { x: 560, y: 1220 },
    { x: 820, y: 520 },
    { x: 1140, y: 1520 },
    { x: 1480, y: 1080 },
    { x: 1860, y: 740 },
    { x: 2180, y: 1280 },
    { x: 2560, y: 780 },
    { x: 2880, y: 1260 },
    { x: 3220, y: 1020 },
    { x: 3340, y: 1640 },
  ];
  const pickStreetType = (): ZombieType => {
    const r = Math.random();
    if (r > 0.92) return 'brute';
    if (r > 0.84) return 'riot';
    if (r > 0.76) return 'fireman';
    if (r > 0.67) return 'toxic';
    if (r > 0.56) return 'crawler';
    if (r > 0.30) return 'runner';
    return 'walker';
  };
  for (const hc of hordeCenters) {
    const clusterSize = 10 + Math.floor(Math.random() * 6);
    for (let k = 0; k < clusterSize; k++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 18 + Math.random() * 120;
      const zx = hc.x + Math.cos(ang) * rad;
      const zy = hc.y + Math.sin(ang) * rad;
      if (pointBlocked(zx, zy, 14, buildings, obstacles, worldWidth, worldHeight, riverX)) continue;
      zombies.push(createZombie(zx, zy, pickStreetType(), diff));
    }
  }
  for (let i = 0; i < 48; i++) {
    const zx = 380 + Math.random() * (riverX - 500);
    const zy = 100 + Math.random() * (worldHeight - 200);
    if (Math.hypot(zx - playerStart.x, zy - playerStart.y) < 250) continue;
    if (Math.hypot(zx - truckPos.x, zy - truckPos.y) < 220) continue;
    if (pointBlocked(zx, zy, 14, buildings, obstacles, worldWidth, worldHeight, riverX)) continue;
    zombies.push(createZombie(zx, zy, pickStreetType(), diff));
  }

  for (let lx = 320; lx < riverX - 150; lx += 380) {
    streetLamps.push({
      x: lx,
      y: 1140,
      broken: Math.random() < 0.2,
      flickerSeed: Math.random() * 100,
    });
  }

  return {
    worldWidth,
    worldHeight,
    buildings,
    obstacles,
    barrels,
    pickups,
    decals,
    fires,
    survivors,
    zombies,
    streetLamps,
    riverX,
    bridgeEntryY,
    truckPos,
    hospitalDoor: null,
    stairExit: null,
    generator: null,
    helipadPos: null,
  };
}

export function generatePhase2City(diff: DifficultyKey): GeneratedWorld {
  const worldWidth = 3600;
  const worldHeight = 2250;

  const buildings: Building[] = [];
  const obstacles: Obstacle[] = [];
  const barrels: Barrel[] = [];
  const pickups: Pickup[] = [];
  const decals: Decal[] = [];
  const fires: FireSpot[] = [];
  const survivors: Survivor[] = [];
  const zombies: Zombie[] = [];
  const streetLamps: StreetLamp[] = [];

  const truckPos = { x: 260, y: 1125 };
  const hospitalDoor: Rect = { x: 3250, y: 1060, w: 64, h: 130 };

  decals.push({ type: 'river', x: 0, y: 0, w: 96, h: worldHeight });

  // Hospital Exterior on East end
  const hospExt = buildEnterableBuilding(
    'p2_hospital_ext',
    'hospital_ext',
    3250,
    810,
    300,
    630,
    'west'
  );
  buildings.push(hospExt);
  decals.push({ type: 'sidewalk', x: 3210, y: 780, w: 360, h: 690 });

  const specs: {
    cat: BuildingCategory;
    x: number;
    y: number;
    w: number;
    h: number;
    door: 'south' | 'north' | 'east' | 'west';
    loot: Pickup['type'][];
  }[] = [
    { cat: 'house', x: 520, y: 380, w: 205, h: 170, door: 'south', loot: ['medkit', 'shotgun_ammo'] },
    { cat: 'pharmacy', x: 560, y: 1580, w: 220, h: 175, door: 'north', loot: ['medkit', 'medkit', 'medkit'] },
    { cat: 'police', x: 1120, y: 360, w: 235, h: 185, door: 'south', loot: ['crate_shotgun', 'crate_smg', 'shotgun_ammo'] },
    { cat: 'house', x: 1160, y: 1560, w: 205, h: 170, door: 'north', loot: ['medkit', 'flame_ammo'] },
    { cat: 'pharmacy', x: 1760, y: 420, w: 220, h: 175, door: 'south', loot: ['medkit', 'medkit', 'crate_flamethrower'] },
    { cat: 'police', x: 1800, y: 1560, w: 235, h: 185, door: 'north', loot: ['crate_smg', 'shotgun_ammo', 'medkit'] },
    { cat: 'house', x: 2420, y: 400, w: 205, h: 170, door: 'south', loot: ['medkit', 'smg_ammo'] },
    { cat: 'pharmacy', x: 2460, y: 1620, w: 220, h: 175, door: 'north', loot: ['medkit', 'medkit', 'flame_ammo'] },
    { cat: 'police', x: 2880, y: 580, w: 235, h: 185, door: 'south', loot: ['crate_shotgun', 'shotgun_ammo', 'medkit'] },
  ];

  specs.forEach((spec, idx) => {
    const b = buildEnterableBuilding(`p2_b_${idx}`, spec.cat, spec.x, spec.y, spec.w, spec.h, spec.door);
    buildings.push(b);
    decals.push({ type: 'sidewalk', x: spec.x - 22, y: spec.y - 22, w: spec.w + 44, h: spec.h + 44 });
    streetLamps.push({
      x: spec.x - 16,
      y: spec.y + spec.h + 14,
      broken: Math.random() < 0.35,
      flickerSeed: Math.random() * 100,
    });

    spec.loot.forEach((lootType, li) => {
      const anchor = b.furniture[li % b.furniture.length];
      const lx = anchor ? anchor.x + anchor.w / 2 : spec.x + spec.w / 2;
      const ly = anchor ? anchor.y + anchor.h / 2 : spec.y + spec.h / 2;
      const weaponId = lootType.startsWith('crate_')
        ? (lootType.replace('crate_', '') as Pickup['weaponId'])
        : undefined;
      pickups.push({ x: lx, y: ly, z: 10, type: lootType, weaponId, bob: li });
    });
  });

  const carColors = ['#b82535', '#3259b8', '#d9a31e', '#5d687a', '#2b7a44'];
  const variants: CarVariant[] = ['sedan', 'suv', 'police'];
  for (let i = 0; i < 30; i++) {
    const cx = 480 + Math.random() * 2520;
    const cy = 120 + Math.random() * (worldHeight - 240);
    const horizontal = Math.random() > 0.5;
    const w = horizontal ? 54 : 30;
    const h = horizontal ? 30 : 54;
    const variant = variants[i % 4 === 0 ? 2 : i % 2];
    if (!pointBlocked(cx + w / 2, cy + h / 2, 34, buildings, obstacles, worldWidth, worldHeight, null)) {
      const burning = Math.random() < 0.45;
      obstacles.push({
        type: 'car',
        x: cx,
        y: cy,
        w,
        h,
        horizontal,
        color: variant === 'police' ? '#1e293b' : carColors[i % carColors.length],
        burning,
        carVariant: variant,
      });
      if (burning) {
        fires.push({ x: cx + w * 0.65, y: cy + h * 0.5, radius: 78, seed: i * 4.1 });
      }
    }
  }

  for (let i = 0; i < 20; i++) {
    const fx = 460 + Math.random() * 2550;
    const fy = 150 + Math.random() * (worldHeight - 300);
    if (!pointBlocked(fx, fy, 26, buildings, obstacles, worldWidth, worldHeight, null)) {
      fires.push({ x: fx, y: fy, radius: 85, seed: i * 6.2 });
      decals.push({ type: 'rubble', x: fx, y: fy, size: 20 });
    }
  }

  for (let i = 0; i < 24; i++) {
    const bx = 420 + Math.random() * 2600;
    const by = 120 + Math.random() * (worldHeight - 240);
    if (!pointBlocked(bx, by, 18, buildings, obstacles, worldWidth, worldHeight, null)) {
      barrels.push({ x: bx, y: by, radius: 9, hp: 20 });
    }
  }

  const policeSpots = [
    { x: 1020, y: 1040 },
    { x: 1960, y: 1140 },
    { x: 2740, y: 1080 },
  ];
  policeSpots.forEach((pos) => {
    survivors.push({
      id: nextSurvivorId++,
      kind: 'police',
      x: pos.x,
      y: pos.y,
      radius: 10,
      rescued: false,
      hp: 140,
      maxHp: 140,
      invulnTimer: 0,
      angle: 0,
      animTimer: Math.random() * 10,
      helpTimer: 2,
      fireCooldown: 0.2,
      shirtColor: '#25428a',
      hairColor: '#1a1c2c',
    });
  });

  const p2Centers = [
    { x: 740, y: 980 },
    { x: 1060, y: 1280 },
    { x: 1460, y: 920 },
    { x: 1840, y: 1120 },
    { x: 2240, y: 880 },
    { x: 2560, y: 1240 },
    { x: 2940, y: 1120 },
  ];
  const pickP2Type = (): ZombieType => {
    const r = Math.random();
    if (r > 0.90) return 'brute';
    if (r > 0.82) return 'riot';
    if (r > 0.74) return 'fireman';
    if (r > 0.65) return 'toxic';
    if (r > 0.54) return 'crawler';
    if (r > 0.28) return 'runner';
    return 'walker';
  };
  for (const hc of p2Centers) {
    const clusterSize = 10 + Math.floor(Math.random() * 6);
    for (let k = 0; k < clusterSize; k++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 18 + Math.random() * 120;
      const zx = hc.x + Math.cos(ang) * rad;
      const zy = hc.y + Math.sin(ang) * rad;
      if (pointBlocked(zx, zy, 14, buildings, obstacles, worldWidth, worldHeight, null)) continue;
      zombies.push(createZombie(zx, zy, pickP2Type(), diff));
    }
  }
  for (let i = 0; i < 40; i++) {
    const zx = 500 + Math.random() * 2560;
    const zy = 100 + Math.random() * (worldHeight - 200);
    if (pointBlocked(zx, zy, 14, buildings, obstacles, worldWidth, worldHeight, null)) continue;
    zombies.push(createZombie(zx, zy, pickP2Type(), diff));
  }

  for (let lx = 380; lx < 3120; lx += 380) {
    streetLamps.push({
      x: lx,
      y: 1030,
      broken: Math.random() < 0.3,
      flickerSeed: Math.random() * 100,
    });
  }

  return {
    worldWidth,
    worldHeight,
    buildings,
    obstacles,
    barrels,
    pickups,
    decals,
    fires,
    survivors,
    zombies,
    streetLamps,
    riverX: null,
    bridgeEntryY: null,
    truckPos,
    hospitalDoor,
    stairExit: null,
    generator: null,
    helipadPos: null,
  };
}

export function generateHospitalFloor(floorNum: number, diff: DifficultyKey): GeneratedWorld {
  const worldWidth = 1160;
  const worldHeight = 800;

  const buildings: Building[] = [];
  const obstacles: Obstacle[] = [];
  const barrels: Barrel[] = [];
  const pickups: Pickup[] = [];
  const decals: Decal[] = [];
  const fires: FireSpot[] = [];
  const survivors: Survivor[] = [];
  const zombies: Zombie[] = [];
  const streetLamps: StreetLamp[] = [];

  const wallT = 22;
  obstacles.push({ type: 'wall', x: 0, y: 0, w: worldWidth, h: wallT });
  obstacles.push({ type: 'wall', x: 0, y: worldHeight - wallT, w: worldWidth, h: wallT });
  obstacles.push({ type: 'wall', x: 0, y: 0, w: wallT, h: worldHeight });
  obstacles.push({ type: 'wall', x: worldWidth - wallT, y: 0, w: wallT, h: worldHeight });

  const dividers: Rect[] = [
    { x: 320, y: wallT, w: 14, h: 210 },
    { x: 640, y: wallT, w: 14, h: 210 },
    { x: 320, y: 560, w: 14, h: 218 },
    { x: 640, y: 560, w: 14, h: 218 },
    { x: wallT, y: 280, w: 160, h: 14 },
    { x: 270, y: 280, w: 200, h: 14 },
    { x: 550, y: 280, w: 220, h: 14 },
    { x: 860, y: 280, w: 278, h: 14 },
    { x: wallT, y: 510, w: 160, h: 14 },
    { x: 270, y: 510, w: 200, h: 14 },
    { x: 550, y: 510, w: 220, h: 14 },
    { x: 860, y: 510, w: 278, h: 14 },
  ];
  dividers.forEach((d) => obstacles.push({ type: 'wall', x: d.x, y: d.y, w: d.w, h: d.h }));

  const floorFurniture: FurnitureItem[] = [
    { kind: 'desk', x: 110, y: 95, w: 56, h: 24 },
    { kind: 'cabinet', x: 230, y: 75, w: 36, h: 22 },
    { kind: 'bed', x: 410, y: 80, w: 50, h: 28, color: '#38bdf8' },
    { kind: 'table', x: 520, y: 110, w: 42, h: 24 },
    { kind: 'operating_table', x: 740, y: 100, w: 64, h: 32 },
    { kind: 'cabinet', x: 960, y: 80, w: 42, h: 24 },
    { kind: 'chairs', x: 75, y: 590, w: 92, h: 24 },
    { kind: 'cabinet', x: 220, y: 670, w: 38, h: 24 },
    { kind: 'gurney', x: 400, y: 630, w: 54, h: 26 },
    { kind: 'table', x: 530, y: 650, w: 42, h: 24 },
    { kind: 'bed', x: 740, y: 630, w: 50, h: 28, color: '#e43b44' },
    { kind: 'cabinet', x: 950, y: 650, w: 42, h: 24 },
  ];

  buildings.push({
    id: `hosp_floor_${floorNum}`,
    category: 'hospital_ext',
    label: `ANDAR ${floorNum}`,
    x: wallT,
    y: wallT,
    w: worldWidth - wallT * 2,
    h: worldHeight - wallT * 2,
    safe: false,
    roofAlpha: 0,
    roofColor: '#1e293b',
    roofTrim: '#475569',
    wallColor: PALETTE.hospitalWall,
    floorColor: PALETTE.hospitalFloor,
    floorAltColor: PALETTE.hospitalFloorAlt,
    walls: [],
    furniture: floorFurniture,
    doorways: [],
  });

  const lampPositions = [
    { x: 180, y: 140 },
    { x: 490, y: 140 },
    { x: 840, y: 140 },
    { x: 220, y: 400 },
    { x: 520, y: 400 },
    { x: 820, y: 400 },
    { x: 1020, y: 400 },
    { x: 180, y: 640 },
    { x: 490, y: 640 },
    { x: 840, y: 640 },
  ];
  lampPositions.forEach((lp, idx) => {
    streetLamps.push({
      x: lp.x,
      y: lp.y,
      broken: idx % 4 === 3,
      flickering: true,
      flickerSeed: idx * 7.3 + floorNum * 3.1,
      isHospitalLamp: true,
    });
  });

  // Generator puzzle reduced to 1 FUSE per floor!
  const generator: GeneratorObject = {
    x: 155,
    y: 345,
    fusesInserted: 0,
    fusesRequired: 1,
    activated: false,
  };

  const singleFuseSpots: { x: number; y: number }[] = [
    { x: 540, y: 122 }, // Floor 1: Room 2 table
    { x: 980, y: 92 },  // Floor 2: Room 3 cabinet
    { x: 550, y: 662 }, // Floor 3: Room 5 table
    { x: 970, y: 662 }, // Floor 4: Room 6 cabinet
  ];
  const fusePos = singleFuseSpots[(floorNum - 1) % singleFuseSpots.length];
  pickups.push({ x: fusePos.x, y: fusePos.y, z: 10, type: 'fuse', bob: 0.5 });

  pickups.push(
    { x: 135, y: 105, z: 10, type: 'medkit', bob: 0.2 },
    { x: 770, y: 115, z: 10, type: floorNum % 2 === 0 ? 'shotgun_ammo' : 'smg_ammo', bob: 1.5 },
    { x: 425, y: 640, z: 10, type: 'medkit', bob: 2.3 },
    { x: 765, y: 640, z: 10, type: floorNum === 3 ? 'crate_flamethrower' : 'flame_ammo', weaponId: floorNum === 3 ? 'flamethrower' : undefined, bob: 3.1 }
  );

  // Escalating Hospital Zombie Variety & Difficulty each floor!
  const floorPools: ZombieType[][] = [
    ['doctor', 'nurse', 'patient'],
    ['doctor', 'nurse', 'surgeon', 'patient', 'crawler'],
    ['doctor', 'nurse', 'surgeon', 'patient', 'crawler', 'runner', 'toxic'],
    ['doctor', 'nurse', 'surgeon', 'runner', 'toxic', 'riot', 'brute'],
  ];
  const pool = floorPools[Math.min(floorPools.length - 1, floorNum - 1)];
  const count = 11 + floorNum * 4;
  for (let i = 0; i < count; i++) {
    const zx = 360 + Math.random() * 680;
    const zy = 80 + Math.random() * 640;
    if (Math.hypot(zx - 150, zy - 400) < 220) continue;
    const type = pool[i % pool.length];
    zombies.push(createZombie(zx, zy, type, diff, floorNum));
  }

  const stairExit: Rect = { x: worldWidth - 120, y: 345, w: 80, h: 110 };

  return {
    worldWidth,
    worldHeight,
    buildings,
    obstacles,
    barrels,
    pickups,
    decals,
    fires,
    survivors,
    zombies,
    streetLamps,
    riverX: null,
    bridgeEntryY: null,
    truckPos: null,
    hospitalDoor: null,
    stairExit,
    generator,
    helipadPos: null,
  };
}

export function generateHospitalRooftop(diff: DifficultyKey): GeneratedWorld {
  const worldWidth = 1120;
  const worldHeight = 720;

  const obstacles: Obstacle[] = [];
  const wallT = 20;
  obstacles.push({ type: 'wall', x: 0, y: 0, w: worldWidth, h: wallT });
  obstacles.push({ type: 'wall', x: 0, y: worldHeight - wallT, w: worldWidth, h: wallT });
  obstacles.push({ type: 'wall', x: 0, y: 0, w: wallT, h: worldHeight });
  obstacles.push({ type: 'wall', x: worldWidth - wallT, y: 0, w: wallT, h: worldHeight });

  obstacles.push({ type: 'ac_unit', x: 260, y: 120, w: 58, h: 42 });
  obstacles.push({ type: 'ac_unit', x: 260, y: 550, w: 58, h: 42 });
  obstacles.push({ type: 'ac_unit', x: 520, y: 140, w: 54, h: 38 });
  obstacles.push({ type: 'ac_unit', x: 520, y: 535, w: 54, h: 38 });

  const zombies: Zombie[] = [];
  const roofPool: ZombieType[] = ['surgeon', 'doctor', 'nurse', 'runner', 'riot'];
  for (let i = 0; i < 6; i++) {
    const zx = 380 + Math.random() * 240;
    const zy = 140 + Math.random() * 440;
    zombies.push(createZombie(zx, zy, roofPool[i % roofPool.length], diff, 4));
  }

  return {
    worldWidth,
    worldHeight,
    buildings: [],
    obstacles,
    barrels: [],
    pickups: [
      { x: 290, y: 360, z: 0, type: 'medkit', bob: 0 },
      { x: 460, y: 360, z: 0, type: 'smg_ammo', bob: 1.2 },
    ],
    decals: [],
    fires: [],
    survivors: [],
    zombies,
    streetLamps: [
      { x: 180, y: 140, broken: false, flickering: true, flickerSeed: 1.2 },
      { x: 180, y: 580, broken: false, flickering: true, flickerSeed: 4.5 },
      { x: 760, y: 180, broken: false, flickering: false, flickerSeed: 2.1 },
      { x: 760, y: 540, broken: false, flickering: false, flickerSeed: 6.4 },
    ],
    riverX: null,
    bridgeEntryY: null,
    truckPos: null,
    hospitalDoor: null,
    stairExit: null,
    generator: null,
    helipadPos: { x: 860, y: 360 },
  };
}
