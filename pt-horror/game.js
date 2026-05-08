import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

/* ============================================================
   EL PASILLO — homenaje a P.T.
   Pasillo en L que se repite. Cada bucle corrompe la realidad.
   ============================================================ */

// ---------- Estado global ----------
const state = {
    loop: 0,
    maxLoops: 7,
    photoFragments: 0,
    canExit: false,
    paused: true,
    keys: {},
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    triggers: new Set(), // eventos de bucle ya disparados
    lastDoorEnter: 0,
    headBob: 0,
};

// ---------- DOM ----------
const dom = {
    menu: document.getElementById('menu'),
    startBtn: document.getElementById('startBtn'),
    loading: document.getElementById('loading'),
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

// ---------- Three.js setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.18);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 60);
camera.position.set(0, 1.65, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.65;
dom.game.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

// ---------- Texturas procedurales ----------
function makeWallpaperTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    // base color crema oscura
    g.fillStyle = '#3a2818';
    g.fillRect(0, 0, 512, 512);
    // patrón damasco
    for (let y = 0; y < 512; y += 32) {
        for (let x = 0; x < 512; x += 32) {
            g.fillStyle = ((x + y) / 32) % 2 === 0 ? '#4a3220' : '#2e1f12';
            g.fillRect(x, y, 32, 32);
        }
    }
    // motivos florales repetidos
    for (let y = 16; y < 512; y += 64) {
        for (let x = 16; x < 512; x += 64) {
            g.strokeStyle = '#5a3826';
            g.lineWidth = 1.5;
            g.beginPath();
            g.arc(x, y, 8, 0, Math.PI * 2);
            g.stroke();
            g.beginPath();
            g.arc(x, y, 4, 0, Math.PI * 2);
            g.stroke();
        }
    }
    // suciedad
    for (let i = 0; i < 1500; i++) {
        const a = Math.random() * 0.18;
        g.fillStyle = `rgba(0,0,0,${a})`;
        g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    return t;
}

function makeFloorTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#1a1410';
    g.fillRect(0, 0, 512, 512);
    // tablones
    for (let y = 0; y < 512; y += 64) {
        const offset = (y / 64) % 2 ? 32 : 0;
        for (let x = -32; x < 512; x += 96) {
            const shade = 18 + Math.random() * 10;
            g.fillStyle = `rgb(${shade + 15},${shade + 8},${shade})`;
            g.fillRect(x + offset, y, 92, 60);
            // veta
            g.strokeStyle = 'rgba(0,0,0,0.4)';
            g.beginPath();
            g.moveTo(x + offset + Math.random() * 20, y + 4);
            g.bezierCurveTo(
                x + offset + 30, y + 20,
                x + offset + 60, y + 40,
                x + offset + 90, y + 56
            );
            g.stroke();
        }
    }
    // manchas
    for (let i = 0; i < 80; i++) {
        g.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
        g.beginPath();
        g.arc(Math.random() * 512, Math.random() * 512, Math.random() * 12, 0, Math.PI * 2);
        g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 4);
    return t;
}

function makeCeilingTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#1a1612';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) {
        g.fillStyle = `rgba(80,60,40,${Math.random() * 0.15})`;
        g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
    }
    // mancha de humedad
    g.fillStyle = 'rgba(50, 20, 5, 0.5)';
    g.beginPath();
    g.arc(128, 80, 40, 0, Math.PI * 2);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    return t;
}

function makeDoorTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#2a1810';
    g.fillRect(0, 0, 256, 512);
    // paneles
    g.strokeStyle = '#0a0604';
    g.lineWidth = 4;
    g.strokeRect(20, 20, 216, 220);
    g.strokeRect(20, 270, 216, 220);
    g.strokeStyle = '#4a2a1a';
    g.lineWidth = 1;
    g.strokeRect(28, 28, 200, 204);
    g.strokeRect(28, 278, 200, 204);
    // pomo
    g.fillStyle = '#5a4a1a';
    g.beginPath();
    g.arc(220, 256, 6, 0, Math.PI * 2);
    g.fill();
    // veta
    for (let i = 0; i < 60; i++) {
        g.strokeStyle = `rgba(0,0,0,${Math.random() * 0.2})`;
        g.beginPath();
        g.moveTo(0, Math.random() * 512);
        g.bezierCurveTo(64, Math.random() * 512, 192, Math.random() * 512, 256, Math.random() * 512);
        g.stroke();
    }
    return new THREE.CanvasTexture(c);
}

