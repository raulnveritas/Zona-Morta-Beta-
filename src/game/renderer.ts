import { PALETTE, TILE_SIZE, WEAPONS } from './constants';
import type {
  Barrel,
  BridgeState,
  Building,
  Bullet,
  Decal,
  DynamicFlash,
  FireSpot,
  FloatingText,
  FurnitureItem,
  GameStats,
  GeneratorObject,
  HelicopterState,
  Obstacle,
  Particle,
  Pickup,
  PlayPhase,
  Player,
  ProtagonistGender,
  Rect,
  RooftopBoardingState,
  StreetLamp,
  Survivor,
  Zombie,
} from './types';

export interface RenderContextData {
  playPhase: PlayPhase;
  gender: ProtagonistGender;
  worldWidth: number;
  worldHeight: number;
  camera: { x: number; y: number; shake: number };
  globalTimer: number;
  player: Player;
  zombies: Zombie[];
  survivors: Survivor[];
  buildings: Building[];
  obstacles: Obstacle[];
  barrels: Barrel[];
  pickups: Pickup[];
  decals: Decal[];
  fires: FireSpot[];
  bullets: Bullet[];
  particles: Particle[];
  streetLamps: StreetLamp[];
  dynamicFlashes: DynamicFlash[];
  floatingTexts: FloatingText[];
  riverX: number | null;
  bridgeEntryY: number | null;
  truckPos: { x: number; y: number } | null;
  hospitalDoor: Rect | null;
  stairExit: Rect | null;
  generator: GeneratorObject | null;
  helipadPos: { x: number; y: number } | null;
  helicopter: HelicopterState | null;
  bridgeState: BridgeState | null;
  rooftopBoarding: RooftopBoardingState | null;
  hospitalFloor: number;
  fusesCollected: number;
  stats: GameStats;
  playerInSafeBuilding: Building | null;
  cutsceneActive: boolean;
  finaleFlyover: boolean;
}

// Close-up portrait isometric 2:1 projection (larger pixel detail on mobile)
const ISO_X = 1.32;
const ISO_Y = 0.66;

export function worldToIso(
  wx: number,
  wy: number,
  wz: number,
  camX: number,
  camY: number,
  viewWidth: number,
  viewHeight: number
): { x: number; y: number } {
  const dx = wx - camX;
  const dy = wy - camY;
  return {
    x: viewWidth * 0.5 + (dx - dy) * ISO_X,
    y: viewHeight * 0.52 + (dx + dy) * ISO_Y - wz,
  };
}

export function isoToWorld(
  sx: number,
  sy: number,
  camX: number,
  camY: number,
  viewWidth: number,
  viewHeight: number
): { x: number; y: number } {
  const rx = (sx - viewWidth * 0.5) / ISO_X;
  const ry = (sy - viewHeight * 0.52) / ISO_Y;
  return {
    x: camX + (rx + ry) * 0.5,
    y: camY + (ry - rx) * 0.5,
  };
}

function drawIsoQuad(
  ctx: CanvasRenderingContext2D,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
  fill: string,
  stroke?: string,
  lineWidth = 1
) {
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  w: number,
  h: number,
  zBase: number,
  height: number,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  topColor: string,
  leftColor: string,
  rightColor: string,
  castShadow = true,
  outline = 'rgba(8, 10, 16, 0.85)'
) {
  const b00 = worldToIso(wx, wy, zBase, camX, camY, vw, vh);
  const b10 = worldToIso(wx + w, wy, zBase, camX, camY, vw, vh);
  const b11 = worldToIso(wx + w, wy + h, zBase, camX, camY, vw, vh);
  const b01 = worldToIso(wx, wy + h, zBase, camX, camY, vw, vh);

  if (castShadow && zBase === 0) {
    const shOff = height * 0.45;
    const s10 = worldToIso(wx + w + shOff, wy + shOff * 0.4, 0, camX, camY, vw, vh);
    const s11 = worldToIso(wx + w + shOff, wy + h + shOff * 0.4, 0, camX, camY, vw, vh);
    const s01 = worldToIso(wx + shOff * 0.5, wy + h + shOff * 0.4, 0, camX, camY, vw, vh);
    drawIsoQuad(ctx, b01, b10, s10, s11, 'rgba(0, 0, 0, 0.30)');
    drawIsoQuad(ctx, b01, b11, s11, s01, 'rgba(0, 0, 0, 0.30)');
  }

  const t00 = worldToIso(wx, wy, zBase + height, camX, camY, vw, vh);
  const t10 = worldToIso(wx + w, wy, zBase + height, camX, camY, vw, vh);
  const t11 = worldToIso(wx + w, wy + h, zBase + height, camX, camY, vw, vh);
  const t01 = worldToIso(wx, wy + h, zBase + height, camX, camY, vw, vh);

  // Left-front face (x .. x+w at y+h)
  drawIsoQuad(ctx, t01, t11, b11, b01, leftColor, outline);
  // Right-front face (y .. y+h at x+w)
  drawIsoQuad(ctx, t10, t11, b11, b10, rightColor, outline);
  // Top face
  drawIsoQuad(ctx, t00, t10, t11, t01, topColor, outline);
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  lightCtx: CanvasRenderingContext2D,
  lightCanvas: HTMLCanvasElement,
  viewWidth: number,
  viewHeight: number,
  data: RenderContextData,
  isMenuPreview: boolean
) {
  if (data.playPhase === 'CUTSCENE_3_FINALE' && data.finaleFlyover) {
    renderFinaleOverflight(ctx, viewWidth, viewHeight, data);
    return;
  }

  if (
    data.playPhase === 'PHASE1_BRIDGE' ||
    data.playPhase === 'CUTSCENE_2_CRASH'
  ) {
    renderBridgeSubwaySurfers(ctx, viewWidth, viewHeight, data);
    if (!isMenuPreview && !data.cutsceneActive) {
      renderHud(ctx, viewWidth, viewHeight, data);
    }
    return;
  }

  ctx.fillStyle = '#120f24';
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const shakeX =
    data.camera.shake > 0 ? (Math.random() - 0.5) * data.camera.shake : 0;
  const shakeY =
    data.camera.shake > 0 ? (Math.random() - 0.5) * data.camera.shake : 0;
  const camX = data.camera.x + shakeX;
  const camY = data.camera.y + shakeY;

  // 1. Isometric Ground & Streets
  drawIsoGround(ctx, camX, camY, viewWidth, viewHeight, data);

  // 2. River & Bridge Approach (Phase 1)
  if (data.riverX !== null) {
    drawIsoRiver(
      ctx,
      data.riverX,
      data.worldWidth,
      data.worldHeight,
      data.bridgeEntryY || 950,
      camX,
      camY,
      viewWidth,
      viewHeight,
      data.globalTimer
    );
  }

  // 3. Helipad (Rooftop)
  if (data.helipadPos) {
    drawIsoHelipad(ctx, data.helipadPos.x, data.helipadPos.y, camX, camY, viewWidth, viewHeight);
  }

  // 4. Decals (Sidewalks, Parks, Blood, Craters)
  drawIsoDecals(ctx, camX, camY, viewWidth, viewHeight, data.decals);

  // 5. Building Floors & Back Walls
  for (const b of data.buildings) {
    const center = worldToIso(b.x + b.w / 2, b.y + b.h / 2, 0, camX, camY, viewWidth, viewHeight);
    if (center.x < -380 || center.x > viewWidth + 380 || center.y < -300 || center.y > viewHeight + 300) {
      continue;
    }
    drawBuildingFloorAndBackWalls(ctx, b, camX, camY, viewWidth, viewHeight, data.globalTimer);
  }

  // 6. Portal / Objective Zones (Hospital Door, Stairwell, Truck Boarding)
  if (data.hospitalDoor) {
    drawIsoPortal(ctx, data.hospitalDoor, '#38b764', 'ENTRADA HOSPITAL', camX, camY, viewWidth, viewHeight, data.globalTimer);
  }
  if (data.stairExit) {
    const unlocked = data.generator?.activated ?? true;
    const label = !unlocked
      ? 'PORTA TRANCADA'
      : data.hospitalFloor < 4
        ? `ESCADA ${data.hospitalFloor + 1}º ANDAR`
        : 'ACESSO HELIPORTO';
    drawIsoPortal(
      ctx,
      data.stairExit,
      unlocked ? '#73eff7' : '#e43b44',
      label,
      camX,
      camY,
      viewWidth,
      viewHeight,
      data.globalTimer
    );
  }

  // 7. Depth-Sorted 2.5D Objects & Characters
  interface Drawable {
    depth: number;
    draw: () => void;
  }
  const drawables: Drawable[] = [];

  // Building interior furniture & interior walls
  for (const b of data.buildings) {
    if (b.roofAlpha < 0.98) {
      for (const f of b.furniture) {
        drawables.push({
          depth: f.x + f.w * 0.5 + f.y + f.h * 0.5,
          draw: () => drawIsoFurniture(ctx, f, camX, camY, viewWidth, viewHeight),
        });
      }
    }
  }

  // Generator (Hospital Floors)
  if (data.generator) {
    const gen = data.generator;
    drawables.push({
      depth: gen.x + gen.y,
      draw: () => drawIsoGenerator(ctx, gen, camX, camY, viewWidth, viewHeight, data.globalTimer),
    });
  }

  // Obstacles (Cars, Trees, Hospital Interior Walls, AC Units)
  for (const obs of data.obstacles) {
    const p = worldToIso(obs.x + obs.w / 2, obs.y + obs.h / 2, 0, camX, camY, viewWidth, viewHeight);
    if (p.x < -180 || p.x > viewWidth + 180 || p.y < -180 || p.y > viewHeight + 180) continue;
    drawables.push({
      depth: obs.x + obs.w * 0.5 + obs.y + obs.h * 0.5,
      draw: () => drawIsoObstacle(ctx, obs, camX, camY, viewWidth, viewHeight, data.globalTimer),
    });
  }

  // Barrels
  for (const bar of data.barrels) {
    drawables.push({
      depth: bar.x + bar.y,
      draw: () => drawIsoBarrel(ctx, bar, camX, camY, viewWidth, viewHeight),
    });
  }

  // Dynamic City Fire Spots
  for (const fire of data.fires) {
    const p = worldToIso(fire.x, fire.y, 0, camX, camY, viewWidth, viewHeight);
    if (p.x < -120 || p.x > viewWidth + 120 || p.y < -120 || p.y > viewHeight + 120) continue;
    drawables.push({
      depth: fire.x + fire.y + 2,
      draw: () => drawIsoFireSpot(ctx, fire, camX, camY, viewWidth, viewHeight, data.globalTimer),
    });
  }

  // Outdoor 2.5D Streetlamp Poles
  for (const lamp of data.streetLamps) {
    if (lamp.isHospitalLamp) continue;
    const p = worldToIso(lamp.x, lamp.y, 0, camX, camY, viewWidth, viewHeight);
    if (p.x < -100 || p.x > viewWidth + 100 || p.y < -120 || p.y > viewHeight + 120) continue;
    drawables.push({
      depth: lamp.x + lamp.y,
      draw: () => drawIsoStreetLamp(ctx, lamp, camX, camY, viewWidth, viewHeight, data.globalTimer),
    });
  }

  // Pickups & Fuses
  for (const pk of data.pickups) {
    drawables.push({
      depth: pk.x + pk.y + 4,
      draw: () => drawIsoPickup(ctx, pk, camX, camY, viewWidth, viewHeight, data.globalTimer),
    });
  }

  // Army Truck (Waiting or Overturned)
  if (data.truckPos) {
    const tp = data.truckPos;
    const isUpright = data.playPhase === 'PHASE1_CITY' || data.playPhase === 'CUTSCENE_1_BRIDGE';
    drawables.push({
      depth: tp.x + tp.y,
      draw: () => {
        if (isUpright) {
          drawIsoArmyTruck(ctx, tp.x, tp.y, false, data.playPhase === 'PHASE1_CITY', camX, camY, viewWidth, viewHeight, data.globalTimer);
        } else {
          drawIsoArmyTruck(ctx, tp.x, tp.y, true, false, camX, camY, viewWidth, viewHeight, data.globalTimer);
        }
      },
    });
  }

  // Survivors, Police & Allied Soldier
  for (const s of data.survivors) {
    drawables.push({
      depth: s.x + s.y,
      draw: () => drawIsoSurvivor(ctx, s, camX, camY, viewWidth, viewHeight, data.globalTimer),
    });
  }

  // Protagonist Soldier
  if (data.playPhase !== 'CUTSCENE_3_FINALE' || data.player.z > -10) {
    drawables.push({
      depth: data.player.x + data.player.y,
      draw: () => drawIsoPlayer(ctx, data.player, data.gender, camX, camY, viewWidth, viewHeight),
    });
  }

  // Zombies
  for (const z of data.zombies) {
    const p = worldToIso(z.x, z.y, 0, camX, camY, viewWidth, viewHeight);
    if (p.x < -60 || p.x > viewWidth + 60 || p.y < -60 || p.y > viewHeight + 60) continue;
    drawables.push({
      depth: z.x + z.y,
      draw: () => drawIsoZombie(ctx, z, camX, camY, viewWidth, viewHeight, data.globalTimer),
    });
  }

  // Building Roofs & Front Walls (15% opacity when inside, 100% outside!)
  for (const b of data.buildings) {
    if (b.category === 'hospital_ext' && data.playPhase === 'PHASE2_HOSPITAL') continue;
    drawables.push({
      depth: b.x + b.w + b.y + b.h - 2,
      draw: () => drawBuildingFrontWallsAndRoof(ctx, b, camX, camY, viewWidth, viewHeight),
    });
  }

  drawables.sort((a, b) => a.depth - b.depth);
  for (const item of drawables) {
    item.draw();
  }

  // 8. Bullets & Particles
  for (const b of data.bullets) {
    const p = worldToIso(b.x, b.y, 12, camX, camY, viewWidth, viewHeight);
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, b.isFlame ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const pt of data.particles) {
    const p = worldToIso(pt.x, pt.y, pt.z || 8, camX, camY, viewWidth, viewHeight);
    ctx.fillStyle = pt.color;
    const r = Math.max(1.5, (pt.size * (pt.life / pt.maxLife)) * 0.65);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 9. Helicopter (Intro Rappel OR Rooftop Finale)
  if (data.helicopter) {
    drawIsoHelicopter(ctx, data.helicopter, camX, camY, viewWidth, viewHeight);
  }

  // 10. Dynamic Lighting & Shadows Layer
  renderIsoLighting(ctx, lightCtx, lightCanvas, camX, camY, viewWidth, viewHeight, data);

  // 10b. Atmospheric Night Rain & Distant Lightning (outdoors only)
  if (data.playPhase !== 'PHASE2_HOSPITAL') {
    drawNightStormOverlay(ctx, viewWidth, viewHeight, data.globalTimer);
  }

  // 11. Floating Combat/Pickup Texts
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  for (const ft of data.floatingTexts) {
    const p = worldToIso(ft.x, ft.y, 26, camX, camY, viewWidth, viewHeight);
    ctx.fillStyle = '#000000';
    ctx.fillText(ft.text, p.x + 1, p.y + 1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, p.x, p.y);
  }

  // 12. HUD & Radar (hidden during cutscenes & menu preview)
  if (!isMenuPreview && !data.cutsceneActive) {
    renderHud(ctx, viewWidth, viewHeight, data);
  }
}

function drawNightStormOverlay(
  ctx: CanvasRenderingContext2D,
  vw: number,
  vh: number,
  timer: number
) {
  // Subtle occasional distant purple-blue lightning flash (~every 9s)
  const cycle = timer % 9.5;
  if (cycle < 0.22) {
    const flashAlpha = (cycle < 0.08 || (cycle > 0.13 && cycle < 0.20)) ? 0.16 : 0.04;
    ctx.fillStyle = `rgba(148, 175, 255, ${flashAlpha})`;
    ctx.fillRect(0, 0, vw, vh);
  }

  // Diagonal animated pixel-art rain streaks
  ctx.strokeStyle = 'rgba(130, 175, 235, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const dropCount = 46;
  for (let i = 0; i < dropCount; i++) {
    const rx = ((i * 83 + timer * 170) % (vw + 120)) - 60;
    const ry = ((i * 137 + timer * 420) % (vh + 80)) - 40;
    ctx.moveTo(Math.round(rx), Math.round(ry));
    ctx.lineTo(Math.round(rx - 7), Math.round(ry + 14));
  }
  ctx.stroke();
}

function drawIsoGround(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  data: RenderContextData
) {
  const tl = isoToWorld(0, 0, camX, camY, vw, vh);
  const tr = isoToWorld(vw, 0, camX, camY, vw, vh);
  const bl = isoToWorld(0, vh, camX, camY, vw, vh);
  const br = isoToWorld(vw, vh, camX, camY, vw, vh);

  const minC = Math.max(0, Math.floor(Math.min(tl.x, tr.x, bl.x, br.x) / TILE_SIZE) - 1);
  const maxC = Math.min(Math.ceil(data.worldWidth / TILE_SIZE), Math.ceil(Math.max(tl.x, tr.x, bl.x, br.x) / TILE_SIZE) + 1);
  const minR = Math.max(0, Math.floor(Math.min(tl.y, tr.y, bl.y, br.y) / TILE_SIZE) - 1);
  const maxR = Math.min(Math.ceil(data.worldHeight / TILE_SIZE), Math.ceil(Math.max(tl.y, tr.y, bl.y, br.y) / TILE_SIZE) + 1);

  const isHospital = data.playPhase === 'PHASE2_HOSPITAL';
  const isRoof = data.playPhase === 'PHASE2_ROOFTOP' || data.playPhase === 'CUTSCENE_3_FINALE';

  for (let r = minR; r < maxR; r++) {
    for (let c = minC; c < maxC; c++) {
      const wx = c * TILE_SIZE;
      const wy = r * TILE_SIZE;
      const p0 = worldToIso(wx, wy, 0, camX, camY, vw, vh);
      const p1 = worldToIso(wx + TILE_SIZE, wy, 0, camX, camY, vw, vh);
      const p2 = worldToIso(wx + TILE_SIZE, wy + TILE_SIZE, 0, camX, camY, vw, vh);
      const p3 = worldToIso(wx, wy + TILE_SIZE, 0, camX, camY, vw, vh);

      let color = (c + r) % 2 === 0 ? PALETTE.asphalt : PALETTE.asphaltDark;
      if (isHospital) {
        color = (c + r) % 2 === 0 ? PALETTE.hospitalFloor : PALETTE.hospitalFloorAlt;
      } else if (isRoof) {
        color = (c + r) % 2 === 0 ? '#2f3542' : '#292f3b';
      } else if (r === 18 || r === 19 || r === 20 || c === 18 || c === 36) {
        color = (c + r) % 2 === 0 ? '#1d2330' : '#181e29';
      }

      drawIsoQuad(ctx, p0, p1, p2, p3, color);

      if (!isHospital && !isRoof && r === 19 && c % 2 === 0) {
        const l0 = worldToIso(wx + 10, wy + 2, 0, camX, camY, vw, vh);
        const l1 = worldToIso(wx + TILE_SIZE - 10, wy + 2, 0, camX, camY, vw, vh);
        const l2 = worldToIso(wx + TILE_SIZE - 10, wy + 6, 0, camX, camY, vw, vh);
        const l3 = worldToIso(wx + 10, wy + 6, 0, camX, camY, vw, vh);
        drawIsoQuad(ctx, l0, l1, l2, l3, '#c49d2b');
      }
      // Crosswalks at main street intersections
      if (!isHospital && !isRoof && (r === 18 || r === 20) && (c === 17 || c === 35 || c === 52)) {
        for (let stripe = 6; stripe < TILE_SIZE - 6; stripe += 12) {
          const s0 = worldToIso(wx + 4, wy + stripe, 0.2, camX, camY, vw, vh);
          const s1 = worldToIso(wx + TILE_SIZE - 4, wy + stripe, 0.2, camX, camY, vw, vh);
          const s2 = worldToIso(wx + TILE_SIZE - 4, wy + stripe + 6, 0.2, camX, camY, vw, vh);
          const s3 = worldToIso(wx + 4, wy + stripe + 6, 0.2, camX, camY, vw, vh);
          drawIsoQuad(ctx, s0, s1, s2, s3, 'rgba(226, 232, 240, 0.26)');
        }
      }
      // Storm drain / manhole cover details
      if (!isHospital && !isRoof && r === 18 && c % 7 === 2) {
        const mp = worldToIso(wx + 24, wy + 24, 0.3, camX, camY, vw, vh);
        ctx.fillStyle = '#0f131a';
        ctx.fillRect(mp.x - 5, mp.y - 3, 10, 6);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(mp.x - 5, mp.y - 3, 10, 6);
      }
    }
  }
}

function drawIsoRiver(
  ctx: CanvasRenderingContext2D,
  riverX: number,
  worldW: number,
  worldH: number,
  bridgeY: number,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  timer: number
) {
  const r0 = worldToIso(riverX, 0, -6, camX, camY, vw, vh);
  const r1 = worldToIso(worldW, 0, -6, camX, camY, vw, vh);
  const r2 = worldToIso(worldW, worldH, -6, camX, camY, vw, vh);
  const r3 = worldToIso(riverX, worldH, -6, camX, camY, vw, vh);
  drawIsoQuad(ctx, r0, r1, r2, r3, PALETTE.water);

  // Ripples
  for (let wy = 80; wy < worldH; wy += 90) {
    const wave = Math.sin(timer * 2 + wy * 0.04) * 18;
    const w0 = worldToIso(riverX + 40 + wave, wy, -5, camX, camY, vw, vh);
    const w1 = worldToIso(riverX + 95 + wave, wy, -5, camX, camY, vw, vh);
    ctx.strokeStyle = PALETTE.waterFoam;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w0.x, w0.y);
    ctx.lineTo(w1.x, w1.y);
    ctx.stroke();
  }

  // Isometric Bridge Deck
  const bh = 150;
  const by = bridgeY - bh / 2;
  drawIsoBox(
    ctx,
    riverX - 18,
    by,
    worldW - riverX + 18,
    bh,
    -6,
    8,
    camX,
    camY,
    vw,
    vh,
    PALETTE.bridgeDeck,
    '#3e4656',
    '#2a303b',
    false
  );
  // Bridge yellow center dashes
  for (let bx = riverX; bx < worldW - 30; bx += 64) {
    const d0 = worldToIso(bx, bridgeY - 3, 2, camX, camY, vw, vh);
    const d1 = worldToIso(bx + 32, bridgeY - 3, 2, camX, camY, vw, vh);
    const d2 = worldToIso(bx + 32, bridgeY + 3, 2, camX, camY, vw, vh);
    const d3 = worldToIso(bx, bridgeY + 3, 2, camX, camY, vw, vh);
    drawIsoQuad(ctx, d0, d1, d2, d3, '#e5b82e');
  }
}

