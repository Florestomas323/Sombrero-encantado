'use strict';

/**
 * El Sombrero Encantado - Impact Enterprises (edición de otoño)
 * Five prizes, 20 % each; all plays win.
 * Prize is drawn only after selection. Hat choice is cosmetic.
 * No personal data is collected and no server is necessary.
 */
const PRIZES = Object.freeze([
  { id: 'pelador',    name: 'Pelador',    percentage: 20,  image: 'assets/pelador.jpg' },
  { id: 'machacador', name: 'Machacador', percentage: 20,  image: 'assets/machacador.jpg' },
  { id: 'paleta',     name: 'Paleta',     percentage: 20, image: 'assets/paleta.jpg' },
  { id: 'destapador', name: 'Destapador', percentage: 20, image: 'assets/destapador.jpg' },
  { id: 'utensilios', name: 'Utensilios', percentage: 20, image: 'assets/utensilios.jpg' }
]);
const STORAGE_KEY = 'impact-sombrero-historial-v1';
const $ = id => document.getElementById(id);
const intro = $('intro'), screen = $('gameScreen'), field = $('gameField'), tilesRoot = $('tiles');
const historyDialog = $('historyDialog');
const revealCard = $('revealCard'), leafLayer = $('leafLayer'), statusArea = document.querySelector('.status-area');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const reduceMotion = motionQuery.matches;
const prefersReducedMotion = () => motionQuery.matches;
const sleep = ms => new Promise(resolve => setTimeout(resolve, reduceMotion ? 80 : ms));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/* Selection reveal timeline (ms from the tap). Whole sequence: ~1.65 s. */
const REVEAL = Object.freeze({
  tilt: 200,          // 1. immediate small tilt; the other hats dim
  glintAt: 170,       // 2. warm glint runs across the copper brooch
  glint: 420,
  leavesAt: 260,      //    three leaves leave the brooch, circle the hat and drift away
  leaf: 1000,
  leafStagger: 70,
  liftAt: 520,        // 3. hat lifts and tilts back; prize appears underneath
  lift: 520,
  prizeAt: 600,
  prize: 400,
  cardAt: 1360,       // 4. prize stays alone for a moment, then name + button
  card: 280
});
// Copper brooch position inside assets/sombrero.webp (percent of the image box).
const BROOCH = Object.freeze({ x: 68.3, y: 57.2 });
const LEAF_COLORS = [['#f2a541', '#b8561f'], ['#d9672c', '#8f2f1c'], ['#e8b04f', '#a4581f']];
const LEAF_PATH = 'M50 3 57 22 69 15 66 38 85 28 80 45 97 50 79 60 85 73 62 68 59 84 52 76 52 97 48 97 48 76 41 84 38 68 15 73 21 60 3 50 20 45 15 28 34 38 31 15 43 22Z';
const slotPositions = [
  { x: 30, y: 27 }, { x: 70, y: 27 },
  { x: 20, y: 76 }, { x: 50, y: 76 }, { x: 80, y: 76 }
];
let phase = 'intro';
let round = 0;
let tiles = [];
// Music and effects are ON by default; browser audio starts only after a real tap.
let soundEnabled = true;
let audioCtx = null;
let soundBus = null;
const ambientAudio = new Audio('assets/ambiente.mp3');
ambientAudio.preload = 'auto';
ambientAudio.loop = true;
ambientAudio.volume = 0.50;
let noiseBuffer = null;
let toastTimer = null;

