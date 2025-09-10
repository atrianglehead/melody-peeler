const canvas = document.getElementById('pianoRoll');
const ctx = canvas.getContext('2d');

const pitchLayer = document.getElementById('pitchLayer');
const durationLayer = document.getElementById('durationLayer');
const loudnessLayer = document.getElementById('loudnessLayer');
const velocitySlider = document.getElementById('velocity');
const playBtn = document.getElementById('play');
const stopBtn = document.getElementById('stop');
const tempoSlider = document.getElementById('tempo');
const tempoLinesCheckbox = document.getElementById('tempoLines');
const tempoClickCheckbox = document.getElementById('tempoClick');
const discreteTimeCheckbox = document.getElementById('discreteTime');

const noteHeight = 10; // pixels per semitone
const maxPitch = 84;
const minPitch = 24;
const defaultPitch = 60;
const defaultVelocity = 100;
const leftMargin = 40;
const stepWidth = 100; // pixels per beat
const gridWidth = canvas.width - leftMargin;
let defaultWidth = stepWidth / 4; // quarter beat

const pitchCount = maxPitch - minPitch + 1;
canvas.height = pitchCount * noteHeight;

let tempo = parseInt(tempoSlider.value, 10);
let beatDuration = 60 / tempo; // seconds per beat
let timePerPixel = beatDuration / stepWidth;

function updateTempo() {
  tempo = parseInt(tempoSlider.value, 10);
  beatDuration = 60 / tempo;
  timePerPixel = beatDuration / stepWidth;
  draw();
}
tempoSlider.addEventListener('input', updateTempo);

function pitchToY(pitch) {
  return (maxPitch - pitch) * noteHeight;
}

function yToPitch(y) {
  return maxPitch - Math.floor(y / noteHeight);
}

function pitchName(pitch) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(pitch / 12) - 1;
  return names[pitch % 12] + octave;
}

let notes = [];
let currentNote = null;
let selectedNote = null;
let mode = null; // 'new', 'move', 'resize'
let dragOffsetX = 0;
let dragOffsetY = 0;

function snap(value) {
  const grid = stepWidth / 4;
  return Math.round(value / grid) * grid;
}

function snapWidth(value) {
  const grid = stepWidth / 4;
  return Math.max(grid, Math.round(value / grid) * grid);
}

canvas.addEventListener('mousedown', (e) => {
  const { x, y } = getMousePos(e);
  const gridX = x - leftMargin;
  if (gridX < 0) return;
  currentNote = getNoteAt(gridX, y);
  if (currentNote) {
    selectNote(currentNote);
    if (gridX > currentNote.x + currentNote.width - 5 && durationLayer.checked) {
      mode = 'resize';
    } else {
      mode = 'move';
      dragOffsetX = gridX - currentNote.x;
      dragOffsetY = y - pitchToY(currentNote.pitch);
    }
  } else {
    mode = 'new';
    const pitch = yToPitch(y);
    let startX = gridX;
    if (discreteTimeCheckbox.checked) startX = snap(startX);
    currentNote = {
      x: startX,
      width: discreteTimeCheckbox.checked ? defaultWidth : 1,
      pitch,
      velocity: defaultVelocity
    };
    notes.push(currentNote);
    selectNote(currentNote);
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!currentNote) return;
  const { x, y } = getMousePos(e);
  const gridX = x - leftMargin;
  if (mode === 'new' || mode === 'resize') {
    if (durationLayer.checked) {
      let newWidth = gridX - currentNote.x;
      if (discreteTimeCheckbox.checked) newWidth = snapWidth(newWidth);
      currentNote.width = Math.max(1, newWidth);
    }
  } else if (mode === 'move') {
    let newX = gridX - dragOffsetX;
    if (discreteTimeCheckbox.checked) newX = snap(newX);
    currentNote.x = newX;
    if (pitchLayer.checked) {
      currentNote.pitch = yToPitch(y - dragOffsetY);
    }
  }
  draw();
});

canvas.addEventListener('mouseup', () => {
  currentNote = null;
  mode = null;
});

canvas.addEventListener('dblclick', (e) => {
  const { x, y } = getMousePos(e);
  const gridX = x - leftMargin;
  const note = getNoteAt(gridX, y);
  if (note) {
    notes = notes.filter(n => n !== note);
    if (selectedNote === note) selectedNote = null;
    draw();
  }
});

velocitySlider.addEventListener('input', () => {
  if (selectedNote && loudnessLayer.checked) {
    selectedNote.velocity = parseInt(velocitySlider.value, 10);
    draw();
  }
});

