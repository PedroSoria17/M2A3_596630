import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

/* ============================================================
   EL PASILLO — homenaje a P.T.
   Calle en L, con edificios, postes, niebla y... algo más.
   ============================================================ */

// ============== ESTADO Y AJUSTES ==============
const SETTINGS = {
    masterVol: 0.7,
    sfxVol: 1.0,
    ambVol: 0.8,
    brightness: 1.0,
    fov: 78,
    fogScale: 1.0,
    sensitivity: 1.0,
    shake: true,
    flashlight: true,
};

const state = {
    loop: 0,
    photoFragments: 0,
    canExit: false,
    paused: true,
    playing: false,
    keys: {},
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    triggers: new Set(),
    lastDoorEnter: 0,
    headBob: 0,
    shakeAmount: 0,
};

const dom = {
    menu: document.getElementById('menu'),
    startBtn: document.getElementById('startBtn'),
    menuSettingsBtn: document.getElementById('menuSettingsBtn'),
    settings: document.getElementById('settings'),
    settingsBack: document.getElementById('settings-back'),
    pause: document.getElementById('pause'),
    resumeBtn: document.getElementById('resumeBtn'),
    pauseSettingsBtn: document.getElementById('pauseSettingsBtn'),
    quitBtn: document.getElementById('quitBtn'),
    game: document.getElementById('game'),
    subtitles: document.getElementById('subtitles'),
    hint: document.getElementById('hint'),
    loopCounter: document.getElementById('loopCounter'),
    static: document.getElementById('static'),
    jumpscare: document.getElementById('jumpscare'),
    ending: document.getElementById('ending'),
    endingText: document.getElementById('endingText'),
    restartBtn: document.getElementById('restartBtn'),
};

// ============== THREE.JS BASE ==============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
const BASE_FOG = 0.052;
scene.fog = new THREE.FogExp2(0x05060a, BASE_FOG);

const camera = new THREE.PerspectiveCamera(SETTINGS.fov, window.innerWidth / window.innerHeight, 0.05, 200);
camera.position.set(0, 1.65, -1);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
dom.game.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

// ============== TEXTURAS PROCEDURALES ==============

function noiseFill(g, w, h, density, alpha) {
    for (let i = 0; i < density; i++) {
        g.fillStyle = `rgba(0,0,0,${Math.random() * alpha})`;
        g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random(), 1 + Math.random());
    }
}

function makeBuildingTexture(seed = 0) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 1024;
    const g = c.getContext('2d');
    const rng = (() => { let s = seed * 9301 + 49297; return () => (s = (s * 9301 + 49297) % 233280) / 233280; })();

    // base de ladrillo
    g.fillStyle = '#2a201c';
    g.fillRect(0, 0, 512, 1024);
    for (let y = 0; y < 1024; y += 16) {
        const off = (y / 16) % 2 ? 24 : 0;
        for (let x = -24; x < 512; x += 48) {
            const shade = 30 + rng() * 25;
            g.fillStyle = `rgb(${shade + 20},${shade + 8},${shade})`;
            g.fillRect(x + off, y, 46, 14);
        }
    }
    // junta oscura entre ladrillos
    g.fillStyle = 'rgba(0,0,0,0.5)';
    for (let y = 14; y < 1024; y += 16) g.fillRect(0, y, 512, 2);

    // ventanas: grid 3 columnas x 6 filas
    const winW = 92, winH = 110, gapX = 50, gapY = 40;
    const startX = (512 - (3 * winW + 2 * gapX)) / 2;
    const startY = 80;
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 3; col++) {
            const x = startX + col * (winW + gapX);
            const y = startY + row * (winH + gapY);
            // marco
            g.fillStyle = '#0a0604';
            g.fillRect(x - 4, y - 4, winW + 8, winH + 8);
            // cristal
            const lit = rng() < 0.18;
            if (lit) {
                const grad = g.createLinearGradient(x, y, x, y + winH);
                grad.addColorStop(0, '#3a2a1a');
                grad.addColorStop(0.5, '#5a3a20');
                grad.addColorStop(1, '#2a1a0a');
                g.fillStyle = grad;
                g.fillRect(x, y, winW, winH);
                // cortinas
                g.fillStyle = 'rgba(0,0,0,0.5)';
                g.fillRect(x, y, winW * 0.3, winH);
                g.fillRect(x + winW * 0.7, y, winW * 0.3, winH);
                // silueta?
                if (rng() < 0.25) {
                    g.fillStyle = 'rgba(0,0,0,0.85)';
                    g.fillRect(x + winW * 0.4, y + winH * 0.3, winW * 0.2, winH * 0.6);
                }
            } else {
                g.fillStyle = '#06060a';
                g.fillRect(x, y, winW, winH);
                // reflejo sutil
                g.fillStyle = 'rgba(40,40,60,0.15)';
                g.fillRect(x, y, winW * 0.3, winH);
            }
            // crucetas
            g.strokeStyle = '#0a0604';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(x, y + winH / 2); g.lineTo(x + winW, y + winH / 2);
            g.moveTo(x + winW / 2, y); g.lineTo(x + winW / 2, y + winH);
            g.stroke();
            // alféizar
            g.fillStyle = '#1a100a';
            g.fillRect(x - 8, y + winH + 4, winW + 16, 4);
        }
    }

    // suciedad / chorretones de óxido bajo cada ventana
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 3; col++) {
            const x = startX + col * (winW + gapX) + winW / 2;
            const y = startY + row * (winH + gapY) + winH;
            g.fillStyle = `rgba(40, 20, 8, ${0.3 + rng() * 0.3})`;
            for (let i = 0; i < 4; i++) {
                g.fillRect(x - 18 + i * 9, y, 2, 12 + rng() * 30);
            }
        }
    }

    // grietas
    for (let i = 0; i < 6; i++) {
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.lineWidth = 1;
        g.beginPath();
        let x = rng() * 512;
        let y = rng() * 1024;
        g.moveTo(x, y);
        for (let j = 0; j < 8; j++) {
            x += (rng() - 0.5) * 80;
            y += rng() * 60;
            g.lineTo(x, y);
        }
        g.stroke();
    }

    noiseFill(g, 512, 1024, 4000, 0.3);

    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function makeAsphaltTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#0e0e10';
    g.fillRect(0, 0, 512, 512);
    // grava
    for (let i = 0; i < 6000; i++) {
        const sh = 20 + Math.random() * 30;
        g.fillStyle = `rgb(${sh},${sh},${sh + 4})`;
        g.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
    }
    // grietas
    for (let i = 0; i < 14; i++) {
        g.strokeStyle = 'rgba(0,0,0,0.7)';
        g.lineWidth = 1 + Math.random();
        g.beginPath();
        let x = Math.random() * 512, y = Math.random() * 512;
        g.moveTo(x, y);
        for (let j = 0; j < 6; j++) {
            x += (Math.random() - 0.5) * 80;
            y += (Math.random() - 0.5) * 80;
            g.lineTo(x, y);
        }
        g.stroke();
    }
    // charcos (manchas oscuras brillantes)
    for (let i = 0; i < 5; i++) {
        const grad = g.createRadialGradient(
            Math.random() * 512, Math.random() * 512, 5,
            Math.random() * 512, Math.random() * 512, 60
        );
        grad.addColorStop(0, 'rgba(20, 25, 35, 0.5)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 512, 512);
    }
    // marca de vía descascarillada
    g.fillStyle = '#9a8838';
    for (let y = 30; y < 512; y += 70) {
        g.fillRect(252, y, 8, 30);
    }
    // sucio
    noiseFill(g, 512, 512, 3000, 0.4);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function makeSidewalkTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#3a3833';
    g.fillRect(0, 0, 256, 256);
    // baldosas
    for (let y = 0; y < 256; y += 64) {
        for (let x = 0; x < 256; x += 64) {
            const sh = 50 + Math.random() * 12;
            g.fillStyle = `rgb(${sh},${sh - 2},${sh - 4})`;
            g.fillRect(x + 2, y + 2, 60, 60);
        }
    }
    // junta
    g.strokeStyle = '#1a1814';
    g.lineWidth = 2;
    for (let y = 0; y <= 256; y += 64) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
    }
    for (let x = 0; x <= 256; x += 64) {
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke();
    }
    // manchas
    noiseFill(g, 256, 256, 1500, 0.4);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function makeMetalDoorTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#2a2620';
    g.fillRect(0, 0, 256, 512);
    // paneles
    g.strokeStyle = '#0a0804';
    g.lineWidth = 4;
    g.strokeRect(20, 20, 216, 470);
    // remaches
    g.fillStyle = '#5a4a2a';
    for (let y = 30; y < 480; y += 40) {
        g.beginPath(); g.arc(28, y, 3, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(228, y, 3, 0, Math.PI * 2); g.fill();
    }
    // óxido
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * 256, y = Math.random() * 512;
        g.fillStyle = `rgba(80, 30, 10, ${0.3 + Math.random() * 0.4})`;
        g.beginPath();
        g.ellipse(x, y, 8 + Math.random() * 10, 4 + Math.random() * 8, 0, 0, Math.PI * 2);
        g.fill();
    }
    // pomo
    g.fillStyle = '#8a7a3a';
    g.fillRect(212, 250, 16, 30);
    g.fillStyle = '#000';
    g.fillRect(214, 260, 12, 8);
    // marca de sangre
    g.fillStyle = 'rgba(120, 0, 0, 0.5)';
    g.fillRect(80, 200, 60, 4);
    g.fillRect(82, 205, 4, 30);
    noiseFill(g, 256, 512, 800, 0.3);
    return new THREE.CanvasTexture(c);
}

function makePosterTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#3a2812';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#080604';
    g.fillRect(16, 16, 224, 224);
    // figura distorsionada
    const grad = g.createRadialGradient(128, 110, 10, 128, 128, 110);
    grad.addColorStop(0, 'rgba(180, 140, 110, 0.7)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(16, 16, 224, 224);
    // texto
    g.fillStyle = '#a83838';
    g.font = 'bold 22px Courier New';
    g.fillText('DESAPARECIDA', 28, 50);
    g.fillStyle = '#8a3a3a';
    g.font = '12px Courier New';
    g.fillText('última vez vista en esta calle', 30, 230);
    // arañazos
    for (let i = 0; i < 30; i++) {
        g.strokeStyle = 'rgba(140, 100, 80, 0.4)';
        g.beginPath();
        g.moveTo(Math.random() * 256, Math.random() * 256);
        g.lineTo(Math.random() * 256, Math.random() * 256);
        g.stroke();
    }
    return new THREE.CanvasTexture(c);
}

function makeMoonTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 30, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 240, 220, 1)');
    grad.addColorStop(0.4, 'rgba(220, 200, 180, 0.6)');
    grad.addColorStop(0.7, 'rgba(120, 100, 90, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    // cráteres
    for (let i = 0; i < 8; i++) {
        const x = 80 + Math.random() * 96;
        const y = 80 + Math.random() * 96;
        g.fillStyle = `rgba(80, 70, 60, ${0.2 + Math.random() * 0.3})`;
        g.beginPath();
        g.arc(x, y, 3 + Math.random() * 8, 0, Math.PI * 2);
        g.fill();
    }
    return new THREE.CanvasTexture(c);
}

// ============== ENTIDAD: AZAZEL ==============
// Inspirado en Pazuzu (mesopotámico, demonio del viento) y Azazel (caído).
// Cuernos curvados, ojos rojos, piel cenicienta, garras largas, patas
// digitígradas con pezuñas. Sangre negra (icor).

function makeDemonTexture() {
    const c = document.createElement('canvas');
    c.width = 384; c.height = 768;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 384, 768);
    const cx = 192;

    // niebla de sombra alrededor
    const halo = g.createRadialGradient(cx, 350, 50, cx, 350, 380);
    halo.addColorStop(0, 'rgba(20, 0, 0, 0.4)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, 384, 768);

    // === PIERNAS digitígradas ===
    g.fillStyle = '#2a1f18';
    // pierna izquierda
    g.beginPath();
    g.moveTo(cx - 50, 460);
    g.lineTo(cx - 65, 540);
    g.lineTo(cx - 50, 600);
    g.lineTo(cx - 18, 690);
    g.lineTo(cx - 5, 700);
    g.lineTo(cx - 28, 600);
    g.lineTo(cx - 38, 540);
    g.lineTo(cx - 30, 460);
    g.closePath();
    g.fill();
    // pierna derecha
    g.beginPath();
    g.moveTo(cx + 50, 460);
    g.lineTo(cx + 65, 540);
    g.lineTo(cx + 50, 600);
    g.lineTo(cx + 18, 690);
    g.lineTo(cx + 5, 700);
    g.lineTo(cx + 28, 600);
    g.lineTo(cx + 38, 540);
    g.lineTo(cx + 30, 460);
    g.closePath();
    g.fill();

    // pezuñas
    g.fillStyle = '#080404';
    g.beginPath();
    g.ellipse(cx - 11, 700, 22, 14, 0, 0, Math.PI * 2);
    g.ellipse(cx + 11, 700, 22, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a1a08';
    for (let i = 0; i < 2; i++) {
        const fx = cx - 11 + i * 22;
        g.fillRect(fx - 6, 705, 4, 12);
        g.fillRect(fx + 2, 705, 4, 12);
    }

    // === TORSO emaciado ===
    g.fillStyle = '#3a2d23';
    g.beginPath();
    g.moveTo(cx - 70, 270);
    g.lineTo(cx + 70, 270);
    g.lineTo(cx + 55, 460);
    g.lineTo(cx - 55, 460);
    g.closePath();
    g.fill();
    // ribs (sombras)
    g.fillStyle = 'rgba(0, 0, 0, 0.55)';
    for (let i = 0; i < 6; i++) {
        const y = 295 + i * 22;
        g.beginPath();
        g.ellipse(cx, y, 50 - i * 2, 4, 0, 0, Math.PI);
        g.fill();
    }
    // esternón
    g.fillStyle = 'rgba(0, 0, 0, 0.4)';
    g.fillRect(cx - 2, 285, 4, 165);
    // hueco abdominal
    g.fillStyle = '#080404';
    g.beginPath();
    g.ellipse(cx, 430, 16, 22, 0, 0, Math.PI * 2);
    g.fill();

    // === BRAZOS muy largos ===
    g.fillStyle = '#3a2d23';
    // brazo izquierdo
    g.beginPath();
    g.moveTo(cx - 70, 280);
    g.lineTo(cx - 105, 360);
    g.lineTo(cx - 130, 480);
    g.lineTo(cx - 110, 490);
    g.lineTo(cx - 85, 360);
    g.lineTo(cx - 55, 285);
    g.closePath();
    g.fill();
    // brazo derecho
    g.beginPath();
    g.moveTo(cx + 70, 280);
    g.lineTo(cx + 105, 360);
    g.lineTo(cx + 130, 480);
    g.lineTo(cx + 110, 490);
    g.lineTo(cx + 85, 360);
    g.lineTo(cx + 55, 285);
    g.closePath();
    g.fill();
    // garras
    g.fillStyle = '#0a0a0a';
    for (let i = 0; i < 5; i++) {
        const ox = -130 + i * 5;
        g.beginPath();
        g.moveTo(cx + ox, 480);
        g.lineTo(cx + ox + 3, 480);
        g.lineTo(cx + ox + 1, 525 + Math.random() * 10);
        g.closePath();
        g.fill();
    }
    for (let i = 0; i < 5; i++) {
        const ox = 110 + i * 5;
        g.beginPath();
        g.moveTo(cx + ox, 480);
        g.lineTo(cx + ox + 3, 480);
        g.lineTo(cx + ox + 1, 525 + Math.random() * 10);
        g.closePath();
        g.fill();
    }

    // === CABEZA ===
    // cráneo
    g.fillStyle = '#4a3a2e';
    g.beginPath();
    g.ellipse(cx, 180, 70, 90, 0, 0, Math.PI * 2);
    g.fill();
    // mandíbula
    g.fillStyle = '#2a1f15';
    g.beginPath();
    g.moveTo(cx - 55, 210);
    g.lineTo(cx + 55, 210);
    g.lineTo(cx + 38, 268);
    g.lineTo(cx - 38, 268);
    g.closePath();
    g.fill();

    // sombras del cráneo
    const skullShade = g.createRadialGradient(cx, 180, 20, cx, 180, 90);
    skullShade.addColorStop(0, 'rgba(0,0,0,0)');
    skullShade.addColorStop(1, 'rgba(0,0,0,0.7)');
    g.fillStyle = skullShade;
    g.beginPath();
    g.ellipse(cx, 180, 70, 90, 0, 0, Math.PI * 2);
    g.fill();

    // === CUERNOS curvados (Pazuzu / Baphomet) ===
    g.strokeStyle = '#0a0a0a';
    g.fillStyle = '#181410';
    g.lineWidth = 3;
    // izquierdo
    g.beginPath();
    g.moveTo(cx - 55, 120);
    g.bezierCurveTo(cx - 100, 90, cx - 130, 50, cx - 110, 10);
    g.bezierCurveTo(cx - 80, 40, cx - 60, 70, cx - 50, 115);
    g.closePath();
    g.fill(); g.stroke();
    // anillos
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    for (let i = 0; i < 4; i++) {
        const t = i / 4;
        const x = cx - 55 - t * 60;
        const y = 120 - t * 80;
        g.beginPath();
        g.ellipse(x, y, 6 + i * 1.5, 3, -0.3, 0, Math.PI * 2);
        g.stroke();
    }
    // derecho
    g.fillStyle = '#181410';
    g.strokeStyle = '#0a0a0a';
    g.beginPath();
    g.moveTo(cx + 55, 120);
    g.bezierCurveTo(cx + 100, 90, cx + 130, 50, cx + 110, 10);
    g.bezierCurveTo(cx + 80, 40, cx + 60, 70, cx + 50, 115);
    g.closePath();
    g.fill(); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    for (let i = 0; i < 4; i++) {
        const t = i / 4;
        const x = cx + 55 + t * 60;
        const y = 120 - t * 80;
        g.beginPath();
        g.ellipse(x, y, 6 + i * 1.5, 3, 0.3, 0, Math.PI * 2);
        g.stroke();
    }

    // === OJOS hundidos brillantes ===
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(cx - 24, 175, 16, 22, 0, 0, Math.PI * 2);
    g.ellipse(cx + 24, 175, 16, 22, 0, 0, Math.PI * 2);
    g.fill();
    // halo rojo
    for (const ex of [-24, 24]) {
        const eg = g.createRadialGradient(cx + ex, 175, 1, cx + ex, 175, 35);
        eg.addColorStop(0, 'rgba(255, 60, 30, 1)');
        eg.addColorStop(0.4, 'rgba(180, 0, 0, 0.6)');
        eg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        g.fillStyle = eg;
        g.beginPath();
        g.arc(cx + ex, 175, 35, 0, Math.PI * 2);
        g.fill();
    }
    // pupila
    g.fillStyle = '#ffe040';
    g.fillRect(cx - 26, 172, 4, 6);
    g.fillRect(cx + 22, 172, 4, 6);

    // === BOCA con dientes ===
    g.fillStyle = '#000';
    g.beginPath();
    g.moveTo(cx - 38, 222);
    g.lineTo(cx + 38, 222);
    g.lineTo(cx + 28, 260);
    g.lineTo(cx - 28, 260);
    g.closePath();
    g.fill();
    // dientes superiores
    g.fillStyle = '#d8c8a8';
    for (let i = 0; i < 7; i++) {
        const tx = cx - 32 + i * 10;
        g.beginPath();
        g.moveTo(tx, 222);
        g.lineTo(tx + 6, 222);
        g.lineTo(tx + 3, 240 + Math.random() * 4);
        g.closePath();
        g.fill();
    }
    // colmillos
    g.fillStyle = '#e8d8b8';
    g.beginPath();
    g.moveTo(cx - 30, 222); g.lineTo(cx - 22, 222); g.lineTo(cx - 26, 254);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(cx + 22, 222); g.lineTo(cx + 30, 222); g.lineTo(cx + 26, 254);
    g.closePath(); g.fill();
    // dientes inferiores
    g.fillStyle = '#c8b898';
    for (let i = 0; i < 6; i++) {
        const tx = cx - 26 + i * 10;
        g.beginPath();
        g.moveTo(tx, 260);
        g.lineTo(tx + 5, 260);
        g.lineTo(tx + 2, 245);
        g.closePath();
        g.fill();
    }

    // === ICOR negro / sangre ===
    g.fillStyle = 'rgba(8, 0, 0, 0.85)';
    for (let i = 0; i < 12; i++) {
        const x = cx + (Math.random() - 0.5) * 80;
        const y = 240 + Math.random() * 30;
        g.fillRect(x, y, 2, 30 + Math.random() * 60);
    }
    // de los ojos
    g.fillRect(cx - 24, 190, 1.5, 30);
    g.fillRect(cx + 24, 190, 1.5, 25);

    // === VENAS oscuras en piel ===
    g.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    g.lineWidth = 1;
    for (let i = 0; i < 50; i++) {
        g.beginPath();
        const x0 = cx + (Math.random() - 0.5) * 140;
        const y0 = 280 + Math.random() * 200;
        g.moveTo(x0, y0);
        g.bezierCurveTo(
            x0 + (Math.random() - 0.5) * 30, y0 + Math.random() * 30,
            x0 + (Math.random() - 0.5) * 60, y0 + Math.random() * 60,
            x0 + (Math.random() - 0.5) * 80, y0 + Math.random() * 80
        );
        g.stroke();
    }

    // sigilo en el pecho (pentaculo invertido)
    g.strokeStyle = 'rgba(120, 0, 0, 0.6)';
    g.lineWidth = 1.5;
    g.beginPath();
    const sx = cx, sy = 350, sr = 30;
    for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 4 / 5);
        const px = sx + Math.cos(a) * sr;
        const py = sy + Math.sin(a) * sr + sr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.stroke();
    g.beginPath();
    g.arc(sx, sy + sr, sr + 3, 0, Math.PI * 2);
    g.stroke();

    // viñeta general
    const vg = g.createRadialGradient(cx, 384, 100, cx, 384, 380);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = vg;
    g.fillRect(0, 0, 384, 768);

    return new THREE.CanvasTexture(c);
}

