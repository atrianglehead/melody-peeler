const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');
const playBtn = document.getElementById('play');
const velocitySlider = document.getElementById('velocity');
const velocityToggle = document.getElementById('toggleVelocity');

const PITCHES = 12;
const CELL_WIDTH = 40;
const CELL_HEIGHT = canvas.height / PITCHES; // 30 for 12 pitches
const DEFAULT_VELOCITY = 0.8;

let notes = [];
let isDrawing = false;
let dragType = null;
let selectedNote = null;
let offsetX = 0;
let offsetY = 0;

function drawGrid(playheadX = null) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#eee';
  for (let i = 0; i <= PITCHES; i++) {
    const y = i * CELL_HEIGHT;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  for (let x = 0; x <= canvas.width; x += CELL_WIDTH) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (const note of notes) {
    const velocity = velocityToggle.checked ? note.velocity : DEFAULT_VELOCITY;
    ctx.fillStyle = `rgba(${Math.floor(255 - velocity * 155)}, ${Math.floor(100 + velocity * 100)}, 0, 1)`;
    const x = note.start * CELL_WIDTH;
    const y = (PITCHES - 1 - note.pitch) * CELL_HEIGHT;
    const w = note.duration * CELL_WIDTH;
    ctx.fillRect(x, y, w, CELL_HEIGHT);
    if (note === selectedNote) {
      ctx.strokeStyle = '#000';
      ctx.strokeRect(x, y, w, CELL_HEIGHT);
    }
  }

  if (playheadX !== null) {
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, canvas.height);
    ctx.stroke();
  }
}

drawGrid();

function yToPitch(y) {
  return Math.max(0, Math.min(PITCHES - 1, Math.floor(y / CELL_HEIGHT)));
}

function xToBeat(x) {
  return x / CELL_WIDTH;
}

function getNoteAt(x, y) {
  for (const note of notes) {
    const nx = note.start * CELL_WIDTH;
    const ny = (PITCHES - 1 - note.pitch) * CELL_HEIGHT;
    const nw = note.duration * CELL_WIDTH;
    if (x >= nx && x <= nx + nw && y >= ny && y <= ny + CELL_HEIGHT) {
      return note;
    }
  }
  return null;
}

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  selectedNote = getNoteAt(x, y);
  if (selectedNote) {
    const noteX = selectedNote.start * CELL_WIDTH;
    const noteW = selectedNote.duration * CELL_WIDTH;
    if (x > noteX + noteW - 5) {
      dragType = 'resize';
    } else {
      dragType = 'move';
      offsetX = x - noteX;
      offsetY = y - (PITCHES - 1 - selectedNote.pitch) * CELL_HEIGHT;
    }
  } else {
    dragType = 'new';
    const pitch = yToPitch(y);
    const start = xToBeat(x);
    selectedNote = { start, pitch, duration: 0.1, velocity: parseFloat(velocitySlider.value) };
    notes.push(selectedNote);
  }
  velocitySlider.value = selectedNote.velocity;
  isDrawing = true;
  drawGrid();
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (dragType === 'new' || dragType === 'resize') {
    selectedNote.duration = Math.max(0.1, xToBeat(x) - selectedNote.start);
  } else if (dragType === 'move') {
    selectedNote.start = Math.max(0, xToBeat(x - offsetX));
    selectedNote.pitch = yToPitch(y - offsetY);
  }
  drawGrid();
});

canvas.addEventListener('mouseup', () => {
  isDrawing = false;
  dragType = null;
});

canvas.addEventListener('dblclick', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const note = getNoteAt(x, y);
  if (note) {
    notes.splice(notes.indexOf(note), 1);
    if (selectedNote === note) selectedNote = null;
    drawGrid();
  }
});

velocitySlider.addEventListener('input', () => {
  if (selectedNote) {
    selectedNote.velocity = parseFloat(velocitySlider.value);
    drawGrid();
  }
});

velocityToggle.addEventListener('change', () => drawGrid());

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

let audioCtx = null;
let isPlaying = false;
let secPerBeat = 0.5; // default 120bpm
let startTime = 0;
let playheadRAF = null;

playBtn.addEventListener('click', () => {
  if (isPlaying) {
    stop();
  } else {
    play();
  }
});

function play() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  isPlaying = true;
  playBtn.textContent = 'Pause';
  startTime = audioCtx.currentTime;
  const totalBeats = notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0);
  for (const note of notes) {
    const when = startTime + note.start * secPerBeat;
    const dur = note.duration * secPerBeat;
    const velocity = velocityToggle.checked ? note.velocity : DEFAULT_VELOCITY;
    const freq = midiToFreq(60 + note.pitch);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = velocity;
    osc.frequency.value = freq;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(when);
    osc.stop(when + dur);
  }
  function step() {
    const elapsed = audioCtx.currentTime - startTime;
    const playheadX = (elapsed / secPerBeat) * CELL_WIDTH;
    drawGrid(playheadX);
    if (elapsed / secPerBeat >= totalBeats) {
      stop();
    } else {
      playheadRAF = requestAnimationFrame(step);
    }
  }
  step();
}

function stop() {
  isPlaying = false;
  playBtn.textContent = 'Play';
  cancelAnimationFrame(playheadRAF);
  drawGrid();
}