function makePictureTexture(label = '') {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#2a1a14';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#080604';
    g.fillRect(16, 16, 224, 224);
    // figura borrosa
    const grad = g.createRadialGradient(128, 100, 10, 128, 128, 110);
    grad.addColorStop(0, 'rgba(180, 160, 140, 0.6)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(16, 16, 224, 224);
    // arañazos
    for (let i = 0; i < 30; i++) {
        g.strokeStyle = 'rgba(140, 100, 80, 0.4)';
        g.beginPath();
        g.moveTo(Math.random() * 256, Math.random() * 256);
        g.lineTo(Math.random() * 256, Math.random() * 256);
        g.stroke();
    }
    if (label) {
        g.fillStyle = '#8a3a3a';
        g.font = '20px Courier New';
        g.fillText(label, 30, 240);
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
        // chorretón
        for (let j = 0; j < 5; j++) {
            g.fillRect(x - 2, y, 4, Math.random() * 80);
        }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function makeLisaFaceTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512);
    // cabeza pálida
    g.fillStyle = '#a89888';
    g.beginPath();
    g.ellipse(256, 240, 110, 150, 0, 0, Math.PI * 2);
    g.fill();
    // sombras
    const grad = g.createRadialGradient(256, 240, 30, 256, 240, 160);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(256, 240, 110, 150, 0, 0, Math.PI * 2);
    g.fill();
    // ojos negros hundidos
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(220, 220, 16, 22, 0, 0, Math.PI * 2);
    g.ellipse(292, 220, 16, 22, 0, 0, Math.PI * 2);
    g.fill();
    // boca rota
    g.strokeStyle = '#3a0000';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(220, 310);
    g.bezierCurveTo(240, 330, 270, 330, 290, 310);
    g.stroke();
    g.fillStyle = '#3a0000';
    for (let i = 0; i < 6; i++) {
        g.fillRect(225 + i * 11, 315, 3, 8);
    }
    // pelo largo y húmedo
    g.fillStyle = '#1a0a08';
    g.beginPath();
    g.moveTo(150, 180);
    for (let x = 150; x <= 360; x += 4) {
        const y = 180 + Math.sin(x * 0.04) * 4 + Math.random() * 3;
        g.lineTo(x, y);
    }
    g.lineTo(370, 480);
    g.lineTo(140, 480);
    g.closePath();
    g.fill();
    // sangre
    g.fillStyle = 'rgba(80, 0, 0, 0.7)';
    for (let i = 0; i < 8; i++) {
        const x = 180 + Math.random() * 150;
        g.fillRect(x, 250 + Math.random() * 40, 2, 30 + Math.random() * 60);
    }
    return new THREE.CanvasTexture(c);
}

const tex = {
    wall: makeWallpaperTexture(),
    floor: makeFloorTexture(),
    ceiling: makeCeilingTexture(),
    door: makeDoorTexture(),
    picture: makePictureTexture(),
    blood: makeBloodOverlay(),
    lisaFace: makeLisaFaceTexture(),
};

// pasar textura de Lisa al CSS para el jumpscare
document.documentElement.style.setProperty('--lisa-face', `url(${tex.lisaFace.image.toDataURL()})`);

// ---------- Geometría del pasillo en L ----------
/* Distribución (vista superior):
   El jugador empieza en (0, 0), mirando -Z.
   Tramo 1: x ∈ [-1.5, 1.5], z ∈ [-18, 0]
   Esquina:  z ∈ [-22, -18], conexión
   Tramo 2: x ∈ [-1.5, 18],  z ∈ [-22, -18]  (gira a la derecha al final)
   La puerta está al final del tramo 2 (x≈18, z≈-20)
*/
const HALL_HALFW = 1.6;          // mitad ancho corredor
const HALL_HEIGHT = 2.7;
const T1_END = -18;              // tramo 1: de z=0 a z=-18
const CORNER_END = -22;          // tramo perpendicular ancho hasta z=-22
const T2_END = 18;               // tramo 2 de x=0 a x=18
const colliders = [];            // boxes para colisión
const corridorRoot = new THREE.Group();
scene.add(corridorRoot);

function addBox(w, h, d, x, y, z, mat, options = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (options.rotY) mesh.rotation.y = options.rotY;
    mesh.receiveShadow = true;
    corridorRoot.add(mesh);
    if (!options.noCollide) {
        const box = new THREE.Box3().setFromObject(mesh);
        colliders.push(box);
    }
    return mesh;
}

const wallMat = new THREE.MeshStandardMaterial({ map: tex.wall, roughness: 1, metalness: 0 });
const floorMat = new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 0.95 });
const ceilMat = new THREE.MeshStandardMaterial({ map: tex.ceiling, roughness: 1 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x1a0e08, roughness: 1 });