pitchLayer.addEventListener('change', updateControls);
durationLayer.addEventListener('change', updateControls);
loudnessLayer.addEventListener('change', updateControls);
tempoLinesCheckbox.addEventListener('change', draw);
discreteTimeCheckbox.addEventListener('change', draw);

playBtn.addEventListener('click', togglePlay);
stopBtn.addEventListener('click', stopPlayback);

function updateControls() {
  velocitySlider.disabled = !loudnessLayer.checked || !selectedNote;
  draw();
}

function selectNote(note) {
  selectedNote = note;
  if (note && loudnessLayer.checked) {
    velocitySlider.value = note.velocity;
  }
  updateControls();
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function getNoteAt(x, y) {
  return notes.find(n => x >= n.x && x <= n.x + (durationLayer.checked ? n.width : defaultWidth) && y >= pitchToY(n.pitch) && y <= pitchToY(n.pitch) + noteHeight);
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  ctx.font = '10px sans-serif';

  for (let i = 0; i <= pitchCount; i++) {
    const y = i * noteHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
    if (i < pitchCount) {
      const pitch = maxPitch - i;
      ctx.fillStyle = '#000';
      ctx.fillText(pitchName(pitch), 2, y + 1);
    }
  }

  ctx.strokeStyle = '#ccc';
  if (tempoLinesCheckbox.checked) {
    for (let x = leftMargin; x <= canvas.width; x += stepWidth) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(leftMargin, 0);
  ctx.lineTo(leftMargin, canvas.height);
  ctx.stroke();
}

function draw() {
  drawGrid();
  for (const note of notes) {
    const y = pitchLayer.checked ? pitchToY(note.pitch) : pitchToY(defaultPitch);
    const width = durationLayer.checked ? note.width : defaultWidth;
    const velocity = loudnessLayer.checked ? note.velocity : defaultVelocity;
    const color = `hsl(200, 100%, ${100 - (velocity / 127) * 50}%)`;
    ctx.fillStyle = color;
    ctx.fillRect(note.x + leftMargin, y, width, noteHeight - 1);
    if (note === selectedNote) {
      ctx.strokeStyle = '#000';
      ctx.strokeRect(note.x + leftMargin, y, width, noteHeight - 1);
    }
  }

  if (isPlaying || playheadOffset > 0) {
    const x = isPlaying ? playheadX : leftMargin + playheadOffset / timePerPixel;
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

draw();

let audioCtx = null;
let isPlaying = false;
let playheadOffset = 0; // seconds
let playbackStart = 0;
let playheadX = leftMargin;
let endTime = 0;
let lastBeat = -1;

function togglePlay() {
  if (isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  if (notes.length === 0) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  isPlaying = true;
  playBtn.textContent = '⏸';
  playbackStart = audioCtx.currentTime - playheadOffset;
  notes.forEach(n => n.started = false);
  lastBeat = Math.floor(playheadOffset / beatDuration);
  endTime = notes.reduce((m, n) => Math.max(m, n.x + (durationLayer.checked ? n.width : defaultWidth)), 0) * timePerPixel;
  animate();
}

function pausePlayback() {
  isPlaying = false;
  playBtn.textContent = '▶';
  playheadOffset = audioCtx.currentTime - playbackStart;
  audioCtx.close();
  audioCtx = null;
  draw();
}

function stopPlayback() {
  if (isPlaying) {
    pausePlayback();
  }
  playheadOffset = 0;
  draw();
}

function animate() {
  if (!isPlaying) return;
  const elapsed = audioCtx.currentTime - playbackStart;
  const currentTime = playheadOffset + elapsed;
  playheadX = leftMargin + currentTime / timePerPixel;
  draw();

  for (const note of notes) {
    const start = note.x * timePerPixel;
    if (!note.started && start <= currentTime) {
      const duration = (durationLayer.checked ? note.width : defaultWidth) * timePerPixel;
      const remaining = start + duration - currentTime;
      if (remaining > 0) {
        const pitch = pitchLayer.checked ? note.pitch : defaultPitch;
        const velocity = (loudnessLayer.checked ? note.velocity : defaultVelocity) / 127;
        const freq = 440 * Math.pow(2, (pitch - 69) / 12);
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        gain.gain.value = velocity;
        osc.connect(gain).connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + remaining);
      }
      note.started = true;
    }
  }

  const beat = Math.floor(currentTime / beatDuration);
  if (beat > lastBeat) {
    if (tempoClickCheckbox.checked && audioCtx) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 1000;
      gain.gain.value = 0.5;
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    }
    lastBeat = beat;
  }

  if (currentTime >= endTime) {
    stopPlayback();
    return;
  }

  requestAnimationFrame(animate);
}