function drawIsoHelipad(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  camX: number,
  camY: number,
  vw: number,
  vh: number
) {
  const s = 90;
  const p0 = worldToIso(hx - s, hy - s, 1, camX, camY, vw, vh);
  const p1 = worldToIso(hx + s, hy - s, 1, camX, camY, vw, vh);
  const p2 = worldToIso(hx + s, hy + s, 1, camX, camY, vw, vh);
  const p3 = worldToIso(hx - s, hy + s, 1, camX, camY, vw, vh);
  drawIsoQuad(ctx, p0, p1, p2, p3, PALETTE.heliPad, PALETTE.heliYellow);

  const c = worldToIso(hx, hy, 2, camX, camY, vw, vh);
  ctx.strokeStyle = PALETTE.heliYellow;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, 56, 28, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = 'bold 20px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.heliYellow;
  ctx.fillText('H', c.x, c.y + 7);
}

function drawIsoDecals(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  decals: Decal[]
) {
  for (const d of decals) {
    if (d.type === 'river') continue;
    if (d.type === 'sidewalk' && d.w && d.h) {
      drawIsoBox(
        ctx,
        d.x,
        d.y,
        d.w,
        d.h,
        0,
        3,
        camX,
        camY,
        vw,
        vh,
        PALETTE.sidewalk,
        PALETTE.sidewalkShadow,
        '#4b5466',
        false
      );
    } else if (d.type === 'park' && d.w && d.h) {
      drawIsoBox(
        ctx,
        d.x,
        d.y,
        d.w,
        d.h,
        0,
        3,
        camX,
        camY,
        vw,
        vh,
        PALETTE.grass,
        PALETTE.grassDark,
        PALETTE.grassLight,
        false
      );
    } else if (d.type === 'rubble') {
      const p = worldToIso(d.x, d.y, 1, camX, camY, vw, vh);
      if (p.x < -60 || p.x > vw + 60 || p.y < -60 || p.y > vh + 60) continue;
      const sz = d.size || 20;
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(Math.round(p.x - sz * 0.7), Math.round(p.y - 2), Math.round(sz * 1.4), 7);
      // Brick/concrete chunks
      ctx.fillStyle = '#475569';
      ctx.fillRect(Math.round(p.x - sz * 0.55), Math.round(p.y - 5), 7, 5);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 7), 8, 5);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(Math.round(p.x + sz * 0.15), Math.round(p.y - 4), 6, 4);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(Math.round(p.x - sz * 0.3), Math.round(p.y - 2), 5, 4);
    } else if (d.type === 'blood' || d.type === 'green_splat' || d.type === 'toxic_puddle' || d.type === 'crater') {
      const p = worldToIso(d.x, d.y, 0.5, camX, camY, vw, vh);
      if (p.x < -50 || p.x > vw + 50 || p.y < -50 || p.y > vh + 50) continue;
      ctx.fillStyle =
        d.type === 'toxic_puddle'
          ? 'rgba(56, 183, 100, 0.72)'
          : d.type === 'green_splat'
            ? 'rgba(88, 168, 70, 0.78)'
            : d.type === 'crater'
              ? 'rgba(15, 16, 22, 0.85)'
              : 'rgba(145, 18, 28, 0.76)';
      const rad = (d.size || 16) * 0.85;
      // Pixel-art splat blocks
      ctx.fillRect(Math.round(p.x - rad), Math.round(p.y - rad * 0.4), Math.round(rad * 2), Math.round(rad * 0.8));
      ctx.fillRect(Math.round(p.x - rad * 0.6), Math.round(p.y - rad * 0.6), Math.round(rad * 1.2), Math.round(rad * 1.2));
    }
  }
}