function makeDemonFaceCloseup() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512);
    const cx = 256, cy = 256;

    // piel rasgada
    g.fillStyle = '#3a2418';
    g.beginPath();
    g.ellipse(cx, cy, 200, 230, 0, 0, Math.PI * 2);
    g.fill();
    // sombras
    const sg = g.createRadialGradient(cx, cy, 50, cx, cy, 240);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(1, 'rgba(0,0,0,0.95)');
    g.fillStyle = sg;
    g.fillRect(0, 0, 512, 512);

    // cuernos asomando arriba
    g.fillStyle = '#0a0a0a';
    g.beginPath();
    g.moveTo(cx - 80, 70);
    g.bezierCurveTo(cx - 160, 30, cx - 220, -10, cx - 200, -40);
    g.bezierCurveTo(cx - 130, 0, cx - 100, 30, cx - 70, 70);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(cx + 80, 70);
    g.bezierCurveTo(cx + 160, 30, cx + 220, -10, cx + 200, -40);
    g.bezierCurveTo(cx + 130, 0, cx + 100, 30, cx + 70, 70);
    g.closePath();
    g.fill();

    // ojos enormes brillantes
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(cx - 70, cy - 30, 50, 70, 0, 0, Math.PI * 2);
    g.ellipse(cx + 70, cy - 30, 50, 70, 0, 0, Math.PI * 2);
    g.fill();
    for (const ex of [-70, 70]) {
        const grad = g.createRadialGradient(cx + ex, cy - 30, 5, cx + ex, cy - 30, 90);
        grad.addColorStop(0, 'rgba(255, 100, 30, 1)');
        grad.addColorStop(0.5, 'rgba(220, 0, 0, 0.7)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(cx + ex, cy - 30, 90, 0, Math.PI * 2);
        g.fill();
    }
    g.fillStyle = '#ffe040';
    g.fillRect(cx - 76, cy - 36, 12, 12);
    g.fillRect(cx + 64, cy - 36, 12, 12);

    // boca abierta gritando
    g.fillStyle = '#000';
    g.beginPath();
    g.moveTo(cx - 110, cy + 80);
    g.bezierCurveTo(cx - 70, cy + 220, cx + 70, cy + 220, cx + 110, cy + 80);
    g.bezierCurveTo(cx + 60, cy + 60, cx - 60, cy + 60, cx - 110, cy + 80);
    g.closePath();
    g.fill();
    // dientes superiores
    g.fillStyle = '#e0d0a8';
    for (let i = 0; i < 9; i++) {
        const tx = cx - 95 + i * 22;
        g.beginPath();
        g.moveTo(tx, cy + 75);
        g.lineTo(tx + 14, cy + 75);
        g.lineTo(tx + 7, cy + 130 + Math.random() * 14);
        g.closePath();
        g.fill();
    }
    // dientes inferiores
    g.fillStyle = '#c8b898';
    for (let i = 0; i < 8; i++) {
        const tx = cx - 80 + i * 22;
        g.beginPath();
        g.moveTo(tx, cy + 200);
        g.lineTo(tx + 12, cy + 200);
        g.lineTo(tx + 6, cy + 165);
        g.closePath();
        g.fill();
    }
    // lengua
    g.fillStyle = '#3a0808';
    g.beginPath();
    g.ellipse(cx, cy + 175, 50, 18, 0, 0, Math.PI * 2);
    g.fill();
    // saliva oscura
    g.fillStyle = 'rgba(20, 0, 0, 0.7)';
    for (let i = 0; i < 6; i++) {
        const x = cx - 80 + Math.random() * 160;
        g.fillRect(x, cy + 200, 2, 30 + Math.random() * 60);
    }

    // venas
    g.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 60; i++) {
        g.beginPath();
        const x0 = cx + (Math.random() - 0.5) * 360;
        const y0 = cy + (Math.random() - 0.5) * 360;
        g.moveTo(x0, y0);
        g.bezierCurveTo(
            x0 + (Math.random() - 0.5) * 60, y0 + (Math.random() - 0.5) * 60,
            x0 + (Math.random() - 0.5) * 80, y0 + (Math.random() - 0.5) * 80,
            x0 + (Math.random() - 0.5) * 120, y0 + (Math.random() - 0.5) * 120
        );
        g.stroke();
    }
    // arañazos / chorretones
    g.fillStyle = 'rgba(80, 0, 0, 0.7)';
    for (let i = 0; i < 12; i++) {
        const x = cx + (Math.random() - 0.5) * 360;
        const y = cy + (Math.random() - 0.5) * 200;
        g.fillRect(x, y, 3, 60 + Math.random() * 80);
    }

    return new THREE.CanvasTexture(c);
}