function buildCorridor() {
    // Tramo 1 vertical (a lo largo de Z)
    const t1Length = Math.abs(T1_END);
    // suelo tramo 1
    const f1 = new THREE.Mesh(new THREE.PlaneGeometry(HALL_HALFW * 2, t1Length), floorMat);
    f1.rotation.x = -Math.PI / 2;
    f1.position.set(0, 0, T1_END / 2);
    f1.receiveShadow = true;
    corridorRoot.add(f1);
    // techo tramo 1
    const c1 = new THREE.Mesh(new THREE.PlaneGeometry(HALL_HALFW * 2, t1Length), ceilMat);
    c1.rotation.x = Math.PI / 2;
    c1.position.set(0, HALL_HEIGHT, T1_END / 2);
    corridorRoot.add(c1);
    // pared izquierda tramo 1
    addBox(0.2, HALL_HEIGHT, t1Length, -HALL_HALFW, HALL_HEIGHT / 2, T1_END / 2, wallMat);
    // pared derecha tramo 1
    addBox(0.2, HALL_HEIGHT, t1Length, HALL_HALFW, HALL_HEIGHT / 2, T1_END / 2, wallMat);
    // pared al inicio (para evitar mirar al vacío)
    addBox(HALL_HALFW * 2 + 0.4, HALL_HEIGHT, 0.2, 0, HALL_HEIGHT / 2, 0.1, wallMat);

    // Esquina/transición: de z=-18 a z=-22 con anchura del tramo 2
    // suelo de la esquina
    const cornerW = T2_END + HALL_HALFW * 2;
    const cornerD = Math.abs(CORNER_END - T1_END);
    const fc = new THREE.Mesh(new THREE.PlaneGeometry(cornerW, cornerD), floorMat);
    fc.rotation.x = -Math.PI / 2;
    fc.position.set(cornerW / 2 - HALL_HALFW, 0, (T1_END + CORNER_END) / 2);
    corridorRoot.add(fc);
    const cc = new THREE.Mesh(new THREE.PlaneGeometry(cornerW, cornerD), ceilMat);
    cc.rotation.x = Math.PI / 2;
    cc.position.set(cornerW / 2 - HALL_HALFW, HALL_HEIGHT, (T1_END + CORNER_END) / 2);
    corridorRoot.add(cc);
    // pared trasera de la esquina (z = CORNER_END)
    addBox(cornerW, HALL_HEIGHT, 0.2, cornerW / 2 - HALL_HALFW, HALL_HEIGHT / 2, CORNER_END - 0.1, wallMat);
    // pared izquierda continua que separa el corredor (x=-halfw, todo el largo de la esquina)
    addBox(0.2, HALL_HEIGHT, cornerD, -HALL_HALFW, HALL_HEIGHT / 2, (T1_END + CORNER_END) / 2, wallMat);

    // Tramo 2 (a lo largo de X positivo, z entre T1_END y CORNER_END)
    const t2Length = T2_END - HALL_HALFW;
    // pared norte (z = T1_END) desde x=HALF a x=T2_END
    addBox(t2Length, HALL_HEIGHT, 0.2, HALL_HALFW + t2Length / 2, HALL_HEIGHT / 2, T1_END - 0.1, wallMat);
    // pared sur (z = CORNER_END) desde x=HALF a x=T2_END  (ya cubierto parcial por trasera de esquina, pero alargamos)
    // (la trasera de esquina ya cubre todo el ancho hasta T2_END+, ok)
    // suelo tramo 2 (entre x=HALF y T2_END)
    const f2 = new THREE.Mesh(new THREE.PlaneGeometry(t2Length, cornerD), floorMat);
    f2.rotation.x = -Math.PI / 2;
    f2.position.set(HALL_HALFW + t2Length / 2, 0, (T1_END + CORNER_END) / 2);
    corridorRoot.add(f2);
    const c2 = new THREE.Mesh(new THREE.PlaneGeometry(t2Length, cornerD), ceilMat);
    c2.rotation.x = Math.PI / 2;
    c2.position.set(HALL_HALFW + t2Length / 2, HALL_HEIGHT, (T1_END + CORNER_END) / 2);
    corridorRoot.add(c2);
    // pared final (puerta) en x=T2_END
    addBox(0.4, HALL_HEIGHT, cornerD, T2_END, HALL_HEIGHT / 2, (T1_END + CORNER_END) / 2, wallMat);

    // Rodapiés y molduras (decorativos, sin collide)
    const trimGeo = new THREE.BoxGeometry(0.05, 0.15, t1Length);
    const trimL = new THREE.Mesh(trimGeo, trimMat);
    trimL.position.set(-HALL_HALFW + 0.04, 0.075, T1_END / 2);
    corridorRoot.add(trimL);
    const trimR = trimL.clone();
    trimR.position.x = HALL_HALFW - 0.04;
    corridorRoot.add(trimR);
}