function drawBuildingFloorAndBackWalls(
  ctx: CanvasRenderingContext2D,
  b: Building,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  timer: number
) {
  const f0 = worldToIso(b.x, b.y, 1, camX, camY, vw, vh);
  const f1 = worldToIso(b.x + b.w, b.y, 1, camX, camY, vw, vh);
  const f2 = worldToIso(b.x + b.w, b.y + b.h, 1, camX, camY, vw, vh);
  const f3 = worldToIso(b.x, b.y + b.h, 1, camX, camY, vw, vh);
  drawIsoQuad(ctx, f0, f1, f2, f3, b.floorColor, '#0b0d14');

  // Detailed floor pattern: weathered wood planks (houses) vs square concrete/linoleum tiles (pharmacy/police)
  ctx.strokeStyle = b.floorAltColor;
  ctx.lineWidth = 1;
  if (b.category === 'house') {
    for (let px = b.x + 16; px < b.x + b.w - 8; px += 16) {
      const l0 = worldToIso(px, b.y + 4, 1.2, camX, camY, vw, vh);
      const l1 = worldToIso(px, b.y + b.h - 4, 1.2, camX, camY, vw, vh);
      ctx.beginPath();
      ctx.moveTo(l0.x, l0.y);
      ctx.lineTo(l1.x, l1.y);
      ctx.stroke();
    }
    // Staggered wood plank cross seams
    for (let px = b.x + 16; px < b.x + b.w - 20; px += 16) {
      const seamY = b.y + 28 + ((px * 13) % Math.max(40, b.h - 56));
      const s0 = worldToIso(px, seamY, 1.3, camX, camY, vw, vh);
      const s1 = worldToIso(px + 16, seamY, 1.3, camX, camY, vw, vh);
      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.stroke();
    }
  } else {
    for (let px = b.x + 24; px < b.x + b.w - 8; px += 24) {
      const l0 = worldToIso(px, b.y + 4, 1.2, camX, camY, vw, vh);
      const l1 = worldToIso(px, b.y + b.h - 4, 1.2, camX, camY, vw, vh);
      ctx.beginPath();
      ctx.moveTo(l0.x, l0.y);
      ctx.lineTo(l1.x, l1.y);
      ctx.stroke();
    }
    for (let py = b.y + 24; py < b.y + b.h - 8; py += 24) {
      const r0 = worldToIso(b.x + 4, py, 1.2, camX, camY, vw, vh);
      const r1 = worldToIso(b.x + b.w - 4, py, 1.2, camX, camY, vw, vh);
      ctx.beginPath();
      ctx.moveTo(r0.x, r0.y);
      ctx.lineTo(r1.x, r1.y);
      ctx.stroke();
    }
    // Scattered white paper sheets on police station floor (matching sprite sheet)
    if (b.category === 'police') {
      for (let i = 0; i < 6; i++) {
        const sx = b.x + 36 + ((i * 47) % (b.w - 72));
        const sy = b.y + 42 + ((i * 61) % (b.h - 84));
        const sp0 = worldToIso(sx, sy, 1.4, camX, camY, vw, vh);
        const sp1 = worldToIso(sx + 8, sy + 2, 1.4, camX, camY, vw, vh);
        const sp2 = worldToIso(sx + 6, sy + 10, 1.4, camX, camY, vw, vh);
        const sp3 = worldToIso(sx - 2, sy + 8, 1.4, camX, camY, vw, vh);
        drawIsoQuad(ctx, sp0, sp1, sp2, sp3, '#cbd5e1', '#475569');
      }
    }
  }

  if (b.safe && b.roofAlpha < 0.95) {
    ctx.strokeStyle = `rgba(56, 183, 100, ${0.45 + Math.sin(timer * 4) * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(f0.x, f0.y);
    ctx.lineTo(f1.x, f1.y);
    ctx.lineTo(f2.x, f2.y);
    ctx.lineTo(f3.x, f3.y);
    ctx.closePath();
    ctx.stroke();
  }

  // Concrete front porch step & doorway threshold (matching sprite sheets)
  for (const d of b.doorways) {
    const isBottom = Math.abs(d.y - (b.y + b.h - 10)) < 4;
    const isTop = Math.abs(d.y - b.y) < 4;
    const isRight = Math.abs(d.x - (b.x + b.w - 10)) < 4;
    const stepX = isRight ? d.x + 10 : d.x - 2;
    const stepY = isBottom ? d.y + 10 : isTop ? d.y - 16 : d.y - 2;
    const stepW = isBottom || isTop ? d.w + 4 : 16;
    const stepH = isBottom || isTop ? 16 : d.h + 4;
    drawIsoBox(ctx, stepX, stepY, stepW, stepH, 0, 5, camX, camY, vw, vh, '#838b99', '#5e6573', '#434954', false);

    const d0 = worldToIso(d.x, d.y, 2, camX, camY, vw, vh);
    const d1 = worldToIso(d.x + d.w, d.y, 2, camX, camY, vw, vh);
    const d2 = worldToIso(d.x + d.w, d.y + d.h, 2, camX, camY, vw, vh);
    const d3 = worldToIso(d.x, d.y + d.h, 2, camX, camY, vw, vh);
    const doorFill = b.category === 'pharmacy' ? '#73eff7' : b.category === 'police' ? '#475569' : '#6e4526';
    drawIsoQuad(ctx, d0, d1, d2, d3, doorFill, '#1b1d24');
  }

  const wallH = 44;
  for (const w of b.walls) {
    const isFrontWall =
      Math.abs(w.y - (b.y + b.h - 10)) < 2 || Math.abs(w.x - (b.x + b.w - 10)) < 2;
    if (isFrontWall) continue;
    const isInteriorPartition = w.x > b.x + 14 && w.y > b.y + 4 && w.w < 14;
    drawIsoBox(
      ctx,
      w.x,
      w.y,
      w.w,
      w.h,
      0,
      wallH,
      camX,
      camY,
      vw,
      vh,
      isInteriorPartition ? '#754c2c' : b.roofTrim,
      isInteriorPartition ? '#59371f' : b.wallColor,
      isInteriorPartition ? '#3d2514' : '#241c24',
      false
    );
  }
}

function drawIsoLitWindow(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  z: number,
  wSpan: number,
  hSpan: number,
  onBottomWall: boolean,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  glassColor = '#ffdf6b'
) {
  const p0 = worldToIso(wx, wy, z, camX, camY, vw, vh);
  const p1 = onBottomWall
    ? worldToIso(wx + wSpan, wy, z, camX, camY, vw, vh)
    : worldToIso(wx, wy + wSpan, z, camX, camY, vw, vh);
  const p2 = onBottomWall
    ? worldToIso(wx + wSpan, wy, z + hSpan, camX, camY, vw, vh)
    : worldToIso(wx, wy + wSpan, z + hSpan, camX, camY, vw, vh);
  const p3 = worldToIso(wx, wy, z + hSpan, camX, camY, vw, vh);
  drawIsoQuad(ctx, p0, p1, p2, p3, glassColor, '#0b0d14', 1.5);
  // Window cross mullion bar
  ctx.strokeStyle = '#2d241c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
  ctx.lineTo((p3.x + p2.x) / 2, (p3.y + p2.y) / 2);
  ctx.moveTo((p0.x + p3.x) / 2, (p0.y + p3.y) / 2);
  ctx.lineTo((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  ctx.stroke();
}

function drawBuildingFrontWallsAndRoof(
  ctx: CanvasRenderingContext2D,
  b: Building,
  camX: number,
  camY: number,
  vw: number,
  vh: number
) {
  ctx.save();
  // NEVER disappear completely: 15% opacity inside, 100% outside!
  ctx.globalAlpha = b.roofAlpha;

  const wallH = 44;
  for (const w of b.walls) {
    const isFrontWall =
      Math.abs(w.y - (b.y + b.h - 10)) < 2 || Math.abs(w.x - (b.x + b.w - 10)) < 2;
    if (!isFrontWall) continue;
    drawIsoBox(
      ctx,
      w.x,
      w.y,
      w.w,
      w.h,
      0,
      wallH,
      camX,
      camY,
      vw,
      vh,
      b.roofTrim,
      b.wallColor,
      '#24202b',
      false
    );
  }

  // Pixel brick horizontal mortar lines & lit windows on front walls
  if (b.category !== 'hospital_ext') {
    for (let zLine = 9; zLine < wallH; zLine += 9) {
      const a = worldToIso(b.x, b.y + b.h, zLine, camX, camY, vw, vh);
      const c = worldToIso(b.x + b.w, b.y + b.h, zLine, camX, camY, vw, vh);
      const d = worldToIso(b.x + b.w, b.y, zLine, camX, camY, vw, vh);
      ctx.strokeStyle = 'rgba(10, 12, 18, 0.36)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }

    const winColor = b.category === 'pharmacy' ? '#7dd3fc' : b.category === 'police' ? '#fde68a' : '#ffdf6b';
    drawIsoLitWindow(ctx, b.x + 26, b.y + b.h + 0.5, 16, 22, 16, true, camX, camY, vw, vh, winColor);
    drawIsoLitWindow(ctx, b.x + b.w - 48, b.y + b.h + 0.5, 16, 22, 16, true, camX, camY, vw, vh, winColor);
    drawIsoLitWindow(ctx, b.x + b.w + 0.5, b.y + 26, 16, 22, 16, false, camX, camY, vw, vh, winColor);
    drawIsoLitWindow(ctx, b.x + b.w + 0.5, b.y + b.h - 48, 16, 22, 16, false, camX, camY, vw, vh, winColor);
  }

  // Category-specific Roof & Architectural Details inspired by the 7 sprite sheets!
  if (b.category === 'house') {
    // Pitched shingled gable roof + wooden gable ends + corner gutter pipe
    const ov = 6;
    const x0 = b.x - ov;
    const x1 = b.x + b.w + ov;
    const y0 = b.y - ov;
    const y1 = b.y + b.h + ov;
    const midY = (y0 + y1) / 2;
    const eaveZ = wallH;
    const ridgeZ = wallH + 26;

    const e00 = worldToIso(x0, y0, eaveZ, camX, camY, vw, vh);
    const e10 = worldToIso(x1, y0, eaveZ, camX, camY, vw, vh);
    const e11 = worldToIso(x1, y1, eaveZ, camX, camY, vw, vh);
    const e01 = worldToIso(x0, y1, eaveZ, camX, camY, vw, vh);
    const r0 = worldToIso(x0, midY, ridgeZ, camX, camY, vw, vh);
    const r1 = worldToIso(x1, midY, ridgeZ, camX, camY, vw, vh);

    // Back roof slope
    drawIsoQuad(ctx, e00, e10, r1, r0, '#3e2c24', '#0b0d14', 1.5);
    // Front roof slope
    drawIsoQuad(ctx, r0, r1, e11, e01, '#543c32', '#0b0d14', 1.5);
    // Front-right wooden gable triangle
    ctx.beginPath();
    ctx.moveTo(e10.x, e10.y);
    ctx.lineTo(e11.x, e11.y);
    ctx.lineTo(r1.x, r1.y);
    ctx.closePath();
    ctx.fillStyle = '#5c3c28';
    ctx.fill();
    ctx.strokeStyle = '#0b0d14';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Shingle horizontal row lines on front slope
    ctx.strokeStyle = 'rgba(18, 12, 10, 0.52)';
    ctx.lineWidth = 1;
    for (let t = 0.2; t <= 0.8; t += 0.2) {
      const sx0 = worldToIso(x0, midY + (y1 - midY) * t, ridgeZ - 26 * t, camX, camY, vw, vh);
      const sx1 = worldToIso(x1, midY + (y1 - midY) * t, ridgeZ - 26 * t, camX, camY, vw, vh);
      ctx.beginPath();
      ctx.moveTo(sx0.x, sx0.y);
      ctx.lineTo(sx1.x, sx1.y);
      ctx.stroke();
    }

    // Metal corner gutter pipe
    const gTop = worldToIso(b.x + b.w + 1, b.y + b.h + 1, wallH, camX, camY, vw, vh);
    const gBot = worldToIso(b.x + b.w + 1, b.y + b.h + 1, 2, camX, camY, vw, vh);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gTop.x, gTop.y);
    ctx.lineTo(gBot.x, gBot.y);
    ctx.stroke();
  } else if (b.category === 'pharmacy') {
    // Teal parapet trim + flat concrete roof + glowing green '+' cross
    drawIsoBox(ctx, b.x - 4, b.y - 4, b.w + 8, b.h + 8, wallH, 10, camX, camY, vw, vh, '#6d7785', '#36a892', '#237364', false);
    drawIsoBox(ctx, b.x + 6, b.y + 6, b.w - 12, b.h - 12, wallH + 10, 2, camX, camY, vw, vh, '#555e6b', '#414954', '#2e343d', false);

    // Glowing Green Pixel '+' Cross Sign on front-right corner
    const crossP = worldToIso(b.x + b.w + 2, b.y + b.h - 16, wallH + 5, camX, camY, vw, vh);
    ctx.fillStyle = '#090d12';
    ctx.fillRect(crossP.x - 4, crossP.y - 10, 8, 20);
    ctx.fillRect(crossP.x - 10, crossP.y - 4, 20, 8);
    ctx.fillStyle = '#38e57d';
    ctx.fillRect(crossP.x - 3, crossP.y - 9, 6, 18);
    ctx.fillRect(crossP.x - 9, crossP.y - 3, 18, 6);
  } else if (b.category === 'police') {
    // Blue-grey parapet roof + Twin metallic AC units + Gold Police Badge + PD Stencil
    drawIsoBox(ctx, b.x - 4, b.y - 4, b.w + 8, b.h + 8, wallH, 9, camX, camY, vw, vh, '#434e61', '#3b4a69', '#273247', false);
    // Twin AC units on roof
    drawIsoBox(ctx, b.x + 28, b.y + 24, 28, 24, wallH + 9, 10, camX, camY, vw, vh, '#94a3b8', '#64748b', '#475569', false);
    drawIsoBox(ctx, b.x + 70, b.y + 24, 28, 24, wallH + 9, 10, camX, camY, vw, vh, '#94a3b8', '#64748b', '#475569', false);

    // Gold Star-Shield Emblem centered on front facade
    const badgeP = worldToIso(b.x + b.w * 0.5, b.y + b.h + 1, wallH - 4, camX, camY, vw, vh);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(badgeP.x, badgeP.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', badgeP.x, badgeP.y + 3.5);

    // PD stencil on right wall
    const pdP = worldToIso(b.x + b.w + 1, b.y + b.h * 0.52, wallH * 0.55, camX, camY, vw, vh);
    ctx.fillStyle = 'rgba(203, 213, 225, 0.72)';
    ctx.font = 'bold 10px "Press Start 2P", monospace';
    ctx.fillText('PD', pdP.x, pdP.y);
  } else {
    // Hospital Exterior
    drawIsoBox(ctx, b.x - 4, b.y - 4, b.w + 8, b.h + 8, wallH, 10, camX, camY, vw, vh, b.roofColor, b.roofTrim, '#221c24', false);
    const hCross = worldToIso(b.x + 2, b.y + b.h * 0.5, wallH + 2, camX, camY, vw, vh);
    ctx.fillStyle = '#e43b44';
    ctx.fillRect(hCross.x - 4, hCross.y - 12, 8, 24);
    ctx.fillRect(hCross.x - 12, hCross.y - 4, 24, 8);
  }

  // Building Nameplate
  const labelPos = worldToIso(b.x + b.w / 2, b.y + b.h / 2, wallH + 30, camX, camY, vw, vh);
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10, 12, 20, 0.9)';
  ctx.fillRect(labelPos.x - 48, labelPos.y - 10, 96, 15);
  ctx.strokeStyle = b.roofTrim;
  ctx.lineWidth = 1;
  ctx.strokeRect(labelPos.x - 48, labelPos.y - 10, 96, 15);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(b.label, labelPos.x, labelPos.y + 1);

  ctx.restore();
}

function drawIsoFurniture(
  ctx: CanvasRenderingContext2D,
  f: FurnitureItem,
  camX: number,
  camY: number,
  vw: number,
  vh: number
) {
  switch (f.kind) {
    case 'bed':
      // Wooden bed frame + headboard + olive/grey blanket + white pillow
      drawIsoBox(ctx, f.x, f.y, f.w, f.h, 0, 6, camX, camY, vw, vh, '#6e472b', '#4f321d', '#382213', false);
      drawIsoBox(ctx, f.x + 2, f.y + 2, f.w - 4, f.h - 4, 6, 5, camX, camY, vw, vh, f.color || '#8f937a', '#686b57', '#4f5241', false);
      drawIsoBox(ctx, f.x, f.y, 4, f.h, 6, 10, camX, camY, vw, vh, '#784e30', '#54351f', '#3d2616', false);
      drawIsoBox(ctx, f.x + 5, f.y + 4, 10, f.h - 8, 11, 3, camX, camY, vw, vh, '#f1f5f9', '#cbd5e1', '#94a3b8', false);
      break;
    case 'table':
      drawIsoBox(ctx, f.x + 2, f.y + 2, f.w - 4, f.h - 4, 0, 8, camX, camY, vw, vh, '#5c3a21', '#422816', '#331e10', false);
      drawIsoBox(ctx, f.x, f.y, f.w, f.h, 8, 4, camX, camY, vw, vh, '#8f5936', '#6b4226', '#54321c', false);
      break;
    case 'sofa':
      drawIsoBox(ctx, f.x, f.y, f.w, f.h, 0, 9, camX, camY, vw, vh, f.color || '#8f3038', '#691c22', '#471216', false);
      drawIsoBox(ctx, f.x, f.y, f.w, 6, 9, 7, camX, camY, vw, vh, '#ad3e47', '#691c22', '#471216', false);
      break;
    case 'counter':
      // Pharmacy glass display counter + small metallic cash register
      drawIsoBox(ctx, f.x, f.y, f.w, f.h, 0, 12, camX, camY, vw, vh, '#bae6fd', f.color || '#2e8a77', '#1e5e51', false);
      drawIsoBox(ctx, f.x + 8, f.y + 3, 12, 10, 12, 6, camX, camY, vw, vh, '#94a3b8', '#64748b', '#475569', false);
      break;
    case 'desk':
      // Police / Hospital wooden desk + CRT monitor on top
      drawIsoBox(ctx, f.x, f.y, f.w, f.h, 0, 12, camX, camY, vw, vh, '#855331', '#633c22', '#472a16', false);
      drawIsoBox(ctx, f.x + f.w * 0.55, f.y + 4, 14, 12, 12, 10, camX, camY, vw, vh, '#cbd5e1', '#38bdf8', '#475569', false);
      break;
    case 'shelf':
      drawIsoBox(ctx, f.x, f.y, f.w, f.h, 0, 22, camX, camY, vw, vh, '#784e30', '#59371f', '#3d2514', false);
      // Stocked colorful medicine bottles on top
      drawIsoBox(ctx, f.x + 5, f.y + 4, 6, 6, 22, 6, camX, camY, vw, vh, '#e43b44', '#a22633', '#731922', false);
      drawIsoBox(ctx, f.x + 15, f.y + 4, 6, 6, 22, 6, camX, camY, vw, vh, '#38b764', '#236e48', '#174a30', false);
      drawIsoBox(ctx, f.x + 25, f.y + 4, 6, 6, 22, 6, camX, camY, vw, vh, '#73eff7', '#2b869e', '#1a596b', false);
      drawIsoBox(ctx, f.x + 35, f.y + 4, 6, 6, 22, 6, camX, camY, vw, vh, '#ffcd75', '#b88224', '#7a5413', false);
      break;
    case 'locker':
      drawIsoBox(ctx, f.x, f.y, f.w, f.h, 0, 26, camX, camY, vw, vh, '#94a3b8', f.color || '#64748b', '#334155', false);
      break;
    case 'cabinet':
      // Wooden dresser / chest of drawers
      drawIsoBox(ctx, f.x, f.y, f.w, f.h, 0, 18, camX, camY, vw, vh, '#8c5835', '#6b4125', '#4d2d18', false);
      break;
    case 'gurney':
    case 'operating_table':
      drawIsoBox(ctx, f.x, f.y, f.w, f.h, 0, 11, camX, camY, vw, vh, '#f1f5f9', '#94a3b8', '#64748b', false);
      break;
    case 'monitor':
      drawIsoBox(ctx, f.x, f.y, f.w, f.h, 0, 18, camX, camY, vw, vh, '#38b764', '#1e293b', '#0f172a', false);
      break;
    case 'chairs':
      for (let cx = f.x; cx < f.x + f.w - 14; cx += 22) {
        drawIsoBox(ctx, cx, f.y, 16, 16, 0, 10, camX, camY, vw, vh, '#3b5dc9', '#243678', '#182452', false);
      }
      break;
  }
}

function drawIsoGenerator(
  ctx: CanvasRenderingContext2D,
  gen: GeneratorObject,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  timer: number
) {
  drawIsoBox(
    ctx,
    gen.x - 16,
    gen.y - 12,
    32,
    24,
    0,
    22,
    camX,
    camY,
    vw,
    vh,
    '#8892a3',
    '#5c6675',
    '#3e4652',
    true
  );
  // Dark cooling vent panel & status LED gauge on front face
  const gP = worldToIso(gen.x - 4, gen.y + 12.5, 11, camX, camY, vw, vh);
  ctx.fillStyle = '#181c24';
  ctx.fillRect(Math.round(gP.x - 9), Math.round(gP.y - 5), 18, 10);
  ctx.fillStyle = gen.activated ? '#38e57d' : '#f59e0b';
  ctx.fillRect(Math.round(gP.x - 7), Math.round(gP.y - 3), 5, 4);
  ctx.fillStyle = gen.activated ? '#73eff7' : '#e43b44';
  ctx.fillRect(Math.round(gP.x), Math.round(gP.y - 3), 6, 4);

  const p = worldToIso(gen.x, gen.y, 26, camX, camY, vw, vh);
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  ctx.fillText(
    gen.activated ? 'ENERGIA ON' : `GERADOR ${gen.fusesInserted}/${gen.fusesRequired}`,
    p.x + 1,
    p.y - 7
  );
  ctx.fillStyle = gen.activated ? '#38b764' : '#ffcd75';
  ctx.fillText(
    gen.activated ? 'ENERGIA ON' : `GERADOR ${gen.fusesInserted}/${gen.fusesRequired}`,
    p.x,
    p.y - 8
  );

  if (!gen.activated) {
    const ground = worldToIso(gen.x, gen.y, 1, camX, camY, vw, vh);
    ctx.strokeStyle = `rgba(255, 205, 117, ${0.45 + Math.sin(timer * 6) * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ground.x, ground.y, 26, 13, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawIsoPortal(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  color: string,
  label: string,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  timer: number
) {
  const p0 = worldToIso(rect.x, rect.y, 2, camX, camY, vw, vh);
  const p1 = worldToIso(rect.x + rect.w, rect.y, 2, camX, camY, vw, vh);
  const p2 = worldToIso(rect.x + rect.w, rect.y + rect.h, 2, camX, camY, vw, vh);
  const p3 = worldToIso(rect.x, rect.y + rect.h, 2, camX, camY, vw, vh);

  ctx.save();
  ctx.globalAlpha = 0.35 + Math.sin(timer * 5) * 0.15;
  drawIsoQuad(ctx, p0, p1, p2, p3, color);
  ctx.restore();

  const c = worldToIso(rect.x + rect.w / 2, rect.y + rect.h / 2, 24, camX, camY, vw, vh);
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  ctx.fillText(label, c.x + 1, c.y + 1);
  ctx.fillStyle = color;
  ctx.fillText(label, c.x, c.y);
}

function drawIsoObstacle(
  ctx: CanvasRenderingContext2D,
  obs: Obstacle,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  timer: number
) {
  if (obs.type === 'wall') {
    drawIsoBox(
      ctx,
      obs.x,
      obs.y,
      obs.w,
      obs.h,
      0,
      36,
      camX,
      camY,
      vw,
      vh,
      PALETTE.hospitalWallTop,
      PALETTE.hospitalWall,
      PALETTE.hospitalWallRight,
      false
    );
  } else if (obs.type === 'ac_unit') {
    drawIsoBox(ctx, obs.x, obs.y, obs.w, obs.h, 0, 22, camX, camY, vw, vh, '#94a3b8', '#64748b', '#475569', true);
  } else if (obs.type === 'tree') {
    // Trunk
    drawIsoBox(ctx, obs.x + 7, obs.y + 7, 10, 10, 0, 16, camX, camY, vw, vh, '#5c3a21', '#422816', '#2d1a0e', true);
    // Layered Canopy
    drawIsoBox(ctx, obs.x - 4, obs.y - 4, 32, 32, 14, 16, camX, camY, vw, vh, '#386e3e', '#264d2b', '#18331c', false);
    drawIsoBox(ctx, obs.x + 2, obs.y + 2, 20, 20, 30, 10, camX, camY, vw, vh, '#4c8c53', '#386e3e', '#264d2b', false);
  } else if (obs.type === 'car') {
    const variant = obs.carVariant || 'sedan';
    const isPolice = variant === 'police';
    const isSuv = variant === 'suv';
    const baseCol = isPolice ? '#1e293b' : obs.color || '#b82535';
    const bodyCol = obs.burning ? '#32343d' : baseCol;
    const cabinTop = obs.burning ? '#2a2c34' : isPolice ? '#e2e8f0' : baseCol;

    // Tires underneath
    if (obs.horizontal) {
      drawIsoBox(ctx, obs.x + 6, obs.y - 2, 10, obs.h + 4, 0, 7, camX, camY, vw, vh, '#181a20', '#101217', '#08090c', false);
      drawIsoBox(ctx, obs.x + obs.w - 16, obs.y - 2, 10, obs.h + 4, 0, 7, camX, camY, vw, vh, '#181a20', '#101217', '#08090c', false);
    } else {
      drawIsoBox(ctx, obs.x - 2, obs.y + 6, obs.w + 4, 10, 0, 7, camX, camY, vw, vh, '#181a20', '#101217', '#08090c', false);
      drawIsoBox(ctx, obs.x - 2, obs.y + obs.h - 16, obs.w + 4, 10, 0, 7, camX, camY, vw, vh, '#181a20', '#101217', '#08090c', false);
    }

    // Lower chassis & front/rear chrome bumpers
    drawIsoBox(ctx, obs.x, obs.y, obs.w, obs.h, 3, isSuv ? 13 : 11, camX, camY, vw, vh, bodyCol, '#262b38', '#181c26', true);
    if (isPolice && !obs.burning) {
      // White police cruiser doors strip
      if (obs.horizontal) {
        drawIsoBox(ctx, obs.x + obs.w * 0.25, obs.y - 0.5, obs.w * 0.5, obs.h + 1, 5, 8, camX, camY, vw, vh, '#e2e8f0', '#cbd5e1', '#94a3b8', false);
      } else {
        drawIsoBox(ctx, obs.x - 0.5, obs.y + obs.h * 0.25, obs.w + 1, obs.h * 0.5, 5, 8, camX, camY, vw, vh, '#e2e8f0', '#cbd5e1', '#94a3b8', false);
      }
    }

    // Cabin roof & dark cracked glass
    const cw = obs.horizontal ? (isSuv ? obs.w * 0.72 : obs.w * 0.54) : obs.w - 6;
    const ch = obs.horizontal ? obs.h - 6 : (isSuv ? obs.h * 0.72 : obs.h * 0.54);
    const cx = obs.x + (obs.w - cw) * (isSuv ? 0.35 : 0.45);
    const cy = obs.y + (obs.h - ch) * 0.5;
    const baseH = isSuv ? 16 : 14;
    const cabH = isSuv ? 12 : 9;
    drawIsoBox(ctx, cx, cy, cw, ch, baseH, cabH, camX, camY, vw, vh, cabinTop, '#1b2638', '#111824', false);

    // Police alternating Red/Blue Lightbar OR SUV Roof Rack + Spare Tire
    if (isPolice) {
      const strobe = Math.sin(timer * 14 + obs.x) > 0;
      const barW = obs.horizontal ? 8 : 16;
      const barH = obs.horizontal ? 16 : 8;
      drawIsoBox(
        ctx,
        cx + cw * 0.42,
        cy + ch * 0.5 - barH * 0.5,
        barW,
        barH,
        baseH + cabH,
        4,
        camX,
        camY,
        vw,
        vh,
        strobe ? '#ef4444' : '#3b82f6',
        strobe ? '#b91c1c' : '#1d4ed8',
        strobe ? '#3b82f6' : '#ef4444',
        false
      );
    } else if (isSuv) {
      drawIsoBox(ctx, cx + 4, cy + 4, cw - 8, ch - 8, baseH + cabH, 2, camX, camY, vw, vh, '#475569', '#334155', '#1e293b', false);
      // Rear spare tire
      if (obs.horizontal) {
        drawIsoBox(ctx, obs.x - 4, obs.y + obs.h * 0.3, 5, obs.h * 0.4, 8, 12, camX, camY, vw, vh, '#181a20', '#0f1218', '#090b0f', false);
      }
    }

    // Dim headlights & red taillights
    const hl = worldToIso(obs.x + (obs.horizontal ? obs.w : obs.w * 0.25), obs.y + (obs.horizontal ? obs.h * 0.25 : obs.h), 8, camX, camY, vw, vh);
    const tl = worldToIso(obs.x + (obs.horizontal ? 0 : obs.w * 0.75), obs.y + (obs.horizontal ? obs.h * 0.8 : 0), 8, camX, camY, vw, vh);
    ctx.fillStyle = obs.burning ? '#334155' : '#fef08a';
    ctx.fillRect(Math.round(hl.x - 2), Math.round(hl.y - 2), 4, 3);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(Math.round(tl.x - 2), Math.round(tl.y - 2), 4, 3);

    if (obs.burning) {
      const fp = worldToIso(obs.x + obs.w * 0.65, obs.y + obs.h * 0.5, 22, camX, camY, vw, vh);
      const fPulse = Math.sin(timer * 20 + obs.x);
      // Rising dark smoke puffs
      const smokeY = fp.y - 12 - ((timer * 24 + obs.x) % 18);
      ctx.fillStyle = 'rgba(34, 38, 48, 0.78)';
      ctx.fillRect(Math.round(fp.x - 6), Math.round(smokeY), 12, 9);
      ctx.fillRect(Math.round(fp.x - 2), Math.round(smokeY - 7), 9, 7);
      // Layered pixel fire blocks + flying sparks
      ctx.fillStyle = '#e43b44';
      ctx.fillRect(Math.round(fp.x - 7), Math.round(fp.y - 6), 14, 9);
      ctx.fillStyle = fPulse > 0 ? '#f77622' : '#ff9f43';
      ctx.fillRect(Math.round(fp.x - 5), Math.round(fp.y - 12), 10, 10);
      ctx.fillStyle = '#ffcd75';
      ctx.fillRect(Math.round(fp.x - 2), Math.round(fp.y - 9), 5, 6);
      const spY = fp.y - 10 - ((timer * 38 + obs.y) % 22);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(Math.round(fp.x + Math.sin(timer * 9 + obs.x) * 6), Math.round(spY), 2, 2);
    }
  }
}

function drawIsoFireSpot(
  ctx: CanvasRenderingContext2D,
  fire: FireSpot,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  timer: number
) {
  const p = worldToIso(fire.x, fire.y, 1, camX, camY, vw, vh);
  const pulse = Math.sin(timer * 18 + fire.seed);
  const pulse2 = Math.cos(timer * 13 + fire.seed * 1.7);

  // Scorched char & glowing ember pit
  ctx.fillStyle = 'rgba(12, 10, 14, 0.82)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(234, 88, 12, 0.42)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 11, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Charred wood/debris logs
  ctx.fillStyle = '#291d18';
  ctx.fillRect(Math.round(p.x - 9), Math.round(p.y - 2), 18, 4);
  ctx.fillRect(Math.round(p.x - 4), Math.round(p.y - 4), 8, 6);

  // Rising smoke plumes
  const sm1 = ((timer * 26 + fire.seed * 5) % 28);
  const sm2 = ((timer * 26 + fire.seed * 5 + 14) % 28);
  ctx.fillStyle = `rgba(38, 42, 52, ${(0.65 - sm1 / 46).toFixed(2)})`;
  ctx.fillRect(Math.round(p.x - 5 + Math.sin(timer * 3 + fire.seed) * 3), Math.round(p.y - 16 - sm1), 10, 8);
  ctx.fillStyle = `rgba(48, 52, 64, ${(0.55 - sm2 / 52).toFixed(2)})`;
  ctx.fillRect(Math.round(p.x - 3 - Math.cos(timer * 2.5 + fire.seed) * 3), Math.round(p.y - 16 - sm2), 8, 7);

  // Multi-tongue animated pixel fire
  const h1 = 12 + Math.round(pulse * 4);
  const h2 = 16 + Math.round(pulse2 * 5);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(Math.round(p.x - 9), Math.round(p.y - h1), 18, h1);
  ctx.fillStyle = '#f97316';
  ctx.fillRect(Math.round(p.x - 6), Math.round(p.y - h2), 12, h2 - 1);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - Math.max(6, h2 - 5)), 6, Math.max(5, h2 - 6));
  ctx.fillStyle = '#fef9c3';
  ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 5), 3, 4);

  // Flying sparks
  const sparkY = p.y - 14 - ((timer * 42 + fire.seed * 11) % 24);
  const sparkX = p.x + Math.sin(timer * 7 + fire.seed) * 7;
  ctx.fillStyle = '#fde047';
  ctx.fillRect(Math.round(sparkX), Math.round(sparkY), 2, 2);
}