function makeBloodOverlay() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512);
    for (let i = 0; i < 12; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 256;
        g.fillStyle = `rgba(${100 + Math.random() * 60}, 0, 0, ${0.4 + Math.random() * 0.4})`;
        g.beginPath();
        g.arc(x, y, Math.random() * 30 + 10, 0, Math.PI * 2);
        g.fill();
        for (let j = 0; j < 5; j++) g.fillRect(x - 2, y, 4, Math.random() * 80);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

const tex = {
    building1: makeBuildingTexture(1),
    building2: makeBuildingTexture(7),
    building3: makeBuildingTexture(13),
    asphalt: makeAsphaltTexture(),
    sidewalk: makeSidewalkTexture(),
    door: makeMetalDoorTexture(),
    poster: makePosterTexture(),
    moon: makeMoonTexture(),
    blood: makeBloodOverlay(),
    demon: makeDemonTexture(),
    demonFace: makeDemonFaceCloseup(),
};

// pasar la cara del demonio al CSS para el jumpscare
document.documentElement.style.setProperty('--demon-face', `url(${tex.demonFace.image.toDataURL()})`);

// ============== AUDIO ==============
const audio = (function() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const masterGain = ctx.createGain();
    masterGain.gain.value = SETTINGS.masterVol;
    masterGain.connect(ctx.destination);
    const sfxGain = ctx.createGain();
    sfxGain.gain.value = SETTINGS.sfxVol;
    sfxGain.connect(masterGain);
    const ambGain = ctx.createGain();
    ambGain.gain.value = SETTINGS.ambVol;
    ambGain.connect(masterGain);

    function ensureRunning() { if (ctx.state === 'suspended') ctx.resume(); }

    function makeNoiseBuffer(seconds = 3) {
        const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        return buf;
    }
    const noiseBuf = makeNoiseBuffer(3);

    // Distortion curve
    function makeDistortion(amount) {
        const n = 1024;
        const curve = new Float32Array(n);
        const k = amount;
        for (let i = 0; i < n; i++) {
            const x = (i * 2) / n - 1;
            curve[i] = ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    function startDrone() {
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const o3 = ctx.createOscillator();
        const g = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 280;
        o1.frequency.value = 50;
        o1.type = 'sawtooth';
        o2.frequency.value = 50.4;
        o2.type = 'sawtooth';
        o3.frequency.value = 75;
        o3.type = 'triangle';
        g.gain.value = 0.06;
        o1.connect(filter); o2.connect(filter); o3.connect(filter);
        filter.connect(g);
        g.connect(ambGain);
        o1.start(); o2.start(); o3.start();
        // wind susurro de fondo
        const wind = ctx.createBufferSource();
        wind.buffer = noiseBuf;
        wind.loop = true;
        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 380;
        windFilter.Q.value = 0.5;
        const windGain = ctx.createGain();
        windGain.gain.value = 0.035;
        wind.connect(windFilter).connect(windGain).connect(ambGain);
        wind.start();
        return { gain: g };
    }

    function playStatic(duration = 3, volume = 0.18) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1500;
        filter.Q.value = 0.7;
        const g = ctx.createGain();
        g.gain.value = 0;
        g.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.1);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        src.connect(filter).connect(g).connect(sfxGain);
        src.start();
        src.stop(ctx.currentTime + duration + 0.1);
        // voz simulada
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 80 + Math.random() * 60;
        lfo.type = 'square';
        const vg = ctx.createGain();
        vg.gain.value = 0;
        vg.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + 0.2);
        vg.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        lfo.connect(vg).connect(sfxGain);
        lfo.start();
        lfo.stop(ctx.currentTime + duration + 0.1);
    }

    function playKnock() {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 180;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.55, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        src.connect(filter).connect(g).connect(sfxGain);
        src.start();
        src.stop(ctx.currentTime + 0.3);
    }

    function playWhisper() {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;
        const f1 = ctx.createBiquadFilter();
        f1.type = 'bandpass';
        f1.frequency.value = 2200;
        f1.Q.value = 8;
        const g = ctx.createGain();
        g.gain.value = 0;
        g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.3);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);
        src.connect(f1).connect(g).connect(sfxGain);
        src.start();
        src.stop(ctx.currentTime + 3.1);
    }

    function playBabyCry(duration = 4) {
        const o = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const env = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = 420;
        lfo.type = 'sine';
        lfo.frequency.value = 3;
        lfoGain.gain.value = 60;
        lfo.connect(lfoGain).connect(o.frequency);
        env.gain.value = 0;
        for (let t = 0; t < duration; t += 1.0) {
            env.gain.setValueAtTime(0.0, ctx.currentTime + t);
            env.gain.linearRampToValueAtTime(0.22, ctx.currentTime + t + 0.2);
            env.gain.linearRampToValueAtTime(0.05, ctx.currentTime + t + 0.7);
        }
        env.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 4;
        o.connect(filter).connect(env).connect(sfxGain);
        o.start(); lfo.start();
        o.stop(ctx.currentTime + duration + 0.1);
        lfo.stop(ctx.currentTime + duration + 0.1);
    }

    function playPhoneRing(times = 3) {
        let t0 = ctx.currentTime;
        for (let i = 0; i < times; i++) {
            for (let phase = 0; phase < 2; phase++) {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'sine';
                o.frequency.value = phase === 0 ? 480 : 620;
                g.gain.setValueAtTime(0, t0);
                g.gain.linearRampToValueAtTime(0.18, t0 + 0.05);
                g.gain.linearRampToValueAtTime(0, t0 + 0.4);
                o.connect(g).connect(sfxGain);
                o.start(t0); o.stop(t0 + 0.45);
            }
            t0 += 2.0;
        }
    }

    /* ---- Sonidos demoníacos ---- */
    // Gruñido sostenido (presencia)
    function playDemonGrowl(duration = 4, volume = 0.4) {
        const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 38;
        const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 39.7;
        const o3 = ctx.createOscillator(); o3.type = 'square'; o3.frequency.value = 73;
        // vibrato
        const vibrato = ctx.createOscillator(); vibrato.type = 'sine'; vibrato.frequency.value = 4.5;
        const vibGain = ctx.createGain(); vibGain.gain.value = 5;
        vibrato.connect(vibGain).connect(o3.frequency);
        // distorsión
        const ws = ctx.createWaveShaper();
        ws.curve = makeDistortion(60);
        ws.oversample = '4x';
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        const env = ctx.createGain();
        env.gain.value = 0;
        env.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.4);
        env.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        const mix = ctx.createGain(); mix.gain.value = 0.5;
        o1.connect(mix); o2.connect(mix); o3.connect(mix);
        mix.connect(ws).connect(filter).connect(env).connect(sfxGain);
        o1.start(); o2.start(); o3.start(); vibrato.start();
        const stopAt = ctx.currentTime + duration + 0.15;
        o1.stop(stopAt); o2.stop(stopAt); o3.stop(stopAt); vibrato.stop(stopAt);

        // rezo invertido / susurro grave por encima
        const wh = ctx.createBufferSource();
        wh.buffer = noiseBuf; wh.loop = true; wh.playbackRate.value = 0.6;
        const whF = ctx.createBiquadFilter(); whF.type = 'bandpass'; whF.frequency.value = 380; whF.Q.value = 4;
        const whG = ctx.createGain(); whG.gain.value = 0;
        whG.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + 0.3);
        whG.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        wh.connect(whF).connect(whG).connect(sfxGain);
        wh.start(); wh.stop(stopAt);
    }

    // Grito demoníaco (jumpscare)
    function playDemonScream() {
        const dur = 1.8;
        // base subgrave
        const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
        o1.frequency.setValueAtTime(40, ctx.currentTime);
        o1.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5);
        // gruñido medio
        const o2 = ctx.createOscillator(); o2.type = 'square';
        o2.frequency.setValueAtTime(180, ctx.currentTime);
        o2.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.7);
        // chillido alto
        const o3 = ctx.createOscillator(); o3.type = 'sawtooth';
        o3.frequency.setValueAtTime(900, ctx.currentTime);
        o3.frequency.exponentialRampToValueAtTime(1700, ctx.currentTime + 0.25);
        o3.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 1.0);
        // ring mod
        const ring = ctx.createOscillator(); ring.type = 'sine'; ring.frequency.value = 7;
        const ringGain = ctx.createGain(); ringGain.gain.value = 0;
        const o3Gain = ctx.createGain(); o3Gain.gain.value = 1;
        ring.connect(ringGain).connect(o3Gain.gain);
        // distorsión brutal
        const ws = ctx.createWaveShaper();
        ws.curve = makeDistortion(120);
        ws.oversample = '4x';
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2200;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, ctx.currentTime);
        env.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 0.04);
        env.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.5);
        env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        // ruido áspero al inicio
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuf;
        const noiseG = ctx.createGain();
        noiseG.gain.setValueAtTime(0.7, ctx.currentTime);
        noiseG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        const noiseF = ctx.createBiquadFilter();
        noiseF.type = 'bandpass'; noiseF.frequency.value = 1100; noiseF.Q.value = 0.5;
        noise.connect(noiseF).connect(noiseG).connect(env);

        const mix = ctx.createGain(); mix.gain.value = 0.45;
        o1.connect(mix); o2.connect(mix);
        o3.connect(o3Gain).connect(mix);
        mix.connect(ws).connect(filter).connect(env).connect(sfxGain);
        o1.start(); o2.start(); o3.start(); ring.start(); noise.start();
        const stopAt = ctx.currentTime + dur + 0.1;
        o1.stop(stopAt); o2.stop(stopAt); o3.stop(stopAt); ring.stop(stopAt); noise.stop(stopAt);
    }

    // Susurro demoníaco (en latín invertido)
    function playDemonWhisper() {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf; src.loop = true;
        src.playbackRate.value = 0.55;
        const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 600; f1.Q.value = 6;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1800; f2.Q.value = 8;
        const ws = ctx.createWaveShaper(); ws.curve = makeDistortion(20);
        const g = ctx.createGain(); g.gain.value = 0;
        g.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.3);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 4);
        // entrelazado
        src.connect(f1).connect(ws).connect(g).connect(sfxGain);
        src.connect(f2).connect(g);
        src.start();
        src.stop(ctx.currentTime + 4.2);
    }

    // Boom subgrave (puerta cerrándose / impacto)
    function playSubBoom(volume = 0.7) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(120, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.7);
        const g = ctx.createGain();
        g.gain.setValueAtTime(volume, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
        o.connect(g).connect(sfxGain);
        o.start();
        o.stop(ctx.currentTime + 1);
    }

    return {
        ctx, ensureRunning, masterGain, sfxGain, ambGain,
        startDrone, playStatic, playKnock, playWhisper, playBabyCry, playPhoneRing,
        playDemonGrowl, playDemonScream, playDemonWhisper, playSubBoom,
    };
})();