buildCorridor();

// ---------- Puerta al final ----------
const doorMat = new THREE.MeshStandardMaterial({ map: tex.door, roughness: 0.85 });
const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.08), doorMat);
const DOOR_POS = new THREE.Vector3(T2_END - 0.28, 1.2, (T1_END + CORNER_END) / 2);
doorMesh.position.copy(DOOR_POS);
doorMesh.rotation.y = Math.PI / 2;
scene.add(doorMesh);

// marco
const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0604, roughness: 1 });
const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 1.6), frameMat);
frameTop.position.set(T2_END - 0.28, 2.45, DOOR_POS.z);
scene.add(frameTop);
const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.12), frameMat);
frameL.position.set(T2_END - 0.28, 1.25, DOOR_POS.z - 0.78);
scene.add(frameL);
const frameR = frameL.clone();
frameR.position.z = DOOR_POS.z + 0.78;
scene.add(frameR);

// ---------- Decorados ----------
const decorRoot = new THREE.Group();
scene.add(decorRoot);

function addPicture(x, y, z, rotY) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x2a1610, roughness: 1 }));
    frame.position.set(x, y, z);
    frame.rotation.y = rotY;
    decorRoot.add(frame);
    const canv = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7),
        new THREE.MeshStandardMaterial({ map: tex.picture, roughness: 1 }));
    canv.position.copy(frame.position);
    const offX = Math.sin(rotY) * 0.03;
    const offZ = Math.cos(rotY) * 0.03;
    canv.position.x += offX;
    canv.position.z += offZ;
    canv.rotation.y = rotY;
    decorRoot.add(canv);
    return { frame, canv };
}

const pictures = [];
pictures.push(addPicture(-HALL_HALFW + 0.05, 1.7, -4, Math.PI / 2));
pictures.push(addPicture(HALL_HALFW - 0.05, 1.7, -10, -Math.PI / 2));
pictures.push(addPicture(-HALL_HALFW + 0.05, 1.7, -14, Math.PI / 2));
pictures.push(addPicture(8, 1.7, T1_END - 0.15, Math.PI));
pictures.push(addPicture(14, 1.7, CORNER_END + 0.15, 0));

// Mesa con teléfono al final
const tableMat = new THREE.MeshStandardMaterial({ color: 0x1a0e08, roughness: 1 });
const table = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.4), tableMat);
table.position.set(T2_END - 1.2, 0.4, DOOR_POS.z + 1.2);
scene.add(table);
const phone = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x080604, roughness: 0.8 }));
phone.position.set(table.position.x, 0.85, table.position.z);
scene.add(phone);

// Radio en el suelo cerca del inicio
const radio = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.9 }));
radio.position.set(HALL_HALFW - 0.25, 0.09, -2);
scene.add(radio);
// luz LED roja
const radioLed = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2020 }));
radioLed.position.set(radio.position.x - 0.1, radio.position.y + 0.05, radio.position.z + 0.1);
scene.add(radioLed);

// ---------- Iluminación ----------
const ambient = new THREE.AmbientLight(0x221814, 0.35);
scene.add(ambient);

// Tres focos de techo
const ceilingLights = [];
function addCeilingLight(x, z, color = 0xffd0a0, intensity = 1.2) {
    const light = new THREE.PointLight(color, intensity, 9, 1.6);
    light.position.set(x, HALL_HEIGHT - 0.2, z);
    light.castShadow = false;
    scene.add(light);
    // bombilla visible
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshBasicMaterial({ color }));
    bulb.position.copy(light.position);
    scene.add(bulb);
    ceilingLights.push({ light, bulb, baseIntensity: intensity, baseColor: color });
    return light;
}
addCeilingLight(0, -3);
addCeilingLight(0, -10);
addCeilingLight(0, -16);
addCeilingLight(5, T1_END - 2);
addCeilingLight(13, T1_END - 2);

// Linterna del jugador
const flashlight = new THREE.SpotLight(0xfff0d8, 0.6, 14, Math.PI / 5, 0.6, 1.2);
flashlight.position.set(0, 0, 0);
camera.add(flashlight);
flashlight.target.position.set(0, 0, -1);
camera.add(flashlight.target);
scene.add(camera);

