let audioContext;
let sourceNode = null;
let audioBuffer = null;
let isPlaying = false;
let startTime = 0;
let pauseOffset = 0;
let playbackRate = 1.0;
let intervalId = null;
let isSpeedChanging = false;
let autoAdvanceLocked = false;

const playlistInput = document.getElementById("playlistInput");
const speedDisplay = document.getElementById("speedDisplay");
const changeAmountInput = document.getElementById("changeAmount");
const playPauseBtn = document.getElementById("playPauseBtn");
const playlistDisplay = document.getElementById("playlistDisplay");
const loopToggle = document.getElementById("loopToggle");

let playlistFiles = [];
let currentIndex = 0;
let lastValidAmount = changeAmountInput.value;

// Allow only numeric input
changeAmountInput.addEventListener("input", () => {
  const v = changeAmountInput.value;
  if (/^-?\d*\.?\d*$/.test(v)) {
    lastValidAmount = v;
  } else {
    changeAmountInput.value = lastValidAmount;
  }
});

playlistInput.addEventListener("change", async (e) => {
  if (!audioContext) audioContext = new AudioContext();
  const files = Array.from(e.target.files);
  const newFiles = [];

  for (const file of files) {
    const alreadyExists = playlistFiles.some(entry => entry.file.name === file.name);
    if (alreadyExists) continue;

    const arrayBuffer = await file.arrayBuffer();
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
    newFiles.push({ file, buffer: decodedBuffer });
  }

  if (!newFiles.length) return;

  playlistFiles.push(...newFiles);

  if (!audioBuffer) {
    currentIndex = 0;
    loadTrack(currentIndex);
  }

  renderPlaylist();
  playPauseBtn.disabled = false;
});

function loadTrack(index) {
  stopPlayback();
  autoAdvanceLocked = false;

  const entry = playlistFiles[index];
  if (!entry || !entry.buffer) return;

  audioBuffer = entry.buffer;
  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.playbackRate.setValueAtTime(playbackRate, audioContext.currentTime);
  sourceNode.connect(audioContext.destination);
  sourceNode.loop = false;

  sourceNode.onended = () => {
    if (!isPlaying || autoAdvanceLocked) return;
    autoAdvanceLocked = true;

    isPlaying = false;
    playPauseBtn.textContent = "Play";

    if (loopToggle.checked) {
      setTimeout(() => {
        autoAdvanceLocked = false;
        nextTrack();
      }, 100);
    }
  };

  try {
    sourceNode.start(0);
  } catch (e) {
    console.error("Error starting sourceNode:", e);
  }

  startTime = audioContext.currentTime;
  pauseOffset = 0;
  isPlaying = true;
  playPauseBtn.textContent = "Pause";

  if (isSpeedChanging) {
    startSpeedChange(); // resume speed change if it was already on
  }

  renderPlaylist();
  updateSpeedDisplay();
}

function stopPlayback() {
  if (sourceNode) {
    try {
      sourceNode.onended = null;
      sourceNode.stop();
      sourceNode.disconnect();
    } catch (e) {
      console.warn("Error stopping playback:", e);
    }
    sourceNode = null;
  }
  isPlaying = false;
}

function togglePlay() {
  if (!audioBuffer) return;

  if (!isPlaying) {
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.setValueAtTime(playbackRate, audioContext.currentTime);
    sourceNode.connect(audioContext.destination);
    sourceNode.loop = false;

    sourceNode.onended = () => {
      if (!isPlaying || autoAdvanceLocked) return;
      autoAdvanceLocked = true;
      isPlaying = false;
      playPauseBtn.textContent = "Play";
      if (loopToggle.checked) {
        setTimeout(() => {
          autoAdvanceLocked = false;
          nextTrack();
        }, 100);
      }
    };

    try {
      sourceNode.start(0, pauseOffset);
    } catch (e) {
      console.error("Start error:", e);
    }

    startTime = audioContext.currentTime;
    isPlaying = true;
    playPauseBtn.textContent = "Pause";

    if (isSpeedChanging) {
      startSpeedChange(); // Resume speed change if it was active
    }
  } else {
    sourceNode.stop();
    pauseOffset += audioContext.currentTime - startTime;
    isPlaying = false;
    playPauseBtn.textContent = "Play";
    stopSpeedChange(); // Optional: pause speed when pausing music
  }
}

function nextTrack() {
  if (playlistFiles.length === 0) return;
  stopPlayback();
  currentIndex = (currentIndex + 1) % playlistFiles.length;
  loadTrack(currentIndex);
}

function prevTrack() {
  if (playlistFiles.length === 0) return;
  stopPlayback();
  currentIndex = (currentIndex - 1 + playlistFiles.length) % playlistFiles.length;
  loadTrack(currentIndex);
}

function setSpeedFromInput() {
  const input = prompt("Enter playback speed (e.g. 1.5 for 150%)", playbackRate.toFixed(2));
  const rate = parseFloat(input);
  if (!isNaN(rate) && rate > 0) {
    playbackRate = rate;
    if (sourceNode) {
      sourceNode.playbackRate.setValueAtTime(playbackRate, audioContext.currentTime);
    }
    updateSpeedDisplay();
  }
}

function updateSpeedDisplay() {
  if (!isFinite(playbackRate) || playbackRate <= 0) playbackRate = 1.0;
  const percent = (playbackRate * 100).toFixed(0);
  if (playbackRate < 100) {
    speedDisplay.textContent = (playbackRate * 100).toFixed(2) + "%";
  } else {
    speedDisplay.textContent = playbackRate.toFixed(2) + "×";
  }
}

function getMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function startSpeedChange() {
  if (intervalId !== null) return; // already running
  isSpeedChanging = true;

  const fps = 60;
  const tickMs = 1000 / fps;

  intervalId = setInterval(() => {
    if (!isPlaying) return;

    let pct = parseFloat(changeAmountInput.value);
    if (isNaN(pct)) pct = parseFloat(lastValidAmount) || 0;
    const fracPerTick = (pct / fps) / 100;

    if (getMode() === "linear") {
      playbackRate += fracPerTick;
    } else {
      playbackRate *= (1 + fracPerTick);
    }

    if (!isFinite(playbackRate) || playbackRate <= 0) playbackRate = 1.0;

    if (sourceNode) {
      sourceNode.playbackRate.setValueAtTime(playbackRate, audioContext.currentTime);
    }

    updateSpeedDisplay();
  }, tickMs);
}

function stopSpeedChange() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isSpeedChanging = false;
}

function renderPlaylist() {
  playlistDisplay.innerHTML = "";
  playlistFiles.forEach((track, index) => {
    const li = document.createElement("li");
    li.textContent = track.file.name;
    if (index === currentIndex) li.classList.add("active");
    li.addEventListener("click", () => {
      currentIndex = index;
      loadTrack(index);
    });
    playlistDisplay.appendChild(li);
  });
}