let drone = null;

// ============== GEOMETRÍA: CALLE EN L ==============
const HALL_HALFW = 2.5;        // mitad ancho de la calzada
const SIDEWALK = 1.0;          // ancho de acera
const T1_END = -18;            // tramo 1 (z negativo) hasta esta z
const CORNER_END = -23;        // límite sur de la esquina
const T2_END = 18;             // tramo 2 (x positivo) hasta esta x
const BUILDING_HEIGHT = 12;
const BUILDING_DEPTH = 4;      // grosor de los edificios (no transitable)
const GROUND_Y = 0;
const WALL_X_W = -HALL_HALFW - SIDEWALK;  // pared edificio oeste
const WALL_X_E = HALL_HALFW + SIDEWALK;   // pared edificio este (tramo 1)
const WALL_Z_N = T1_END - SIDEWALK;       // pared norte (de tramo 2)
const WALL_Z_S = CORNER_END - SIDEWALK;   // pared sur (esquina)

const colliders = [];
const worldRoot = new THREE.Group();
scene.add(worldRoot);

function pushCollider(box) { colliders.push(box); }

function addBox(w, h, d, x, y, z, mat, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (opts.rotY) m.rotation.y = opts.rotY;
    worldRoot.add(m);
    if (!opts.noCollide) {
        m.updateMatrixWorld();
        pushCollider(new THREE.Box3().setFromObject(m));
    }
    return m;
}

const buildingMats = [
    new THREE.MeshStandardMaterial({ map: tex.building1, roughness: 1, metalness: 0 }),
    new THREE.MeshStandardMaterial({ map: tex.building2, roughness: 1, metalness: 0 }),
    new THREE.MeshStandardMaterial({ map: tex.building3, roughness: 1, metalness: 0 }),
];
const asphaltMat = new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.95 });
const sidewalkMat = new THREE.MeshStandardMaterial({ map: tex.sidewalk, roughness: 1 });
const concreteMat = new THREE.MeshStandardMaterial({ color: 0x1a1814, roughness: 1 });

function bMat(i) { return buildingMats[i % buildingMats.length]; }

// suelo: asfalto en tramos + esquina, aceras a los lados
function buildGround() {
    // calzada tramo 1
    const r1 = new THREE.Mesh(
        new THREE.PlaneGeometry(HALL_HALFW * 2, Math.abs(T1_END)),
        asphaltMat
    );
    r1.rotation.x = -Math.PI / 2;
    r1.position.set(0, GROUND_Y, T1_END / 2);
    r1.receiveShadow = true;
    worldRoot.add(r1);
    // textura asfalto repeat
    asphaltMat.map.repeat.set(2, Math.abs(T1_END) / 5);

    // calzada esquina
    const cornerW = T2_END + HALL_HALFW;
    const cornerD = T1_END - CORNER_END;
    const r2 = new THREE.Mesh(new THREE.PlaneGeometry(cornerW, cornerD), asphaltMat);
    r2.rotation.x = -Math.PI / 2;
    r2.position.set(cornerW / 2 - HALL_HALFW, GROUND_Y, (T1_END + CORNER_END) / 2);
    worldRoot.add(r2);

    // aceras tramo 1 (oeste y este)
    const swLen1 = Math.abs(T1_END);
    const sw1W = new THREE.Mesh(new THREE.BoxGeometry(SIDEWALK, 0.18, swLen1), sidewalkMat);
    sw1W.position.set(-HALL_HALFW - SIDEWALK / 2, 0.09, T1_END / 2);
    worldRoot.add(sw1W);
    pushCollider(new THREE.Box3().setFromObject(sw1W));
    const sw1E = new THREE.Mesh(new THREE.BoxGeometry(SIDEWALK, 0.18, swLen1), sidewalkMat);
    sw1E.position.set(HALL_HALFW + SIDEWALK / 2, 0.09, T1_END / 2);
    worldRoot.add(sw1E);
    pushCollider(new THREE.Box3().setFromObject(sw1E));
    // aceras tramo 2 (norte y sur, FUERA de la calzada abierta)
    const sw2N = new THREE.Mesh(new THREE.BoxGeometry(T2_END - HALL_HALFW, 0.18, SIDEWALK), sidewalkMat);
    sw2N.position.set((T2_END + HALL_HALFW) / 2, 0.09, T1_END + SIDEWALK / 2);
    worldRoot.add(sw2N);
    pushCollider(new THREE.Box3().setFromObject(sw2N));
    const sw2S = new THREE.Mesh(new THREE.BoxGeometry(T2_END - HALL_HALFW, 0.18, SIDEWALK), sidewalkMat);
    sw2S.position.set((T2_END + HALL_HALFW) / 2, 0.09, CORNER_END - SIDEWALK / 2);
    worldRoot.add(sw2S);
    pushCollider(new THREE.Box3().setFromObject(sw2S));
    sidewalkMat.map.repeat.set(2, 6);
}

// Edificios: bloques que delimitan la calle en L
function buildBuildings() {
    const H = BUILDING_HEIGHT;
    const D = BUILDING_DEPTH;

    // helper: caja entre coordenadas x/z
    function placeBox(xMin, xMax, zMin, zMax, mat) {
        const w = xMax - xMin;
        const d = zMax - zMin;
        addBox(w, H, d, (xMin + xMax) / 2, H / 2, (zMin + zMax) / 2, mat);
    }

    // OESTE: pared oeste larga (cubre todo el flanco izquierdo)
    placeBox(WALL_X_W - D, WALL_X_W, CORNER_END - SIDEWALK - 2, 4, bMat(0));

    // NE: bloque al este de tramo 1 y norte de tramo 2 (forman una L invertida)
    // = todo el rectángulo x ∈ [WALL_X_E, T2_END + D], z ∈ [T1_END + SIDEWALK, 4]
    placeBox(WALL_X_E, T2_END + D, T1_END + SIDEWALK, 4, bMat(1));

    // SE: cierra el extremo este del tramo 2 (donde está la puerta)
    placeBox(T2_END, T2_END + D, CORNER_END - SIDEWALK - 2, T1_END + SIDEWALK, bMat(2));

    // SUR: pared sur (cubre la esquina y todo el tramo 2)
    placeBox(WALL_X_W - D, T2_END + D, CORNER_END - SIDEWALK - D, CORNER_END - SIDEWALK, bMat(0));

    // INICIO: cierre detrás del jugador (al norte del spawn)
    placeBox(WALL_X_W - D, T2_END + D, 4, 4 + D, bMat(2));

    addBuildingDetails();
}