// ---------- Lisa (fantasma) ----------
function makeGhostTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 512);
    // cuerpo
    g.fillStyle = 'rgba(180, 170, 160, 0.9)';
    g.beginPath();
    g.ellipse(128, 130, 50, 70, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(70, 180);
    g.lineTo(60, 480);
    g.lineTo(196, 480);
    g.lineTo(186, 180);
    g.closePath();
    g.fill();
    // pelo
    g.fillStyle = '#0a0604';
    g.beginPath();
    g.moveTo(70, 90);
    g.bezierCurveTo(80, 60, 176, 60, 186, 90);
    g.lineTo(200, 480);
    g.lineTo(180, 220);
    g.bezierCurveTo(160, 200, 96, 200, 76, 220);
    g.lineTo(56, 480);
    g.closePath();
    g.fill();
    // ojos negros
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(108, 120, 7, 12, 0, 0, Math.PI * 2);
    g.ellipse(148, 120, 7, 12, 0, 0, Math.PI * 2);
    g.fill();
    // boca
    g.strokeStyle = '#3a0000';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(112, 162);
    g.lineTo(144, 162);
    g.stroke();
    // sangre
    g.fillStyle = 'rgba(80, 0, 0, 0.6)';
    g.fillRect(110, 170, 2, 40);
    g.fillRect(140, 170, 2, 30);
    return new THREE.CanvasTexture(c);
}
const lisaTex = makeGhostTexture();
const lisaMat = new THREE.MeshBasicMaterial({
    map: lisaTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
});
const lisa = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), lisaMat);
lisa.position.set(0, 1, -100);
scene.add(lisa);

// ---------- Audio procedural ----------
const audio = (function() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);

    function ensureRunning() {
        if (ctx.state === 'suspended') ctx.resume();
    }

    // ruido blanco continuo
    function makeNoiseBuffer(seconds = 2) {
        const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        return buf;
    }
    const noiseBuf = makeNoiseBuffer(3);

    // drone ambiente bajo
    function startDrone() {
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 220;
        o1.frequency.value = 55;
        o1.type = 'sawtooth';
        o2.frequency.value = 55.5;
        o2.type = 'sawtooth';
        o1.detune.value = -8;
        g.gain.value = 0.05;
        o1.connect(filter); o2.connect(filter);
        filter.connect(g);
        g.connect(masterGain);
        o1.start(); o2.start();
        return { gain: g, oscs: [o1, o2] };
    }

    // estática de radio
    function playStatic(duration = 3, volume = 0.15) {
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
        src.connect(filter).connect(g).connect(masterGain);
        src.start();
        src.stop(ctx.currentTime + duration + 0.1);
        // pulsos de la voz simulada con LFO
        const lfoOsc = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfoOsc.frequency.value = 80 + Math.random() * 60;
        lfoOsc.type = 'square';
        lfoGain.gain.value = volume * 0.4;
        const voiceGain = ctx.createGain();
        voiceGain.gain.value = 0;
        voiceGain.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + 0.2);
        voiceGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        lfoOsc.connect(voiceGain).connect(masterGain);
        lfoOsc.start();
        lfoOsc.stop(ctx.currentTime + duration + 0.1);
    }

    // tono estridente (jumpscare)
    function playSting() {
        const o = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(80, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.3);
        o2.frequency.setValueAtTime(220, ctx.currentTime);
        o2.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.6);
        o.type = 'sawtooth';
        o2.type = 'sawtooth';
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        o.connect(g); o2.connect(g);
        g.connect(masterGain);
        o.start(); o2.start();
        o.stop(ctx.currentTime + 1.6);
        o2.stop(ctx.currentTime + 1.6);
        // ruido áspero
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.4, ctx.currentTime);
        ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        src.connect(ng).connect(masterGain);
        src.start();
        src.stop(ctx.currentTime + 0.7);
    }

    // llanto de bebé (simulado por LFO)
    function playBabyCry(duration = 4) {
        const o = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = 420;
        lfo.type = 'sine';
        lfo.frequency.value = 3;
        lfoGain.gain.value = 60;
        lfo.connect(lfoGain).connect(o.frequency);
        const env = ctx.createGain();
        env.gain.value = 0;
        env.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.1);
        // ondas de llanto
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
        o.connect(filter).connect(env).connect(masterGain);
        o.start(); lfo.start();
        o.stop(ctx.currentTime + duration + 0.1);
        lfo.stop(ctx.currentTime + duration + 0.1);
    }

    // crujido / paso pesado lejano
    function playKnock() {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 180;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        src.connect(filter).connect(g).connect(masterGain);
        src.start();
        src.stop(ctx.currentTime + 0.3);
    }

    // susurro (banda estrecha + modulación)
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
        src.connect(f1).connect(g).connect(masterGain);
        src.start();
        src.stop(ctx.currentTime + 3.1);
    }

    function playPhoneRing(times = 4) {
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
                o.connect(g).connect(masterGain);
                o.start(t0); o.stop(t0 + 0.45);
            }
            t0 += 0.6;
            t0 += 1.4;
        }
    }

    return { ctx, ensureRunning, startDrone, playStatic, playSting, playBabyCry, playKnock, playWhisper, playPhoneRing, masterGain };
})();

