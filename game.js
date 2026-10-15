'use strict';

/**
 * El Sombrero Encantado - Impact Enterprises
 * Five exact independent probabilities; all plays win.
 * Prize is drawn only after selection. Hat choice is cosmetic.
 * No personal data is collected and no server is necessary.
 */
const PRIZES = Object.freeze([
  { id: 'tazones',    name: 'Set de tazones',          percentage: 5,  image: 'assets/tazones.webp' },
  { id: 'tazas',      name: 'Set de tazas de café',     percentage: 5,  image: 'assets/tazas.webp' },
  { id: 'espumador',  name: 'Espumador',               percentage: 20, image: 'assets/espumador.webp' },
  { id: 'cuchillo',   name: 'Cuchillo Santoku',        percentage: 35, image: 'assets/cuchillo.webp' },
  { id: 'utensilios', name: 'Set de utensilios',       percentage: 35, image: 'assets/utensilios.webp' }
]);
const STORAGE_KEY = 'impact-sombrero-historial-v1';
const $ = id => document.getElementById(id);
const intro = $('intro'), screen = $('gameScreen'), field = $('gameField'), tilesRoot = $('tiles');
const resultDialog = $('resultDialog'), historyDialog = $('historyDialog');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(resolve => setTimeout(resolve, reduceMotion ? 80 : ms));
const slotPositions = [
  { x: 30, y: 27 }, { x: 70, y: 27 },
  { x: 20, y: 76 }, { x: 50, y: 76 }, { x: 80, y: 76 }
];
let phase = 'intro';
let round = 0;
let tiles = [];
let soundEnabled = false;
let audioCtx = null;
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

function chime(frequency = 580, duration = 0.095, type = 'sine', vol = 0.035) {
  if (!soundEnabled) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx ??= new AC();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    oscillator.connect(gain).connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (_) { /* Audio is optional */ }
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
    button.style.setProperty('--aura', ['#9e42ee', '#b44bf4', '#da89fe', '#8d4bf4', '#ec9b4f'][index]);
    button.innerHTML = `
      <span class="pedestal" aria-hidden="true"></span>
      <span class="product-preview"><img src="${prize.image}" alt="" draggable="false"></span>
      <img class="hat-image" src="assets/sombrero.webp" alt="" draggable="false">
      <span class="star" aria-hidden="true">✦</span>`;
    button.addEventListener('click', () => selectHat(button));
    tilesRoot.appendChild(button);
    return { element: button, slot: index, previewImg: button.querySelector('.product-preview img') };
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
  round += 1;
  const myRound = round;
  if (resultDialog.open) resultDialog.close();
  if (historyDialog.open) historyDialog.close();
  intro.hidden = true;
  screen.hidden = false;
  renderTiles();
  phase = 'preview';
  field.classList.remove('can-pick');
  setStatus('Observa los cinco regalos posibles…');
  $('lead').textContent = 'Cinco sombreros · Cinco sorpresas · ¡Todos ganan!';
  $('hint').textContent = 'Los regalos que ves son las opciones disponibles. Cada elección activa un sorteo con probabilidades definidas.';
  screen.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
  chime(680, .14);
  await sleep(1700);
  if (myRound !== round) return;

  phase = 'cover';
  setStatus('¡Los sombreros ocultan las sorpresas!');
  tiles.forEach(tile => tile.element.classList.add('covering'));
  chime(390, .18);
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
    chime(380 + step * 27, .07, 'triangle', .016);
    await sleep(reduceMotion ? 90 : (step < 6 ? 365 : 430));
  }
  if (myRound !== round) return;
  tiles.forEach(tile => tile.element.classList.remove('is-shuffling'));
  phase = 'choose';
  setStatus('✨ ¡Ahora elige tu sombrero encantado! ✨');
  $('lead').textContent = 'Toca uno de los cinco sombreros';
  tiles.forEach(tile => { tile.element.disabled = false; tile.element.classList.add('selectable'); });
  $('hint').textContent = 'Toca cualquier sombrero. Todos activan el mismo sorteo; la sorpresa se asigna en el momento de elegir.';
  chime(880, .22, 'sine', .05);
}

async function selectHat(chosenElement) {
  if (phase !== 'choose') return;
  phase = 'reveal';
  const myRound = round;
  tiles.forEach(tile => { tile.element.disabled = true; tile.element.classList.remove('selectable'); });
  const prize = drawPrize();
  const winningTile = tiles.find(tile => tile.element === chosenElement);
  winningTile.previewImg.src = prize.image;
  tiles.forEach(tile => tile.element.classList.toggle('faded', tile !== winningTile));
  chosenElement.classList.add('selected');
  setStatus('¡Preparando tu sorpresa encantada!');
  chime(550, .14);
  await sleep(300);
  if (myRound !== round) return;
  chosenElement.classList.add('revealed');
  setStatus('¡Felicidades! ¡Encontraste un regalo!');
  chime(780, .2);setTimeout(() => chime(1040, .33), 145);
  appendHistory(prize);
  await sleep(920);
  if (myRound !== round) return;
  $('winImage').src = prize.image;
  $('winImage').alt = prize.name;
  $('winName').textContent = prize.name;
  resultDialog.showModal();
  phase = 'finished';
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
  if (resultDialog.open) resultDialog.close();
  if (historyDialog.open) historyDialog.close();
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
$('soundButton').addEventListener('click', async () => {
  soundEnabled = !soundEnabled;
  $('soundButton').setAttribute('aria-pressed', String(soundEnabled));
  $('soundButton').querySelector('span').textContent = soundEnabled ? 'Sonido: sí' : 'Sonido: no';
  if (soundEnabled) {
    try { if (audioCtx?.state === 'suspended') await audioCtx.resume(); } catch (_) {}
    chime(720, .15);
  }
});
$('fullscreenButton').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) { await document.exitFullscreen(); }
    else if (document.documentElement.requestFullscreen) { await document.documentElement.requestFullscreen(); }
    else { toast('En este navegador, usa “Añadir a pantalla de inicio” para verlo a pantalla completa.'); }
  } catch (_) { toast('Tu navegador no permitió activar pantalla completa.'); }
});
resultDialog.addEventListener('cancel', event => { event.preventDefault(); });
historyDialog.addEventListener('click', event => { if (event.target === historyDialog) historyDialog.close(); });

// Also available to simple automated smoke tests and debug consoles.
window.sombreroGame = Object.freeze({ getPrizes: () => PRIZES.map(p => ({...p})), drawPrize });