function addBuildingDetails() {
    const detailMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1 });
    const balconyHeights = [3.2, 6.0, 9.0];

    // alongAxis: 'x' o 'z' — eje paralelo al muro
    function ledge(x, z, alongAxis, alongLen = 1.4, stickOut = 0.45) {
        for (const h of balconyHeights) {
            const w = alongAxis === 'x' ? alongLen : stickOut;
            const d = alongAxis === 'x' ? stickOut : alongLen;
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), detailMat);
            m.position.set(x, h, z);
            worldRoot.add(m);
            // barandilla
            const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.04), detailMat);
            rail.position.set(x, h + 0.4, z + (alongAxis === 'x' ? stickOut / 2 : 0));
            if (alongAxis === 'z') {
                rail.rotation.y = Math.PI / 2;
                rail.position.set(x + stickOut / 2, h + 0.4, z);
            }
            worldRoot.add(rail);
        }
    }
    function pipe(x, z) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 9, 8), detailMat);
        p.position.set(x, 4.5, z);
        worldRoot.add(p);
    }
    function ac(x, z, normalAxis) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), detailMat);
        m.position.set(x, 2.4 + Math.random() * 4, z);
        worldRoot.add(m);
    }

    // balcones a lo largo de pared OESTE (vertical, eje Z), sticking out hacia +X
    for (let z = -3; z > T1_END + 1; z -= 4) {
        ledge(WALL_X_W + 0.25, z, 'z', 1.4, 0.45);
        pipe(WALL_X_W + 0.05, z + 1.7);
    }
    // pared NE (cara oeste, x=WALL_X_E), tramo 1, sticking hacia -X
    for (let z = -5; z > T1_END + 1; z -= 4) {
        ledge(WALL_X_E - 0.25, z, 'z', 1.4, 0.45);
    }
    // pared NE (cara sur, z=T1_END+SIDEWALK), tramo 2, sticking hacia -Z
    for (let x = HALL_HALFW + 1; x < T2_END - 1; x += 4) {
        ledge(x, T1_END + SIDEWALK - 0.25, 'x', 1.4, 0.45);
    }
    // pared SUR (cara norte, z=CORNER_END-SIDEWALK), sticking hacia +Z
    for (let x = -1; x < T2_END - 1; x += 5) {
        ledge(x, CORNER_END - SIDEWALK + 0.25, 'x', 1.4, 0.45);
    }
    // unidades AC en pared NE cara oeste
    for (let z = -7; z > T1_END + 1; z -= 5) {
        ac(WALL_X_E - 0.3, z, 'x');
    }

    // contenedor de basura sobre la acera oeste
    const dumpsterMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.85 });
    const dumpster = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 1.5), dumpsterMat);
    dumpster.position.set(WALL_X_W + 0.5, 0.59, -3);
    worldRoot.add(dumpster);
    pushCollider(new THREE.Box3().setFromObject(dumpster));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 1.5), dumpsterMat);
    lid.position.set(dumpster.position.x, 1.13, dumpster.position.z);
    worldRoot.add(lid);

    // coche oxidado contra la acera norte de tramo 2
    const carBody = new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.9, metalness: 0.35 });
    const carDark = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.7 });
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.85, 1.1), carBody);
    body.position.y = 0.6;
    car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 1.0), carBody);
    cabin.position.set(-0.15, 1.27, 0);
    car.add(cabin);
    for (const [wx, wz] of [[-0.9, 0.5], [0.9, 0.5], [-0.9, -0.5], [0.9, -0.5]]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12), carDark);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.28, wz);
        car.add(wheel);
    }
    car.position.set(7, 0.18, T1_END + SIDEWALK / 2);
    car.rotation.y = -0.05;
    worldRoot.add(car);
    car.updateMatrixWorld(true);
    pushCollider(new THREE.Box3().setFromObject(car));

    // pósters en paredes
    state.posters = [];
    function poster(x, y, z, rotY) {
        const back = new THREE.Mesh(
            new THREE.PlaneGeometry(0.6, 0.85),
            new THREE.MeshStandardMaterial({ map: tex.poster, roughness: 1 })
        );
        back.position.set(x, y, z); back.rotation.y = rotY;
        worldRoot.add(back);
        state.posters.push(back);
    }
    poster(WALL_X_W + 0.04, 1.7, -5, Math.PI / 2);
    poster(WALL_X_E - 0.04, 1.7, -10, -Math.PI / 2);
    poster(WALL_X_W + 0.04, 1.7, -14, Math.PI / 2);
    poster(11, 1.7, T1_END + SIDEWALK - 0.04, Math.PI);
    poster(14, 1.7, CORNER_END - SIDEWALK + 0.04, 0);

    // graffiti rojo
    const graffiti = makeGraffitiTexture();
    const graf = new THREE.Mesh(
        new THREE.PlaneGeometry(2.5, 1.4),
        new THREE.MeshStandardMaterial({ map: graffiti, transparent: true, roughness: 1 })
    );
    graf.position.set(WALL_X_E - 0.04, 2.6, -8);
    graf.rotation.y = -Math.PI / 2;
    worldRoot.add(graf);
}

function makeGraffitiTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 256);
    g.font = 'bold 80px Courier New';
    g.fillStyle = 'rgba(180, 0, 20, 0.85)';
    g.fillText('NO MIRES', 30, 100);
    g.fillText('DETRÁS', 110, 200);
    g.fillStyle = 'rgba(180, 0, 20, 0.5)';
    for (let i = 0; i < 12; i++) {
        const x = 20 + Math.random() * 450;
        g.fillRect(x, 60 + Math.random() * 200, 2, 20 + Math.random() * 40);
    }
    return new THREE.CanvasTexture(c);
}

buildGround();
buildBuildings();

// ============== POSTES DE LUZ ==============
const lampLights = [];
function addLamppost(x, z, rotY = 0) {
    const grp = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.7, metalness: 0.6 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.4, 10), poleMat);
    base.position.y = 0.2;
    grp.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.0, 10), poleMat);
    pole.position.y = 2.4;
    grp.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.9), poleMat);
    arm.position.set(0, 4.2, 0.45);
    grp.add(arm);
    const headHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.35, 8), poleMat);
    headHousing.position.set(0, 4.05, 0.9);
    grp.add(headHousing);
    // bombilla emisiva
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd0a0 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), bulbMat);
    bulb.position.set(0, 3.85, 0.9);
    grp.add(bulb);
    // luz
    const light = new THREE.PointLight(0xffc890, 1.6, 14, 1.7);
    light.position.set(0, 3.85, 0.9);
    grp.add(light);

    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;
    worldRoot.add(grp);

    grp.updateMatrixWorld(true);
    pushCollider(new THREE.Box3().setFromObject(base).expandByScalar(-0.05));

    lampLights.push({ light, bulb, baseIntensity: 1.6, baseColor: 0xffc890, group: grp });
    return grp;
}
// distribución: alterna lados a lo largo de tramos
addLamppost(WALL_X_W + 0.4, -2, 0);                     // T1 oeste
addLamppost(WALL_X_E - 0.4, -7, Math.PI);               // T1 este
addLamppost(WALL_X_W + 0.4, -12, 0);                    // T1 oeste
addLamppost(WALL_X_E - 0.4, -16, Math.PI);              // T1 este
addLamppost(4, T1_END + SIDEWALK - 0.4, -Math.PI / 2);  // T2 norte (acera norte)
addLamppost(11, CORNER_END - SIDEWALK + 0.4, Math.PI / 2);  // T2 sur (acera sur)
addLamppost(16, T1_END + SIDEWALK - 0.4, -Math.PI / 2); // T2 norte

// ============== PUERTA FINAL ==============
const doorMat = new THREE.MeshStandardMaterial({ map: tex.door, roughness: 0.85 });
const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.08), doorMat);
const DOOR_POS = new THREE.Vector3(T2_END - 0.05, 1.2, (T1_END + CORNER_END) / 2);
doorMesh.position.copy(DOOR_POS);
doorMesh.rotation.y = Math.PI / 2;
worldRoot.add(doorMesh);
const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0604, roughness: 1 });
const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 1.7), frameMat);
frameTop.position.set(T2_END - 0.05, 2.5, DOOR_POS.z); worldRoot.add(frameTop);
const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.12), frameMat);
frameL.position.set(T2_END - 0.05, 1.3, DOOR_POS.z - 0.83); worldRoot.add(frameL);
const frameR = frameL.clone();
frameR.position.z = DOOR_POS.z + 0.83; worldRoot.add(frameR);
// luz tenue sobre la puerta
const doorLight = new THREE.PointLight(0xffaa66, 0.6, 5, 2);
doorLight.position.set(T2_END - 1.3, 2.8, DOOR_POS.z);
worldRoot.add(doorLight);

// radio en la acera
const radio = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.9 }));
radio.position.set(HALL_HALFW + SIDEWALK / 2, 0.28, -2);
worldRoot.add(radio);
const radioLed = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2020 }));
radioLed.position.set(radio.position.x - 0.1, radio.position.y + 0.06, radio.position.z + 0.11);
worldRoot.add(radioLed);

// teléfono público (cabina) en tramo 2 sobre la acera norte
const phoneBoxMat = new THREE.MeshStandardMaterial({ color: 0x2a2014, roughness: 0.8 });
const phoneBox = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.3), phoneBoxMat);
phoneBox.position.set(T2_END - 2, 1.4, T1_END + SIDEWALK / 2);
worldRoot.add(phoneBox);
const phone = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x080604, roughness: 0.8 }));
phone.position.set(phoneBox.position.x, phoneBox.position.y + 0.25, phoneBox.position.z - 0.05);
worldRoot.add(phone);

// ============== ILUMINACIÓN GLOBAL ==============
const ambient = new THREE.AmbientLight(0x2a2c38, 0.42);
scene.add(ambient);
// luz de luna direccional
const moonLight = new THREE.DirectionalLight(0x6a78a8, 0.35);
moonLight.position.set(-30, 40, -10);
scene.add(moonLight);

// linterna del jugador
const flashlight = new THREE.SpotLight(0xfff0d8, 1.0, 16, Math.PI / 4.2, 0.55, 1.1);
camera.add(flashlight);
flashlight.target.position.set(0, 0, -1);
camera.add(flashlight.target);
scene.add(camera);

// ============== CIELO: LUNA Y ESTRELLAS ==============
// luna como billboard alto
const moon = new THREE.Mesh(new THREE.PlaneGeometry(8, 8),
    new THREE.MeshBasicMaterial({ map: tex.moon, transparent: true, depthWrite: false, fog: false }));
moon.position.set(-40, 32, -50);
moon.lookAt(0, 5, 0);
scene.add(moon);
// estrellas
{
    const N = 220;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
        const r = 80;
        const phi = Math.random() * Math.PI / 2 + 0.1;
        const theta = Math.random() * Math.PI * 2;
        pos[i * 3]     = Math.sin(phi) * Math.cos(theta) * r;
        pos[i * 3 + 1] = Math.cos(phi) * r;
        pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xb8c0d8, size: 0.5, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.7 });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
}

// ============== ENTIDAD: AZAZEL ==============
const demonMat = new THREE.MeshBasicMaterial({
    map: tex.demon, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide,
});
const demon = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 4.0), demonMat);
demon.position.set(0, 2, -100);
scene.add(demon);
// luz roja sutil que la sigue cuando aparece
const demonGlow = new THREE.PointLight(0xff2010, 0, 5, 2);
demonGlow.position.copy(demon.position);
scene.add(demonGlow);