let drone = null;

// ---------- Subtítulos / hint ----------
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

// ---------- Controles teclado ----------
addEventListener('keydown', e => { state.keys[e.code] = true; });
addEventListener('keyup', e => { state.keys[e.code] = false; });

addEventListener('keydown', e => {
    if (e.code === 'KeyE' && controls.isLocked) tryInteract();
});

// ---------- Colisiones simples ----------
const playerRadius = 0.35;
function tryMove(delta) {
    const speed = 2.4;
    state.direction.set(0, 0, 0);
    if (state.keys['KeyW']) state.direction.z -= 1;
    if (state.keys['KeyS']) state.direction.z += 1;
    if (state.keys['KeyA']) state.direction.x -= 1;
    if (state.keys['KeyD']) state.direction.x += 1;
    state.direction.normalize();

    // cabeza balanceándose
    if (state.direction.lengthSq() > 0) {
        state.headBob += delta * 8;
    } else {
        state.headBob *= 0.9;
    }

    const obj = controls.getObject();
    const fwd = new THREE.Vector3();
    controls.getDirection(fwd);
    fwd.y = 0; fwd.normalize();
    // right = forward × up para que D mueva al lado derecho del jugador
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    move.addScaledVector(fwd, -state.direction.z * speed * delta);
    move.addScaledVector(right, state.direction.x * speed * delta);

    // intentar mover en X, después en Z (separado para deslizar por paredes)
    const tryAxis = (dx, dz) => {
        const next = obj.position.clone();
        next.x += dx; next.z += dz;
        // collision check con expand box
        const sphereBox = new THREE.Box3(
            new THREE.Vector3(next.x - playerRadius, 0.2, next.z - playerRadius),
            new THREE.Vector3(next.x + playerRadius, HALL_HEIGHT - 0.2, next.z + playerRadius)
        );
        for (const b of colliders) {
            if (sphereBox.intersectsBox(b)) return false;
        }
        // bloquear puerta cuando no se puede salir
        if (!state.canExit) {
            // colisión con puerta a x=T2_END - 0.05
            if (next.x > T2_END - 0.55 && next.z > CORNER_END - 0.5 && next.z < T1_END + 0.5) {
                if (next.x > T2_END - 0.55) return false;
            }
        }
        return true;
    };
    if (tryAxis(move.x, 0)) obj.position.x += move.x;
    if (tryAxis(0, move.z)) obj.position.z += move.z;

    // bobbing
    obj.position.y = 1.65 + Math.sin(state.headBob) * 0.04;
}

// ---------- Lógica del bucle ----------
const SPAWN = new THREE.Vector3(0, 1.65, -1);

function startNewLoop() {
    state.loop += 1;
    state.canExit = false;
    state.triggers.clear();
    // teleport
    controls.getObject().position.copy(SPAWN);
    camera.rotation.set(0, 0, 0);
    controls.getObject().rotation.set(0, 0, 0);
    // resetear lisa
    lisaMat.opacity = 0;
    lisa.position.set(0, 1, -100);
    // volver a colocar puerta
    doorMesh.position.copy(DOOR_POS);
    doorMesh.rotation.set(0, Math.PI / 2, 0);
    // luces normales
    for (const cl of ceilingLights) {
        cl.light.color.setHex(cl.baseColor);
        cl.light.intensity = cl.baseIntensity;
    }
    scene.fog.density = 0.18;
    dom.loopCounter.textContent = `BUCLE ${String(state.loop).padStart(2, '0')}`;
    // gancho de bucle
    onLoopEnter(state.loop);
}

