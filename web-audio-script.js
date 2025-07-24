let audioContext, sourceNode, audioBuffer;
let playbackRate = 1.0;
let isPlaying = false;
let pauseOffset = 0;
let intervalId = null;

// DOM elements
const fileInput        = document.getElementById("fileInput");
const playPauseBtn     = document.getElementById("playPauseBtn");
const speedDisplay     = document.getElementById("speedDisplay");
const setSpeedBtn      = document.getElementById("setSpeedBtn");
const changeAmountInput= document.getElementById("changeAmount");
const startAutoBtn     = document.getElementById("startAutoBtn");
const stopAutoBtn      = document.getElementById("stopAutoBtn");
const modeRadios       = document.getElementsByName("mode");

// keep last valid for input
let lastValidAmount = changeAmountInput.value;

// enforce numeric or “-” only
changeAmountInput.addEventListener("input", () => {
  const v = changeAmountInput.value;
  if (/^-?\d*\.?\d*$/.test(v)) lastValidAmount = v;
  else changeAmountInput.value = lastValidAmount;
});

// When user selects a file, decode it
fileInput.addEventListener("change", handleFile);

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ({ target }) => {
    const arrayBuffer = target.result;
    audioContext = audioContext || new AudioContext();
    audioContext.decodeAudioData(arrayBuffer, buffer => {
      audioBuffer = buffer;
      playPauseBtn.disabled = false;
    });
  };
  reader.readAsArrayBuffer(file);
}

// Build a looping source each play
function createSource() {
  const src = audioContext.createBufferSource();
  src.buffer = audioBuffer;
  src.playbackRate.setValueAtTime(playbackRate, audioContext.currentTime);
  src.loop = true;
  src.connect(audioContext.destination);
  return src;
}

// play/pause toggle
playPauseBtn.addEventListener("click", () => {
  if (!audioBuffer) return;
  if (!isPlaying) {
    sourceNode = createSource();
    sourceNode.start(0, pauseOffset);
    isPlaying = true;
    playPauseBtn.textContent = "Pause";
  } else {
    sourceNode.stop();
    pauseOffset += audioContext.currentTime - sourceNode.startTime;
    isPlaying = false;
    playPauseBtn.textContent = "Play";
  }
});

// manual speed prompt
setSpeedBtn.addEventListener("click", () => {
  const input = prompt("Enter speed (e.g. 1.5 for 150%)", playbackRate.toFixed(2));
  const rate = parseFloat(input);
  if (!isNaN(rate) && rate > 0) {
    playbackRate = rate;
    if (sourceNode) {
      sourceNode.playbackRate.setValueAtTime(playbackRate, audioContext.currentTime);
    }
    updateSpeedDisplay();
  }
});

// update UI
function updateSpeedDisplay() {
  if (!isFinite(playbackRate) || playbackRate <= 0) playbackRate = 1;
  speedDisplay.textContent = playbackRate < 100
    ? (playbackRate * 100).toFixed(2) + "%"
    : playbackRate.toFixed(1) + "×";
}

// get current mode
function getMode() {
  return [...modeRadios].find(r => r.checked).value;
}

// auto-change
startAutoBtn.addEventListener("click", () => {
  stopAutoBtn.disabled = false;
  startAutoBtn.disabled = true;
  const fps = 60, tick = 1000 / fps;
  intervalId = setInterval(() => {
    if (!isPlaying) return;
    let pct = parseFloat(changeAmountInput.value);
    if (isNaN(pct)) pct = parseFloat(lastValidAmount) || 0;
    const frac = (pct / fps) / 100;
    if (getMode() === "linear") playbackRate += frac;
    else playbackRate *= (1 + frac);
    if (sourceNode) {
      sourceNode.playbackRate.setValueAtTime(playbackRate, audioContext.currentTime);
    }
    updateSpeedDisplay();
  }, tick);
});
stopAutoBtn.addEventListener("click", () => {
  clearInterval(intervalId);
  startAutoBtn.disabled = false;
});

// initialize UI text
updateSpeedDisplay();
// Disable buttons until file is loaded
playPauseBtn.disabled = true;
stopAutoBtn.disabled = true;