function secureRandom() {
  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

// Call this exactly once after a hat is chosen. Not based on hat identity or position.
function drawPrize() {
  const r = secureRandom() * 100;
  let cumulative = 0;
  for (const prize of PRIZES) {
    cumulative += prize.percentage;
    if (r < cumulative) return prize;
  }
  return PRIZES[PRIZES.length - 1];
}

function shuffleArray(arr) {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(secureRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Begin/resume audio inside a direct button or touch interaction (Safari/iPad compatible).
function unlockSound() {
  if (!soundEnabled) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !audioCtx) {
      audioCtx = new AC();
      soundBus = audioCtx.createGain();
      soundBus.gain.value = 0.8;
      soundBus.connect(audioCtx.destination);
    }
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    // A real click is required for background music on iPhone and iPad.
    if (ambientAudio.paused) ambientAudio.play().catch(() => {});
  } catch (_) { /* The game remains playable without audio. */ }
}
function chime(frequency = 600, duration = 0.22, type = 'sine', vol = 0.11, delay = 0) {
  if (!soundEnabled || !audioCtx || !soundBus) return;
  try {
    const now = audioCtx.currentTime + delay;
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.013);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(soundBus);
    oscillator.start(now);
    oscillator.stop(now + duration + .025);
  } catch (_) { /* Audio is optional */ }
}
function magicWhoosh(duration = 0.34, frequency = 380) {
  if (!soundEnabled || !audioCtx || !soundBus) return;
  try {
    const now = audioCtx.currentTime;
    if (!noiseBuffer) {
      noiseBuffer = audioCtx.createBuffer(1, Math.ceil(audioCtx.sampleRate * 0.8), audioCtx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass'; filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(frequency, now);
    filter.frequency.exponentialRampToValueAtTime(frequency * 3, now + duration);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(.19, now + duration * .35);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    noise.connect(filter).connect(gain).connect(soundBus);
    noise.start(now); noise.stop(now + duration + .015);
  } catch (_) { /* Audio is optional */ }
}
function startMelody() {
  chime(523.25, .38, 'sine', .12);
  chime(659.25, .38, 'sine', .12, .14);
  chime(783.99, .55, 'sine', .14, .30);
}
function winningMelody() {
  magicWhoosh(.65, 450);
  [523.25,659.25,783.99,1046.5].forEach((freq, index) => {
    chime(freq, 1.1, 'sine', .18, .12 + index*.14);
    chime(freq*2, .45, 'triangle', .025, .13 + index*.14);
  });
}
function setStatus(value) { $('status').textContent = value; }
function toast(message) {
  const element = $('toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 2500);
}

function renderTiles() {
  tilesRoot.replaceChildren();
  tiles = PRIZES.map((prize, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hat-tile';
    button.disabled = true;
    button.setAttribute('aria-label', `Sombrero encantado ${index + 1}`);
    button.style.setProperty('--angle', [-3, 4, -5, 2, 5][index] + 'deg');
    button.style.setProperty('--aura', ['#e08a3a', '#f0a24a', '#d66f2f', '#f3b860', '#c9622c'][index]);
    button.innerHTML = `
      <span class="pedestal" aria-hidden="true"></span>
      <span class="prize-glow" aria-hidden="true"></span>
      <span class="product-preview"><img src="${prize.image}" alt="" draggable="false"></span>
      <span class="hat" aria-hidden="true">
        <img class="hat-image" src="assets/sombrero.webp" alt="" draggable="false">
        <span class="brooch-glint"><span class="glint-sweep"></span></span>
      </span>
      <span class="star" aria-hidden="true">✦</span>`;
    button.addEventListener('click', () => selectHat(button));
    tilesRoot.appendChild(button);
    return {
      element: button,
      slot: index,
      angle: [-3, 4, -5, 2, 5][index],
      hat: button.querySelector('.hat'),
      glint: button.querySelector('.brooch-glint'),
      sweep: button.querySelector('.glint-sweep'),
      glow: button.querySelector('.prize-glow'),
      preview: button.querySelector('.product-preview'),
      previewImg: button.querySelector('.product-preview img')
    };
  });
  positionTiles();
}
function positionTiles() {
  for (const tile of tiles) {
    const slot = slotPositions[tile.slot];
    tile.element.style.setProperty('--x', `${slot.x}%`);
    tile.element.style.setProperty('--y', `${slot.y}%`);
  }
}

async function startGame() {
  unlockSound();
  round += 1;
  const myRound = round;
  if (historyDialog.open) historyDialog.close();
  resetReveal();
  intro.hidden = true;
  screen.hidden = false;
  renderTiles();
  phase = 'preview';
  field.classList.remove('can-pick');
  setStatus('Observa los cinco regalos posibles…');
  $('lead').textContent = 'Cinco sombreros · Cinco sorpresas · ¡Todos ganan!';
  $('hint').textContent = 'Observa los regalos que la magia podría darte…';
  screen.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
  startMelody();
  await sleep(1700);
  if (myRound !== round) return;

  phase = 'cover';
  setStatus('¡Los sombreros ocultan las sorpresas!');
  tiles.forEach(tile => tile.element.classList.add('covering'));
  magicWhoosh(.55, 280);
  chime(392, .34, 'triangle', .08);
  await sleep(650);
  if (myRound !== round) return;
  tiles.forEach(tile => { tile.element.classList.remove('covering'); tile.element.classList.add('covered'); });

  phase = 'shuffle';
  setStatus('¡La magia está mezclando los sombreros!');
  await sleep(130);
  for (let step = 0; step < (reduceMotion ? 3 : 9); step++) {
    if (myRound !== round) return;
    const oldSlots = tiles.map(tile => tile.slot);
    // Move every hat to a randomly permuted destination; retry if unchanged.
    let nextSlots;
    do { nextSlots = shuffleArray(oldSlots); }
    while (nextSlots.every((v, i) => v === oldSlots[i]));
    tiles.forEach((tile, index) => { tile.slot = nextSlots[index]; tile.element.classList.add('is-shuffling'); });
    positionTiles();
    if (step % 2 === 0) magicWhoosh(.35, 350 + step * 45);
    chime(420 + step * 44, .15, 'triangle', .07);
    await sleep(reduceMotion ? 90 : (step < 6 ? 365 : 430));
  }
  if (myRound !== round) return;
  tiles.forEach(tile => tile.element.classList.remove('is-shuffling'));
  phase = 'choose';
  setStatus('✨ ¡Ahora elige tu sombrero encantado! ✨');
  $('lead').textContent = 'Toca uno de los cinco sombreros';
  tiles.forEach(tile => { tile.element.disabled = false; tile.element.classList.add('selectable'); });
  $('hint').textContent = 'Toca el sombrero que más te guste para descubrir tu sorpresa. ¡Todos ganan!';
  chime(880, .22, 'sine', .05);
}

function resetReveal() {
  revealCard.hidden = true;
  revealCard.classList.remove('is-visible', 'at-top', 'at-bottom');
  revealCard.getAnimations().forEach(animation => animation.cancel());
  field.classList.remove('is-revealing');
  statusArea.classList.remove('is-covered');
  leafLayer.replaceChildren();
}

// Untransformed geometry (in viewport px) of the chosen tile, its hat and its prize card.
function revealGeometry(tile) {
  const tileRect = tile.element.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  const hatW = tile.hat.offsetWidth, hatH = tile.hat.offsetHeight;
  // Covered hat sits at translate(-50%, -47%) from its layout box.
  const hatCx = tileRect.left + tile.hat.offsetLeft;
  const hatCy = tileRect.top + tile.hat.offsetTop + hatH * 0.03;
  const prizeTop = tileRect.top + tile.preview.offsetTop;
  const prizeBottom = prizeTop + tile.preview.offsetHeight;
  return { tileRect, fieldRect, hatW, hatH, hatCx, hatCy, prizeTop, prizeBottom };
}

// Lift + scale that keep the whole hat visible above the prize, even for the top row on a phone.
function liftPlan(geo) {
  const allowanceAbove = Math.max(0, Math.min(64, geo.fieldRect.top - 10));
  const topLimit = geo.fieldRect.top - allowanceAbove + 4;
  const bottomLimit = geo.prizeTop - 6;
  const tiltSquash = 0.95;               // rotateX(18deg) visually shortens the hat a little
  const band = Math.max(20, bottomLimit - topLimit);
  const scale = Math.max(0.6, Math.min(0.92, band / (geo.hatH * tiltSquash * 1.06)));
  const visibleH = geo.hatH * scale * tiltSquash * 1.06;   // small margin for the backward rotation
  const targetCy = bottomLimit - visibleH / 2;
  const lift = Math.max(0, geo.hatCy - targetCy);
  // Keep the hat horizontally inside the board on the far-left and far-right slots.
  const halfW = geo.hatW * scale / 2 + 6;
  const minCx = geo.fieldRect.left + halfW, maxCx = geo.fieldRect.right - halfW;
  const shiftX = Math.min(Math.max(geo.hatCx, minCx), maxCx) - geo.hatCx;
  return { lift, scale, shiftX, raisesAboveField: geo.hatCy - lift - visibleH / 2 < geo.fieldRect.top + 2 };
}

function makeLeaf(index) {
  const [light, dark] = LEAF_COLORS[index % LEAF_COLORS.length];
  const leaf = document.createElement('span');
  leaf.className = 'leaf';
  leaf.innerHTML = `<svg viewBox="0 0 100 100" focusable="false">
    <defs><linearGradient id="leafGrad${index}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
    <path d="${LEAF_PATH}" fill="url(#leafGrad${index})"/>
    <path d="M50 92V30M50 62 30 46M50 62 70 46M50 46 38 30M50 46 62 30" stroke="#5e2410" stroke-opacity=".45" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  </svg>`;
  return leaf;
}

// Three small leaves spring from the brooch, spiral around the hat, then drift off to the sides.
function launchLeaves(tile) {
  const brooch = tile.glint.getBoundingClientRect();
  const hatBox = tile.hat.getBoundingClientRect();
  const bx = brooch.left + brooch.width / 2, by = brooch.top + brooch.height / 2;
  const cx = hatBox.left + hatBox.width / 2, cy = hatBox.top + hatBox.height / 2;
  const rx = hatBox.width * 0.6, ry = hatBox.height * 0.55;
  const size = Math.round(Math.max(22, Math.min(36, hatBox.width * 0.18)));
  const startAngle = Math.atan2((by - cy) / ry, (bx - cx) / rx);
  const plans = [
    { dir: -1, sweep: 1.25 * Math.PI, side: 1, rise: -0.35, spin: 420 },
    { dir: 1, sweep: 1.05 * Math.PI, side: -1, rise: -0.1, spin: -380 },
    { dir: -1, sweep: 1.6 * Math.PI, side: 1, rise: 0.25, spin: 520 }
  ];
  plans.forEach((plan, index) => {
    const leaf = makeLeaf(index);
    leaf.style.width = leaf.style.height = `${size}px`;
    leafLayer.appendChild(leaf);
    const frames = [];
    const orbitSteps = 6;
    frames.push({ offset: 0, opacity: 0, transform: `translate(${bx}px, ${by}px) rotate(0deg) scale(.25)` });
    for (let step = 1; step <= orbitSteps; step++) {
      const t = step / orbitSteps;
      const angle = startAngle + plan.dir * plan.sweep * t;
      const radius = 0.3 + 0.7 * t;
      const x = cx + Math.cos(angle) * rx * radius;
      const y = cy + Math.sin(angle) * ry * radius;
      frames.push({
        offset: 0.68 * t,
        opacity: 1,
        transform: `translate(${x}px, ${y}px) rotate(${plan.spin * 0.6 * t}deg) scale(${0.55 + 0.45 * Math.min(1, t * 2)})`
      });
    }
    const exitX = cx + plan.side * (rx + hatBox.width * 0.75);
    const exitY = cy + plan.rise * hatBox.height;
    frames.push({ offset: 1, opacity: 0, transform: `translate(${exitX}px, ${exitY}px) rotate(${plan.spin}deg) scale(.8)` });
    const animation = leaf.animate(frames, {
      duration: REVEAL.leaf,
      delay: index * REVEAL.leafStagger,
      easing: 'cubic-bezier(.3,.1,.4,1)',
      fill: 'both'
    });
    animation.finished.then(() => leaf.remove(), () => leaf.remove());
  });
}

function hatTransform(tile, { y = '-47%', x = '0px', rotate = 0, tiltBack = 0, scale = 1 } = {}) {
  return `translate(calc(-50% + ${x}), calc(${y})) perspective(700px) rotateX(${tiltBack}deg) rotate(${tile.angle + rotate}deg) scale(${scale})`;
}

function placeRevealCard(tile, geo) {
  // Put the name + button over the half of the board the chosen prize is NOT in.
  const prizeMid = (geo.prizeTop + geo.prizeBottom) / 2;
  const chosenInTopHalf = prizeMid < geo.fieldRect.top + geo.fieldRect.height / 2;
  revealCard.classList.toggle('at-bottom', chosenInTopHalf);
  revealCard.classList.toggle('at-top', !chosenInTopHalf);
}

async function showRevealCard(prize, myRound) {
  if (myRound !== round) return;
  $('revealName').textContent = prize.name;
  revealCard.hidden = false;
  revealCard.classList.add('is-visible');
  if (!prefersReducedMotion()) {
    revealCard.animate(
      [{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }],
      { duration: REVEAL.card, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }
    );
  }
  setStatus(`¡Felicidades! Tu regalo es: ${prize.name}`);
  $('lead').textContent = '¡El sombrero encantado ha hablado!';
  $('hint').textContent = '¡Gracias por jugar con Impact Enterprises!';
  $('againButton').focus({ preventScroll: true });
  phase = 'finished';
}

async function selectHat(chosenElement) {
  // First tap locks everything: a double tap can never produce a second prize.
  if (phase !== 'choose') return;
  phase = 'reveal';
  const myRound = round;
  const winningTile = tiles.find(tile => tile.element === chosenElement);
  if (!winningTile) return;
  const hoverPose = getComputedStyle(winningTile.hat).transform;
  tiles.forEach(tile => {
    tile.element.disabled = true;
    tile.element.classList.remove('selectable');
    tile.element.classList.toggle('faded', tile !== winningTile);
  });
  chosenElement.classList.add('selected');

  // One draw per participation, after the choice; image, name and history use this same prize.
  const prize = drawPrize();
  winningTile.previewImg.src = prize.image;
  winningTile.previewImg.alt = prize.name;
  appendHistory(prize);
  setStatus('¡El sombrero está despertando!');
  magicWhoosh(.4, 380);
  chime(550, .24);

  if (prefersReducedMotion()) {
    // Reduced motion: a short cross-fade only, no tilt, lift or leaves.
    const fade = { duration: 260, easing: 'ease', fill: 'both' };
    winningTile.hat.animate([{ opacity: 1 }, { opacity: 0 }], fade);
    winningTile.preview.animate([
      { opacity: 0, transform: 'translate(-50%,0) scale(1)' },
      { opacity: 1, transform: 'translate(-50%,0) scale(1)' }
    ], fade);
    winningTile.glow.animate([{ opacity: 0 }, { opacity: .7 }], fade);
    winningMelody();
    placeRevealCard(winningTile, revealGeometry(winningTile));
    await wait(420);
    return showRevealCard(prize, myRound);
  }

  // 1. Immediate small tilt.
  const geo = revealGeometry(winningTile);
  const plan = liftPlan(geo);
  const tiltEnd = hatTransform(winningTile, { y: '-50%', rotate: -5, scale: 1.03 });
  winningTile.hat.animate([
    { transform: hoverPose === 'none' ? hatTransform(winningTile) : hoverPose, opacity: 1 },
    { transform: hatTransform(winningTile, { y: '-51%', rotate: -9, scale: 1.05 }), opacity: 1, offset: 0.55 },
    { transform: tiltEnd, opacity: 1 }
  ], { duration: REVEAL.tilt, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });

  // 2. Warm glint across the copper brooch, then the leaves.
  winningTile.glint.animate([
    { opacity: 0, transform: 'translate(-50%,-50%) scale(.4)' },
    { opacity: .9, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.4 },
    { opacity: 0, transform: 'translate(-50%,-50%) scale(.9)' }
  ], { duration: REVEAL.glint, delay: REVEAL.glintAt, easing: 'ease-out', fill: 'both' });
  winningTile.sweep.animate([
    { transform: 'translateX(-130%)' }, { transform: 'translateX(130%)' }
  ], { duration: REVEAL.glint * 0.85, delay: REVEAL.glintAt, easing: 'ease-in-out', fill: 'both' });
  chime(988, .3, 'sine', .07, REVEAL.glintAt / 1000);

  await wait(REVEAL.leavesAt);
  if (myRound !== round) return;
  launchLeaves(winningTile);
  chime(1318.5, .26, 'triangle', .04, .05);

  // 3. Hat lifts and tilts back; the prize was underneath all along.
  await wait(REVEAL.liftAt - REVEAL.leavesAt);
  if (myRound !== round) return;
  field.classList.add('is-revealing');
  statusArea.classList.toggle('is-covered', plan.raisesAboveField);
  placeRevealCard(winningTile, geo);
  winningTile.hat.animate([
    { transform: tiltEnd },
    { transform: hatTransform(winningTile, {
      y: `-47% - ${plan.lift.toFixed(1)}px`, x: `${plan.shiftX.toFixed(1)}px`,
      rotate: -8, tiltBack: 18, scale: plan.scale
    }) }
  ], { duration: REVEAL.lift, easing: 'cubic-bezier(.22,.9,.28,1.04)', fill: 'forwards' });
  winningTile.preview.animate([
    { opacity: 0, transform: 'translate(-50%, 7%) scale(.93)' },
    { opacity: 1, transform: 'translate(-50%, 0) scale(1)' }
  ], { duration: REVEAL.prize, delay: REVEAL.prizeAt - REVEAL.liftAt, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
  winningTile.glow.animate([
    { opacity: 0, transform: 'translateX(-50%) scale(.6)' },
    { opacity: 1, transform: 'translateX(-50%) scale(1.08)', offset: 0.55 },
    { opacity: .75, transform: 'translateX(-50%) scale(1)' }
  ], { duration: REVEAL.prize + 260, delay: REVEAL.prizeAt - REVEAL.liftAt, easing: 'ease-out', fill: 'both' });
  chosenElement.classList.add('revealed');
  winningMelody();
  setStatus('¡Mira lo que escondía tu sombrero!');

  // 4. Let the prize be seen for a moment, then its name and the button.
  await wait(REVEAL.cardAt - REVEAL.liftAt);
  return showRevealCard(prize, myRound);
}

function readHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(history) ? history : [];
  } catch (_) { return []; }
}
function appendHistory(prize) {
  const entries = readHistory();
  entries.unshift({ id: prize.id, name: prize.name, at: new Date().toISOString() });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 500))); }
  catch (_) { /* Private browsing or disabled storage is allowed */ }
}
function openHistory() {
  const entries = readHistory();
  const wrapper = $('historyList');
  wrapper.replaceChildren();
  if (!entries.length) {
    wrapper.innerHTML = '<p class="empty-history">Todavía no se han entregado premios desde este navegador.</p>';
  } else {
    const summary = document.createElement('p');
    summary.textContent = `${entries.length} premio${entries.length === 1 ? '' : 's'} registrado${entries.length === 1 ? '' : 's'}`;
    summary.className = 'winner-kicker';
    wrapper.appendChild(summary);
    const counts = PRIZES.map(prize => ({ name: prize.name, count: entries.filter(e => e.id === prize.id).length }));
    for (const { name, count } of counts) {
      const row = document.createElement('div');
      row.className = 'history-row';
      const label = document.createElement('span'); label.textContent = name;
      const quantity = document.createElement('strong');quantity.textContent = String(count);
      row.append(label,quantity);wrapper.appendChild(row);
    }
  }
  historyDialog.showModal();
}