function onLoopEnter(n) {
    switch (n) {
        case 1:
            showSubtitle('No tomes el camino fácil. Hay 10 de nosotros ahora.', 5000);
            setTimeout(() => audio.playStatic(2.5, 0.18), 1500);
            break;
        case 2:
            // empiezan los parpadeos
            showSubtitle('… está ahí, justo detrás de ti.', 4000);
            setTimeout(() => audio.playKnock(), 3000);
            break;
        case 3:
            // mancha de sangre y susurro
            scene.fog.density = 0.22;
            setTimeout(() => audio.playWhisper(), 1500);
            setTimeout(() => showSubtitle('Mira detrás. Mira detrás. Mira detrás.', 4000), 1800);
            break;
        case 4:
            // llanto de bebé
            setTimeout(() => audio.playBabyCry(5), 1500);
            setTimeout(() => showSubtitle('El bebé… está llorando otra vez.', 4500), 2000);
            // teléfono suena al avanzar
            break;
        case 5:
            // Lisa aparece al fondo del primer tramo
            scene.fog.density = 0.27;
            setTimeout(() => {
                lisa.position.set(0, 1, T1_END + 1);
                lisaMat.opacity = 0.85;
                audio.playWhisper();
                showSubtitle('Lisa.', 3000);
            }, 1200);
            break;
        case 6:
            // Lisa persigue
            scene.fog.density = 0.32;
            setTimeout(() => {
                lisa.position.set(0, 1, -3);
                lisaMat.opacity = 0;
                showSubtitle('Date la vuelta. Date la vuelta. NO TE GIRES.', 5000);
            }, 800);
            break;
        case 7:
            // final — la puerta se abre
            state.canExit = true;
            scene.fog.density = 0.12;
            for (const cl of ceilingLights) {
                cl.light.color.setHex(0xffeec0);
                cl.light.intensity = cl.baseIntensity * 1.3;
            }
            showSubtitle('Algo ha cambiado. La puerta… está abierta.', 5000);
            break;
    }
}

// Eventos disparados por posición durante el bucle activo
function checkLoopTriggers() {
    const p = controls.getObject().position;
    const trig = (id, condition, fn) => {
        if (!state.triggers.has(id) && condition) {
            state.triggers.add(id);
            fn();
        }
    };

    // Trigger común: mitad del primer tramo
    trig(`${state.loop}-mid1`, p.z < -8 && p.z > -10, () => {
        if (state.loop === 2) flickerLights(2.5);
        if (state.loop === 3) {
            audio.playKnock();
            showSubtitle('… alguien camina sobre el techo.', 3000);
        }
        if (state.loop === 4) audio.playPhoneRing(3);
        if (state.loop === 5) {
            // lisa avanza un paso
            audio.playKnock();
        }
    });

    // Trigger: esquina
    trig(`${state.loop}-corner`, p.z < T1_END + 1 && p.z > T1_END - 1, () => {
        if (state.loop === 3) {
            // sangre aparece (overlay simple via fog color)
            scene.background = new THREE.Color(0x100404);
            showSubtitle('Las paredes… respiran.', 3500);
        }
        if (state.loop === 4) {
            audio.playBabyCry(3);
        }
        if (state.loop === 5) {
            // Lisa sale de detrás
            lisa.position.set(p.x, 1, p.z + 3);
            lisaMat.opacity = 0.9;
            audio.playWhisper();
        }
        if (state.loop === 6) {
            audio.playSting();
            jumpscare();
        }
    });

    // Trigger: cerca del teléfono (bucle 4)
    if (state.loop >= 4) {
        const dPhone = Math.hypot(p.x - phone.position.x, p.z - phone.position.z);
        trig(`${state.loop}-phone`, dPhone < 1.4, () => {
            audio.playPhoneRing(2);
            showHint('[E] descolgar', 2500);
        });
    }

    // Trigger: cerca de la puerta -> avanzar bucle
    const dDoor = Math.hypot(p.x - (T2_END - 0.5), p.z - DOOR_POS.z);
    if (dDoor < 1.2 && Date.now() - state.lastDoorEnter > 1500) {
        state.lastDoorEnter = Date.now();
        if (state.canExit) {
            // ¡SALIR!
            endGame();
        } else {
            // bucle: fundir a negro y rebobinar
            doorTransition();
        }
    }
}

function flickerLights(seconds = 2) {
    const start = performance.now();
    const baseList = ceilingLights.map(c => c.baseIntensity);
    const i = setInterval(() => {
        for (let k = 0; k < ceilingLights.length; k++) {
            ceilingLights[k].light.intensity = Math.random() < 0.4 ? 0 : baseList[k] * (0.6 + Math.random() * 0.6);
        }
        if (performance.now() - start > seconds * 1000) {
            clearInterval(i);
            for (let k = 0; k < ceilingLights.length; k++) ceilingLights[k].light.intensity = baseList[k];
        }
    }, 60);
}

function doorTransition() {
    // fade negro, sonido, teleport
    audio.playKnock();
    dom.static.style.opacity = '0.6';
    document.body.style.transition = 'background 0.4s';
    document.body.style.background = '#000';
    setTimeout(() => {
        dom.static.style.opacity = '0';
        startNewLoop();
    }, 700);
}