// ============== UI: SUBTÍTULOS / HINT ==============
let subTimer = null;
function showSubtitle(text, duration = 4000) {
    dom.subtitles.textContent = text;
    dom.subtitles.style.opacity = '1';
    clearTimeout(subTimer);
    subTimer = setTimeout(() => { dom.subtitles.style.opacity = '0'; }, duration);
}
let hintTimer = null;
function showHint(text, duration = 2500) {
    dom.hint.textContent = text;
    dom.hint.style.opacity = '1';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { dom.hint.style.opacity = '0'; }, duration);
}

// ============== CONTROLES Y MOVIMIENTO ==============
addEventListener('keydown', e => {
    state.keys[e.code] = true;
    if (e.code === 'KeyE' && controls.isLocked) tryInteract();
    if (e.code === 'Escape') {
        // pausa en lugar de ESC default (PointerLockControls libera el cursor también)
        if (state.playing && controls.isLocked) {
            // se desbloqueará por sí solo y aparece el menú de pausa
        }
    }
});
addEventListener('keyup', e => { state.keys[e.code] = false; });

const playerRadius = 0.35;
function tryMove(delta) {
    const speed = 2.6;
    state.direction.set(0, 0, 0);
    if (state.keys['KeyW']) state.direction.z -= 1;
    if (state.keys['KeyS']) state.direction.z += 1;
    if (state.keys['KeyA']) state.direction.x -= 1;
    if (state.keys['KeyD']) state.direction.x += 1;
    state.direction.normalize();
    if (state.direction.lengthSq() > 0) state.headBob += delta * 8;
    else state.headBob *= 0.9;

    const obj = controls.getObject();
    const fwd = new THREE.Vector3();
    controls.getDirection(fwd);
    fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    move.addScaledVector(fwd, -state.direction.z * speed * delta);
    move.addScaledVector(right, state.direction.x * speed * delta);

    const tryAxis = (dx, dz) => {
        const next = obj.position.clone();
        next.x += dx; next.z += dz;
        const sphereBox = new THREE.Box3(
            new THREE.Vector3(next.x - playerRadius, 0.4, next.z - playerRadius),
            new THREE.Vector3(next.x + playerRadius, BUILDING_HEIGHT - 0.5, next.z + playerRadius)
        );
        for (const b of colliders) if (sphereBox.intersectsBox(b)) return false;
        // bloquear puerta cuando no se puede salir
        if (!state.canExit) {
            if (next.x > T2_END - 0.55 && next.z > CORNER_END - 0.5 && next.z < T1_END + 0.5) return false;
        }
        return true;
    };
    if (tryAxis(move.x, 0)) obj.position.x += move.x;
    if (tryAxis(0, move.z)) obj.position.z += move.z;

    obj.position.y = 1.65 + Math.sin(state.headBob) * 0.04;
}

// ============== CAMERA SHAKE ==============
const shakeOffset = { x: 0, y: 0, z: 0 };
function addShake(amount) { state.shakeAmount = Math.max(state.shakeAmount, amount); }
function updateShake(delta) {
    // quitar offset previo
    camera.rotation.x -= shakeOffset.x;
    camera.rotation.y -= shakeOffset.y;
    camera.rotation.z -= shakeOffset.z;
    if (!SETTINGS.shake) {
        shakeOffset.x = shakeOffset.y = shakeOffset.z = 0;
        return;
    }
    state.shakeAmount = Math.max(0, state.shakeAmount - delta * 1.4);
    if (state.shakeAmount > 0.001) {
        shakeOffset.x = (Math.random() - 0.5) * state.shakeAmount;
        shakeOffset.y = (Math.random() - 0.5) * state.shakeAmount;
        shakeOffset.z = (Math.random() - 0.5) * state.shakeAmount * 0.4;
    } else {
        shakeOffset.x = shakeOffset.y = shakeOffset.z = 0;
    }
    camera.rotation.x += shakeOffset.x;
    camera.rotation.y += shakeOffset.y;
    camera.rotation.z += shakeOffset.z;
}

// ============== INTERACCIÓN ==============
function tryInteract() {
    const p = controls.getObject().position;
    const dRadio = Math.hypot(p.x - radio.position.x, p.z - radio.position.z);
    if (dRadio < 1.6) {
        audio.playStatic(4, 0.22);
        const lines = [
            '"… diez personas asesinadas en su propia casa…"',
            '"… el padre los miró fijamente antes…"',
            '"… los policías encontraron al bebé…"',
            '"… pero el bebé seguía respirando…"',
            '"… nunca encontraron al asesino. Era el padre."',
            '"… las víctimas hablan ya en otro idioma…"',
            '"… NO ESTAMOS SOLOS EN ESTA CALLE."',
        ];
        showSubtitle(lines[Math.min(state.loop - 1, lines.length - 1)] || lines[0], 5500);
        return;
    }
    const dPhone = Math.hypot(p.x - phone.position.x, p.z - phone.position.z);
    if (dPhone < 1.6 && state.loop >= 4) {
        audio.playPhoneRing(1);
        const lines = [
            '"… te estoy esperando, papá…"',
            '"… AZAZEL te ha visto. Ya no puedes irte."',
            '"… el séptimo bucle te abrirá la puerta… o te abrirá."',
        ];
        showSubtitle(lines[Math.min(state.loop - 4, lines.length - 1)], 5000);
        addShake(0.04);
        return;
    }
    // pósters
    if (state.posters) {
        for (const pic of state.posters) {
            const d = Math.hypot(p.x - pic.position.x, p.z - pic.position.z);
            if (d < 1.5 && pic.userData.taken !== true) {
                state.photoFragments++;
                pic.userData.taken = true;
                pic.material.color.setHex(0x000000);
                showHint(`Fragmento ${state.photoFragments}/${state.posters.length}`, 2500);
                audio.playWhisper();
                return;
            }
        }
    }
    showHint('Nada que hacer aquí.', 1500);
}

// ============== BUCLES ==============
const SPAWN = new THREE.Vector3(0, 1.65, -1);
function startNewLoop() {
    state.loop += 1;
    state.canExit = false;
    state.triggers.clear();
    controls.getObject().position.copy(SPAWN);
    camera.rotation.set(0, 0, 0);
    demonMat.opacity = 0;
    demon.position.set(0, 2, -100);
    demonGlow.intensity = 0;
    for (const cl of lampLights) {
        cl.light.color.setHex(cl.baseColor);
        cl.light.intensity = cl.baseIntensity;
        cl.bulb.material.color.setHex(cl.baseColor);
    }
    applyFog();
    dom.loopCounter.textContent = `BUCLE ${String(state.loop).padStart(2, '0')}`;
    onLoopEnter(state.loop);
}

const LOOP_FOG = [0.052, 0.054, 0.06, 0.07, 0.085, 0.10, 0.12, 0.045];
function applyFog() {
    const base = LOOP_FOG[state.loop] !== undefined ? LOOP_FOG[state.loop] : BASE_FOG;
    scene.fog.density = base * SETTINGS.fogScale;
    // tinte sutil hacia rojo en bucles altos
    const r = Math.min(0.05, state.loop * 0.008);
    scene.fog.color.setRGB(0.02 + r, 0.024, 0.04);
    scene.background = scene.fog.color;
}

function onLoopEnter(n) {
    switch (n) {
        case 1:
            showSubtitle('Esta calle… no termina nunca.', 4500);
            setTimeout(() => audio.playStatic(2.5, 0.18), 1500);
            break;
        case 2:
            showSubtitle('Algo respira a tu espalda.', 4000);
            setTimeout(() => { audio.playKnock(); addShake(0.025); }, 2500);
            break;
        case 3:
            setTimeout(() => audio.playWhisper(), 1500);
            setTimeout(() => showSubtitle('Mira detrás. Mira detrás. Mira detrás.', 4000), 1800);
            break;
        case 4:
            setTimeout(() => audio.playBabyCry(5), 1500);
            setTimeout(() => showSubtitle('El bebé… no es un bebé.', 4500), 2500);
            break;
        case 5:
            setTimeout(() => {
                demon.position.set(0, 1.95, T1_END - 2);
                demonMat.opacity = 0.85;
                demonGlow.position.copy(demon.position);
                demonGlow.intensity = 0.6;
                audio.playDemonGrowl(4, 0.35);
                showSubtitle('AZAZEL te observa.', 3500);
                addShake(0.05);
            }, 1200);
            break;
        case 6:
            setTimeout(() => {
                demon.position.set(0, 1.95, -3);
                demonMat.opacity = 0;
                demonGlow.intensity = 0;
                showSubtitle('No te gires. NO TE GIRES.', 5000);
                audio.playDemonWhisper();
            }, 800);
            break;
        case 7:
            state.canExit = true;
            for (const cl of lampLights) {
                cl.light.color.setHex(0xfff0d0);
                cl.light.intensity = cl.baseIntensity * 1.4;
                cl.bulb.material.color.setHex(0xfff0d0);
            }
            showSubtitle('Algo cedió. La puerta… está abierta.', 5000);
            audio.playSubBoom(0.5);
            break;
    }
}

