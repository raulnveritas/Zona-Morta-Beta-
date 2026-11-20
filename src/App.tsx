import React, { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ZonaMortaEngine } from './game/engine';
import type {
  DifficultyKey,
  HudSnapshot,
  ProtagonistGender,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  overlay: 'MENU',
  playPhase: 'CUTSCENE_0_INTRO',
  gender: 'male',
  score: 0,
  kills: 0,
  rescued: 0,
  policeRescued: 0,
  elapsedTime: 0,
  hospitalFloor: 1,
  fusesCollected: 0,
  fusesRequired: 1,
  generatorActive: false,
  hasCheckpoint: false,
  bridgeActive: false,
  bridgeTimeRemaining: 25,
  bridgeHits: 0,
  bridgeSlowed: false,
  cutsceneActive: false,
  cutsceneSpeaker: null,
  cutsceneText: null,
  cutsceneBanner: null,
  cutsceneFadeColor: null,
  cutsceneFadeAlpha: 0,
  playerHp: 100,
  rank: 'C',
  rescueBonus: 0,
  rooftopBoardingActive: false,
  rooftopBoarded: 0,
  rooftopTotalToBoard: 0,
  finaleFlyover: false,
  finaleScoreStep: 0,
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ZonaMortaEngine | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const joyZoneRef = useRef<HTMLDivElement | null>(null);
  const joyDraggingRef = useRef(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [gender, setGender] = useState<ProtagonistGender>('male');
  const [difficulty, setDifficulty] = useState<DifficultyKey>('normal');
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new ZonaMortaEngine(canvasRef.current, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleSelectGender = (g: ProtagonistGender) => {
    setGender(g);
    engineRef.current?.setGender(g);
  };

  const handleSelectDifficulty = (diff: DifficultyKey) => {
    setDifficulty(diff);
    engineRef.current?.setDifficulty(diff);
  };

  const handleStartNew = () => {
    engineRef.current?.startNewMission(gender);
  };

  const handleContinueCheckpoint = () => {
    engineRef.current?.continueFromCheckpoint();
  };

  const handleSkipCutscene = () => {
    engineRef.current?.skipCutscene();
  };

  const handleToggleMute = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.sfx.init();
    setMuted(eng.sfx.toggleMute());
  };

  const updateJoystickAt = (clientX: number, clientY: number) => {
    const eng = engineRef.current;
    const zone = joyZoneRef.current;
    const knob = joyKnobRef.current;
    if (!eng || !zone || !knob) return;

    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const maxDist = 46;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    eng.touchMove = { x: dx / maxDist, y: dy / maxDist, active: true };
  };

  const handleJoystickTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.touches.length === 0) return;
    updateJoystickAt(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    joyDraggingRef.current = true;
    updateJoystickAt(e.clientX, e.clientY);
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joyDraggingRef.current || e.pointerType === 'touch') return;
    updateJoystickAt(e.clientX, e.clientY);
  };

  const handleJoystickEnd = () => {
    joyDraggingRef.current = false;
    const eng = engineRef.current;
    const knob = joyKnobRef.current;
    if (knob) knob.style.transform = 'translate(0px, 0px)';
    if (eng) eng.touchMove = { x: 0, y: 0, active: false };
  };

  // Swipe-only controls for Bridge Phase (left/right lane, up turbo 1s, down brake)
  const handleBridgeSwipeStart = (clientX: number, clientY: number) => {
    swipeStartRef.current = { x: clientX, y: clientY };
  };

  const handleBridgeSwipeEnd = (clientX: number, clientY: number) => {
    if (!swipeStartRef.current) return;
    const dx = clientX - swipeStartRef.current.x;
    const dy = clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;
    engineRef.current?.handleBridgeSwipe(dx, dy);
  };

  const showTopHud = hud.overlay === 'PLAYING' && !hud.cutsceneActive;

  return (
    <div className="w-full h-full bg-[#05060b] flex items-center justify-center overflow-hidden">
      {/* Vertical Portrait Mobile Frame */}
      <div className="relative w-full max-w-[460px] h-full overflow-hidden bg-[#090a11] sm:border-x sm:border-[#2e3959]/60 shadow-2xl">
        {/* Canvas 2D Isométrico Pixel Art */}
        <canvas ref={canvasRef} className="pixel-canvas block w-full h-full" />

        {/* Scanlines sutis */}
        <div className="crt-scanlines pointer-events-none absolute inset-0 z-10" />

        {/* Fade de Cutscene (Preto / Branco) */}
        {hud.overlay === 'PLAYING' && hud.cutsceneFadeAlpha > 0 && (
          <div
            className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-150"
            style={{
              backgroundColor: hud.cutsceneFadeColor || '#000000',
              opacity: hud.cutsceneFadeAlpha,
            }}
          />
        )}

        {/* Botão de Áudio posicionado abaixo da barra HUD / radar para nunca sobrepor texto */}
        <button
          type="button"
          onClick={handleToggleMute}
          aria-label={muted ? 'Ativar áudio' : 'Silenciar áudio'}
          className={`snes-btn snes-btn-blue absolute right-2 z-40 flex items-center gap-1 px-2.5 py-1.5 text-[9px] whitespace-nowrap shrink-0 ${
            showTopHud ? 'top-[50px]' : 'top-2.5'
          }`}
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* OVERLAY DE CUTSCENE DENTRO DO JOGO + BOTÃO PULAR */}
        {hud.overlay === 'PLAYING' && hud.cutsceneActive && (
          <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between">
            <div className="bg-black/90 border-b border-[#2e3959] px-3 py-2.5 flex items-center justify-between pointer-events-auto">
              <span className="font-pixel text-[8px] text-[#94a3b8]">
                {hud.finaleFlyover ? 'EVACUAÇÃO AÉREA' : 'TRANSMISSÃO TÁTICA'}
              </span>
              <button
                type="button"
                onClick={handleSkipCutscene}
                className="snes-btn snes-btn-blue px-3 py-1.5 text-[9px] flex items-center gap-1.5 mr-12 whitespace-nowrap"
              >
                <span>Pular</span>
                <SkipForward className="w-3 h-3" />
              </button>
            </div>

            {hud.cutsceneBanner && !hud.finaleFlyover && (
              <div className="mx-auto max-w-xs px-3 text-center">
                <div className="bg-black/85 border-2 border-[#ffcd75] px-4 py-2.5 rounded">
                  <p className="font-pixel text-[10px] text-[#ffcd75] leading-relaxed">
                    {hud.cutsceneBanner}
                  </p>
                </div>
              </div>
            )}

            {hud.finaleFlyover ? (
              <div className="mx-4 mb-5 pointer-events-auto">
                <div className="snes-frame bg-[#0b0e18]/92 border-2 border-[#ffcd75] p-4 text-center shadow-2xl">
                  <p className="font-pixel text-[8px] text-[#38b764] mb-1">
                    SOBREVOO · CIDADE DESTRUÍDA
                  </p>
                  <h2
                    className="font-pixel text-sm text-[#ffcd75] mb-3"
                    style={{ textShadow: '2px 2px 0 #000' }}
                  >
                    RELATÓRIO DA MISSÃO
                  </h2>

                  <div className="bg-[#090b14]/90 border border-[#2e3959] rounded p-3 mb-3 space-y-2 text-xs font-mono-num">
                    {hud.finaleScoreStep >= 1 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#94a3b8]">SOBREVIVENTES SALVOS</span>
                        <span className="text-[#38b764] font-bold">
                          {hud.rescued} (+{hud.rescueBonus})
                        </span>
                      </div>
                    )}
                    {hud.finaleScoreStep >= 2 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#94a3b8]">ZUMBIS ELIMINADOS</span>
                        <span className="text-[#e43b44] font-bold">{hud.kills}</span>
                      </div>
                    )}
                    {hud.finaleScoreStep >= 3 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#94a3b8]">TEMPO DE MISSÃO</span>
                        <span className="text-[#f8fafc] font-bold">
                          {formatTime(hud.elapsedTime)}
                        </span>
                      </div>
                    )}
                    {hud.finaleScoreStep >= 4 && (
                      <div className="flex justify-between items-center pt-2 border-t border-[#1e263d] text-sm">
                        <span className="text-[#ffcd75] font-bold">PONTUAÇÃO TOTAL</span>
                        <span className="text-[#ffcd75] font-bold">{hud.score}</span>
                      </div>
                    )}
                  </div>

                  {hud.finaleScoreStep >= 5 && (
                    <div className="pt-1">
                      <span className="font-pixel text-[8px] text-[#94a3b8] block mb-1">
                        NOTA FINAL
                      </span>
                      <div
                        className="font-pixel text-3xl text-[#ffcd75] mb-3"
                        style={{ textShadow: '3px 3px 0 #a22633' }}
                      >
                        {hud.rank}
                      </div>
                      <button
                        type="button"
                        onClick={handleStartNew}
                        className="snes-btn snes-btn-green w-full py-2.5 text-[10px] whitespace-nowrap"
                      >
                        ▶ JOGAR NOVAMENTE
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-black/92 border-t border-[#2e3959] px-4 py-4 min-h-[96px] flex items-center justify-center">
                <div className="w-full text-center">
                  {hud.cutsceneSpeaker && (
                    <p className="font-pixel text-[9px] text-[#73eff7] mb-1.5">
                      {hud.cutsceneSpeaker}
                    </p>
                  )}
                  {hud.cutsceneText && (
                    <p className="text-sm text-white font-semibold leading-snug">
                      {hud.cutsceneText}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PONTE (SUBWAY SURFERS): SOMENTE DESLIZAR O DEDO — ZERO BOTÕES NA TELA */}
        {hud.overlay === 'PLAYING' && hud.bridgeActive && (
          <div
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                handleBridgeSwipeStart(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchEnd={(e) => {
              if (e.changedTouches.length > 0) {
                handleBridgeSwipeEnd(
                  e.changedTouches[0].clientX,
                  e.changedTouches[0].clientY
                );
              }
            }}
            onPointerDown={(e) => {
              if (e.pointerType !== 'touch') {
                handleBridgeSwipeStart(e.clientX, e.clientY);
              }
            }}
            onPointerUp={(e) => {
              if (e.pointerType !== 'touch') {
                handleBridgeSwipeEnd(e.clientX, e.clientY);
              }
            }}
            className="absolute inset-0 z-20 touch-none select-none flex flex-col justify-end items-center pb-5 pointer-events-auto"
          >
            {hud.cutsceneText ? (
              <div className="mb-4 mx-4 bg-black/85 border-2 border-[#ffcd75] px-4 py-2 rounded text-center pointer-events-none">
                <p className="font-pixel text-[8px] text-[#73eff7] mb-1">
                  {hud.cutsceneSpeaker}
                </p>
                <p className="text-xs text-white font-semibold">{hud.cutsceneText}</p>
              </div>
            ) : (
              <p className="font-pixel text-[8px] text-white/65 bg-black/45 px-3 py-1.5 rounded pointer-events-none">
                ← DESLIZE PISTA · ↑ TURBO · ↓ FREIO →
              </p>
            )}
          </div>
        )}

        {/* CONTROLES MOBILE GRANDES (EXPLORAÇÃO ISOMÉTRICA RETRATO) */}
        {hud.overlay === 'PLAYING' &&
          !hud.bridgeActive &&
          !hud.cutsceneActive && (
            <div className="absolute inset-0 pointer-events-none z-20">
              {/* Joystick Analógico Grande com Cruz Direcional Pixel Art na Esquerda */}
              <div
                ref={joyZoneRef}
                onTouchStart={handleJoystickTouch}
                onTouchMove={handleJoystickTouch}
                onTouchEnd={handleJoystickEnd}
                onPointerDown={handleJoystickPointerDown}
                onPointerMove={handleJoystickPointerMove}
                onPointerUp={handleJoystickEnd}
                onPointerCancel={handleJoystickEnd}
                className="pointer-events-auto absolute bottom-5 left-4 w-36 h-36 rounded-full bg-[#111524]/75 border-2 border-[#64748b]/80 shadow-[0_6px_0_#06080f] flex items-center justify-center touch-none select-none"
              >
                {/* Pixel D-pad cross backdrop */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-55">
                  <div className="relative w-24 h-24">
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 w-7 h-24 bg-[#334155] border border-[#0b0d14] rounded-sm" />
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 w-24 h-7 bg-[#334155] border border-[#0b0d14] rounded-sm" />
                    <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] text-[#cbd5e1] leading-none">▲</span>
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-[#cbd5e1] leading-none">▼</span>
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-[#cbd5e1] leading-none">◀</span>
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-[#cbd5e1] leading-none">▶</span>
                  </div>
                </div>
                <div
                  ref={joyKnobRef}
                  className="relative z-10 w-12 h-12 rounded-full bg-[#cbd5e1]/85 border-2 border-white shadow-md pointer-events-none"
                />
              </div>

              {/* Botões Grandes Pixel Art na Direita: ARMA & REC acima, ATIRAR vermelho grande embaixo */}
              <div className="pointer-events-auto absolute bottom-5 right-4 flex flex-col items-end gap-2.5 select-none">
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      engineRef.current?.cycleUnlockedWeapon();
                    }}
                    className="snes-btn snes-btn-blue w-16 h-14 rounded-lg text-[9px] flex items-center justify-center touch-none"
                  >
                    ARMA
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      engineRef.current?.triggerReload();
                    }}
                    className="snes-btn snes-btn-green w-16 h-14 rounded-lg text-[9px] flex items-center justify-center touch-none"
                  >
                    REC
                  </button>
                </div>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    if (engineRef.current) engineRef.current.touchFiring = true;
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    if (engineRef.current) engineRef.current.touchFiring = false;
                  }}
                  onPointerCancel={() => {
                    if (engineRef.current) engineRef.current.touchFiring = false;
                  }}
                  className="snes-btn snes-btn-red w-32 h-20 rounded-lg text-xs tracking-wider flex items-center justify-center shadow-lg touch-none"
                >
                  ATIRAR
                </button>
              </div>
            </div>
          )}

        {/* TELA DE INÍCIO (SELEÇÃO DE SOLDADO HOMEM / SOLDADA MULHER) */}
        {hud.overlay === 'MENU' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs overflow-y-auto">
            <div className="snes-frame w-full p-4 text-center">
              <p className="font-pixel text-[8px] text-[#ffcd75] tracking-wider mb-1.5">
                MISSÃO RESGATE · PIXEL ART ISOMÉTRICO
              </p>
              <h1
                className="font-pixel text-2xl text-[#e43b44] leading-tight mb-1"
                style={{ textShadow: '3px 3px 0 #000, -1px -1px 0 #ffcd75' }}
              >
                ZONA MORTA
              </h1>
              <h2
                className="font-pixel text-xs text-[#73eff7] mb-4"
                style={{ textShadow: '2px 2px 0 #000' }}
              >
                MISSÃO HOSPITAL
              </h2>

              <div className="mb-3.5">
                <p className="font-pixel text-[8px] text-[#cbd5e1] mb-2">
                  ESCOLHA SEU SOLDADO
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectGender('male')}
                    className={`snes-btn py-2.5 px-2 flex items-center justify-center gap-1.5 text-[8px] whitespace-nowrap ${
                      gender === 'male' ? 'snes-btn-active' : 'snes-btn-blue'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span>SOLDADO HOMEM</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectGender('female')}
                    className={`snes-btn py-2.5 px-2 flex items-center justify-center gap-1.5 text-[8px] whitespace-nowrap ${
                      gender === 'female' ? 'snes-btn-active' : 'snes-btn-blue'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span>SOLDADA MULHER</span>
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <p className="font-pixel text-[8px] text-[#cbd5e1] mb-2">
                  DIFICULDADE
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'easy', label: 'RECRUTA' },
                      { key: 'normal', label: 'SOLDADO' },
                      { key: 'hard', label: 'PESADELO' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSelectDifficulty(item.key)}
                      className={`snes-btn py-2 px-1 text-[8px] whitespace-nowrap ${
                        difficulty === item.key ? 'snes-btn-active' : 'snes-btn-blue'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartNew}
                className="snes-btn snes-btn-green w-full py-3.5 text-xs tracking-wider mb-4 whitespace-nowrap"
              >
                ▶ INICIAR MISSÃO
              </button>

              <div className="bg-[#0b0e18] border-2 border-[#2e3959] rounded p-3 text-left space-y-2 text-[11px] text-[#cbd5e1] leading-relaxed">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#38b764] shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-[#ffcd75]">Prédios Seguros:</strong> Casas, farmácias e delegacias guardam armas e kits médicos (telhado a 15%).
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Crosshair className="w-4 h-4 text-[#73eff7] shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-[#73eff7]">Resgate & Evacuação:</strong> Sobreviventes seguem sem dano; policiais atiram. Na ponte, deslize para desviar e chegue ao heliporto do hospital!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TELA DE GAME OVER */}
        {hud.overlay === 'GAME_OVER' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
            <div className="snes-frame w-full p-5 text-center">
              <h2
                className="font-pixel text-xl text-[#e43b44] mb-2.5"
                style={{ textShadow: '3px 3px 0 #000' }}
              >
                MISSÃO FALHOU
              </h2>
              <p className="text-xs text-[#cbd5e1] mb-4">
                {hud.bridgeActive
                  ? 'A horda de corredores alcançou o caminhão na ponte!'
                  : 'A horda dominou o setor antes da evacuação.'}
              </p>

              <div className="bg-[#0b0e18] border-2 border-[#2e3959] rounded p-3.5 mb-4 space-y-2 text-xs font-mono-num">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Sobreviventes Salvos</span>
                  <span className="text-[#38b764] font-bold">{hud.rescued}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Zumbis Mortos</span>
                  <span className="text-[#e43b44] font-bold">{hud.kills}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Pontuação</span>
                  <span className="text-[#ffcd75] font-bold">{hud.score}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {hud.hasCheckpoint && (
                  <button
                    type="button"
                    onClick={handleContinueCheckpoint}
                    className="snes-btn snes-btn-green w-full py-3 text-[10px] flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>VOLTAR AO CHECKPOINT</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStartNew}
                  className="snes-btn snes-btn-red w-full py-3 text-[10px] flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>REINICIAR DO INÍCIO</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TELA FINAL DE PONTUAÇÃO */}
        {hud.overlay === 'VICTORY' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
            <div className="snes-frame w-full p-5 text-center">
              <p className="font-pixel text-[9px] text-[#38b764] mb-1.5">
                EVACUAÇÃO CONCLUÍDA
              </p>
              <h2
                className="font-pixel text-lg text-[#ffcd75] mb-4"
                style={{ textShadow: '3px 3px 0 #000' }}
              >
                PONTUAÇÃO FINAL
              </h2>

              <div className="bg-[#0b0e18] border-2 border-[#2e3959] rounded p-3.5 mb-4 space-y-2 text-xs font-mono-num">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Sobreviventes Salvos</span>
                  <span className="text-[#38b764] font-bold">{hud.rescued}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Zumbis Mortos</span>
                  <span className="text-[#e43b44] font-bold">{hud.kills}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Tempo de Missão</span>
                  <span className="text-[#f8fafc] font-bold">{formatTime(hud.elapsedTime)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#1e263d] text-sm">
                  <span className="text-[#ffcd75] font-bold">PONTUAÇÃO TOTAL</span>
                  <span className="text-[#ffcd75] font-bold">{hud.score}</span>
                </div>
              </div>

              <div className="mb-4">
                <span className="font-pixel text-[8px] text-[#94a3b8] block mb-1">
                  NOTA FINAL
                </span>
                <div
                  className="font-pixel text-4xl text-[#ffcd75]"
                  style={{ textShadow: '4px 4px 0 #a22633' }}
                >
                  {hud.rank}
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartNew}
                className="snes-btn snes-btn-green w-full py-3.5 text-xs whitespace-nowrap"
              >
                ▶ JOGAR NOVAMENTE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
