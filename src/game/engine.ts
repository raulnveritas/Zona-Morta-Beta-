import { PALETTE, WEAPONS } from './constants';
import {
  createZombie,
  generateHospitalFloor,
  generateHospitalRooftop,
  generatePhase1City,
  generatePhase2City,
} from './mapGen';
import { isoToWorld, renderGame } from './renderer';
import { SoundEngine16Bit } from './sound';
import type {
  Barrel,
  BridgeObstacleKind,
  BridgeState,
  Building,
  Bullet,
  CarVariant,
  CutsceneDialogue,
  Decal,
  DifficultyKey,
  DynamicFlash,
  FireSpot,
  FloatingText,
  GameOverlayState,
  GameStats,
  GeneratorObject,
  HelicopterState,
  HudSnapshot,
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
  SurvivorKind,
  TruckDefenseState,
  WeaponState,
  Zombie,
  ZombieType,
} from './types';

function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export class ZonaMortaEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;

  public sfx = new SoundEngine16Bit();
  private viewWidth = 640;
  private viewHeight = 360;

  private overlay: GameOverlayState = 'MENU';
  private playPhase: PlayPhase = 'CUTSCENE_0_INTRO';
  private difficulty: DifficultyKey = 'normal';
  private gender: ProtagonistGender = 'male';

  private worldWidth = 3000;
  private worldHeight = 1900;
  private buildings: Building[] = [];
  private obstacles: Obstacle[] = [];
  private barrels: Barrel[] = [];
  private pickups: Pickup[] = [];
  private decals: Decal[] = [];
  private fires: FireSpot[] = [];
  private survivors: Survivor[] = [];
  private zombies: Zombie[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private streetLamps: StreetLamp[] = [];
  private dynamicFlashes: DynamicFlash[] = [];
  private floatingTexts: FloatingText[] = [];

  private riverX: number | null = null;
  private bridgeEntryY: number | null = null;
  private truckPos: { x: number; y: number } | null = null;
  private hospitalDoor: Rect | null = null;
  private stairExit: Rect | null = null;
  private generator: GeneratorObject | null = null;
  private helipadPos: { x: number; y: number } | null = null;

  private player!: Player;
  private playerTrail: { x: number; y: number }[] = [];
  private camera = { x: 0, y: 0, shake: 0 };

  private bridgeState: BridgeState | null = null;
  private truckDefense: TruckDefenseState | null = null;
  private rooftopBoarding: RooftopBoardingState | null = null;
  private helicopter: HelicopterState | null = null;
  private hospitalFloor = 1;
  private fusesCollected = 0;
  private finaleFlyover = false;
  private finaleScoreStep = 0;

  // Cutscene state machine
  private cutsceneElapsed = 0;
  private cutsceneQueue: CutsceneDialogue[] = [];
  private cutsceneSpeaker: string | null = null;
  private cutsceneText: string | null = null;
  private cutsceneBanner: string | null = null;
  private cutsceneFadeColor: string | null = null;
  private cutsceneFadeAlpha = 0;
  private nextBridgeObsId = 1;

  private globalTimer = 0;
  private lastFrameTime = 0;
  private rafId: number | null = null;

  // Checkpoint state
  private hasCheckpoint = false;
  private checkpointPhase: 'BRIDGE' | 'PHASE2' = 'BRIDGE';
  private checkpointWeapons: WeaponState[] | null = null;
  private checkpointWeaponIdx = 0;
  private checkpointStats: GameStats | null = null;
  private savedSquadPhase1: {
    kind: SurvivorKind;
    shirtColor: string;
    hairColor: string;
  }[] = [];

  private stats: GameStats = {
    score: 0,
    kills: 0,
    rescued: 0,
    policeRescued: 0,
    startTime: 0,
    elapsedTime: 0,
  };

  private keys: Record<string, boolean> = {};
  private mouse = { x: 320, y: 180, down: false, active: false };
  public touchMove = { x: 0, y: 0, active: false };
  public touchFiring = false;
  private isTouchDevice = false;
  private lastAimSource: 'mouse' | 'touch' = 'touch';

  private onHudUpdate: (snap: HudSnapshot) => void;
  private lastHudPush = 0;

  constructor(canvas: HTMLCanvasElement, onHudUpdate: (snap: HudSnapshot) => void) {
    this.canvas = canvas;
    const c2d = canvas.getContext('2d');
    if (!c2d) throw new Error('Canvas 2D não suportado');
    this.ctx = c2d;

    this.lightCanvas = document.createElement('canvas');
    const l2d = this.lightCanvas.getContext('2d');
    if (!l2d) throw new Error('Light canvas não suportado');
    this.lightCtx = l2d;

    this.onHudUpdate = onHudUpdate;
    this.isTouchDevice =
      'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.sfx.setActiveCheck(
      () => this.overlay === 'PLAYING' && !this.isCutscenePhase()
    );
    this.resize();
    this.bindEvents();
    this.initPreview();
  }

  private isCutscenePhase(): boolean {
    return (
      this.playPhase === 'CUTSCENE_0_INTRO' ||
      this.playPhase === 'CUTSCENE_1_BRIDGE' ||
      this.playPhase === 'CUTSCENE_2_CRASH' ||
      this.playPhase === 'CUTSCENE_3_FINALE'
    );
  }

  private resizeObs: ResizeObserver | null = null;

  private resize = () => {
    const parent = this.canvas.parentElement;
    const pw = parent ? parent.clientWidth : window.innerWidth;
    const ph = parent ? parent.clientHeight : window.innerHeight;
    const safeW = Math.max(240, pw);
    const safeH = Math.max(320, ph);
    const targetW = Math.max(340, Math.min(440, safeW));
    const targetH = Math.max(420, Math.round(targetW * (safeH / safeW)));

    this.canvas.width = targetW;
    this.canvas.height = targetH;
    this.viewWidth = targetW;
    this.viewHeight = targetH;
    this.lightCanvas.width = this.viewWidth;
    this.lightCanvas.height = this.viewHeight;
    this.ctx.imageSmoothingEnabled = false;
    this.lightCtx.imageSmoothingEnabled = false;
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;

    if (this.overlay !== 'PLAYING') {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (this.overlay === 'MENU' || this.overlay === 'VICTORY') {
          e.preventDefault();
          this.startNewMission(this.gender);
        }
      }
      return;
    }

    if (this.isCutscenePhase()) {
      if (e.code === 'Escape') this.skipCutscene();
      return;
    }

    if (this.playPhase === 'PHASE1_BRIDGE') {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.bridgeLaneStep(-1);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.bridgeLaneStep(1);
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.bridgeTurbo();
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.bridgeBrake();
      return;
    }

    if (e.code === 'Digit1') this.switchWeapon(0);
    if (e.code === 'Digit2') this.switchWeapon(1);
    if (e.code === 'Digit3') this.switchWeapon(2);
    if (e.code === 'Digit4') this.switchWeapon(3);
    if (e.code === 'KeyQ') this.cycleUnlockedWeapon();
    if (e.code === 'KeyR') this.triggerReload();
    if (e.code === 'KeyE') this.tryManualInteract();
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * this.viewWidth;
    this.mouse.y = ((e.clientY - rect.top) / rect.height) * this.viewHeight;
    this.mouse.active = true;
    this.lastAimSource = 'mouse';
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouse.down = true;
      this.mouse.active = true;
      this.lastAimSource = 'mouse';
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.down = false;
  };

  private bindEvents() {
    window.addEventListener('resize', this.resize);
    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this.resizeObs = new ResizeObserver(() => this.resize());
      this.resizeObs.observe(this.canvas.parentElement);
    }
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  public destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.sfx.stopBGM();
    this.resizeObs?.disconnect();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  public setDifficulty(diff: DifficultyKey) {
    this.difficulty = diff;
    this.sfx.init();
    this.sfx.sfxPickup();
  }

  public setGender(gender: ProtagonistGender) {
    this.gender = gender;
    this.sfx.init();
    this.sfx.sfxPickup();
    this.pushHud(true);
  }

  public bridgeLaneStep(delta: -1 | 1) {
    if (this.playPhase !== 'PHASE1_BRIDGE' || !this.bridgeState) return;
    const next = Math.max(-1, Math.min(1, this.bridgeState.lane + delta)) as -1 | 0 | 1;
    if (next !== this.bridgeState.lane) {
      this.bridgeState.lane = next;
      this.sfx.sfxSteer();
    }
  }

  public bridgeTurbo() {
    if (this.playPhase !== 'PHASE1_BRIDGE' || !this.bridgeState) return;
    this.bridgeState.turboTimer = 1.0;
    this.bridgeState.brakeTimer = 0;
    this.sfx.sfxTurbo();
  }

  public bridgeBrake() {
    if (this.playPhase !== 'PHASE1_BRIDGE' || !this.bridgeState) return;
    this.bridgeState.brakeTimer = 0.65;
    this.bridgeState.turboTimer = 0;
    this.sfx.sfxSteer();
  }

  public handleBridgeSwipe(dx: number, dy: number) {
    if (this.playPhase !== 'PHASE1_BRIDGE') return;
    if (Math.hypot(dx, dy) < 22) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.bridgeLaneStep(dx > 0 ? 1 : -1);
    } else if (dy < 0) {
      this.bridgeTurbo();
    } else {
      this.bridgeBrake();
    }
  }

  private applyWorld(world: ReturnType<typeof generatePhase1City>) {
    this.worldWidth = world.worldWidth;
    this.worldHeight = world.worldHeight;
    this.buildings = world.buildings;
    this.obstacles = world.obstacles;
    this.barrels = world.barrels;
    this.pickups = world.pickups;
    this.decals = world.decals;
    this.fires = world.fires;
    this.survivors = world.survivors;
    this.zombies = world.zombies;
    this.streetLamps = world.streetLamps;
    this.riverX = world.riverX;
    this.bridgeEntryY = world.bridgeEntryY;
    this.truckPos = world.truckPos;
    this.hospitalDoor = world.hospitalDoor;
    this.stairExit = world.stairExit;
    this.generator = world.generator;
    this.helipadPos = world.helipadPos;
    this.bullets = [];
    this.particles = [];
    this.dynamicFlashes = [];
    this.floatingTexts = [];
  }

  private initPreview() {
    this.overlay = 'MENU';
    this.playPhase = 'PHASE1_CITY';
    const world = generatePhase1City(this.difficulty);
    this.applyWorld(world);
    this.player = {
      x: 260,
      y: 1250,
      z: 0,
      radius: 10,
      speed: 146,
      hp: 100,
      maxHp: 100,
      angle: 0,
      animFrame: 0,
      invulnTimer: 0,
      weaponIndex: 0,
      weapons: [
        { unlocked: true, mag: 14, reserve: Infinity },
        { unlocked: false, mag: 0, reserve: 0 },
        { unlocked: false, mag: 0, reserve: 0 },
        { unlocked: false, mag: 0, reserve: 0 },
      ],
      fireCooldown: 0,
      reloading: false,
      reloadTimer: 0,
    };
    this.camera.x = 260;
    this.camera.y = 1250;
    this.pushHud(true);

    const loop = (ts: number) => {
      if (!this.lastFrameTime) this.lastFrameTime = ts;
      const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastFrameTime) / 1000));
      this.lastFrameTime = ts;
      this.update(dt);
      this.draw();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public startNewMission(selectedGender?: ProtagonistGender) {
    if (selectedGender) this.gender = selectedGender;
    this.hasCheckpoint = false;
    this.savedSquadPhase1 = [];
    this.overlay = 'PLAYING';
    this.bridgeState = null;
    this.truckDefense = null;
    this.rooftopBoarding = null;
    this.finaleFlyover = false;
    this.finaleScoreStep = 0;
    this.hospitalFloor = 1;
    this.fusesCollected = 0;

    const world = generatePhase1City(this.difficulty);
    this.applyWorld(world);

    this.stats = {
      score: 0,
      kills: 0,
      rescued: 0,
      policeRescued: 0,
      startTime: performance.now(),
      elapsedTime: 0,
    };

    this.player = {
      x: 260,
      y: 1250,
      z: 120, // Starts descending on rappel rope in Cutscene 0!
      radius: 10,
      speed: 146,
      hp: 100,
      maxHp: 100,
      angle: 0,
      animFrame: 0,
      invulnTimer: 0,
      weaponIndex: 0,
      weapons: [
        { unlocked: true, mag: 14, reserve: Infinity },
        { unlocked: false, mag: 0, reserve: 0 },
        { unlocked: false, mag: 0, reserve: 0 },
        { unlocked: false, mag: 0, reserve: 0 },
      ],
      fireCooldown: 0,
      reloading: false,
      reloadTimer: 0,
    };
    this.playerTrail = [{ x: 260, y: 1250 }];
    this.camera.x = 540;
    this.camera.y = 1050;

    // Start Cutscene 0: Rappel intro!
    this.startCutscene0();
    this.sfx.init();
    this.sfx.sfxRadioStatic();
    this.pushHud(true);
  }

  private startCutscene0() {
    this.playPhase = 'CUTSCENE_0_INTRO';
    this.cutsceneElapsed = 0;
    this.cutsceneFadeColor = '#000000';
    this.cutsceneFadeAlpha = 1;
    this.cutsceneBanner = null;
    this.helicopter = {
      x: 260,
      y: 1250,
      z: 145,
      rotorAngle: 0,
      searchlightAngle: 0,
      bladeSoundTimer: 0,
      rappelRopeLength: 0,
    };

    const soldierTitle = this.gender === 'female' ? 'SOLDADA' : 'SOLDADO';
    this.cutsceneQueue = [
      { speaker: 'COMANDANTE NO RÁDIO', text: 'Soldado, você me ouve? Responda.', duration: 2.3 },
      { speaker: soldierTitle, text: 'Alto e claro, comandante.', duration: 2.0 },
      {
        speaker: 'COMANDANTE',
        text: 'A cidade caiu. Perdemos contato com 2 equipes de resgate. Você é a última equipe que a gente tem.',
        duration: 3.4,
      },
      {
        speaker: 'COMANDANTE',
        text: 'Sua missão é simples: entre na cidade, resgate o máximo de sobreviventes que conseguir, e leve todo mundo pro hospital.',
        duration: 3.6,
      },
      { speaker: soldierTitle, text: 'E o hospital, comandante?', duration: 2.0 },
      {
        speaker: 'COMANDANTE',
        text: 'É o único ponto seguro que restou. No topo tem um heliporto. Se você chegar lá com eles, a gente tira vocês de lá.',
        duration: 3.6,
      },
      { speaker: soldierTitle, text: 'Entendido. Quantos sobreviventes?', duration: 2.1 },
      {
        speaker: 'COMANDANTE',
        text: 'Não sabemos. Pode ser 5, pode ser 20. Salve quem você puder. Não deixe ninguém pra trás.',
        duration: 3.3,
      },
      { speaker: soldierTitle, text: 'Tá bom. Vamos lá. Um por um.', duration: 2.3 },
    ];
  }

  private startCutscene1() {
    this.playPhase = 'CUTSCENE_1_BRIDGE';
    this.cutsceneElapsed = 0;
    this.cutsceneFadeColor = '#000000';
    this.cutsceneFadeAlpha = 0.55;
    this.cutsceneBanner = null;

    // Save Checkpoint at the truck!
    this.hasCheckpoint = true;
    this.checkpointPhase = 'BRIDGE';
    this.checkpointWeapons = this.player.weapons.map((w) => ({ ...w }));
    this.checkpointWeaponIdx = this.player.weaponIndex;
    this.checkpointStats = { ...this.stats };
    this.savedSquadPhase1 = this.survivors
      .filter((s) => s.rescued && (s.kind === 'civilian' || s.kind === 'police'))
      .map((s) => ({
        kind: s.kind,
        shirtColor: s.shirtColor,
        hairColor: s.hairColor,
      }));

    if (this.truckPos) {
      for (let i = 0; i < 22; i++) {
        this.zombies.push(
          createZombie(
            this.truckPos.x - 240 - Math.random() * 180,
            this.truckPos.y + (Math.random() - 0.5) * 280,
            'runner',
            this.difficulty
          )
        );
      }
    }

    const pTitle = this.gender === 'female' ? 'PROTAGONISTA' : 'PROTAGONISTA';
    this.cutsceneQueue = [
      { speaker: 'SOLDADO', text: 'Corre! Entra no caminhão! AGORA!', duration: 2.2 },
      { speaker: pTitle, text: 'E os outros? Tem gente pra trás ainda!', duration: 2.4 },
      { speaker: 'SOLDADO', text: 'Não tem mais tempo! Olha pra trás!', duration: 2.2 },
      {
        speaker: 'SOLDADO',
        text: 'Se a gente não for agora, a gente morre aqui! Segura todo mundo aí dentro!',
        duration: 3.0,
      },
      { speaker: pTitle, text: 'Vai! Acelera!', duration: 1.9 },
    ];
    this.sfx.sfxRescue();
    this.pushHud(true);
  }

  private startBridgeRun() {
    this.playPhase = 'PHASE1_BRIDGE';
    this.cutsceneSpeaker = null;
    this.cutsceneText = null;
    this.cutsceneBanner = null;
    this.cutsceneFadeAlpha = 0;
    this.bullets = [];
    this.particles = [];

    const chasing: BridgeState['chasingZombies'] = [];
    for (let i = 0; i < 16; i++) {
      chasing.push({
        lanePos: (Math.random() - 0.5) * 1.9,
        z: 0.03 + Math.random() * 0.08,
        anim: Math.random() * 10,
      });
    }

    this.bridgeState = {
      timeRemaining: 25,
      totalDuration: 25,
      lane: 0,
      lanePos: 0,
      turboTimer: 0,
      brakeTimer: 0,
      slowTimer: 0,
      recoverTimer: 0,
      hitsWithoutRecovery: 0,
      scrollOffset: 0,
      spawnTimer: 0.9,
      soldierFireTimer: 0.22,
      obstacles: [],
      chasingZombies: chasing,
      tracers: [],
      exploderSpawned: false,
      exploderZ: 1.0,
    };

    this.sfx.setTempo(170);
    this.sfx.startBGM(170);
    this.pushHud(true);
  }

  private startCutscene2Crash() {
    this.playPhase = 'CUTSCENE_2_CRASH';
    this.cutsceneElapsed = 0;
    this.cutsceneFadeColor = '#ffffff';
    this.cutsceneFadeAlpha = 0;
    this.cutsceneBanner = null;
    this.sfx.stopBGM();
    this.sfx.sfxExplosion();

    this.cutsceneQueue = [
      { speaker: 'PROTAGONISTA', text: 'CUIDADO!', duration: 1.4 },
      { speaker: 'SOLDADO', text: 'SEGURA!', duration: 1.5 },
      { speaker: '', text: 'Alguns minutos depois...', duration: 2.2 },
      {
        speaker: 'SOLDADO',
        text: '(tossindo) Você tá vivo? A gente conseguiu... quase todo mundo tá vivo.',
        duration: 3.1,
      },
      { speaker: 'PROTAGONISTA', text: 'E agora?', duration: 1.7 },
      {
        speaker: 'SOLDADO',
        text: 'Agora a gente tem que tirar todo mundo daqui. Me dá cobertura, eu tiro eles um por um.',
        duration: 3.3,
      },
    ];
    this.pushHud(true);
  }

  public continueFromCheckpoint() {
    if (!this.hasCheckpoint) {
      this.startNewMission(this.gender);
      return;
    }
    this.overlay = 'PLAYING';
    if (this.checkpointPhase === 'BRIDGE') {
      this.startBridgeRun();
    } else {
      this.startPhase2TruckDefense();
    }
  }

  private startPhase2TruckDefense() {
    this.hasCheckpoint = true;
    this.checkpointPhase = 'PHASE2';
    this.overlay = 'PLAYING';
    this.playPhase = 'PHASE2_TRUCK_DEFENSE';
    this.cutsceneSpeaker = null;
    this.cutsceneText = null;
    this.cutsceneBanner = null;
    this.cutsceneFadeAlpha = 0;
    this.bridgeState = null;
    this.helicopter = null;
    this.hospitalFloor = 1;

    const world = generatePhase2City(this.difficulty);
    this.applyWorld(world);

    if (this.checkpointStats) {
      this.stats = {
        ...this.checkpointStats,
        startTime: performance.now() - this.checkpointStats.elapsedTime * 1000,
      };
    }

    const restoredWeapons: WeaponState[] = this.checkpointWeapons
      ? this.checkpointWeapons.map((w) => ({ ...w }))
      : [
          { unlocked: true, mag: 14, reserve: Infinity },
          { unlocked: false, mag: 0, reserve: 0 },
          { unlocked: false, mag: 0, reserve: 0 },
          { unlocked: false, mag: 0, reserve: 0 },
        ];

    this.player = {
      x: 335,
      y: 1125,
      z: 0,
      radius: 10,
      speed: 146,
      hp: 100,
      maxHp: 100,
      angle: 0,
      animFrame: 0,
      invulnTimer: 1.0,
      weaponIndex: this.checkpointWeaponIdx,
      weapons: restoredWeapons,
      fireCooldown: 0,
      reloading: false,
      reloadTimer: 0,
    };
    this.playerTrail = [{ x: this.player.x, y: this.player.y }];

    // Only 1 Surviving Allied Soldier beside overturned truck!
    this.survivors.push({
      id: 9001,
      kind: 'soldier',
      x: 295,
      y: 1095,
      radius: 10,
      rescued: true,
      hp: 9999,
      maxHp: 9999,
      invulnTimer: 0,
      angle: 0,
      animTimer: 0,
      helpTimer: 0,
      fireCooldown: 0.3,
      shirtColor: '#3f5932',
      hairColor: '#2d4023',
    });

    const roster =
      this.savedSquadPhase1.length > 0
        ? this.savedSquadPhase1
        : [{ kind: 'civilian' as SurvivorKind, shirtColor: '#73eff7', hairColor: '#3b2518' }];

    this.truckDefense = {
      x: 260,
      y: 1125,
      totalToExtract: roster.length,
      extractedCount: 0,
      extractTimer: 2.3,
      extractInterval: 2.5,
      completed: false,
      savedRoster: roster,
    };

    for (let i = 0; i < 10; i++) {
      const ang = (Math.random() - 0.5) * 1.4;
      const dist = 270 + Math.random() * 140;
      this.zombies.push(
        createZombie(
          260 + Math.cos(ang) * dist,
          1125 + Math.sin(ang) * dist,
          i % 3 === 0 ? 'runner' : 'walker',
          this.difficulty
        )
      );
    }

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.sfx.setTempo(185);
    this.sfx.startBGM(185);
    this.addFloatingText(this.player.x, this.player.y - 26, 'DÊ COBERTURA AO SOLDADO!', '#ffcd75');
    this.pushHud(true);
  }

  private enterHospitalFloor(floorNum: number) {
    this.playPhase = 'PHASE2_HOSPITAL';
    this.hospitalFloor = floorNum;
    this.fusesCollected = 0;
    const prevFollowers = this.survivors.filter((s) => s.rescued);

    const world = generateHospitalFloor(floorNum, this.difficulty);
    this.applyWorld(world);

    this.player.x = 90;
    this.player.y = 400;
    this.playerTrail = [{ x: this.player.x, y: this.player.y }];

    // Followers wait safely near the generator!
    prevFollowers.forEach((f, idx) => {
      f.x = 125 + (idx % 3) * 18;
      f.y = 380 + Math.floor(idx / 3) * 18;
      this.survivors.push(f);
    });

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.addFloatingText(
      this.player.x,
      this.player.y - 26,
      `${floorNum}º ANDAR · ACHE 1 FUSÍVEL`,
      '#ffcd75'
    );
    this.sfx.sfxPickup();
    this.pushHud(true);
  }

  private enterHospitalRooftop() {
    this.playPhase = 'PHASE2_ROOFTOP';
    const prevFollowers = this.survivors.filter((s) => s.rescued);
    const world = generateHospitalRooftop(this.difficulty);
    this.applyWorld(world);

    this.player.x = 120;
    this.player.y = 360;
    this.playerTrail = [{ x: this.player.x, y: this.player.y }];

    prevFollowers.forEach((f, idx) => {
      f.x = 85 + (idx % 2) * 16;
      f.y = 325 + (idx % 4) * 18;
      this.survivors.push(f);
    });

    this.rooftopBoarding = {
      active: false,
      boardingSurvivorId: null,
      boardedCount: 0,
      totalToBoard: prevFollowers.length,
      boardTimer: 0.8,
      spawnTimer: 1.6,
      completed: prevFollowers.length === 0,
    };

    this.helicopter = {
      x: 860,
      y: 360,
      z: 0,
      rotorAngle: 0,
      searchlightAngle: 0,
      bladeSoundTimer: 0,
      rappelRopeLength: 0,
    };

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.addFloatingText(this.player.x, this.player.y - 24, 'HELIPORTO! CUBRA O EMBARQUE!', '#ffcd75');
    this.pushHud(true);
  }

  private startCutscene3Finale() {
    this.playPhase = 'CUTSCENE_3_FINALE';
    this.cutsceneElapsed = 0;
    this.cutsceneFadeColor = '#000000';
    this.cutsceneFadeAlpha = 0;
    this.cutsceneBanner = null;
    this.finaleFlyover = false;
    this.finaleScoreStep = 0;
    this.zombies = [];
    this.bullets = [];
    this.survivors = [];
    this.player.z = -999;
    this.sfx.stopBGM();
    this.sfx.sfxRescue();

    // Short takeoff & flyover sequence — no long ground dialogue, focuses on takeoff -> flyover -> item-by-item score!
    this.cutsceneQueue = [
      { speaker: 'PILOTO', text: 'Todo mundo a bordo! Decolando agora!', duration: 3.5 },
      { speaker: '', text: '', duration: 11.5 },
    ];
    this.pushHud(true);
  }

  public skipCutscene() {
    if (!this.isCutscenePhase()) return;
    if (this.playPhase === 'CUTSCENE_0_INTRO') {
      this.playPhase = 'PHASE1_CITY';
      this.helicopter = null;
      this.player.z = 0;
      this.cutsceneSpeaker = null;
      this.cutsceneText = null;
      this.cutsceneBanner = null;
      this.cutsceneFadeAlpha = 0;
      this.camera.x = this.player.x;
      this.camera.y = this.player.y;
      this.sfx.startBGM(185);
    } else if (this.playPhase === 'CUTSCENE_1_BRIDGE') {
      this.startBridgeRun();
    } else if (this.playPhase === 'CUTSCENE_2_CRASH') {
      this.startPhase2TruckDefense();
    } else if (this.playPhase === 'CUTSCENE_3_FINALE') {
      this.overlay = 'VICTORY';
      this.finaleFlyover = false;
      this.finaleScoreStep = 5;
      this.cutsceneSpeaker = null;
      this.cutsceneText = null;
      this.cutsceneFadeAlpha = 0;
      this.sfx.stopBGM();
    }
    this.pushHud(true);
  }

  public cycleUnlockedWeapon() {
    for (let offset = 1; offset <= WEAPONS.length; offset++) {
      const nextIdx = (this.player.weaponIndex + offset) % WEAPONS.length;
      if (this.player.weapons[nextIdx].unlocked) {
        this.switchWeapon(nextIdx);
        return;
      }
    }
  }

  public switchWeapon(idx: number) {
    if (!this.player.weapons[idx] || !this.player.weapons[idx].unlocked) {
      this.addFloatingText(this.player.x, this.player.y - 18, 'ARMA BLOQUEADA', '#94b0c2');
      return;
    }
    if (this.player.weaponIndex === idx) return;
    this.player.weaponIndex = idx;
    this.player.reloading = false;
    this.player.reloadTimer = 0;
    this.sfx.sfxReload();
    this.addFloatingText(this.player.x, this.player.y - 18, WEAPONS[idx].shortName, WEAPONS[idx].color);
  }

  public triggerReload() {
    const wDef = WEAPONS[this.player.weaponIndex];
    const wState = this.player.weapons[this.player.weaponIndex];
    if (this.player.reloading) return;
    if (wState.mag >= wDef.magSize) return;
    if (!wDef.infinite && wState.reserve <= 0) {
      this.addFloatingText(this.player.x, this.player.y - 18, 'SEM MUNIÇÃO!', '#e43b44');
      return;
    }
    this.player.reloading = true;
    this.player.reloadTimer = wDef.reloadTime;
    this.sfx.sfxReload();
    this.addFloatingText(this.player.x, this.player.y - 18, 'RECARREGANDO...', '#ffcd75');
  }

  private tryManualInteract() {
    if (this.playPhase === 'PHASE1_CITY' && this.truckPos) {
      if (Math.hypot(this.player.x - this.truckPos.x, this.player.y - this.truckPos.y) < 110) {
        this.startCutscene1();
      }
    } else if (this.playPhase === 'PHASE2_HOSPITAL' && this.generator) {
      if (Math.hypot(this.player.x - this.generator.x, this.player.y - this.generator.y) < 55) {
        this.tryActivateGenerator();
      }
    }
  }

  private tryActivateGenerator() {
    if (!this.generator || this.generator.activated) return;
    if (this.fusesCollected >= this.generator.fusesRequired) {
      this.generator.fusesInserted = this.generator.fusesRequired;
      this.generator.activated = true;
      this.sfx.sfxPowerUpGenerator();
      this.addFloatingText(this.generator.x, this.generator.y - 24, 'ENERGIA RESTAURADA! ESCADA ABERTA!', '#38b764');
    } else {
      this.addFloatingText(
        this.generator.x,
        this.generator.y - 24,
        `FALTA 1 FUSÍVEL (${this.fusesCollected}/1)`,
        '#ffcd75'
      );
    }
  }

  private getSafeBuildingContaining(x: number, y: number, pad = 0): Building | null {
    for (const b of this.buildings) {
      if (!b.safe) continue;
      if (
        x >= b.x - pad &&
        x <= b.x + b.w + pad &&
        y >= b.y - pad &&
        y <= b.y + b.h + pad
      ) {
        return b;
      }
    }
    return null;
  }

  private pointBlockedForEntity(x: number, y: number, radius: number, isZombie: boolean): boolean {
    const maxX =
      this.riverX !== null && this.playPhase === 'PHASE1_CITY'
        ? this.riverX - 18
        : this.worldWidth - 20;
    if (
      x < radius + 20 ||
      y < radius + 20 ||
      x > maxX - radius ||
      y > this.worldHeight - radius - 20
    ) {
      return true;
    }

    if (isZombie) {
      for (const b of this.buildings) {
        if (!b.safe) continue;
        if (
          x + radius > b.x &&
          x - radius < b.x + b.w &&
          y + radius > b.y &&
          y - radius < b.y + b.h
        ) {
          return true;
        }
      }
    }

    for (const b of this.buildings) {
      for (const w of b.walls) {
        const cx = Math.max(w.x, Math.min(x, w.x + w.w));
        const cy = Math.max(w.y, Math.min(y, w.y + w.h));
        if ((x - cx) ** 2 + (y - cy) ** 2 < radius * radius) {
          return true;
        }
      }
    }

    for (const obs of this.obstacles) {
      const cx = Math.max(obs.x, Math.min(x, obs.x + obs.w));
      const cy = Math.max(obs.y, Math.min(y, obs.y + obs.h));
      if ((x - cx) ** 2 + (y - cy) ** 2 < radius * radius) {
        return true;
      }
    }

    return false;
  }

  private moveWithSlide(
    entity: { x: number; y: number; radius: number },
    dx: number,
    dy: number,
    isZombie: boolean
  ) {
    const nx = entity.x + dx;
    if (!this.pointBlockedForEntity(nx, entity.y, entity.radius, isZombie)) {
      entity.x = nx;
    }
    const ny = entity.y + dy;
    if (!this.pointBlockedForEntity(entity.x, ny, entity.radius, isZombie)) {
      entity.y = ny;
    }
  }

  private firePlayerWeapon() {
    if (this.player.reloading || this.player.fireCooldown > 0) return;
    const wDef = WEAPONS[this.player.weaponIndex];
    const wState = this.player.weapons[this.player.weaponIndex];

    if (wState.mag <= 0) {
      if (wDef.infinite || wState.reserve > 0) this.triggerReload();
      else this.switchWeapon(0);
      return;
    }

    wState.mag--;
    this.player.fireCooldown = wDef.fireRate;
    this.camera.shake = Math.max(
      this.camera.shake,
      wDef.id === 'shotgun' ? 4.5 : wDef.id === 'flamethrower' ? 1.5 : 2
    );

    if (wDef.id === 'pistol') this.sfx.sfxPistol();
    else if (wDef.id === 'shotgun') this.sfx.sfxShotgun();
    else if (wDef.id === 'flamethrower') this.sfx.playNoise(0.09, 0.13, 650, 'lowpass');
    else this.sfx.sfxMachineGun();

    const muzzleX = this.player.x + Math.cos(this.player.angle) * 14;
    const muzzleY = this.player.y + Math.sin(this.player.angle) * 14;

    this.dynamicFlashes.push({
      x: muzzleX,
      y: muzzleY,
      radius: wDef.id === 'shotgun' ? 145 : wDef.id === 'flamethrower' ? 120 : 100,
      color:
        wDef.id === 'flamethrower'
          ? 'rgba(255, 130, 40, 0.92)'
          : 'rgba(255, 232, 120, 0.92)',
      life: 0.1,
    });

    // Gunfire noise attracts nearby zombies toward player!
    for (const z of this.zombies) {
      if (Math.hypot(z.x - this.player.x, z.y - this.player.y) < 480) {
        z.alertTimer = 4.5;
      }
    }

    for (let i = 0; i < wDef.count; i++) {
      const ang = this.player.angle + (Math.random() - 0.5) * wDef.spread;
      // Spawn at player center so point-blank / touching zombies can ALWAYS be hit!
      this.bullets.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(ang) * wDef.speed,
        vy: Math.sin(ang) * wDef.speed,
        damage: wDef.damage,
        isFlame: wDef.id === 'flamethrower',
        life: wDef.id === 'flamethrower' ? 0.36 : wDef.id === 'shotgun' ? 0.38 : 0.68,
        color: wDef.color,
      });
    }

    if (wState.mag === 0 && (wDef.infinite || wState.reserve > 0)) {
      this.triggerReload();
    }
  }

  private triggerExplosion(x: number, y: number, isToxic = false) {
    this.sfx.sfxExplosion();
    this.camera.shake = isToxic ? 6 : 11;

    this.decals.push({
      type: isToxic ? 'toxic_puddle' : 'crater',
      x,
      y,
      size: isToxic ? 32 : 30,
    });
    this.dynamicFlashes.push({
      x,
      y,
      radius: isToxic ? 150 : 220,
      color: isToxic ? 'rgba(80, 255, 120, 0.95)' : 'rgba(255, 170, 60, 0.95)',
      life: 0.25,
    });

    const fireColors = isToxic
      ? ['#a7f070', '#38b764', '#257179', '#ffffff']
      : ['#ffffff', '#ffcd75', '#f77622', '#e43b44', '#333c57'];

    for (let i = 0; i < 28; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        z: 10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        size: 4 + Math.random() * 6,
        color: fireColors[Math.floor(Math.random() * fireColors.length)],
      });
    }

    const blastRadius = isToxic ? 75 : 100;
    const hitTargets = this.zombies
      .map((z) => ({ z, dist: Math.hypot(z.x - x, z.y - y) }))
      .filter((item) => item.dist < blastRadius);

    for (const item of hitTargets) {
      const curIdx = this.zombies.indexOf(item.z);
      if (curIdx !== -1) {
        this.damageZombie(
          curIdx,
          (isToxic ? 95 : 190) * (1 - item.dist / blastRadius),
          Math.atan2(item.z.y - y, item.z.x - x),
          !isToxic
        );
      }
    }

    const pDist = Math.hypot(this.player.x - x, this.player.y - y);
    if (pDist < blastRadius * 0.72) {
      this.damagePlayer(20 * (1 - pDist / (blastRadius * 0.72)));
    }
  }

  private damageZombie(index: number, dmg: number, knockAngle: number, ignite = false) {
    const z = this.zombies[index];
    if (!z) return;
    z.hp -= dmg;
    z.hitFlash = 0.1;
    if (ignite) z.burnTimer = 2.4;
    // Safe knockback that respects walls and pushes zombie away from player
    this.moveWithSlide(z, Math.cos(knockAngle) * 10, Math.sin(knockAngle) * 10, true);

    for (let p = 0; p < 4; p++) {
      const a = knockAngle + (Math.random() - 0.5) * 1.2;
      const s = 30 + Math.random() * 60;
      this.particles.push({
        x: z.x,
        y: z.y,
        z: 10,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25,
        maxLife: 0.25,
        size: 3,
        color: z.type === 'toxic' ? '#38b764' : PALETTE.bloodFresh,
      });
    }

    if (z.hp <= 0) {
      const zx = z.x;
      const zy = z.y;
      const wasToxic = z.type === 'toxic';
      this.stats.kills++;
      this.stats.score += z.score;
      this.sfx.sfxZombiePop();

      // Zombie death green pixel chunks + blood explosion!
      const popColors = ['#58a846', '#73f78b', '#cf232e', '#7d141b'];
      for (let k = 0; k < 16; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 115;
        this.particles.push({
          x: zx,
          y: zy,
          z: 10 + Math.random() * 8,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.35 + Math.random() * 0.25,
          maxLife: 0.6,
          size: 3.5 + Math.random() * 3.5,
          color: popColors[k % popColors.length],
        });
      }

      if (this.decals.length > 220) {
        const rmIdx = this.decals.findIndex((d) => d.type === 'blood' || d.type === 'green_splat');
        if (rmIdx !== -1) this.decals.splice(rmIdx, 1);
      }
      this.decals.push({
        type: wasToxic ? 'toxic_puddle' : 'green_splat',
        x: zx,
        y: zy,
        size: z.radius + 6,
      });
      this.decals.push({
        type: 'blood',
        x: zx + 4,
        y: zy + 2,
        size: z.radius + 2,
      });
      this.addFloatingText(zx, zy - 12, `+${z.score}`, '#ffcd75');
      this.zombies.splice(index, 1);

      if (wasToxic) {
        this.triggerExplosion(zx, zy, true);
      }
    }
  }

  private damagePlayer(amount: number) {
    if (this.player.invulnTimer > 0 || this.overlay !== 'PLAYING') return;
    if (this.getSafeBuildingContaining(this.player.x, this.player.y, -4)) return;

    this.player.hp = Math.max(0, this.player.hp - amount);
    this.player.invulnTimer = 0.65;
    this.camera.shake = 6;
    this.sfx.sfxHurt();
    this.addFloatingText(this.player.x, this.player.y - 18, `-${Math.ceil(amount)} HP`, '#e43b44');

    if (this.player.hp <= 0) {
      this.overlay = 'GAME_OVER';
      this.sfx.stopBGM();
      this.pushHud(true);
    }
  }

  private addFloatingText(x: number, y: number, text: string, color = '#ffffff') {
    if (this.floatingTexts.length >= 4) {
      this.floatingTexts.shift();
    }
    this.floatingTexts.push({ x, y, text, color, life: 0.65 });
  }

  private update(dt: number) {
    this.globalTimer += dt;

    if (this.overlay !== 'PLAYING') {
      if (this.overlay === 'MENU') {
        for (const z of this.zombies) z.animTimer += dt * 4;
      }
      return;
    }

    if (!this.isCutscenePhase()) {
      this.stats.elapsedTime = (performance.now() - this.stats.startTime) / 1000;
    }

    if (this.isCutscenePhase()) {
      this.updateCutscenes(dt);
      this.pushHud(false);
      return;
    }

    if (this.playPhase === 'PHASE1_BRIDGE') {
      this.updateBridgePhase(dt);
      this.pushHud(false);
      return;
    }

    this.updateIsometricGameplay(dt);
    this.pushHud(false);
  }

  private advanceDialogueQueue(dt: number): number {
    this.cutsceneElapsed += dt;
    let accum = 0;
    for (let i = 0; i < this.cutsceneQueue.length; i++) {
      const item = this.cutsceneQueue[i];
      if (this.cutsceneElapsed < accum + item.duration) {
        this.cutsceneSpeaker = item.speaker || null;
        this.cutsceneText = item.text;
        return i;
      }
      accum += item.duration;
    }
    return -1; // finished
  }

  private updateCutscenes(dt: number) {
    const idx = this.advanceDialogueQueue(dt);

    if (this.playPhase === 'CUTSCENE_0_INTRO' && this.helicopter) {
      this.helicopter.rotorAngle += dt * 28;
      this.helicopter.bladeSoundTimer -= dt;
      if (this.helicopter.bladeSoundTimer <= 0) {
        this.sfx.sfxChopperBlade();
        this.helicopter.bladeSoundTimer = 0.12;
      }

      if (this.cutsceneElapsed < 4.5) {
        this.cutsceneFadeAlpha = Math.max(0, 1 - (this.cutsceneElapsed - 2.0) * 0.5);
        this.camera.x = 540 - Math.min(280, this.cutsceneElapsed * 65);
        this.camera.y = 1050 + Math.min(200, this.cutsceneElapsed * 45);
      } else if (this.cutsceneElapsed < 11.0) {
        this.cutsceneFadeAlpha = 0;
        this.camera.x += (this.player.x - this.camera.x) * dt * 3;
        this.camera.y += (this.player.y - this.camera.y) * dt * 3;
        // Soldier rappels down from helicopter!
        this.helicopter.rappelRopeLength = 135;
        this.player.z = Math.max(0, 120 - (this.cutsceneElapsed - 5.0) * 32);
      } else {
        this.helicopter.rappelRopeLength = 0;
        this.player.z = 0;
        if (this.cutsceneElapsed > 19.5) {
          this.helicopter.x += dt * 110;
          this.helicopter.y -= dt * 70;
          this.helicopter.z += dt * 24;
        }
        if (this.cutsceneElapsed > 23.0) {
          this.cutsceneBanner =
            'MISSÃO: RESGATE · SALVE OS SOBREVIVENTES · CHEGUE AO HOSPITAL';
        }
      }

      if (idx === -1) {
        this.skipCutscene();
      }
      return;
    }

    if (this.playPhase === 'CUTSCENE_1_BRIDGE') {
      if (this.truckPos) {
        this.camera.x += (this.truckPos.x - 120 - this.camera.x) * dt * 4;
        this.camera.y += (this.truckPos.y - this.camera.y) * dt * 4;
        for (const z of this.zombies) {
          z.animTimer += dt * 12;
          const ang = Math.atan2(this.truckPos.y - z.y, this.truckPos.x - z.x);
          z.x += Math.cos(ang) * z.speed * dt;
          z.y += Math.sin(ang) * z.speed * dt;
        }
        if (this.cutsceneElapsed > 8.5) {
          this.camera.shake = 6;
        }
      }
      if (idx === -1) {
        this.startBridgeRun();
      }
      return;
    }

    if (this.playPhase === 'CUTSCENE_2_CRASH') {
      if (this.cutsceneElapsed < 1.5) {
        this.camera.shake = 12;
        this.cutsceneFadeColor = '#ffffff';
        this.cutsceneFadeAlpha = Math.min(1, this.cutsceneElapsed * 1.4);
      } else if (this.cutsceneElapsed < 4.9) {
        this.cutsceneFadeColor = '#000000';
        this.cutsceneFadeAlpha = 1;
      } else {
        this.cutsceneFadeColor = '#000000';
        this.cutsceneFadeAlpha = Math.max(0, 1 - (this.cutsceneElapsed - 4.9) * 1.1);
      }
      if (idx === -1) {
        this.startPhase2TruckDefense();
      }
      return;
    }

    if (this.playPhase === 'CUTSCENE_3_FINALE' && this.helicopter) {
      this.helicopter.rotorAngle += dt * 36;
      this.helicopter.searchlightAngle += dt * 1.8;
      this.helicopter.bladeSoundTimer -= dt;
      if (this.helicopter.bladeSoundTimer <= 0) {
        this.sfx.sfxChopperBlade();
        this.helicopter.bladeSoundTimer = 0.09;
      }

      if (this.cutsceneElapsed < 3.5) {
        // Stage 1: Helicopter taking off from the hospital rooftop!
        this.finaleFlyover = false;
        this.helicopter.z += dt * 42;
        this.helicopter.x += dt * 24;
        this.helicopter.y -= dt * 14;
        this.camera.x += (this.helicopter.x - this.camera.x) * dt * 3;
        this.camera.y += (this.helicopter.y - this.camera.y) * dt * 3;
        if (this.cutsceneElapsed > 2.9) {
          this.cutsceneFadeColor = '#090b12';
          this.cutsceneFadeAlpha = Math.min(1, (this.cutsceneElapsed - 2.9) / 0.6);
        }
      } else {
        // Stage 2: Flying over the destroyed burning city (top-down view) with item-by-item score reveal!
        this.finaleFlyover = true;
        this.cutsceneSpeaker = null;
        this.cutsceneText = null;
        this.cutsceneFadeAlpha = Math.max(0, 1 - (this.cutsceneElapsed - 3.5) * 1.6);

        const prevStep = this.finaleScoreStep;
        if (this.cutsceneElapsed >= 11.4) this.finaleScoreStep = 5;
        else if (this.cutsceneElapsed >= 9.7) this.finaleScoreStep = 4;
        else if (this.cutsceneElapsed >= 8.0) this.finaleScoreStep = 3;
        else if (this.cutsceneElapsed >= 6.3) this.finaleScoreStep = 2;
        else if (this.cutsceneElapsed >= 4.6) this.finaleScoreStep = 1;

        if (this.finaleScoreStep > prevStep) {
          if (this.finaleScoreStep === 5) this.sfx.sfxRescue();
          else this.sfx.sfxPickup();
        }
      }

      if (idx === -1) {
        this.overlay = 'VICTORY';
        this.finaleFlyover = false;
        this.cutsceneSpeaker = null;
        this.cutsceneText = null;
        this.cutsceneFadeAlpha = 0;
        this.sfx.stopBGM();
      }
    }
  }

  private updateBridgePhase(dt: number) {
    const bs = this.bridgeState;
    if (!bs) return;

    bs.timeRemaining = Math.max(0, bs.timeRemaining - dt);

    // Last 8s: screen trembles & music speeds up!
    if (bs.timeRemaining <= 8) {
      this.camera.shake = Math.max(this.camera.shake, 3.2);
      this.sfx.setTempo(125);
    } else if (bs.timeRemaining <= 14) {
      this.sfx.setTempo(150);
    }

    // Last 2.5 seconds dialogue banner
    if (bs.timeRemaining <= 2.5) {
      this.cutsceneSpeaker = 'SOLDADO';
      this.cutsceneText = 'Quase lá! Só mais um pouco!';
    } else {
      this.cutsceneSpeaker = null;
      this.cutsceneText = null;
    }

    if (bs.slowTimer > 0) {
      bs.slowTimer = Math.max(0, bs.slowTimer - dt);
    } else if (bs.hitsWithoutRecovery > 0) {
      bs.recoverTimer += dt;
      if (bs.recoverTimer >= 5.5) {
        bs.hitsWithoutRecovery = Math.max(0, bs.hitsWithoutRecovery - 1);
        bs.recoverTimer = 0;
      }
    }

    if (bs.turboTimer > 0) bs.turboTimer = Math.max(0, bs.turboTimer - dt);
    if (bs.brakeTimer > 0) bs.brakeTimer = Math.max(0, bs.brakeTimer - dt);

    const speedFactor =
      bs.slowTimer > 0
        ? 0.55
        : bs.turboTimer > 0
          ? 1.48
          : bs.brakeTimer > 0
            ? 0.72
            : 1.0;
    bs.scrollOffset += dt * 7.8 * speedFactor;

    // Smooth lane transition
    bs.lanePos += (bs.lane - bs.lanePos) * Math.min(1, dt * 14);

    // Spawn obstacles progressively across 25s run
    bs.spawnTimer -= dt;
    if (bs.spawnTimer <= 0 && bs.timeRemaining > 2.0) {
      const last12 = bs.timeRemaining <= 12;
      bs.spawnTimer = last12 ? 0.68 + Math.random() * 0.36 : 1.05 + Math.random() * 0.48;
      const lanes: (-1 | 0 | 1)[] = [-1, 0, 1];
      const openLane = lanes[Math.floor(Math.random() * 3)];
      const kinds: BridgeObstacleKind[] = ['wrecked_car', 'barrier'];
      const carColors = ['#b82535', '#3259b8', '#d9a31e', '#5d687a', '#2b7a44'];
      const variants: CarVariant[] = ['sedan', 'suv', 'police'];

      for (const ln of lanes) {
        if (ln === openLane) continue;
        if (last12 || Math.random() < 0.62) {
          const kind = kinds[Math.floor(Math.random() * kinds.length)];
          const variant = variants[this.nextBridgeObsId % 4 === 0 ? 2 : this.nextBridgeObsId % 2];
          bs.obstacles.push({
            id: this.nextBridgeObsId++,
            lane: ln,
            z: 1.0,
            kind,
            color: variant === 'police' ? '#1e293b' : carColors[this.nextBridgeObsId % carColors.length],
            burning: kind === 'wrecked_car' && Math.random() < 0.45,
            carVariant: variant,
            hit: false,
          });
        }
      }
    }

    // Move obstacles toward camera (z: 1.0 -> 0.0)
    const obsSpeed = (bs.timeRemaining <= 12 ? 0.65 : 0.52) * speedFactor;
    const truckHitZ = bs.turboTimer > 0 ? 0.30 : bs.brakeTimer > 0 ? 0.23 : 0.26;
    for (let i = bs.obstacles.length - 1; i >= 0; i--) {
      const obs = bs.obstacles[i];
      obs.z -= obsSpeed * dt;

      if (!obs.hit && Math.abs(obs.z - truckHitZ) <= 0.04) {
        if (Math.abs(obs.lane - bs.lanePos) < 0.42) {
          obs.hit = true;
          bs.slowTimer = 2.0;
          bs.turboTimer = 0;
          bs.recoverTimer = 0;
          bs.hitsWithoutRecovery++;
          this.camera.shake = 10;
          this.sfx.sfxCrash();

          if (bs.hitsWithoutRecovery >= 3) {
            this.overlay = 'GAME_OVER';
            this.sfx.stopBGM();
            this.pushHud(true);
            return;
          }
        }
      }

      if (obs.z < -0.05) bs.obstacles.splice(i, 1);
    }

    // Chasing horde moves closer when slowed!
    const targetHordeZ =
      0.04 + bs.hitsWithoutRecovery * 0.05 + (bs.slowTimer > 0 ? 0.04 : 0);
    for (const cz of bs.chasingZombies) {
      cz.anim += dt * 14;
      cz.z += (targetHordeZ - cz.z) * dt * 2.5;
    }

    // Soldiers in back of truck shoot visual tracers at horde
    bs.soldierFireTimer -= dt;
    if (bs.soldierFireTimer <= 0 && bs.chasingZombies.length > 0) {
      bs.soldierFireTimer = 0.2;
      this.sfx.sfxMachineGun();
      const cz =
        bs.chasingZombies[Math.floor(Math.random() * bs.chasingZombies.length)];
      const truckScreenX = this.viewWidth * 0.5 + bs.lanePos * 0.62 * (this.viewWidth * 0.24);
      const czScreenX = this.viewWidth * 0.5 + cz.lanePos * 0.62 * (this.viewWidth * 0.36);
      bs.tracers.push({
        x1: truckScreenX + (Math.random() - 0.5) * 20,
        y1: this.viewHeight * 0.64,
        x2: czScreenX,
        y2: this.viewHeight * 0.88,
        life: 0.08,
      });
    }

    for (let i = bs.tracers.length - 1; i >= 0; i--) {
      bs.tracers[i].life -= dt;
      if (bs.tracers[i].life <= 0) bs.tracers.splice(i, 1);
    }

    // End of 50s -> Explosive zombie appears & Cutscene 2!
    if (bs.timeRemaining <= 1.2 && !bs.exploderSpawned) {
      bs.exploderSpawned = true;
      bs.exploderZ = 0.85;
    }
    if (bs.exploderSpawned) {
      bs.exploderZ -= dt * 0.7;
    }

    if (bs.timeRemaining <= 0) {
      this.startCutscene2Crash();
    }

    if (this.camera.shake > 0) {
      this.camera.shake = Math.max(0, this.camera.shake - dt * 20);
    }
  }

  private updateIsometricGameplay(dt: number) {
    // Screen-aligned Top-Down input mapped cleanly to Isometric world!
    let ix = 0;
    let iy = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) iy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) iy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) ix -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) ix += 1;

    if (this.touchMove.active) {
      ix = this.touchMove.x;
      iy = this.touchMove.y;
    }

    let worldDx = ix + iy;
    let worldDy = iy - ix;
    const len = Math.hypot(worldDx, worldDy);
    if (len > 0) {
      worldDx /= len;
      worldDy /= len;
      this.moveWithSlide(
        this.player,
        worldDx * this.player.speed * dt,
        worldDy * this.player.speed * dt,
        false
      );
      this.player.animFrame += dt * 10;

      const lastT = this.playerTrail[0];
      if (!lastT || Math.hypot(this.player.x - lastT.x, this.player.y - lastT.y) >= 18) {
        this.playerTrail.unshift({ x: this.player.x, y: this.player.y });
        if (this.playerTrail.length > 70) this.playerTrail.pop();
      }
    }

    // Building Roof Fade: 15% opacity when inside, 100% outside!
    for (const b of this.buildings) {
      const inside =
        this.player.x >= b.x &&
        this.player.x <= b.x + b.w &&
        this.player.y >= b.y &&
        this.player.y <= b.y + b.h;
      const targetAlpha = inside ? 0.15 : 1.0;
      b.roofAlpha += (targetAlpha - b.roofAlpha) * Math.min(1, dt * 8);
    }

    if (this.touchMove.active || this.touchFiring) {
      this.lastAimSource = 'touch';
    }

    // Isometric Mouse Aiming or Mobile Auto-Aim toward nearest zombie
    const useMobileAutoAim =
      this.lastAimSource === 'touch' || !this.mouse.active;
    if (!useMobileAutoAim) {
      const worldMouse = isoToWorld(
        this.mouse.x,
        this.mouse.y,
        this.camera.x,
        this.camera.y,
        this.viewWidth,
        this.viewHeight
      );
      this.player.angle = Math.atan2(
        worldMouse.y - this.player.y,
        worldMouse.x - this.player.x
      );
    } else {
      let nearestZ: Zombie | null = null;
      let bestDist = 300;
      for (const z of this.zombies) {
        const d = Math.hypot(z.x - this.player.x, z.y - this.player.y);
        if (d < bestDist) {
          bestDist = d;
          nearestZ = z;
        }
      }
      if (nearestZ) {
        this.player.angle = Math.atan2(
          nearestZ.y - this.player.y,
          nearestZ.x - this.player.x
        );
      } else if (len > 0) {
        this.player.angle = Math.atan2(worldDy, worldDx);
      }
    }

    if (this.player.invulnTimer > 0) this.player.invulnTimer -= dt;
    if (this.player.fireCooldown > 0) this.player.fireCooldown -= dt;

    if (this.player.reloading) {
      this.player.reloadTimer -= dt;
      if (this.player.reloadTimer <= 0) {
        this.player.reloading = false;
        const wDef = WEAPONS[this.player.weaponIndex];
        const wState = this.player.weapons[this.player.weaponIndex];
        if (wDef.infinite) {
          wState.mag = wDef.magSize;
        } else {
          const needed = wDef.magSize - wState.mag;
          const load = Math.min(needed, wState.reserve);
          wState.mag += load;
          wState.reserve -= load;
        }
      }
    }

    if (this.mouse.down || this.keys['Space'] || this.touchFiring) {
      this.firePlayerWeapon();
    }

    // Phase 2 Truck Defense: Soldier pulls survivors slowly 1 by 1 while player covers
    if (
      this.playPhase === 'PHASE2_TRUCK_DEFENSE' &&
      this.truckDefense &&
      !this.truckDefense.completed
    ) {
      this.truckDefense.extractTimer -= dt;
      if (this.truckDefense.extractTimer <= 0) {
        const idx = this.truckDefense.extractedCount;
        const info = this.truckDefense.savedRoster[idx];
        if (info) {
          this.survivors.push({
            id: 5000 + idx,
            kind: info.kind,
            x: this.truckDefense.x + 28,
            y: this.truckDefense.y + 38,
            radius: 10,
            rescued: true,
            hp: 135,
            maxHp: 135,
            invulnTimer: 0,
            angle: 0,
            animTimer: 0,
            helpTimer: 0,
            fireCooldown: 0.3,
            shirtColor: info.shirtColor,
            hairColor: info.hairColor,
          });
          this.sfx.sfxRescue();
          this.addFloatingText(
            this.truckDefense.x + 25,
            this.truckDefense.y + 16,
            `RETIRADO ${idx + 1}/${this.truckDefense.totalToExtract}`,
            '#38b764'
          );
        }
        this.truckDefense.extractedCount++;
        this.truckDefense.extractTimer = this.truckDefense.extractInterval;

        if (this.truckDefense.extractedCount >= this.truckDefense.totalToExtract) {
          this.truckDefense.completed = true;
          this.playPhase = 'PHASE2_CITY';
          this.addFloatingText(
            this.player.x,
            this.player.y - 28,
            'TODOS FORA! SIGAM PARA O HOSPITAL!',
            '#ffcd75'
          );
        }
      }

      if (this.zombies.length < 18 && Math.random() < dt * 1.3) {
        const ang = (Math.random() - 0.5) * 1.8;
        const dist = 280 + Math.random() * 110;
        const zx = this.truckDefense.x + Math.cos(ang) * dist;
        const zy = this.truckDefense.y + Math.sin(ang) * dist;
        if (!this.pointBlockedForEntity(zx, zy, 12, true)) {
          this.zombies.push(
            createZombie(
              zx,
              zy,
              Math.random() < 0.35 ? 'runner' : 'walker',
              this.difficulty
            )
          );
        }
      }
    }

    if (
      this.playPhase === 'PHASE2_HOSPITAL' &&
      !this.generator?.activated &&
      Math.random() < dt * 0.45
    ) {
      this.sfx.sfxLampBuzz();
    }

    // Bullets (continuous swept segment collision so point-blank & fast shots NEVER miss!)
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const prevX = b.x;
      const prevY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      let hitBarrel = false;
      for (let bi = this.barrels.length - 1; bi >= 0; bi--) {
        const bar = this.barrels[bi];
        if (distPointToSegment(bar.x, bar.y, prevX, prevY, b.x, b.y) < bar.radius + 4) {
          bar.hp -= b.damage;
          hitBarrel = true;
          if (bar.hp <= 0) {
            this.barrels.splice(bi, 1);
            this.triggerExplosion(bar.x, bar.y, false);
          }
          break;
        }
      }
      if (hitBarrel) {
        this.bullets.splice(i, 1);
        continue;
      }

      let hitZombie = false;
      for (let zi = this.zombies.length - 1; zi >= 0; zi--) {
        const z = this.zombies[zi];
        if (distPointToSegment(z.x, z.y, prevX, prevY, b.x, b.y) < z.radius + (b.isFlame ? 10 : 6)) {
          this.damageZombie(zi, b.damage, Math.atan2(b.vy, b.vx), b.isFlame);
          if (!b.isFlame) {
            this.bullets.splice(i, 1);
            hitZombie = true;
            break;
          }
        }
      }
      if (hitZombie) continue;

      if (b.life <= 0 || this.pointBlockedForEntity(b.x, b.y, 2, false)) {
        this.bullets.splice(i, 1);
      }
    }

    // Survivors, Police & Allied Soldier AI
    let followerIdx = 0;
    const holdNearGenerator =
      this.playPhase === 'PHASE2_HOSPITAL' &&
      this.generator &&
      !this.generator.activated;

    for (let si = this.survivors.length - 1; si >= 0; si--) {
      const s = this.survivors[si];
      s.animTimer += dt * 7;
      if (s.invulnTimer > 0) s.invulnTimer -= dt;
      if (s.fireCooldown > 0) s.fireCooldown -= dt;

      if (!s.rescued) {
        const dPlayer = Math.hypot(this.player.x - s.x, this.player.y - s.y);
        if (dPlayer < 42) {
          s.rescued = true;
          if (s.kind === 'civilian') {
            this.stats.rescued++;
            this.stats.score += 500;
          } else if (s.kind === 'police') {
            this.stats.rescued++;
            this.stats.policeRescued++;
            this.stats.score += 600;
          }
          this.sfx.sfxRescue();
          this.addFloatingText(
            s.x,
            s.y - 18,
            s.kind === 'police'
              ? 'POLICIAL NO ESQUADRÃO!'
              : s.kind === 'soldier'
                ? 'SOLDADO ALIADO!'
                : 'SEGUINDO VOCÊ! +500',
            '#38b764'
          );
        } else {
          s.helpTimer -= dt;
          if (s.helpTimer <= 0 && dPlayer < 320) {
            this.sfx.sfxHelpCall();
            this.addFloatingText(
              s.x,
              s.y - 16,
              s.kind === 'police' ? 'COBERTURA!' : 'SOCORRO!',
              '#73eff7'
            );
            s.helpTimer = 3.8 + Math.random() * 2.5;
          }
        }
      }

      // Police & Soldier shoot zombies
      if (s.kind === 'police' || s.kind === 'soldier') {
        let nearestZ: Zombie | null = null;
        let bestDist = 250;
        for (const z of this.zombies) {
          const zd = Math.hypot(z.x - s.x, z.y - s.y);
          if (zd < bestDist) {
            bestDist = zd;
            nearestZ = z;
          }
        }
        if (nearestZ) {
          s.angle = Math.atan2(nearestZ.y - s.y, nearestZ.x - s.x);
          if (s.fireCooldown <= 0) {
            s.fireCooldown = s.kind === 'soldier' ? 0.34 : 0.6;
            this.sfx.sfxPoliceShot();
            const mx = s.x + Math.cos(s.angle) * 12;
            const my = s.y + Math.sin(s.angle) * 12;
            this.dynamicFlashes.push({
              x: mx,
              y: my,
              radius: 75,
              color: 'rgba(255, 220, 120, 0.75)',
              life: 0.05,
            });
            this.bullets.push({
              x: mx,
              y: my,
              vx: Math.cos(s.angle) * 430,
              vy: Math.sin(s.angle) * 430,
              damage: s.kind === 'soldier' ? 28 : 26,
              isFlame: false,
              life: 0.65,
              color: '#73eff7',
              fromAlly: true,
            });
          }
        }
      }

      // Followers line up in queue behind player (or wait safely by generator on Hospital floors, or board chopper 1-by-1 on Rooftop!)
      if (s.rescued) {
        if (
          s.kind === 'soldier' &&
          this.playPhase === 'PHASE2_TRUCK_DEFENSE' &&
          this.truckDefense &&
          !this.truckDefense.completed
        ) {
          continue;
        }

        // Rooftop 1-by-1 helicopter boarding: only the currently boarding survivor walks into the open chopper door!
        if (
          this.playPhase === 'PHASE2_ROOFTOP' &&
          this.rooftopBoarding?.active &&
          this.helicopter
        ) {
          if (this.rooftopBoarding.boardingSurvivorId === s.id) {
            const doorX = this.helicopter.x - 10;
            const doorY = this.helicopter.y + 18;
            const dx = doorX - s.x;
            const dy = doorY - s.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 22) {
              this.rooftopBoarding.boardedCount++;
              this.rooftopBoarding.boardingSurvivorId = null;
              this.rooftopBoarding.boardTimer = 0.65;
              this.sfx.sfxRescue();
              this.addFloatingText(
                doorX,
                doorY - 22,
                `EMBARCOU ${this.rooftopBoarding.boardedCount}/${this.rooftopBoarding.totalToBoard}`,
                '#38b764'
              );
              this.survivors.splice(si, 1);
            } else {
              this.moveWithSlide(s, (dx / dist) * 105 * dt, (dy / dist) * 105 * dt, false);
              s.angle = Math.atan2(dy, dx);
            }
            continue;
          }
          // Others wait in safe staging semicircle near helipad until it's their turn
          const waitX = this.helicopter.x - 125 - (followerIdx % 2) * 24;
          const waitY = this.helicopter.y - 40 + (followerIdx % 5) * 22;
          const dx = waitX - s.x;
          const dy = waitY - s.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 8) {
            this.moveWithSlide(s, (dx / dist) * 120 * dt, (dy / dist) * 120 * dt, false);
            if (s.kind === 'civilian') s.angle = Math.atan2(dy, dx);
          }
          followerIdx++;
          continue;
        }

        if (holdNearGenerator && this.generator) {
          const waitX = this.generator.x - 20 + (followerIdx % 3) * 18;
          const waitY = this.generator.y + 36 + Math.floor(followerIdx / 3) * 16;
          const dx = waitX - s.x;
          const dy = waitY - s.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 6) {
            this.moveWithSlide(s, (dx / dist) * 110 * dt, (dy / dist) * 110 * dt, false);
          }
          followerIdx++;
          continue;
        }

        const trailSlot = Math.min(
          this.playerTrail.length - 1,
          (followerIdx + 1) * 2
        );
        const target = this.playerTrail[trailSlot] || this.player;
        const dx = target.x - s.x;
        const dy = target.y - s.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 280) {
          s.x = target.x;
          s.y = target.y;
        } else if (dist > 14) {
          const spd = Math.min(140, 118 + dist * 0.35);
          this.moveWithSlide(s, (dx / dist) * spd * dt, (dy / dist) * spd * dt, false);
          if (s.kind === 'civilian') s.angle = Math.atan2(dy, dx);
        }
        followerIdx++;
      }
    }

    // Keep city streets populated with diverse zombie hordes!
    if (
      (this.playPhase === 'PHASE1_CITY' || this.playPhase === 'PHASE2_CITY') &&
      this.zombies.length < 56 &&
      Math.random() < dt * 0.45
    ) {
      const ang = Math.random() * Math.PI * 2;
      const baseDist = 310 + Math.random() * 110;
      const cx = this.player.x + Math.cos(ang) * baseDist;
      const cy = this.player.y + Math.sin(ang) * baseDist;
      const roamPool: ZombieType[] = ['walker', 'runner', 'crawler', 'toxic', 'fireman', 'riot'];
      for (let h = 0; h < 7; h++) {
        const zx = cx + (Math.random() - 0.5) * 90;
        const zy = cy + (Math.random() - 0.5) * 90;
        if (!this.pointBlockedForEntity(zx, zy, 12, true)) {
          this.zombies.push(
            createZombie(
              zx,
              zy,
              roamPool[Math.floor(Math.random() * roamPool.length)],
              this.difficulty
            )
          );
        }
      }
    }

    // Zombies
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      z.animTimer += dt * (z.type === 'runner' ? 12 : 7);
      if (z.hitFlash > 0) z.hitFlash -= dt;
      if (z.alertTimer > 0) z.alertTimer -= dt;

      if (z.burnTimer > 0) {
        z.burnTimer -= dt;
        z.hp -= 18 * dt;
        if (z.hp <= 0) {
          this.damageZombie(i, 1, 0, false);
          continue;
        }
      }

      let targetX = this.player.x;
      let targetY = this.player.y;
      let targetDist = Math.hypot(this.player.x - z.x, this.player.y - z.y);
      let targetPolice: Survivor | null = null;

      if (this.getSafeBuildingContaining(this.player.x, this.player.y)) {
        targetDist += 180;
      }

      // ONLY Police Officers take damage from zombies (civilians never take damage!)
      for (const s of this.survivors) {
        if (s.kind !== 'police') continue;
        if (this.getSafeBuildingContaining(s.x, s.y)) continue;
        const sd = Math.hypot(s.x - z.x, s.y - z.y);
        if (sd < targetDist) {
          targetDist = sd;
          targetX = s.x;
          targetY = s.y;
          targetPolice = s;
        }
      }

      z.groanTimer -= dt;
      if (z.groanTimer <= 0 && targetDist < 240) {
        this.sfx.sfxZombieGroan();
        z.groanTimer = 4 + Math.random() * 7;
      }

      const aggroRange = z.alertTimer > 0 ? 580 : 450;
      const rushMult = z.alertTimer > 0 ? 1.12 : 1.0;
      if (targetDist < aggroRange) {
        z.angle = Math.atan2(targetY - z.y, targetX - z.x);
        const minTargetSep = z.radius + (targetPolice ? targetPolice.radius : this.player.radius);
        const actualDist = Math.hypot(targetX - z.x, targetY - z.y);

        let vx = 0;
        let vy = 0;
        if (actualDist > minTargetSep) {
          vx = Math.cos(z.angle) * z.speed * rushMult;
          vy = Math.sin(z.angle) * z.speed * rushMult;
        } else if (actualDist > 0.01) {
          // Physical separation so runners NEVER overlap/glue inside the player or police!
          const push = (minTargetSep - actualDist) * 10 + 40;
          vx -= ((targetX - z.x) / actualDist) * push;
          vy -= ((targetY - z.y) / actualDist) * push;
        } else {
          // Emergency unstick if exactly on top
          vx += 60;
        }

        for (let j = 0; j < this.zombies.length; j++) {
          if (i === j) continue;
          const other = this.zombies[j];
          const d = Math.hypot(z.x - other.x, z.y - other.y);
          if (d > 0 && d < z.radius + other.radius) {
            vx += ((z.x - other.x) / d) * 35;
            vy += ((z.y - other.y) / d) * 35;
          }
        }
        this.moveWithSlide(z, vx * dt, vy * dt, true);
      }

      if (
        targetPolice &&
        Math.hypot(targetPolice.x - z.x, targetPolice.y - z.y) <
          z.radius + targetPolice.radius + 2
      ) {
        if (targetPolice.invulnTimer <= 0) {
          targetPolice.hp -= z.damage;
          targetPolice.invulnTimer = 0.7;
          this.addFloatingText(
            targetPolice.x,
            targetPolice.y - 16,
            `-${Math.ceil(z.damage)}`,
            '#e43b44'
          );
          if (targetPolice.hp <= 0) {
            const idx = this.survivors.indexOf(targetPolice);
            if (idx !== -1) {
              this.addFloatingText(
                targetPolice.x,
                targetPolice.y - 22,
                'POLICIAL CAIU!',
                '#e43b44'
              );
              this.survivors.splice(idx, 1);
            }
          }
        }
      } else if (
        Math.hypot(this.player.x - z.x, this.player.y - z.y) <
        z.radius + this.player.radius + 2
      ) {
        this.damagePlayer(z.damage);
      }
    }

    // Collect Pickups (Weapons, Medkits, Fuses!)
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.bob += dt * 4;
      if (Math.hypot(this.player.x - pk.x, this.player.y - pk.y) < this.player.radius + 18) {
        if (pk.type === 'fuse') {
          this.fusesCollected++;
          this.sfx.sfxPickup();
          this.addFloatingText(
            pk.x,
            pk.y - 16,
            `FUSÍVEL ${this.fusesCollected}/1`,
            '#ffcd75'
          );
        } else if (pk.type.startsWith('crate_')) {
          this.sfx.sfxRescue();
          const wIdx = WEAPONS.findIndex((w) => w.id === pk.weaponId);
          if (wIdx !== -1) {
            const wDef = WEAPONS[wIdx];
            const wState = this.player.weapons[wIdx];
            const firstTime = !wState.unlocked;
            wState.unlocked = true;
            wState.mag = wDef.magSize;
            wState.reserve += wDef.magSize * 3;
            this.switchWeapon(wIdx);
            this.addFloatingText(
              pk.x,
              pk.y - 16,
              firstTime ? `NOVA ARMA: ${wDef.name}` : `+MUNIÇÃO ${wDef.shortName}`,
              wDef.color
            );
          }
        } else {
          this.sfx.sfxPickup();
          if (pk.type === 'medkit') {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
            this.addFloatingText(pk.x, pk.y - 12, '+40 HP', '#38b764');
          } else if (pk.type === 'shotgun_ammo') {
            this.player.weapons[1].reserve += 12;
            this.addFloatingText(pk.x, pk.y - 12, '+12 ESCOPETA', '#ffcd75');
          } else if (pk.type === 'smg_ammo') {
            this.player.weapons[2].reserve += 45;
            this.addFloatingText(pk.x, pk.y - 12, '+45 FUZIL', '#e43b44');
          } else if (pk.type === 'flame_ammo') {
            this.player.weapons[3].reserve += 60;
            this.addFloatingText(pk.x, pk.y - 12, '+60 COMBUSTÍVEL', '#f77622');
          }
        }
        this.pickups.splice(i, 1);
      }
    }

    // Auto-insert fuse when returning to the Generator with 1/1 fuse!
    if (
      this.playPhase === 'PHASE2_HOSPITAL' &&
      this.generator &&
      !this.generator.activated &&
      Math.hypot(this.player.x - this.generator.x, this.player.y - this.generator.y) < 42
    ) {
      if (this.fusesCollected >= this.generator.fusesRequired) {
        this.tryActivateGenerator();
      }
    }

    // Objective Triggers
    if (this.playPhase === 'PHASE1_CITY' && this.truckPos) {
      const bx = this.truckPos.x - 62;
      const by = this.truckPos.y;
      if (
        Math.hypot(this.player.x - bx, this.player.y - by) < 42 ||
        Math.hypot(this.player.x - this.truckPos.x, this.player.y - this.truckPos.y) < 72
      ) {
        this.startCutscene1();
        return;
      }
    } else if (this.playPhase === 'PHASE2_CITY' && this.hospitalDoor) {
      if (
        this.player.x >= this.hospitalDoor.x &&
        this.player.x <= this.hospitalDoor.x + this.hospitalDoor.w &&
        this.player.y >= this.hospitalDoor.y &&
        this.player.y <= this.hospitalDoor.y + this.hospitalDoor.h
      ) {
        this.enterHospitalFloor(1);
        return;
      }
    } else if (this.playPhase === 'PHASE2_HOSPITAL' && this.stairExit) {
      if (
        this.player.x >= this.stairExit.x &&
        this.player.x <= this.stairExit.x + this.stairExit.w &&
        this.player.y >= this.stairExit.y &&
        this.player.y <= this.stairExit.y + this.stairExit.h
      ) {
        if (this.generator && !this.generator.activated) {
          if (Math.floor(this.globalTimer * 2) % 3 === 0) {
            this.addFloatingText(
              this.stairExit.x + 40,
              this.stairExit.y - 10,
              'TRANCADA! LIGUE O GERADOR!',
              '#e43b44'
            );
          }
        } else if (this.hospitalFloor < 4) {
          this.enterHospitalFloor(this.hospitalFloor + 1);
        } else {
          this.enterHospitalRooftop();
        }
        return;
      }
    } else if (this.playPhase === 'PHASE2_ROOFTOP' && this.helicopter) {
      this.helicopter.rotorAngle += dt * 26;
      this.helicopter.searchlightAngle += dt * 1.4;
      this.helicopter.bladeSoundTimer -= dt;
      if (this.helicopter.bladeSoundTimer <= 0) {
        this.sfx.sfxChopperBlade();
        this.helicopter.bladeSoundTimer = 0.13;
      }

      if (this.rooftopBoarding) {
        const dChopper = Math.hypot(
          this.player.x - this.helicopter.x,
          this.player.y - this.helicopter.y
        );
        if (!this.rooftopBoarding.active && dChopper < 360) {
          this.rooftopBoarding.active = true;
          this.addFloatingText(
            this.player.x,
            this.player.y - 24,
            'CUBRA O HELICÓPTERO! EMBARQUE INICIADO!',
            '#ffcd75'
          );
        }

        if (this.rooftopBoarding.active && !this.rooftopBoarding.completed) {
          if (this.survivors.length === 0) {
            this.rooftopBoarding.completed = true;
            this.addFloatingText(
              this.helicopter.x,
              this.helicopter.y - 34,
              'TODOS A BORDO! ENTRE NO HELICÓPTERO!',
              '#38b764'
            );
          } else {
            if (this.rooftopBoarding.boardingSurvivorId === null) {
              this.rooftopBoarding.boardTimer -= dt;
              if (this.rooftopBoarding.boardTimer <= 0) {
                this.rooftopBoarding.boardingSurvivorId = this.survivors[0].id;
              }
            }
            // Spawn rooftop stairwell zombies while player covers boarding!
            this.rooftopBoarding.spawnTimer -= dt;
            if (this.rooftopBoarding.spawnTimer <= 0 && this.zombies.length < 14) {
              this.rooftopBoarding.spawnTimer = 2.1;
              const topSide = Math.random() > 0.5;
              const zx = 75 + Math.random() * 60;
              const zy = topSide ? 90 + Math.random() * 60 : 570 + Math.random() * 60;
              const rTypes: ZombieType[] = ['surgeon', 'runner', 'doctor', 'nurse', 'riot'];
              this.zombies.push(
                createZombie(
                  zx,
                  zy,
                  rTypes[Math.floor(Math.random() * rTypes.length)],
                  this.difficulty,
                  4
                )
              );
            }
          }
        }

        if (this.rooftopBoarding.completed && dChopper < 68) {
          this.startCutscene3Finale();
          return;
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.dynamicFlashes.length - 1; i >= 0; i--) {
      this.dynamicFlashes[i].life -= dt;
      if (this.dynamicFlashes[i].life <= 0) this.dynamicFlashes.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 22 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Smooth Isometric Camera Follow
    this.camera.x += (this.player.x - this.camera.x) * Math.min(1, dt * 8);
    this.camera.y += (this.player.y - this.camera.y) * Math.min(1, dt * 8);
    if (this.camera.shake > 0) {
      this.camera.shake = Math.max(0, this.camera.shake - dt * 26);
    }
  }

  private draw() {
    renderGame(
      this.ctx,
      this.lightCtx,
      this.lightCanvas,
      this.viewWidth,
      this.viewHeight,
      {
        playPhase: this.playPhase,
        gender: this.gender,
        worldWidth: this.worldWidth,
        worldHeight: this.worldHeight,
        camera: this.camera,
        globalTimer: this.globalTimer,
        player: this.player,
        zombies: this.zombies,
        survivors: this.survivors,
        buildings: this.buildings,
        obstacles: this.obstacles,
        barrels: this.barrels,
        pickups: this.pickups,
        decals: this.decals,
        fires: this.fires,
        bullets: this.bullets,
        particles: this.particles,
        streetLamps: this.streetLamps,
        dynamicFlashes: this.dynamicFlashes,
        floatingTexts: this.floatingTexts,
        riverX: this.riverX,
        bridgeEntryY: this.bridgeEntryY,
        truckPos: this.truckPos,
        hospitalDoor: this.hospitalDoor,
        stairExit: this.stairExit,
        generator: this.generator,
        helipadPos: this.helipadPos,
        helicopter: this.helicopter,
        bridgeState: this.bridgeState,
        rooftopBoarding: this.rooftopBoarding,
        hospitalFloor: this.hospitalFloor,
        fusesCollected: this.fusesCollected,
        stats: this.stats,
        playerInSafeBuilding: this.getSafeBuildingContaining(
          this.player.x,
          this.player.y
        ),
        cutsceneActive: this.isCutscenePhase(),
        finaleFlyover: this.finaleFlyover,
      },
      this.overlay === 'MENU'
    );
  }

  private pushHud(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastHudPush < 100) return;
    this.lastHudPush = now;

    const rescueBonus = this.stats.rescued * 1000;
    let rank: 'S' | 'A' | 'B' | 'C' = 'C';
    if (this.stats.rescued >= 6 && this.stats.elapsedTime < 420) rank = 'S';
    else if (this.stats.rescued >= 4) rank = 'A';
    else if (this.stats.rescued >= 2) rank = 'B';

    const showFinalScore =
      this.overlay === 'VICTORY' || this.playPhase === 'CUTSCENE_3_FINALE';

    this.onHudUpdate({
      overlay: this.overlay,
      playPhase: this.playPhase,
      gender: this.gender,
      score: this.stats.score + (showFinalScore ? rescueBonus : 0),
      kills: this.stats.kills,
      rescued: this.stats.rescued,
      policeRescued: this.stats.policeRescued,
      elapsedTime: this.stats.elapsedTime,
      hospitalFloor: this.hospitalFloor,
      fusesCollected: this.fusesCollected,
      fusesRequired: this.generator?.fusesRequired ?? 1,
      generatorActive: this.generator?.activated ?? false,
      hasCheckpoint: this.hasCheckpoint,
      bridgeActive: this.playPhase === 'PHASE1_BRIDGE',
      bridgeTimeRemaining: this.bridgeState ? this.bridgeState.timeRemaining : 25,
      bridgeHits: this.bridgeState ? this.bridgeState.hitsWithoutRecovery : 0,
      bridgeSlowed: this.bridgeState ? this.bridgeState.slowTimer > 0 : false,
      cutsceneActive: this.isCutscenePhase(),
      cutsceneSpeaker: this.cutsceneSpeaker,
      cutsceneText: this.cutsceneText,
      cutsceneBanner: this.cutsceneBanner,
      cutsceneFadeColor: this.cutsceneFadeColor,
      cutsceneFadeAlpha: this.cutsceneFadeAlpha,
      playerHp: Math.ceil(this.player ? this.player.hp : 100),
      rank,
      rescueBonus,
      rooftopBoardingActive: Boolean(
        this.playPhase === 'PHASE2_ROOFTOP' && this.rooftopBoarding?.active
      ),
      rooftopBoarded: this.rooftopBoarding?.boardedCount ?? 0,
      rooftopTotalToBoard: this.rooftopBoarding?.totalToBoard ?? 0,
      finaleFlyover: this.finaleFlyover,
      finaleScoreStep: this.finaleScoreStep,
    });
  }
}
