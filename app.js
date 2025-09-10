const canvas = document.getElementById('pianoRoll');
const ctx = canvas.getContext('2d');

const pitchLayer = document.getElementById('pitchLayer');
const durationLayer = document.getElementById('durationLayer');
const loudnessLayer = document.getElementById('loudnessLayer');
const velocitySlider = document.getElementById('velocity');
const playBtn = document.getElementById('play');

const noteHeight = 10; // pixels per semitone
const maxPitch = 84;
const minPitch = 24;
const defaultPitch = 60;
const defaultWidth = 40; // px
const defaultVelocity = 100;
const timePerPixel = 0.01; // seconds per pixel

const pitchCount = maxPitch - minPitch + 1;
canvas.height = pitchCount * noteHeight;

let audioCtx = null;
let isPlaying = false;
let playbackTimer = null;

function pitchToY(pitch) {
  return (maxPitch - pitch) * noteHeight;
}
function yToPitch(y) {
  return maxPitch - Math.floor(y / noteHeight);
}

let notes = [];
let currentNote = null;
let selectedNote = null;
let mode = null; // 'new', 'move', 'resize'
let dragOffsetX = 0;
let dragOffsetY = 0;

canvas.addEventListener('mousedown', (e) => {
  const { x, y } = getMousePos(e);
  currentNote = getNoteAt(x, y);
  if (currentNote) {
    selectNote(currentNote);
    if (x > currentNote.x + currentNote.width - 5 && durationLayer.checked) {
      mode = 'resize';
    } else {
      mode = 'move';
      dragOffsetX = x - currentNote.x;
      dragOffsetY = y - pitchToY(currentNote.pitch);
    }
  } else {
    mode = 'new';
    const pitch = yToPitch(y);
    currentNote = {
      x,
      width: 1,
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
  if (mode === 'new' || mode === 'resize') {
    if (durationLayer.checked) {
      currentNote.width = Math.max(1, x - currentNote.x);
    }
  } else if (mode === 'move') {
    currentNote.x = x - dragOffsetX;
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
  const note = getNoteAt(x, y);
  if (note) {
    notes.splice(notes.indexOf(note), 1);
    if (selectedNote === note) {
      selectNote(null);
    } else {
      draw();
    }
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

playBtn.addEventListener('click', () => {
  if (isPlaying) {
    stopPlayback();
  } else {
    playNotes();
  }
});

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
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  for (let i = 0; i <= canvas.height; i += noteHeight) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  for (const note of notes) {
    const y = pitchLayer.checked ? pitchToY(note.pitch) : pitchToY(defaultPitch);
    const width = durationLayer.checked ? note.width : defaultWidth;
    const velocity = loudnessLayer.checked ? note.velocity : defaultVelocity;
    const color = `hsl(200, 100%, ${100 - (velocity / 127) * 50}%)`;
    ctx.fillStyle = color;
    ctx.fillRect(note.x, y, width, noteHeight - 1);
    if (note === selectedNote) {
      ctx.strokeStyle = '#000';
      ctx.strokeRect(note.x, y, width, noteHeight - 1);
    }
  }
}

draw();

function playNotes() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;
  let endTime = now;
  for (const note of notes) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const pitch = pitchLayer.checked ? note.pitch : defaultPitch;
    const duration = (durationLayer.checked ? note.width : defaultWidth) * timePerPixel;
    const velocity = (loudnessLayer.checked ? note.velocity : defaultVelocity) / 127;
    const freq = 440 * Math.pow(2, (pitch - 69) / 12);
    const startTime = now + note.x * timePerPixel;
    const stopTime = startTime + duration;
    endTime = Math.max(endTime, stopTime);
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.value = velocity;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(startTime);
    osc.stop(stopTime);
  }
  isPlaying = true;
  playBtn.textContent = '\u23F8';
  playbackTimer = setTimeout(() => {
    stopPlayback();
  }, (endTime - now) * 1000);
}

function stopPlayback() {
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  if (playbackTimer) {
    clearTimeout(playbackTimer);
    playbackTimer = null;
  }
  isPlaying = false;
  playBtn.textContent = '\u25B6';
}