function checkLoopTriggers() {
    const p = controls.getObject().position;
    const trig = (id, cond, fn) => {
        if (!state.triggers.has(id) && cond) { state.triggers.add(id); fn(); }
    };
    // mitad del primer tramo
    trig(`${state.loop}-mid1`, p.z < -8 && p.z > -10, () => {
        if (state.loop === 2) flickerLights(2.5);
        if (state.loop === 3) { audio.playKnock(); addShake(0.04); showSubtitle('… alguien camina sobre el techo.', 3000); }
        if (state.loop === 4) audio.playPhoneRing(2);
        if (state.loop === 5) { audio.playKnock(); addShake(0.05); }
        if (state.loop === 6) {
            audio.playDemonGrowl(3, 0.4);
            addShake(0.06);
        }
    });
    // esquina
    trig(`${state.loop}-corner`, p.z < T1_END + 1 && p.z > T1_END - 1, () => {
        if (state.loop === 3) showSubtitle('Las paredes… respiran.', 3500);
        if (state.loop === 4) { audio.playBabyCry(3); addShake(0.05); }
        if (state.loop === 5) {
            demon.position.set(p.x, 1.95, p.z + 4);
            demonMat.opacity = 0.92;
            demonGlow.intensity = 0.8;
            audio.playDemonWhisper();
            addShake(0.07);
        }
        if (state.loop === 6) {
            audio.playDemonScream();
            addShake(0.18);
            jumpscare();
        }
    });
    // teléfono (bucle 4+)
    if (state.loop >= 4) {
        const dPhone = Math.hypot(p.x - phone.position.x, p.z - phone.position.z);
        trig(`${state.loop}-phone`, dPhone < 2.0, () => {
            audio.playPhoneRing(2);
            showHint('[E] descolgar', 2500);
        });
    }
    // puerta
    const dDoor = Math.hypot(p.x - (T2_END - 0.5), p.z - DOOR_POS.z);
    if (dDoor < 1.4 && Date.now() - state.lastDoorEnter > 1500) {
        state.lastDoorEnter = Date.now();
        if (state.canExit) endGame();
        else doorTransition();
    }
}

function flickerLights(seconds = 2) {
    const start = performance.now();
    const baseList = lampLights.map(c => c.baseIntensity);
    const i = setInterval(() => {
        for (let k = 0; k < lampLights.length; k++) {
            lampLights[k].light.intensity = Math.random() < 0.45 ? 0 : baseList[k] * (0.5 + Math.random() * 0.7);
        }
        if (performance.now() - start > seconds * 1000) {
            clearInterval(i);
            for (let k = 0; k < lampLights.length; k++) lampLights[k].light.intensity = baseList[k];
        }
    }, 65);
}

function doorTransition() {
    audio.playSubBoom(0.55);
    addShake(0.1);
    dom.static.style.opacity = '0.6';
    setTimeout(() => {
        dom.static.style.opacity = '0';
        startNewLoop();
    }, 700);
}

function jumpscare() {
    audio.playDemonScream();
    addShake(0.25);
    dom.jumpscare.classList.remove('hidden');
    dom.static.style.opacity = '0.95';
    setTimeout(() => {
        dom.jumpscare.classList.add('hidden');
        dom.static.style.opacity = '0';
        state.loop = Math.max(0, state.loop - 1);
        startNewLoop();
    }, 1300);
}

function endGame() {
    state.playing = false;
    controls.unlock();
    audio.playSubBoom(0.6);
    dom.game.classList.add('hidden');
    dom.ending.classList.remove('hidden');
    const lines = [
        'Cruzas la puerta.',
        'La calle se cierra a tu espalda.',
        'Pero la radio sigue sonando, en algún lugar.',
        '',
        '"… los hijos. Los diez hijos…"',
        '',
        'Quizá no fue una salida después de todo.',
    ];
    dom.endingText.innerHTML = lines.join('<br>');
}

// ============== ANIMACIÓN ENTIDAD ==============
function updateDemon(delta) {
    if (demonMat.opacity < 0.05) return;
    const p = controls.getObject().position;
    demon.lookAt(p.x, demon.position.y, p.z);
    if (state.loop >= 5) {
        const dir = new THREE.Vector3(p.x - demon.position.x, 0, p.z - demon.position.z);
        const dist = dir.length();
        if (dist > 0.6) {
            dir.normalize();
            const sp = state.loop === 6 ? 1.9 : 0.65;
            demon.position.addScaledVector(dir, sp * delta);
            demonGlow.position.copy(demon.position);
            demonGlow.position.y += 0.5;
        } else if (state.loop === 6) {
            jumpscare();
        }
    }
    demon.position.y = 2.0 + Math.sin(performance.now() * 0.002) * 0.06;
    // gruñido aleatorio bajo
    if (state.loop >= 5 && Math.random() < 0.003) audio.playDemonGrowl(2.5, 0.25);
}

// ============== TICK ==============
const clock = new THREE.Clock();
function tick() {
    const delta = Math.min(clock.getDelta(), 0.05);
    if (controls.isLocked && !state.paused) {
        tryMove(delta);
        checkLoopTriggers();
        updateDemon(delta);
        if (state.loop >= 3 && Math.random() < 0.005 * state.loop) {
            dom.static.style.opacity = '0.18';
            setTimeout(() => { dom.static.style.opacity = '0'; }, 80);
        }
        if (state.loop >= 2 && Math.random() < 0.003) flickerLights(0.6);
    }
    updateShake(delta);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
}

// ============== RESIZE ==============
addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============== SETTINGS ==============
function applySettings() {
    audio.masterGain.gain.value = SETTINGS.masterVol;
    audio.sfxGain.gain.value = SETTINGS.sfxVol;
    audio.ambGain.gain.value = SETTINGS.ambVol;
    renderer.toneMappingExposure = 0.85 * SETTINGS.brightness;
    camera.fov = SETTINGS.fov;
    camera.updateProjectionMatrix();
    if (controls.pointerSpeed !== undefined) controls.pointerSpeed = SETTINGS.sensitivity;
    flashlight.intensity = SETTINGS.flashlight ? 1.0 : 0;
    applyFog();
}

function bindSetting(id, key, mapFn = v => v / 100, displayFn = v => Math.round(v)) {
    const el = document.getElementById(id);
    const val = document.querySelector(`.val[data-for="${id}"]`);
    if (!el) return;
    if (el.type === 'checkbox') {
        el.addEventListener('change', () => { SETTINGS[key] = el.checked; applySettings(); });
        el.checked = SETTINGS[key];
    } else {
        el.addEventListener('input', () => {
            SETTINGS[key] = mapFn(parseFloat(el.value));
            if (val) val.textContent = displayFn(parseFloat(el.value));
            applySettings();
        });
    }
}

bindSetting('vol-master', 'masterVol');
bindSetting('vol-sfx', 'sfxVol');
bindSetting('vol-ambient', 'ambVol');
bindSetting('brightness', 'brightness');
bindSetting('fov', 'fov', v => v, v => Math.round(v));
bindSetting('fog', 'fogScale');
bindSetting('sensitivity', 'sensitivity');
bindSetting('shake-toggle', 'shake');
bindSetting('flashlight-toggle', 'flashlight');

// ============== NAVEGACIÓN UI ==============
let settingsReturnTo = 'menu'; // 'menu' o 'pause'

function showScreen(name) {
    dom.menu.classList.add('hidden');
    dom.settings.classList.add('hidden');
    dom.pause.classList.add('hidden');
    dom.ending.classList.add('hidden');
    if (name === 'menu') dom.menu.classList.remove('hidden');
    if (name === 'settings') dom.settings.classList.remove('hidden');
    if (name === 'pause') dom.pause.classList.remove('hidden');
}

dom.startBtn.addEventListener('click', () => {
    audio.ensureRunning();
    drone = drone || audio.startDrone();
    dom.menu.classList.add('hidden');
    dom.game.classList.remove('hidden');
    state.playing = true;
    controls.lock();
    if (state.loop === 0) startNewLoop();
});

dom.menuSettingsBtn.addEventListener('click', () => {
    settingsReturnTo = 'menu';
    showScreen('settings');
});

dom.settingsBack.addEventListener('click', () => {
    showScreen(settingsReturnTo);
});

dom.resumeBtn.addEventListener('click', () => {
    audio.ensureRunning();
    showScreen('hidden');
    dom.pause.classList.add('hidden');
    dom.game.classList.remove('hidden');
    controls.lock();
});

dom.pauseSettingsBtn.addEventListener('click', () => {
    settingsReturnTo = 'pause';
    showScreen('settings');
});

dom.quitBtn.addEventListener('click', () => {
    state.playing = false;
    state.loop = 0;
    state.photoFragments = 0;
    if (state.posters) state.posters.forEach(p => { p.userData.taken = false; p.material.color.setHex(0xffffff); });
    dom.pause.classList.add('hidden');
    dom.game.classList.add('hidden');
    showScreen('menu');
});

dom.restartBtn.addEventListener('click', () => {
    state.loop = 0;
    state.photoFragments = 0;
    if (state.posters) state.posters.forEach(p => { p.userData.taken = false; p.material.color.setHex(0xffffff); });
    dom.ending.classList.add('hidden');
    dom.game.classList.remove('hidden');
    state.playing = true;
    controls.lock();
    startNewLoop();
});

controls.addEventListener('lock', () => {
    state.paused = false;
    dom.pause.classList.add('hidden');
});
controls.addEventListener('unlock', () => {
    state.paused = true;
    if (state.playing) {
        // entrar en pausa solo si seguimos jugando
        showScreen('pause');
    }
});

// init
applySettings();
tick();