function downloadHistory() {
  const rows = [['Fecha (ISO)', 'Premio'], ...readHistory().map(item => [item.at, item.name])];
  const csv = '\uFEFF' + rows.map(row => row.map(cell => `"${String(cell).replaceAll('"','""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'historial-sombrero-encantado.csv';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function returnHome() {
  round += 1;
  phase = 'intro';
  if (historyDialog.open) historyDialog.close();
  resetReveal();
  screen.hidden = true; intro.hidden = false;
  window.scrollTo({top:0, behavior:'instant'});
  $('startButton').focus({preventScroll:true});
}

$('startButton').addEventListener('click', startGame);
$('againButton').addEventListener('click', startGame);
$('homeButton').addEventListener('click', returnHome);
$('historyButton').addEventListener('click', openHistory);
$('closeHistory').addEventListener('click', () => historyDialog.close());
$('downloadHistory').addEventListener('click', downloadHistory);
$('clearHistory').addEventListener('click', () => {
  if (!confirm('¿Seguro que quieres borrar todo el historial de premios de este navegador?')) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* Ignore */ }
  historyDialog.close();toast('Se borró el historial local.');
});
$('soundButton').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  $('soundButton').setAttribute('aria-pressed', String(soundEnabled));
  $('soundButton').querySelector('span').textContent = soundEnabled ? 'Sonido: sí' : 'Sonido: no';
  $('soundButton').firstChild.textContent = soundEnabled ? '♫ ' : '♪̸ ';
  $('soundButton').title = soundEnabled ? 'Silenciar el juego' : 'Activar sonido';
  if (soundEnabled) {
    unlockSound();
    startMelody();
    toast('Sonido activado');
  } else {
    ambientAudio.pause();
    if (audioCtx && soundBus) soundBus.gain.setTargetAtTime(0, audioCtx.currentTime, .02);
    toast('Sonido desactivado');
  }
  if (soundEnabled && audioCtx && soundBus) soundBus.gain.setTargetAtTime(.8, audioCtx.currentTime, .02);
});
$('fullscreenButton').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) { await document.exitFullscreen(); }
    else if (document.documentElement.requestFullscreen) { await document.documentElement.requestFullscreen(); }
    else { toast('En este navegador, usa “Añadir a pantalla de inicio” para verlo a pantalla completa.'); }
  } catch (_) { toast('Tu navegador no permitió activar pantalla completa.'); }
});
historyDialog.addEventListener('click', event => { if (event.target === historyDialog) historyDialog.close(); });

// Also available to simple automated smoke tests and debug consoles.
window.sombreroGame = Object.freeze({ getPrizes: () => PRIZES.map(p => ({...p})), drawPrize });