function jumpscare() {
    audio.playSting();
    dom.jumpscare.classList.remove('hidden');
    dom.static.style.opacity = '0.9';
    setTimeout(() => {
        dom.jumpscare.classList.add('hidden');
        dom.static.style.opacity = '0';
        // retroceder un bucle
        state.loop = Math.max(0, state.loop - 1);
        startNewLoop();
    }, 1100);
}

function endGame() {
    controls.unlock();
    dom.game.classList.add('hidden');
    dom.ending.classList.remove('hidden');
    const lines = [
        'Cruzas la puerta.',
        'El pasillo se cierra a tu espalda.',
        'Pero la radio sigue sonando, en algún lugar.',
        '',
        '"… los hijos. Los diez hijos…"',
        '',
        'Quizá no fue una salida después de todo.',
    ];
    dom.endingText.innerHTML = lines.join('<br>');
}

// ---------- Interacción ----------
function tryInteract() {
    const p = controls.getObject().position;
    // Radio
    const dRadio = Math.hypot(p.x - radio.position.x, p.z - radio.position.z);
    if (dRadio < 1.3) {
        audio.playStatic(4, 0.22);
        const lines = [
            '"… diez personas… asesinadas en su propia casa…"',
            '"… el padre… los miró fijamente antes…"',
            '"… los policías encontraron al bebé…"',
            '"… pero el bebé seguía respirando…"',
            '"… nunca encontraron al asesino. Era el padre."',
        ];
        showSubtitle(lines[Math.min(state.loop - 1, lines.length - 1)] || lines[0], 5500);
        return;
    }
    // Teléfono
    const dPhone = Math.hypot(p.x - phone.position.x, p.z - phone.position.z);
    if (dPhone < 1.3 && state.loop >= 4) {
        audio.playPhoneRing(1);
        showSubtitle('"… te estoy esperando, papá…"', 5000);
        return;
    }
    // Cuadros (recoge fragmentos)
    for (const pic of pictures) {
        const d = Math.hypot(p.x - pic.frame.position.x, p.z - pic.frame.position.z);
        if (d < 1.0) {
            state.photoFragments++;
            showHint(`Fragmento ${state.photoFragments}/5`, 2500);
            audio.playWhisper();
            // marcar el cuadro como vacío
            pic.canv.material.color.setHex(0x000000);
            return;
        }
    }
    showHint('Nada que hacer aquí.', 1500);
}

// ---------- Animación de Lisa ----------
function updateLisa(delta) {
    if (lisaMat.opacity < 0.05) return;
    // mirar al jugador
    const p = controls.getObject().position;
    lisa.lookAt(p.x, lisa.position.y, p.z);
    // si está en bucles 5/6 sigue al jugador a baja velocidad
    if (state.loop >= 5) {
        const dir = new THREE.Vector3(p.x - lisa.position.x, 0, p.z - lisa.position.z);
        const dist = dir.length();
        if (dist > 0.6) {
            dir.normalize();
            const sp = state.loop === 6 ? 1.6 : 0.55;
            lisa.position.addScaledVector(dir, sp * delta);
        } else if (state.loop === 6) {
            // toca al jugador → jumpscare
            audio.playSting();
            jumpscare();
        }
    }
    // flotar
    lisa.position.y = 1 + Math.sin(performance.now() * 0.002) * 0.05;
}

// ---------- Loop principal ----------
const clock = new THREE.Clock();
function tick() {
    const delta = Math.min(clock.getDelta(), 0.05);
    if (controls.isLocked && !state.paused) {
        tryMove(delta);
        checkLoopTriggers();
        updateLisa(delta);

        // efecto de ruido aleatorio según bucle
        if (state.loop >= 3 && Math.random() < 0.005 * state.loop) {
            dom.static.style.opacity = '0.15';
            setTimeout(() => { dom.static.style.opacity = '0'; }, 80);
        }
        // flicker aleatorio en bucles avanzados
        if (state.loop >= 2 && Math.random() < 0.003) flickerLights(0.5);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
}

// ---------- Resize ----------
addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Inicio ----------
controls.addEventListener('lock', () => { state.paused = false; });
controls.addEventListener('unlock', () => { state.paused = true; });

dom.startBtn.addEventListener('click', () => {
    audio.ensureRunning();
    drone = drone || audio.startDrone();
    dom.menu.classList.add('hidden');
    dom.game.classList.remove('hidden');
    controls.lock();
    startNewLoop();
});

dom.restartBtn.addEventListener('click', () => {
    state.loop = 0;
    state.photoFragments = 0;
    dom.ending.classList.add('hidden');
    dom.game.classList.remove('hidden');
    controls.lock();
    startNewLoop();
});

tick();