function drawIsoStreetLamp(
  ctx: CanvasRenderingContext2D,
  lamp: StreetLamp,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  timer: number
) {
  const base = worldToIso(lamp.x, lamp.y, 0, camX, camY, vw, vh);
  const top = worldToIso(lamp.x, lamp.y, 56, camX, camY, vw, vh);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(base.x + 3, base.y + 1, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pole base & vertical iron shaft
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(Math.round(base.x - 3), Math.round(base.y - 6), 6, 6);
  ctx.fillStyle = '#334155';
  ctx.fillRect(Math.round(top.x - 1.5), Math.round(top.y), 3, Math.round(base.y - top.y));

  // Lamp arm & housing
  ctx.fillStyle = '#475569';
  ctx.fillRect(Math.round(top.x - 2), Math.round(top.y - 2), 11, 3);
  const lit = !lamp.broken && Math.sin(timer * 18 + lamp.flickerSeed) <= 0.92;
  ctx.fillStyle = lit ? '#fef08a' : '#1e293b';
  ctx.fillRect(Math.round(top.x + 5), Math.round(top.y + 1), 5, 3);
}

function drawIsoBarrel(
  ctx: CanvasRenderingContext2D,
  bar: Barrel,
  camX: number,
  camY: number,
  vw: number,
  vh: number
) {
  const p = worldToIso(bar.x, bar.y, 0, camX, camY, vw, vh);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(p.x + 3, p.y + 1, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#c9242b';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 7, 7, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffcd75';
  ctx.fillRect(p.x - 6, p.y - 9, 12, 3);
  ctx.fillStyle = '#ff6b72';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 14, 7, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawIsoPickup(
  ctx: CanvasRenderingContext2D,
  pk: Pickup,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  timer: number
) {
  const hover = Math.sin(pk.bob + timer * 3.5) * 2.5;
  const p = worldToIso(pk.x, pk.y, pk.z + hover, camX, camY, vw, vh);
  const shadow = worldToIso(pk.x, pk.y, pk.z, camX, camY, vw, vh);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(shadow.x, shadow.y, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (pk.type === 'fuse') {
    // Glowing Yellow Fuse
    ctx.fillStyle = '#ffcd75';
    ctx.fillRect(p.x - 5, p.y - 7, 10, 12);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(p.x - 5, p.y - 7, 10, 3);
    ctx.fillRect(p.x - 5, p.y + 2, 10, 3);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - 5, p.y - 7, 10, 12);
  } else if (pk.type.startsWith('crate_')) {
    const wDef = WEAPONS.find((w) => w.id === pk.weaponId);
    drawIsoBox(
      ctx,
      pk.x - 8,
      pk.y - 6,
      16,
      12,
      pk.z + hover,
      9,
      camX,
      camY,
      vw,
      vh,
      wDef ? wDef.color : '#ffcd75',
      '#4f663a',
      '#354527',
      false
    );
  } else if (pk.type === 'medkit') {
    drawIsoBox(
      ctx,
      pk.x - 6,
      pk.y - 5,
      12,
      10,
      pk.z + hover,
      7,
      camX,
      camY,
      vw,
      vh,
      '#ffffff',
      '#cbd5e1',
      '#94a3b8',
      false
    );
    ctx.fillStyle = '#e43b44';
    ctx.fillRect(p.x - 1.5, p.y - 9, 3, 6);
    ctx.fillRect(p.x - 3, p.y - 7.5, 6, 3);
  } else {
    drawIsoBox(
      ctx,
      pk.x - 6,
      pk.y - 5,
      12,
      10,
      pk.z + hover,
      7,
      camX,
      camY,
      vw,
      vh,
      '#ffcd75',
      '#2e6f40',
      '#1e4d2b',
      false
    );
  }
}

function drawIsoArmyTruck(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  overturned: boolean,
  showBoardPad: boolean,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  timer: number
) {
  if (showBoardPad) {
    const pad0 = worldToIso(tx - 92, ty - 42, 1, camX, camY, vw, vh);
    const pad1 = worldToIso(tx - 42, ty - 42, 1, camX, camY, vw, vh);
    const pad2 = worldToIso(tx - 42, ty + 42, 1, camX, camY, vw, vh);
    const pad3 = worldToIso(tx - 92, ty + 42, 1, camX, camY, vw, vh);
    drawIsoQuad(ctx, pad0, pad1, pad2, pad3, `rgba(56, 183, 100, ${0.35 + Math.sin(timer * 6) * 0.15})`, '#38b764');
    const lp = worldToIso(tx - 66, ty, 42, camX, camY, vw, vh);
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#090b12';
    ctx.fillText('CAMINHÃO EXÉRCITO [E]', lp.x + 1, lp.y + 1);
    ctx.fillStyle = '#ffcd75';
    ctx.fillText('CAMINHÃO EXÉRCITO [E]', lp.x, lp.y);
  }

  if (overturned) {
    // Battle-torn smoking overturned military truck matching sprite sheet
    drawIsoBox(ctx, tx - 44, ty - 24, 86, 48, 0, 17, camX, camY, vw, vh, '#3d4a31', '#27301f', '#192114', true);
    drawIsoBox(ctx, tx + 14, ty - 20, 28, 40, 12, 11, camX, camY, vw, vh, '#4c5e3d', '#334029', '#222b1b', false);
    // Exposed overturned tandem wheels
    drawIsoBox(ctx, tx - 32, ty + 20, 13, 6, 6, 11, camX, camY, vw, vh, '#181a20', '#101217', '#08090c', false);
    drawIsoBox(ctx, tx - 14, ty + 20, 13, 6, 6, 11, camX, camY, vw, vh, '#181a20', '#101217', '#08090c', false);
    drawIsoBox(ctx, tx + 22, ty + 18, 12, 6, 6, 11, camX, camY, vw, vh, '#181a20', '#101217', '#08090c', false);
    // Scorched tear holes + billowing smoke + active fire
    const fp = worldToIso(tx + 12, ty, 22, camX, camY, vw, vh);
    const smokeY = fp.y - 12 - ((timer * 24) % 18);
    ctx.fillStyle = 'rgba(34, 38, 48, 0.8)';
    ctx.fillRect(Math.round(fp.x - 8), Math.round(smokeY), 15, 11);
    ctx.fillRect(Math.round(fp.x - 4), Math.round(smokeY - 8), 11, 8);
    ctx.fillStyle = '#e43b44';
    ctx.fillRect(Math.round(fp.x - 7), Math.round(fp.y - 6), 14, 9);
    ctx.fillStyle = Math.sin(timer * 20) > 0 ? '#f77622' : '#ffcd75';
    ctx.fillRect(Math.round(fp.x - 4), Math.round(fp.y - 11), 9, 9);
    return;
  }

  // Tandem rear wheels + front wheels with olive steel rims
  [-34, -18, 24].forEach((wx) => {
    drawIsoBox(ctx, tx + wx, ty - 25, 12, 50, 0, 9, camX, camY, vw, vh, '#14161c', '#0e1014', '#08090c', false);
    const rim = worldToIso(tx + wx + 6, ty + 25.5, 4.5, camX, camY, vw, vh);
    ctx.fillStyle = '#4c5e3d';
    ctx.fillRect(Math.round(rim.x - 2), Math.round(rim.y - 2), 4, 4);
  });

  // Undercarriage fuel tank & side step rail
  drawIsoBox(ctx, tx + 2, ty + 19, 14, 5, 4, 6, camX, camY, vw, vh, '#2e3824', '#1f2618', '#141910', false);
  // Slatted flatbed chassis + rear bumper
  drawIsoBox(ctx, tx - 46, ty - 23, 60, 46, 4, 10, camX, camY, vw, vh, '#3d4d30', '#2b3622', '#1d2417', true);
  // Dark open cargo bay inside back of tarp
  drawIsoBox(ctx, tx - 46.5, ty - 16, 4, 32, 14, 15, camX, camY, vw, vh, '#0f1218', '#090b10', '#06080b', false);

  // Ribbed olive canvas tarp cover + tie-down ropes
  drawIsoBox(ctx, tx - 44, ty - 22, 57, 44, 14, 19, camX, camY, vw, vh, '#5c7048', '#445435', '#2f3b24', false);
  for (let rx = tx - 36; rx <= tx + 6; rx += 10) {
    const r0 = worldToIso(rx, ty - 22, 33, camX, camY, vw, vh);
    const r1 = worldToIso(rx, ty + 22, 33, camX, camY, vw, vh);
    const r2 = worldToIso(rx, ty + 22, 14, camX, camY, vw, vh);
    ctx.strokeStyle = 'rgba(20, 26, 15, 0.58)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(r0.x, r0.y);
    ctx.lineTo(r1.x, r1.y);
    ctx.lineTo(r2.x, r2.y);
    ctx.stroke();
  }

  // Armored Cab + Engine Hood + Front Tow Bumper
  drawIsoBox(ctx, tx + 14, ty - 20, 22, 40, 4, 24, camX, camY, vw, vh, '#637a4f', '#475938', '#313d26', true);
  drawIsoBox(ctx, tx + 35, ty - 19, 13, 38, 4, 14, camX, camY, vw, vh, '#566b44', '#3f4f32', '#2b3622', true);
  drawIsoBox(ctx, tx + 47, ty - 20, 4, 40, 4, 5, camX, camY, vw, vh, '#334155', '#1e293b', '#0f172a', false);

  // Side-view mirrors & vertical exhaust stack with diesel smoke
  drawIsoBox(ctx, tx + 16, ty + 19, 3, 3, 14, 14, camX, camY, vw, vh, '#1e293b', '#0f172a', '#090b12', false);
  const ex = worldToIso(tx + 17, ty + 20, 28, camX, camY, vw, vh);
  const exDrift = (timer * 18) % 12;
  ctx.fillStyle = 'rgba(100, 116, 139, 0.45)';
  ctx.fillRect(Math.round(ex.x - 3), Math.round(ex.y - 5 - exDrift), 6, 5);

  // Military Star Stencil on Cab Door
  const starP = worldToIso(tx + 24, ty + 20.5, 13, camX, camY, vw, vh);
  ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★', starP.x, starP.y);

  // Split Armored Windshield
  const w0 = worldToIso(tx + 36.2, ty - 14, 17, camX, camY, vw, vh);
  const w1 = worldToIso(tx + 36.2, ty + 14, 17, camX, camY, vw, vh);
  const w2 = worldToIso(tx + 36.2, ty + 14, 24, camX, camY, vw, vh);
  const w3 = worldToIso(tx + 36.2, ty - 14, 24, camX, camY, vw, vh);
  drawIsoQuad(ctx, w3, w2, w1, w0, '#73eff7', '#181a20');

  // Bright Twin Headlights on Front Grille
  const hl1 = worldToIso(tx + 48.5, ty - 13, 10, camX, camY, vw, vh);
  const hl2 = worldToIso(tx + 48.5, ty + 13, 10, camX, camY, vw, vh);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(Math.round(hl1.x - 2), Math.round(hl1.y - 2), 4, 4);
  ctx.fillRect(Math.round(hl2.x - 2), Math.round(hl2.y - 2), 4, 4);
}

function drawOutlinedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string
) {
  ctx.fillStyle = '#090b12';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function drawIsoCharacterBase(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  opts: {
    shirt: string;
    pants: string;
    skin: string;
    hair: string;
    helmet?: string;
    ponytail?: boolean;
    backpack?: boolean;
    vest?: string;
    step: number;
    angle: number;
    weaponColor?: string;
    scale?: number;
    isZombie?: boolean;
    labCoat?: boolean;
  }
) {
  // Crisp black-outlined pixel-art mobile scale (~1.7x)
  const sc = opts.scale || 1.65;
  ctx.save();
  ctx.translate(Math.round(sx), Math.round(sy));
  ctx.scale(sc, sc);

  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.fillRect(-7, -1, 14, 5);

  // Legs (pants + black boots with dark outline)
  drawOutlinedRect(ctx, -5, -9 + opts.step, 4, 6, opts.pants);
  drawOutlinedRect(ctx, 1, -9 - opts.step, 4, 6, opts.pants);
  ctx.fillStyle = '#111318';
  ctx.fillRect(-5, -3 + opts.step, 4, 3);
  ctx.fillRect(1, -3 - opts.step, 4, 3);

  // Green military backpack
  if (opts.backpack) {
    drawOutlinedRect(ctx, -8, -19, 4, 10, '#23381b');
    ctx.fillStyle = '#38572b';
    ctx.fillRect(-7, -18, 2, 7);
  }

  // Torso (outlined blocky pixel art)
  drawOutlinedRect(ctx, -6, -20, 12, 11, opts.shirt);

  // Zombie outstretched arms or Soldier arms
  if (opts.isZombie) {
    drawOutlinedRect(ctx, -8, -19, 3, 7, opts.skin);
    drawOutlinedRect(ctx, 5, -19, 3, 7, opts.skin);
  } else {
    drawOutlinedRect(ctx, -8, -19, 2, 8, opts.shirt);
    drawOutlinedRect(ctx, 6, -19, 2, 8, opts.shirt);
    ctx.fillStyle = opts.skin;
    ctx.fillRect(-8, -12, 2, 2);
    ctx.fillRect(6, -12, 2, 2);
  }

  // Tactical Green Vest or Torn Lab Coat
  if (opts.vest) {
    ctx.fillStyle = opts.vest;
    ctx.fillRect(-5, -19, 10, 8);
    ctx.fillStyle = '#1b2b14';
    ctx.fillRect(-3, -17, 6, 2);
    ctx.fillRect(-4, -14, 3, 2);
    ctx.fillRect(1, -14, 3, 2);
  }
  if (opts.labCoat) {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-6, -20, 12, 12);
    ctx.fillStyle = '#9e1c24';
    ctx.fillRect(-2, -16, 4, 5);
  }

  // Square Pixel Art Head with 1px dark outline (NEVER green on soldier!)
  drawOutlinedRect(ctx, -5, -30, 10, 10, opts.skin);

  // Eyes (red for zombies, dark human eyes for humans)
  ctx.fillStyle = opts.isZombie ? '#ff2a2a' : '#181a24';
  ctx.fillRect(-3, -25, 2, 2);
  ctx.fillRect(1, -25, 2, 2);

  // Helmet / Hair with dark outline
  if (opts.helmet) {
    drawOutlinedRect(ctx, -6, -32, 12, 4, opts.helmet);
    drawOutlinedRect(ctx, -5, -34, 10, 2, opts.helmet);
    ctx.fillStyle = '#588243';
    ctx.fillRect(-4, -32, 8, 1);
  } else {
    drawOutlinedRect(ctx, -5, -32, 10, 4, opts.hair);
  }

  if (opts.ponytail) {
    drawOutlinedRect(ctx, -8, -28, 3, 6, opts.hair);
  }

  // Weapon in isometric screen projection
  if (opts.weaponColor) {
    const isoVx = Math.cos(opts.angle) - Math.sin(opts.angle);
    const isoVy = (Math.cos(opts.angle) + Math.sin(opts.angle)) * 0.5;
    const screenAng = Math.atan2(isoVy, isoVx);
    ctx.save();
    ctx.translate(0, -14);
    ctx.rotate(screenAng);
    ctx.fillStyle = '#090b12';
    ctx.fillRect(1, -2.5, 14, 5);
    ctx.fillStyle = '#222630';
    ctx.fillRect(2, -1.5, 12, 3);
    ctx.fillStyle = opts.weaponColor;
    ctx.fillRect(5, -1, 4, 1.5);
    ctx.restore();
  }

  ctx.restore();
}

function drawIsoPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  gender: ProtagonistGender,
  camX: number,
  camY: number,
  vw: number,
  vh: number
) {
  if (player.invulnTimer > 0 && Math.floor(player.invulnTimer * 20) % 2 === 0) return;
  const p = worldToIso(player.x, player.y, player.z, camX, camY, vw, vh);
  const step = Math.round(Math.sin(player.animFrame) * 2);
  // STRICT: Normal human peach skin (#f2c29b) & brown hair; ONLY uniform/vest/helmet/backpack/pants are military green!
  drawIsoCharacterBase(ctx, p.x, p.y, {
    shirt: gender === 'female' ? '#3f5e30' : '#355228',
    pants: '#21331a',
    skin: '#f2c29b',
    hair: gender === 'female' ? '#5c3317' : '#3b2518',
    helmet: '#3d5e2e',
    ponytail: gender === 'female',
    backpack: true,
    vest: '#294220',
    step,
    angle: player.angle,
    weaponColor: WEAPONS[player.weaponIndex].color,
    scale: 1.75,
  });
}

function drawIsoSurvivor(
  ctx: CanvasRenderingContext2D,
  s: Survivor,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  timer: number
) {
  const p = worldToIso(s.x, s.y, 0, camX, camY, vw, vh);
  const step = Math.round(Math.sin(s.animTimer) * 1.5);

  drawIsoCharacterBase(ctx, p.x, p.y, {
    shirt: s.shirtColor,
    pants: s.kind === 'police' ? '#172554' : s.kind === 'soldier' ? '#21331a' : '#334155',
    skin: '#f2c29b',
    hair: s.hairColor,
    helmet: s.kind === 'police' ? '#1e3a8a' : s.kind === 'soldier' ? '#3d5e2e' : undefined,
    vest: s.kind === 'police' ? '#0f172a' : s.kind === 'soldier' ? '#294220' : undefined,
    backpack: s.kind === 'soldier',
    step,
    angle: s.angle,
    weaponColor: s.kind === 'police' || s.kind === 'soldier' ? '#73eff7' : undefined,
    scale: 1.65,
  });

  // Overhead Icons:
  // Survivor = Pixel speech badge with green person icon; Police = Blue badge with gold Star!
  const iconY = p.y - 64 + Math.sin(timer * 5 + s.id) * 2;
  if (s.kind === 'civilian') {
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(p.x - 8, iconY - 8, 16, 14);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(p.x - 7, iconY - 7, 14, 12);
    ctx.fillStyle = '#38b764';
    ctx.fillRect(p.x - 2, iconY - 5, 4, 4);
    ctx.fillRect(p.x - 4, iconY, 8, 4);
  } else if (s.kind === 'police') {
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(p.x, iconY, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffcd75';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', p.x, iconY + 3.5);

    if (s.hp < s.maxHp) {
      ctx.fillStyle = '#090b12';
      ctx.fillRect(p.x - 14, p.y - 78, 28, 5);
      ctx.fillStyle = s.hp > 55 ? '#38b764' : '#e43b44';
      ctx.fillRect(p.x - 13, p.y - 77, Math.floor((26 * s.hp) / s.maxHp), 3);
    }
  }
}

function drawIsoZombie(
  ctx: CanvasRenderingContext2D,
  z: Zombie,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  timer: number
) {
  const p = worldToIso(z.x, z.y, 0, camX, camY, vw, vh);
  const scale =
    z.type === 'brute'
      ? 2.2
      : z.type === 'exploder'
        ? 1.95
        : z.type === 'riot' || z.type === 'fireman'
          ? 1.78
          : z.type === 'crawler'
            ? 1.5
            : 1.65;
  const step = Math.round(Math.sin(z.animTimer) * (z.type === 'runner' ? 3 : 2));
  const flash = z.hitFlash > 0;
  // ZOMBIES HAVE GREEN SKIN!
  const skin = flash
    ? '#ffffff'
    : z.type === 'toxic' || z.type === 'exploder'
      ? '#73f78b'
      : z.type === 'patient'
        ? '#86efac'
        : '#58a846';

  const drawY = z.type === 'crawler' ? p.y + 9 : p.y;

  let helmet: string | undefined;
  let vest: string | undefined;
  let hair = '#25331d';
  if (z.type === 'doctor') hair = '#94a3b8';
  else if (z.type === 'nurse') {
    hair = '#472a1c';
    helmet = flash ? '#ffffff' : '#f8fafc';
  } else if (z.type === 'surgeon') {
    helmet = flash ? '#ffffff' : '#0f766e';
  } else if (z.type === 'riot') {
    helmet = flash ? '#ffffff' : '#1e3a8a';
    vest = flash ? '#ffffff' : '#0f172a';
  } else if (z.type === 'fireman') {
    helmet = flash ? '#ffffff' : '#eab308';
    vest = flash ? '#ffffff' : '#7f1d1d';
  }

  drawIsoCharacterBase(ctx, p.x, drawY, {
    shirt: flash ? '#ffffff' : z.color,
    pants: z.type === 'patient' ? '#cbd5e1' : z.type === 'surgeon' ? '#0f766e' : '#262230',
    skin,
    hair,
    helmet,
    vest,
    step,
    angle: z.angle,
    scale,
    isZombie: true,
    labCoat: (z.type === 'doctor' || z.type === 'patient') && !flash,
  });

  if (!flash) {
    if (z.type === 'exploder') {
      ctx.fillStyle = Math.sin(timer * 15) > 0 ? '#ffff75' : '#38b764';
      ctx.fillRect(p.x - 6, drawY - 28, 12, 8);
    } else if (z.type === 'toxic') {
      ctx.fillStyle = Math.sin(timer * 10 + z.x) > 0 ? '#a7f070' : '#4ade80';
      ctx.fillRect(p.x - 5, drawY - 27, 4, 4);
      ctx.fillRect(p.x + 2, drawY - 21, 3, 4);
    } else if (z.type === 'riot') {
      // Riot helmet cyan visor slit
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(p.x - 6, drawY - 46, 12, 3);
    } else if (z.type === 'fireman') {
      // Reflective yellow coat stripe
      ctx.fillStyle = '#facc15';
      ctx.fillRect(p.x - 8, drawY - 23, 16, 3);
    } else if (z.type === 'surgeon') {
      // Teal/white surgical mask
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(p.x - 5, drawY - 39, 10, 4);
    } else if (z.type === 'nurse') {
      // Small red cross on nurse cap
      ctx.fillStyle = '#e43b44';
      ctx.fillRect(p.x - 1, drawY - 56, 2, 4);
      ctx.fillRect(p.x - 2, drawY - 55, 4, 2);
    }
  }
}

function drawIsoHelicopter(
  ctx: CanvasRenderingContext2D,
  heli: HelicopterState,
  camX: number,
  camY: number,
  vw: number,
  vh: number
) {
  const ground = worldToIso(heli.x, heli.y, 0, camX, camY, vw, vh);
  const pos = worldToIso(heli.x, heli.y, heli.z, camX, camY, vw, vh);
  const shadowScale = Math.max(0.28, 1 - heli.z * 0.004);

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.46)';
  ctx.beginPath();
  ctx.ellipse(ground.x, ground.y, 58 * shadowScale, 28 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rappel Rope (Cutscene 0)
  if (heli.rappelRopeLength > 0) {
    const ropeEnd = worldToIso(heli.x, heli.y, Math.max(0, heli.z - heli.rappelRopeLength), camX, camY, vw, vh);
    ctx.strokeStyle = '#d4a373';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y + 8);
    ctx.lineTo(ropeEnd.x, ropeEnd.y);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(pos.x, pos.y);

  // Landing skids + vertical struts
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-26, 20);
  ctx.lineTo(30, 20);
  ctx.moveTo(-14, 10);
  ctx.lineTo(-18, 20);
  ctx.moveTo(14, 10);
  ctx.lineTo(18, 20);
  ctx.stroke();

  // Tail boom + horizontal stabilizer + vertical fin
  ctx.fillStyle = '#090b12';
  ctx.fillRect(-72, -16, 56, 11);
  ctx.fillStyle = '#364534';
  ctx.fillRect(-70, -15, 54, 9);
  ctx.fillStyle = '#4c6148';
  ctx.fillRect(-74, -26, 10, 18);
  // Tail rotor disc
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const tr = Math.sin(heli.rotorAngle * 2.5) * 9;
  ctx.moveTo(-72, -20 - tr);
  ctx.lineTo(-72, -20 + tr);
  ctx.stroke();

  // Main armored fuselage with dark outline
  ctx.fillStyle = '#090b12';
  ctx.beginPath();
  ctx.ellipse(0, 0, 40, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4c6148';
  ctx.beginPath();
  ctx.ellipse(0, 0, 38, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#688263';
  ctx.beginPath();
  ctx.ellipse(0, -5, 31, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // White rescue stripe + Red Cross (+)
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-26, 1, 20, 4);
  ctx.fillStyle = '#e43b44';
  ctx.fillRect(-20, -4, 4, 12);
  ctx.fillRect(-24, 0, 12, 4);

  // Open Sliding Side Cargo Door showing interior cabin!
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(-10, -7, 18, 15);
  ctx.fillStyle = '#f97316';
  ctx.fillRect(-7, 2, 12, 4);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-10, -7, 18, 15);

  // Twin overhead turbine pods
  ctx.fillStyle = '#2d3a2c';
  ctx.fillRect(-16, -21, 28, 7);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-18, -19, 4, 4);

  // Multi-pane Blue Cockpit Canopy + Pilot silhouettes
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.ellipse(23, -2, 14, 11, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.ellipse(24, -4, 9, 6, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(19, -5, 4, 5);

  // Nose searchlight lamp
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(34, 4, 5, 4);

  // Spinning Rotor Blades (isometric ellipse projection)
  ctx.fillStyle = 'rgba(226, 232, 240, 0.20)';
  ctx.beginPath();
  ctx.ellipse(0, -21, 82, 32, 0, 0, Math.PI * 2);
  ctx.fill();

  const b1x = Math.cos(heli.rotorAngle) * 80;
  const b1y = Math.sin(heli.rotorAngle) * 30;
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.92)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-b1x, -21 - b1y);
  ctx.lineTo(b1x, -21 + b1y);
  ctx.moveTo(b1y * 1.6, -21 - b1x * 0.38);
  ctx.lineTo(-b1y * 1.6, -21 + b1x * 0.38);
  ctx.stroke();

  // Rotor hub cap
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-4, -24, 8, 6);

  ctx.restore();
}

function renderIsoLighting(
  ctx: CanvasRenderingContext2D,
  lightCtx: CanvasRenderingContext2D,
  lightCanvas: HTMLCanvasElement,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  data: RenderContextData
) {
  // Atmospheric purple/night-blue darkness (never pitch black!)
  let ambient = 'rgba(18, 12, 42, 0.56)';
  if (data.playPhase === 'PHASE2_TRUCK_DEFENSE' || data.playPhase === 'PHASE2_CITY') {
    ambient = 'rgba(14, 10, 36, 0.68)';
  } else if (data.playPhase === 'PHASE2_HOSPITAL') {
    ambient = data.generator?.activated
      ? 'rgba(16, 26, 40, 0.24)'
      : 'rgba(10, 8, 28, 0.82)';
  } else if (data.playPhase === 'PHASE2_ROOFTOP' || data.playPhase === 'CUTSCENE_3_FINALE') {
    ambient = 'rgba(14, 12, 34, 0.58)';
  }

  lightCtx.globalCompositeOperation = 'source-over';
  lightCtx.fillStyle = ambient;
  lightCtx.fillRect(0, 0, vw, vh);
  lightCtx.globalCompositeOperation = 'destination-out';

  const pp = worldToIso(data.player.x, data.player.y, 16, camX, camY, vw, vh);
  // Keep player and nearby zombies clearly illuminated!
  drawLightCircle(lightCtx, pp.x, pp.y, 88, 0.96);

  // Player yellow-greenish tactical flashlight cone
  const isoVx = Math.cos(data.player.angle) - Math.sin(data.player.angle);
  const isoVy = (Math.cos(data.player.angle) + Math.sin(data.player.angle)) * 0.5;
  const screenAng = Math.atan2(isoVy, isoVx);

  lightCtx.save();
  lightCtx.translate(pp.x, pp.y);
  lightCtx.rotate(screenAng);
  const cone = lightCtx.createRadialGradient(8, 0, 8, 110, 0, 210);
  cone.addColorStop(0, 'rgba(0,0,0,1)');
  cone.addColorStop(0.65, 'rgba(0,0,0,0.88)');
  cone.addColorStop(1, 'rgba(0,0,0,0)');
  lightCtx.fillStyle = cone;
  lightCtx.beginPath();
  lightCtx.moveTo(4, -8);
  lightCtx.lineTo(210, -86);
  lightCtx.lineTo(210, 86);
  lightCtx.lineTo(4, 8);
  lightCtx.closePath();
  lightCtx.fill();
  lightCtx.restore();

  // Safe building interior visibility
  if (data.playerInSafeBuilding) {
    const b = data.playerInSafeBuilding;
    const bp = worldToIso(b.x + b.w / 2, b.y + b.h / 2, 0, camX, camY, vw, vh);
    drawLightCircle(lightCtx, bp.x, bp.y, 185, 0.92);
  }

  // Street & Failing Flickering Hospital Lamps + Lit Windows
  for (const lamp of data.streetLamps) {
    if (lamp.broken) continue;
    const lp = worldToIso(lamp.x, lamp.y, 12, camX, camY, vw, vh);
    if (lp.x < -140 || lp.x > vw + 140 || lp.y < -140 || lp.y > vh + 140) continue;

    let intensity = 0.88;
    if (lamp.isHospitalLamp) {
      if (data.generator?.activated) {
        intensity = 0.96;
      } else {
        const wave =
          Math.sin(data.globalTimer * 18 + lamp.flickerSeed) *
          Math.cos(data.globalTimer * 8.1 + lamp.flickerSeed);
        intensity = wave > 0.3 ? 0.12 : wave > 0 ? 0.45 : 0.88;
      }
      drawLightCircle(lightCtx, lp.x, lp.y, 110, intensity);
    } else {
      const flicker = Math.sin(data.globalTimer * 18 + lamp.flickerSeed) > 0.92 ? 0.45 : 0.88;
      drawLightCircle(lightCtx, lp.x, lp.y, 105, flicker);
    }
  }

  for (const b of data.buildings) {
    if (b.category === 'hospital_ext') continue;
    const wp = worldToIso(b.x + b.w * 0.6, b.y + b.h, 16, camX, camY, vw, vh);
    if (wp.x > -120 && wp.x < vw + 120 && wp.y > -120 && wp.y < vh + 120) {
      drawLightCircle(lightCtx, wp.x, wp.y, 75, 0.65);
    }
  }

  for (const fl of data.dynamicFlashes) {
    const fp = worldToIso(fl.x, fl.y, 14, camX, camY, vw, vh);
    drawLightCircle(lightCtx, fp.x, fp.y, fl.radius, 0.98);
  }

  // Dynamic fire light cutouts
  for (const fire of data.fires) {
    const fp = worldToIso(fire.x, fire.y, 8, camX, camY, vw, vh);
    if (fp.x < -160 || fp.x > vw + 160 || fp.y < -160 || fp.y > vh + 160) continue;
    const rad = fire.radius + Math.sin(data.globalTimer * 14 + fire.seed) * 14;
    drawLightCircle(lightCtx, fp.x, fp.y, rad, 0.92);
  }
  for (const obs of data.obstacles) {
    if (obs.type === 'car' && (obs.burning || obs.carVariant === 'police')) {
      const cp = worldToIso(obs.x + obs.w * 0.5, obs.y + obs.h * 0.5, 12, camX, camY, vw, vh);
      if (cp.x < -140 || cp.x > vw + 140 || cp.y < -140 || cp.y > vh + 140) continue;
      drawLightCircle(lightCtx, cp.x, cp.y, obs.burning ? 120 : 88, 0.86);
    }
  }

  // Helicopter sweeping searchlight cutout on rooftop
  if (data.helicopter && data.playPhase === 'PHASE2_ROOFTOP') {
    const sx = data.helicopter.x + Math.cos(data.helicopter.searchlightAngle) * 160;
    const sy = data.helicopter.y + Math.sin(data.helicopter.searchlightAngle) * 110;
    const sp = worldToIso(sx, sy, 0, camX, camY, vw, vh);
    drawLightCircle(lightCtx, sp.x, sp.y, 125, 0.92);
  }

  ctx.drawImage(lightCanvas, 0, 0);

  // Additive tint for yellow-greenish flashlight beam & warm gunfire flashes
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(pp.x, pp.y);
  ctx.rotate(screenAng);
  const beamGrad = ctx.createRadialGradient(8, 0, 6, 100, 0, 195);
  beamGrad.addColorStop(0, 'rgba(185, 238, 105, 0.22)');
  beamGrad.addColorStop(0.65, 'rgba(170, 225, 95, 0.10)');
  beamGrad.addColorStop(1, 'rgba(170, 225, 95, 0)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(4, -7);
  ctx.lineTo(195, -78);
  ctx.lineTo(195, 78);
  ctx.lineTo(4, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Warm orange-yellow pools around dynamic fires, streetlamps, police strobes, searchlight & gunfire flashes
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const fire of data.fires) {
    const fp = worldToIso(fire.x, fire.y, 8, camX, camY, vw, vh);
    if (fp.x < -160 || fp.x > vw + 160 || fp.y < -160 || fp.y > vh + 160) continue;
    const rad = fire.radius * 0.92 + Math.sin(data.globalTimer * 15 + fire.seed) * 12;
    const fg = ctx.createRadialGradient(fp.x, fp.y, 4, fp.x, fp.y, rad);
    fg.addColorStop(0, 'rgba(255, 165, 55, 0.34)');
    fg.addColorStop(0.55, 'rgba(249, 115, 22, 0.16)');
    fg.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(fp.x, fp.y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const obs of data.obstacles) {
    if (obs.type !== 'car') continue;
    if (obs.burning) {
      const cp = worldToIso(obs.x + obs.w * 0.5, obs.y + obs.h * 0.5, 12, camX, camY, vw, vh);
      if (cp.x < -140 || cp.x > vw + 140 || cp.y < -140 || cp.y > vh + 140) continue;
      const cg = ctx.createRadialGradient(cp.x, cp.y, 4, cp.x, cp.y, 105);
      cg.addColorStop(0, 'rgba(255, 145, 45, 0.30)');
      cg.addColorStop(1, 'rgba(255, 145, 45, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 105, 0, Math.PI * 2);
      ctx.fill();
    } else if (obs.carVariant === 'police') {
      const cp = worldToIso(obs.x + obs.w * 0.5, obs.y + obs.h * 0.5, 16, camX, camY, vw, vh);
      if (cp.x < -120 || cp.x > vw + 120 || cp.y < -120 || cp.y > vh + 120) continue;
      const redPhase = Math.sin(data.globalTimer * 14 + obs.x) > 0;
      const pg = ctx.createRadialGradient(cp.x, cp.y, 4, cp.x, cp.y, 82);
      pg.addColorStop(0, redPhase ? 'rgba(239, 68, 68, 0.28)' : 'rgba(59, 130, 246, 0.28)');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 82, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const lamp of data.streetLamps) {
    if (lamp.broken || lamp.isHospitalLamp) continue;
    if (Math.sin(data.globalTimer * 18 + lamp.flickerSeed) > 0.92) continue;
    const lp = worldToIso(lamp.x, lamp.y, 8, camX, camY, vw, vh);
    if (lp.x < -120 || lp.x > vw + 120 || lp.y < -120 || lp.y > vh + 120) continue;
    const lg = ctx.createRadialGradient(lp.x, lp.y, 4, lp.x, lp.y, 88);
    lg.addColorStop(0, 'rgba(254, 240, 138, 0.18)');
    lg.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, 88, 0, Math.PI * 2);
    ctx.fill();
  }

  if (data.helicopter && data.playPhase === 'PHASE2_ROOFTOP') {
    const sx = data.helicopter.x + Math.cos(data.helicopter.searchlightAngle) * 160;
    const sy = data.helicopter.y + Math.sin(data.helicopter.searchlightAngle) * 110;
    const sp = worldToIso(sx, sy, 0, camX, camY, vw, vh);
    const sg = ctx.createRadialGradient(sp.x, sp.y, 8, sp.x, sp.y, 115);
    sg.addColorStop(0, 'rgba(254, 249, 195, 0.26)');
    sg.addColorStop(1, 'rgba(254, 249, 195, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 115, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const fl of data.dynamicFlashes) {
    const fp = worldToIso(fl.x, fl.y, 14, camX, camY, vw, vh);
    const fg = ctx.createRadialGradient(fp.x, fp.y, 4, fp.x, fp.y, fl.radius * 0.75);
    fg.addColorStop(0, fl.color);
    fg.addColorStop(1, 'rgba(255, 220, 80, 0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(fp.x, fp.y, fl.radius * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLightCircle(
  targetCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number
) {
  const grad = targetCtx.createRadialGradient(x, y, radius * 0.15, x, y, radius);
  grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
  grad.addColorStop(0.65, `rgba(0,0,0,${alpha * 0.55})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  targetCtx.fillStyle = grad;
  targetCtx.beginPath();
  targetCtx.arc(x, y, radius, 0, Math.PI * 2);
  targetCtx.fill();
}

// --- SUBWAY SURFERS STYLE 3-LANE BRIDGE PERSPECTIVE (CANVAS 2D) ---
function projectBridge(
  lanePos: number,
  z: number,
  yHeight: number,
  vw: number,
  vh: number
): { x: number; y: number; scale: number; roadHalfW: number } {
  const horizonY = vh * 0.27;
  const bottomY = vh * 0.96;
  const p = Math.pow(Math.max(0, 1 - z), 1.9);
  const roadHalfW = vw * 0.055 + vw * 0.36 * p;
  const scale = 0.16 + 0.95 * p;
  return {
    x: vw * 0.5 + lanePos * 0.62 * roadHalfW,
    y: horizonY + (bottomY - horizonY) * p - yHeight * scale,
    scale,
    roadHalfW,
  };
}

function renderBridgeSubwaySurfers(
  ctx: CanvasRenderingContext2D,
  vw: number,
  vh: number,
  data: RenderContextData
) {
  const bs = data.bridgeState;
  if (!bs) return;

  const shakeX = data.camera.shake > 0 ? (Math.random() - 0.5) * data.camera.shake : 0;
  const shakeY = data.camera.shake > 0 ? (Math.random() - 0.5) * data.camera.shake : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Night Sky & City Silhouette Horizon
  const horizonY = vh * 0.27;
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, '#0b0e1c');
  skyGrad.addColorStop(1, '#261e38');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, vw, horizonY);

  // Distant burning skyline silhouettes
  ctx.fillStyle = '#141826';
  for (let bx = 0; bx < vw; bx += 42) {
    const bh = 18 + ((bx * 37) % 34);
    ctx.fillRect(bx, horizonY - bh, 36, bh);
  }

  // River Water Left & Right of Bridge
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, horizonY, vw, vh - horizonY);

  // Road Trapezoid
  const topL = vw * 0.5 - vw * 0.055;
  const topR = vw * 0.5 + vw * 0.055;
  const botL = vw * 0.5 - vw * 0.415;
  const botR = vw * 0.5 + vw * 0.415;

  ctx.fillStyle = PALETTE.bridgeDeck;
  ctx.beginPath();
  ctx.moveTo(topL, horizonY);
  ctx.lineTo(topR, horizonY);
  ctx.lineTo(botR, vh);
  ctx.lineTo(botL, vh);
  ctx.closePath();
  ctx.fill();

  // Steel Bridge Guardrails
  ctx.strokeStyle = PALETTE.bridgeRail;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(topL, horizonY);
  ctx.lineTo(botL, vh);
  ctx.moveTo(topR, horizonY);
  ctx.lineTo(botR, vh);
  ctx.stroke();

  // Scrolling 3-Lane Dashes
  for (let i = 0; i < 12; i++) {
    const z1 = ((i / 12 + (bs.scrollOffset % 1) / 12) % 1);
    const z2 = Math.min(1, z1 + 0.045);
    [-0.33, 0.33].forEach((divider) => {
      const a = projectBridge(divider / 0.62, z1, 0, vw, vh);
      const b = projectBridge(divider / 0.62, z2, 0, vw, vh);
      ctx.strokeStyle = '#d4a72c';
      ctx.lineWidth = Math.max(1.5, 4 * a.scale);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
  }

  // Obstacles ahead (wrecked cars & road barriers — swipe left/right/up/down!)
  const sortedObs = [...bs.obstacles].sort((a, b) => b.z - a.z);
  for (const obs of sortedObs) {
    const p = projectBridge(obs.lane, obs.z, 0, vw, vh);
    const w = 54 * p.scale;
    const h = 32 * p.scale;

    if (obs.kind === 'wrecked_car') {
      const variant = obs.carVariant || 'sedan';
      const isPolice = variant === 'police';
      const isSuv = variant === 'suv';
      const carH = isSuv ? h * 1.18 : h;

      // Ground shadow & tires
      ctx.fillStyle = 'rgba(0,0,0,0.48)';
      ctx.fillRect(p.x - w / 2, p.y - 3 * p.scale, w, 6 * p.scale);
      ctx.fillStyle = '#0c0e14';
      ctx.fillRect(p.x - w * 0.48, p.y - 8 * p.scale, 10 * p.scale, 9 * p.scale);
      ctx.fillRect(p.x + w * 0.48 - 10 * p.scale, p.y - 8 * p.scale, 10 * p.scale, 9 * p.scale);

      // Lower body + outline
      ctx.fillStyle = '#090b12';
      ctx.fillRect(p.x - w / 2 - 1, p.y - carH - 1, w + 2, carH + 2);
      ctx.fillStyle = obs.burning ? '#3a3c45' : isPolice ? '#1e293b' : obs.color;
      ctx.fillRect(p.x - w / 2, p.y - carH, w, carH);
      if (isPolice && !obs.burning) {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(p.x - w * 0.36, p.y - carH * 0.78, w * 0.72, carH * 0.42);
      }

      // Bumper & taillights
      ctx.fillStyle = '#1f232b';
      ctx.fillRect(p.x - w * 0.48, p.y - 10 * p.scale, w * 0.96, 6 * p.scale);
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(p.x - w * 0.46, p.y - carH * 0.55, 8 * p.scale, 5 * p.scale);
      ctx.fillRect(p.x + w * 0.46 - 8 * p.scale, p.y - carH * 0.55, 8 * p.scale, 5 * p.scale);

      // Shattered rear cabin & window
      ctx.fillStyle = '#090b12';
      ctx.fillRect(p.x - w * 0.38 - 1, p.y - carH * 1.32 - 1, w * 0.76 + 2, carH * 0.46 + 2);
      ctx.fillStyle = isPolice ? '#e2e8f0' : '#2d313b';
      ctx.fillRect(p.x - w * 0.38, p.y - carH * 1.32, w * 0.76, carH * 0.46);
      ctx.fillStyle = '#10141c';
      ctx.fillRect(p.x - w * 0.28, p.y - carH * 1.24, w * 0.56, carH * 0.3);

      // Police flashing roof bar OR SUV rear spare tire
      if (isPolice) {
        const strobe = Math.sin(data.globalTimer * 14 + obs.id) > 0;
        ctx.fillStyle = strobe ? '#ef4444' : '#3b82f6';
        ctx.fillRect(p.x - w * 0.22, p.y - carH * 1.44, w * 0.2, 4 * p.scale);
        ctx.fillStyle = strobe ? '#3b82f6' : '#ef4444';
        ctx.fillRect(p.x + w * 0.02, p.y - carH * 1.44, w * 0.2, 4 * p.scale);
      } else if (isSuv) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(p.x, p.y - carH * 0.55, 9 * p.scale, 0, Math.PI * 2);
        ctx.fill();
      }

      if (obs.burning) {
        const puffY = p.y - carH * 1.5 - ((data.globalTimer * 28 + obs.id * 9) % 18) * p.scale;
        ctx.fillStyle = 'rgba(42, 46, 56, 0.75)';
        ctx.fillRect(p.x - 7 * p.scale, puffY, 14 * p.scale, 10 * p.scale);
        ctx.fillStyle = '#e43b44';
        ctx.fillRect(p.x - 6 * p.scale, p.y - carH * 1.45, 12 * p.scale, 9 * p.scale);
        ctx.fillStyle = Math.sin(data.globalTimer * 24 + obs.id) > 0 ? '#f77622' : '#ffcd75';
        ctx.fillRect(p.x - 4 * p.scale, p.y - carH * 1.58, 8 * p.scale, 9 * p.scale);
      }
    } else {
      // Concrete road barrier
      const bh = 20 * p.scale;
      ctx.fillStyle = '#090b12';
      ctx.fillRect(p.x - w * 0.56 - 1, p.y - bh - 1, w * 1.12 + 2, bh + 2);
      ctx.fillStyle = '#e43b44';
      ctx.fillRect(p.x - w * 0.56, p.y - bh, w * 1.12, bh);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - w * 0.36, p.y - bh, w * 0.22, bh);
      ctx.fillRect(p.x + w * 0.14, p.y - bh, w * 0.22, bh);
    }
  }

  // Explosive Zombie appearing at end of bridge!
  if (bs.exploderSpawned) {
    const ep = projectBridge(0, bs.exploderZ, 0, vw, vh);
    ctx.fillStyle = Math.sin(data.globalTimer * 20) > 0 ? '#a7f070' : '#38b764';
    ctx.fillRect(ep.x - 12 * ep.scale, ep.y - 28 * ep.scale, 24 * ep.scale, 24 * ep.scale);
    ctx.fillStyle = '#ff2a2a';
    ctx.fillRect(ep.x - 4 * ep.scale, ep.y - 22 * ep.scale, 3 * ep.scale, 3 * ep.scale);
    ctx.fillRect(ep.x + 2 * ep.scale, ep.y - 22 * ep.scale, 3 * ep.scale, 3 * ep.scale);
  }

  // Ultra-Detailed Army Truck Rear View (matching MILITARY TRUCK sprite sheet!)
  const truckZ = bs.turboTimer > 0 ? 0.31 : bs.brakeTimer > 0 ? 0.22 : 0.26;
  const tShadow = projectBridge(bs.lanePos, truckZ, 0, vw, vh);
  const tBody = projectBridge(bs.lanePos, truckZ, 0, vw, vh);
  const tw = 74 * tBody.scale;
  const th = 58 * tBody.scale;

  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.beginPath();
  ctx.ellipse(tShadow.x, tShadow.y, tw * 0.60, 11 * tShadow.scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dual tandem rear tires with tread & mudflaps
  ctx.fillStyle = '#090b12';
  ctx.fillRect(tBody.x - tw * 0.51, tBody.y - 15 * tBody.scale, 14 * tBody.scale, 16 * tBody.scale);
  ctx.fillRect(tBody.x + tw * 0.51 - 14 * tBody.scale, tBody.y - 15 * tBody.scale, 14 * tBody.scale, 16 * tBody.scale);
  ctx.fillStyle = '#262b34';
  ctx.fillRect(tBody.x - tw * 0.49, tBody.y - 13 * tBody.scale, 10 * tBody.scale, 12 * tBody.scale);
  ctx.fillRect(tBody.x + tw * 0.49 - 10 * tBody.scale, tBody.y - 13 * tBody.scale, 10 * tBody.scale, 12 * tBody.scale);
  ctx.fillStyle = '#11141c';
  ctx.fillRect(tBody.x - tw * 0.47, tBody.y - 8 * tBody.scale, 6 * tBody.scale, 2 * tBody.scale);
  ctx.fillRect(tBody.x + tw * 0.47 - 6 * tBody.scale, tBody.y - 8 * tBody.scale, 6 * tBody.scale, 2 * tBody.scale);

  // Rear axle differential + diesel exhaust pipe puffing smoke on right
  ctx.fillStyle = '#1e242e';
  ctx.fillRect(tBody.x - tw * 0.35, tBody.y - 10 * tBody.scale, tw * 0.70, 5 * tBody.scale);
  ctx.fillRect(tBody.x - 6 * tBody.scale, tBody.y - 12 * tBody.scale, 12 * tBody.scale, 8 * tBody.scale);
  const exDrift = (data.globalTimer * 24) % 14;
  ctx.fillStyle = 'rgba(71, 85, 105, 0.55)';
  ctx.fillRect(tBody.x + tw * 0.52, tBody.y - th * 0.88 - exDrift * tBody.scale, 8 * tBody.scale, 8 * tBody.scale);

  // Curved olive canvas tarp arch & side tie-down ribs
  ctx.fillStyle = '#090b12';
  ctx.fillRect(tBody.x - tw / 2 - 1.5, tBody.y - th - 1.5, tw + 3, th - 6 * tBody.scale);
  ctx.fillStyle = '#4e613b';
  ctx.fillRect(tBody.x - tw / 2, tBody.y - th, tw, th - 8 * tBody.scale);
  ctx.fillStyle = '#677d50';
  ctx.fillRect(tBody.x - tw * 0.46, tBody.y - th + 1, tw * 0.92, 9 * tBody.scale);
  ctx.fillStyle = '#38472a';
  ctx.fillRect(tBody.x - tw * 0.48, tBody.y - th * 0.85, 4 * tBody.scale, th * 0.46);
  ctx.fillRect(tBody.x + tw * 0.48 - 4 * tBody.scale, tBody.y - th * 0.85, 4 * tBody.scale, th * 0.46);

  // Deep open cargo cavity with rescued survivors & 2 firing soldiers
  ctx.fillStyle = '#090b10';
  ctx.fillRect(tBody.x - tw * 0.39, tBody.y - th * 0.85, tw * 0.78, th * 0.46);
  // Huddled survivors inside back
  [-18, -6, 6, 18].forEach((sx, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#475569' : '#64748b';
    ctx.fillRect(tBody.x + sx * tBody.scale - 4 * tBody.scale, tBody.y - th * 0.58, 8 * tBody.scale, 10 * tBody.scale);
  });
  // 2 Helmeted Soldiers with rifles & muzzle flashes firing from tailgate
  const firingFlash = bs.tracers.some((tr) => tr.life > 0.04);
  [-13, 13].forEach((ox) => {
    const sx = tBody.x + ox * tBody.scale;
    const sy = tBody.y - th * 0.48;
    ctx.fillStyle = '#2d4521';
    ctx.fillRect(sx - 6 * tBody.scale, sy - 6 * tBody.scale, 12 * tBody.scale, 10 * tBody.scale);
    ctx.fillStyle = '#3d5e2e';
    ctx.beginPath();
    ctx.arc(sx, sy - 9 * tBody.scale, 5.5 * tBody.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111318';
    ctx.fillRect(sx - 1.5 * tBody.scale, sy - 3 * tBody.scale, 3 * tBody.scale, 9 * tBody.scale);
    if (firingFlash) {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(sx, sy + 6 * tBody.scale, 4 * tBody.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Slatted tailgate + White Military Star ★ Stencil + heavy steel bumper
  ctx.fillStyle = '#3a492b';
  ctx.fillRect(tBody.x - tw * 0.50, tBody.y - th * 0.40, tw, th * 0.25);
  ctx.fillStyle = '#26301c';
  ctx.fillRect(tBody.x - tw * 0.48, tBody.y - th * 0.34, tw * 0.96, 2.5 * tBody.scale);
  ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
  ctx.font = `${Math.max(7, Math.round(9 * tBody.scale))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('★', tBody.x, tBody.y - th * 0.21);

  // Twin Taillights (glow brighter when braking!)
  ctx.fillStyle = bs.brakeTimer > 0 ? '#ff6b6b' : '#e43b44';
  ctx.fillRect(tBody.x - tw * 0.45, tBody.y - 19 * tBody.scale, 10 * tBody.scale, 6 * tBody.scale);
  ctx.fillRect(tBody.x + tw * 0.45 - 10 * tBody.scale, tBody.y - 19 * tBody.scale, 10 * tBody.scale, 6 * tBody.scale);
  if (bs.brakeTimer > 0) {
    ctx.fillStyle = 'rgba(255, 80, 80, 0.35)';
    ctx.beginPath();
    ctx.arc(tBody.x - tw * 0.40, tBody.y - 16 * tBody.scale, 12 * tBody.scale, 0, Math.PI * 2);
    ctx.arc(tBody.x + tw * 0.40, tBody.y - 16 * tBody.scale, 12 * tBody.scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tire sparks & turbo boost glow when boosting!
  if (bs.turboTimer > 0) {
    ctx.fillStyle = Math.sin(data.globalTimer * 35) > 0 ? '#ffcd75' : '#73eff7';
    ctx.fillRect(tBody.x - tw * 0.46, tBody.y - 5 * tBody.scale, 9 * tBody.scale, 8 * tBody.scale);
    ctx.fillRect(tBody.x + tw * 0.46 - 9 * tBody.scale, tBody.y - 5 * tBody.scale, 9 * tBody.scale, 8 * tBody.scale);
    ctx.fillRect(tBody.x - 11 * tBody.scale, tBody.y - 4 * tBody.scale, 22 * tBody.scale, 10 * tBody.scale);
  }

  // Tracer shots toward chasing horde
  for (const tr of bs.tracers) {
    ctx.strokeStyle = '#ffcd75';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tr.x1, tr.y1);
    ctx.lineTo(tr.x2, tr.y2);
    ctx.stroke();
  }

  // Detailed Chasing Runner Zombies right behind the truck (z < 0.20)
  const runnerShirts = ['#9e3838', '#475569', '#3f6212', '#7c2d12', '#334155'];
  for (let zi = 0; zi < bs.chasingZombies.length; zi++) {
    const cz = bs.chasingZombies[zi];
    const zp = projectBridge(cz.lanePos, cz.z, 0, vw, vh);
    const s = zp.scale;
    const stride = Math.sin(cz.anim) * 4.5 * s;
    const armSwing = Math.cos(cz.anim) * 4 * s;
    const shirt = runnerShirts[zi % runnerShirts.length];

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(zp.x, zp.y + 1, 9 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Kicking legs
    ctx.fillStyle = '#090b12';
    ctx.fillRect(zp.x - 5 * s - 1, zp.y - 9 * s + stride * 0.5, 4 * s + 2, 10 * s);
    ctx.fillRect(zp.x + 1 * s - 1, zp.y - 9 * s - stride * 0.5, 4 * s + 2, 10 * s);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(zp.x - 5 * s, zp.y - 9 * s + stride * 0.5, 4 * s, 9 * s);
    ctx.fillRect(zp.x + 1 * s, zp.y - 9 * s - stride * 0.5, 4 * s, 9 * s);

    // Flailing outstretched zombie arms
    ctx.fillStyle = '#58a846';
    ctx.fillRect(zp.x - 10 * s, zp.y - 22 * s + armSwing, 3 * s, 9 * s);
    ctx.fillRect(zp.x + 7 * s, zp.y - 22 * s - armSwing, 3 * s, 9 * s);

    // Outlined torso in tattered shirt
    ctx.fillStyle = '#090b12';
    ctx.fillRect(zp.x - 7 * s - 1, zp.y - 23 * s - 1, 14 * s + 2, 14 * s + 2);
    ctx.fillStyle = shirt;
    ctx.fillRect(zp.x - 7 * s, zp.y - 23 * s, 14 * s, 14 * s);

    // Pixel green head + dark hair + glowing red eyes
    ctx.fillStyle = '#090b12';
    ctx.fillRect(zp.x - 5 * s - 1 + stride * 0.15, zp.y - 33 * s - 1, 10 * s + 2, 10 * s + 2);
    ctx.fillStyle = '#6ea34b';
    ctx.fillRect(zp.x - 5 * s + stride * 0.15, zp.y - 33 * s, 10 * s, 10 * s);
    ctx.fillStyle = '#25331d';
    ctx.fillRect(zp.x - 5 * s + stride * 0.15, zp.y - 35 * s, 10 * s, 3 * s);
    ctx.fillStyle = '#ff2a2a';
    ctx.fillRect(zp.x - 3 * s + stride * 0.15, zp.y - 29 * s, 2 * s, 2 * s);
    ctx.fillRect(zp.x + 1 * s + stride * 0.15, zp.y - 29 * s, 2 * s, 2 * s);
  }

  // Particles
  for (const pt of data.particles) {
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Night storm rain over bridge chase
  drawNightStormOverlay(ctx, vw, vh, data.globalTimer);

  ctx.restore();
}

function renderHud(
  ctx: CanvasRenderingContext2D,
  vw: number,
  vh: number,
  data: RenderContextData
) {
  const hudH = 44;
  ctx.fillStyle = 'rgba(11, 14, 24, 0.94)';
  ctx.fillRect(0, 0, vw, hudH);
  ctx.fillStyle = '#364264';
  ctx.fillRect(0, hudH - 2, vw, 2);

  if (data.playPhase === 'PHASE1_BRIDGE' && data.bridgeState) {
    const bs = data.bridgeState;
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = bs.timeRemaining <= 10 ? '#e43b44' : '#ffcd75';
    ctx.fillText(`${Math.ceil(bs.timeRemaining)}s`, 10, 20);

    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = bs.hitsWithoutRecovery >= 2 ? '#e43b44' : '#cbd5e1';
    ctx.fillText(`BATIDAS: ${bs.hitsWithoutRecovery}/3`, 10, 34);

    const midX = Math.floor(vw * 0.58);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#73eff7';
    ctx.fillText('PONTE · DESLIZE P/ DESVIAR', midX, 15);
    const barW = Math.min(180, vw * 0.44);
    ctx.fillStyle = '#1b2236';
    ctx.fillRect(midX - barW / 2, 22, barW, 11);
    const prog = 1 - bs.timeRemaining / bs.totalDuration;
    ctx.fillStyle = bs.turboTimer > 0 ? '#73eff7' : '#38b764';
    ctx.fillRect(midX - barW / 2 + 2, 24, Math.floor((barW - 4) * prog), 7);
    return;
  }

  // Clean single-line top HUD with ZERO overlapping text!
  // Format: HP | FASE | SALVOS: X | PTS | ARMA
  const radarR = 16;
  const radarX = vw - radarR - 8;
  const radarY = 21;
  const maxHudRight = radarX - radarR - 8;

  const fuseReq = data.generator?.fusesRequired ?? 1;
  let phaseLabel = 'FASE 1';
  if (data.playPhase === 'PHASE2_TRUCK_DEFENSE') phaseLabel = 'COBERTURA';
  else if (data.playPhase === 'PHASE2_CITY') phaseLabel = 'FASE 2';
  else if (data.playPhase === 'PHASE2_HOSPITAL') {
    phaseLabel = data.generator?.activated
      ? `HOSP ${data.hospitalFloor}/4`
      : `FUS ${data.fusesCollected}/${fuseReq}`;
  } else if (data.playPhase === 'PHASE2_ROOFTOP') phaseLabel = 'HELIPORTO';

  const wDef = WEAPONS[data.player.weaponIndex];
  const wState = data.player.weapons[data.player.weaponIndex];
  const ammoShort = wDef.infinite ? `${wState.mag}` : `${wState.mag}/${wState.reserve}`;
  const hpVal = Math.ceil(data.player.hp);

  ctx.font = '6px "Press Start 2P", monospace';
  ctx.textAlign = 'left';

  // Single non-overlapping line positioned cleanly across [8 .. maxHudRight]
  const lineY = 16;
  const usableW = maxHudRight - 8;

  ctx.fillStyle = hpVal > 50 ? '#38b764' : hpVal > 25 ? '#ffcd75' : '#e43b44';
  ctx.fillText(`HP${hpVal}`, 8, lineY);

  ctx.fillStyle = data.playerInSafeBuilding ? '#38b764' : '#73eff7';
  ctx.fillText(phaseLabel.slice(0, 7), 8 + Math.floor(usableW * 0.17), lineY);

  ctx.fillStyle = '#38b764';
  ctx.fillText(`SLV:${data.stats.rescued}`, 8 + Math.floor(usableW * 0.37), lineY);

  ctx.fillStyle = '#ffcd75';
  ctx.fillText(`P:${data.stats.score}`, 8 + Math.floor(usableW * 0.56), lineY);

  ctx.textAlign = 'right';
  ctx.fillStyle = wDef.color;
  ctx.fillText(`${wDef.shortName.slice(0, 4)} ${ammoShort}`, maxHudRight, lineY);
  ctx.textAlign = 'left';

  // Thin HP bar + objective hint cleanly underneath on y=27..38 (never overlapping line 1)
  const hpBarW = Math.min(110, maxHudRight - 16);
  ctx.fillStyle = '#26070a';
  ctx.fillRect(8, 26, hpBarW, 7);
  ctx.fillStyle = hpVal > 50 ? '#38b764' : hpVal > 25 ? '#ffcd75' : '#e43b44';
  ctx.fillRect(9, 27, Math.floor((hpBarW - 2) * Math.max(0, hpVal / data.player.maxHp)), 5);

  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillStyle = data.playerInSafeBuilding ? '#38b764' : '#94a3b8';
  let hint = 'SIGA AO HOSPITAL';
  if (data.playerInSafeBuilding) {
    hint = `SEGURO:${data.playerInSafeBuilding.label}`;
  } else if (data.playPhase === 'PHASE1_CITY') {
    hint = 'VÁ AO CAMINHÃO';
  } else if (data.playPhase === 'PHASE2_HOSPITAL') {
    hint = data.generator?.activated ? 'ESCADA ABERTA' : 'LIGUE O GERADOR';
  } else if (data.playPhase === 'PHASE2_ROOFTOP') {
    if (data.rooftopBoarding?.active && !data.rooftopBoarding.completed) {
      hint = `EMBARQUE ${data.rooftopBoarding.boardedCount}/${data.rooftopBoarding.totalToBoard}`;
    } else {
      hint = 'ENTRE NO HELICÓPTERO';
    }
  }
  ctx.fillText(hint, 16 + hpBarW, 33);

  // Top-right small circular Radar (ONLY Survivors = Green dot, Weapons = Yellow dot!)
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.arc(radarX, radarY, radarR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#73eff7';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(radarX - 1, radarY - 1, 2, 2);

  // ONLY Civilian Survivors (Green dots)
  ctx.fillStyle = '#38b764';
  for (const s of data.survivors) {
    if (s.rescued || s.kind !== 'civilian') continue;
    const ang = Math.atan2(s.y - data.player.y, s.x - data.player.x);
    const dist = Math.min(radarR - 3, Math.hypot(s.x - data.player.x, s.y - data.player.y) / 90);
    const sx = radarX + (Math.cos(ang) - Math.sin(ang)) * dist * 0.7;
    const sy = radarY + (Math.cos(ang) + Math.sin(ang)) * dist * 0.5;
    ctx.fillRect(Math.floor(sx - 1), Math.floor(sy - 1), 3, 3);
  }

  // ONLY Weapons (Yellow dots)
  ctx.fillStyle = '#ffcd75';
  for (const pk of data.pickups) {
    if (!pk.type.startsWith('crate_')) continue;
    const ang = Math.atan2(pk.y - data.player.y, pk.x - data.player.x);
    const dist = Math.min(radarR - 3, Math.hypot(pk.x - data.player.x, pk.y - data.player.y) / 90);
    const sx = radarX + (Math.cos(ang) - Math.sin(ang)) * dist * 0.7;
    const sy = radarY + (Math.cos(ang) + Math.sin(ang)) * dist * 0.5;
    ctx.fillRect(Math.floor(sx - 1), Math.floor(sy - 1), 3, 3);
  }

  // Off-screen directional objective indicator
  let target: { x: number; y: number; label: string } | null = null;
  if (data.playPhase === 'PHASE1_CITY' && data.truckPos) {
    target = { x: data.truckPos.x, y: data.truckPos.y, label: 'CAMINHÃO' };
  } else if (data.playPhase === 'PHASE2_CITY' && data.hospitalDoor) {
    target = {
      x: data.hospitalDoor.x + data.hospitalDoor.w / 2,
      y: data.hospitalDoor.y + data.hospitalDoor.h / 2,
      label: 'HOSPITAL',
    };
  } else if (data.playPhase === 'PHASE2_HOSPITAL') {
    if (data.generator && !data.generator.activated && data.fusesCollected >= data.generator.fusesRequired) {
      target = { x: data.generator.x, y: data.generator.y, label: 'GERADOR' };
    } else if (data.generator?.activated && data.stairExit) {
      target = {
        x: data.stairExit.x + data.stairExit.w / 2,
        y: data.stairExit.y + data.stairExit.h / 2,
        label: 'ESCADA',
      };
    }
  } else if (data.playPhase === 'PHASE2_ROOFTOP' && data.helipadPos) {
    target = { x: data.helipadPos.x, y: data.helipadPos.y, label: 'HELIPORTO' };
  }

  if (target) {
    const sp = worldToIso(target.x, target.y, 0, data.camera.x, data.camera.y, vw, vh);
    if (sp.x < 10 || sp.x > vw - 10 || sp.y < hudH + 10 || sp.y > vh - 10) {
      const ix = Math.max(38, Math.min(vw - 38, sp.x));
      const iy = Math.max(hudH + 16, Math.min(vh - 18, sp.y));
      ctx.fillStyle = '#ffcd75';
      ctx.fillRect(ix - 30, iy - 8, 60, 14);
      ctx.fillStyle = '#090b12';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(target.label, ix, iy + 2);
    }
  }
}

// --- TOP-DOWN FLYOVER OVER THE DESTROYED CITY (CUTSCENE_3_FINALE) ---
function renderFinaleOverflight(
  ctx: CanvasRenderingContext2D,
  vw: number,
  vh: number,
  data: RenderContextData
) {
  const t = data.globalTimer;
  // Dark night asphalt base
  ctx.fillStyle = '#0c0f1b';
  ctx.fillRect(0, 0, vw, vh);

  const cellSize = 110;
  const scrollX = t * 24;
  const scrollY = t * 52;
  const startCol = Math.floor(scrollX / cellSize) - 1;
  const endCol = startCol + Math.ceil(vw / cellSize) + 3;
  const startRow = Math.floor(scrollY / cellSize) - 1;
  const endRow = startRow + Math.ceil(vh / cellSize) + 3;

  // Scrolling Top-Down Destroyed City Grid
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const bx = col * cellSize - scrollX;
      const by = row * cellSize - scrollY;
      const hash = Math.abs((col * 73856093) ^ (row * 19349663));

      // Avenue vs city block
      const isRiverRow = Math.abs(row % 9) === 5;
      if (isRiverRow) {
        ctx.fillStyle = '#09182e';
        ctx.fillRect(bx, by, cellSize + 1, cellSize + 1);
        // Broken bridge deck across col === 1 or 2
        if (Math.abs(col % 4) === 1) {
          ctx.fillStyle = '#2d3342';
          ctx.fillRect(bx + 18, by, cellSize - 36, cellSize + 1);
          ctx.fillStyle = '#c49d2b';
          ctx.fillRect(bx + cellSize * 0.5 - 1, by + 8, 2, 16);
          ctx.fillRect(bx + cellSize * 0.5 - 1, by + 56, 2, 16);
        } else {
          ctx.fillStyle = '#14335e';
          ctx.fillRect(bx + ((hash % 40) + 10), by + 35, 22, 3);
        }
        continue;
      }

      // Street border + sidewalk + ruined block
      ctx.fillStyle = '#141928';
      ctx.fillRect(bx, by, cellSize + 1, cellSize + 1);
      // Road dashed lane lines
      ctx.fillStyle = '#64748b';
      ctx.fillRect(bx + 4, by + 6, 12, 2);
      ctx.fillRect(bx + 46, by + 6, 12, 2);
      ctx.fillRect(bx + 6, by + 28, 2, 12);

      // Ruined city block interior
      const pad = 16;
      ctx.fillStyle = '#202636';
      ctx.fillRect(bx + pad, by + pad, cellSize - pad * 2, cellSize - pad * 2);

      if (hash % 5 !== 0) {
        // Bombed-out building roof from top-down view
        const rw = cellSize - pad * 2 - 10;
        const rh = cellSize - pad * 2 - 10;
        const rx = bx + pad + 5;
        const ry = by + pad + 5;
        ctx.fillStyle = hash % 3 === 0 ? '#3a2b28' : '#2f3749';
        ctx.fillRect(rx, ry, rw, rh);
        // Collapsed black interior hole
        ctx.fillStyle = '#090b12';
        ctx.fillRect(rx + 8, ry + 8, rw * 0.52, rh * 0.48);
        // Rubble / exposed wall rims
        ctx.fillStyle = '#475569';
        ctx.fillRect(rx + 6, ry + 6, rw * 0.56, 3);
        ctx.fillRect(rx + 6, ry + 6, 3, rh * 0.52);

        // Occasional fire crater burning inside ruined building
        if (hash % 4 === 1) {
          const fx = rx + rw * 0.35;
          const fy = ry + rh * 0.35;
          const rad = 24 + Math.sin(t * 14 + hash) * 5;
          const fg = ctx.createRadialGradient(fx, fy, 2, fx, fy, rad);
          fg.addColorStop(0, 'rgba(255, 195, 70, 0.72)');
          fg.addColorStop(0.45, 'rgba(234, 88, 12, 0.38)');
          fg.addColorStop(1, 'rgba(234, 88, 12, 0)');
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(fx, fy, rad, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f97316';
          ctx.fillRect(fx - 4, fy - 4, 8, 8);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(fx - 2, fy - 2, 4, 4);
        }
      }

      // Wrecked street cars + burning street craters
      if (hash % 3 === 2) {
        ctx.fillStyle = '#475569';
        ctx.fillRect(bx + 26, by + 3, 14, 7);
        if (hash % 6 === 5) {
          const fx = bx + 33;
          const fy = by + 6;
          const fg = ctx.createRadialGradient(fx, fy, 1, fx, fy, 18);
          fg.addColorStop(0, 'rgba(251, 146, 60, 0.65)');
          fg.addColorStop(1, 'rgba(251, 146, 60, 0)');
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(fx, fy, 18, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Tiny wandering zombie dots in streets below
      if (hash % 2 === 0) {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(bx + 10 + ((t * 8 + hash) % 16), by + 48, 2, 2);
        ctx.fillRect(bx + 54, by + 10, 2, 2);
      }
    }
  }

  // Drifting smoke clouds high above the city
  for (let i = 0; i < 6; i++) {
    const sx = ((i * 95 + t * 14) % (vw + 120)) - 60;
    const sy = ((i * 140 + t * 38) % (vh + 120)) - 60;
    ctx.fillStyle = 'rgba(28, 32, 44, 0.28)';
    ctx.beginPath();
    ctx.arc(sx, sy, 38 + (i % 3) * 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // Helicopter flying top-down over the destroyed city (positioned in upper third so score card fits cleanly below!)
  const hx = vw * 0.5 + Math.sin(t * 1.4) * 18;
  const hy = vh * 0.24 + Math.cos(t * 1.1) * 7;

  // Searchlight sweep cone cast onto ruined streets below
  const sweepAng = Math.PI * 0.5 + Math.sin(t * 1.9) * 0.45;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const coneGrad = ctx.createRadialGradient(hx, hy, 8, hx + Math.cos(sweepAng) * 130, hy + Math.sin(sweepAng) * 130, 140);
  coneGrad.addColorStop(0, 'rgba(254, 249, 195, 0.34)');
  coneGrad.addColorStop(1, 'rgba(254, 249, 195, 0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + Math.cos(sweepAng - 0.32) * 190, hy + Math.sin(sweepAng - 0.32) * 190);
  ctx.lineTo(hx + Math.cos(sweepAng + 0.32) * 190, hy + Math.sin(sweepAng + 0.32) * 190);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Helicopter drop shadow offset down-right
  ctx.save();
  ctx.translate(hx + 22, hy + 28);
  ctx.scale(0.85, 0.85);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-4, 28, 8, 34);
  ctx.restore();

  // Detailed Top-Down Blackhawk Rescue Helicopter facing upward-north!
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(Math.sin(t * 1.4) * 0.06);

  // Tail boom + horizontal stabilizers + tail rotor blur
  ctx.fillStyle = '#090b12';
  ctx.fillRect(-6, 22, 12, 42);
  ctx.fillStyle = '#364534';
  ctx.fillRect(-4, 22, 8, 40);
  ctx.fillStyle = '#4c6148';
  ctx.fillRect(-16, 46, 32, 6);
  ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
  ctx.fillRect(4, 54, 8, 2);

  // Landing skids peeking left/right
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-20, -18, 4, 42);
  ctx.fillRect(16, -18, 4, 42);

  // Main Fuselage top-down hull
  ctx.fillStyle = '#090b12';
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4c6148';
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#688263';
  ctx.beginPath();
  ctx.ellipse(0, 2, 10, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Twin engine nacelles + Red Cross (+) emblem on roof
  ctx.fillStyle = '#2d3a2c';
  ctx.fillRect(-11, -4, 6, 16);
  ctx.fillRect(5, -4, 6, 16);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-6, 6, 12, 12);
  ctx.fillStyle = '#e43b44';
  ctx.fillRect(-2, 8, 4, 8);
  ctx.fillRect(-4, 10, 8, 4);

  // Tinted Blue Cockpit Windshield
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.ellipse(0, -21, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spinning 4-blade top-down main rotor disc + crisp blades
  const rAng = data.helicopter ? data.helicopter.rotorAngle : t * 28;
  ctx.fillStyle = 'rgba(226, 232, 240, 0.16)';
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(241, 245, 249, 0.9)';
  ctx.lineWidth = 3.5;
  for (let b = 0; b < 4; b++) {
    const a = rAng + (b * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 60, Math.sin(a) * 60);
    ctx.stroke();
  }
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Rain streaks & dark vignette
  drawNightStormOverlay(ctx, vw, vh, t);
  const vig = ctx.createRadialGradient(vw * 0.5, vh * 0.4, vw * 0.25, vw * 0.5, vh * 0.5, vh * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(5, 6, 12, 0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, vw, vh);
}
