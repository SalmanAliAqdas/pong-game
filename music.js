(() => {
  const button = document.getElementById("music-button");
  if (!button) return;

  // An original, upbeat synthesized arcade loop with no external audio files.
  const melody = [
    76, null, 79, 83, 79, null, 76, null,
    74, null, 78, 81, 78, null, 74, null,
    72, 76, 79, null, 83, null, 79, null,
    74, null, 78, 81, 86, 81, 78, null
  ];
  const bass = [48, 43, 45, 41];
  const stepDuration = 60 / 128 / 2;

  let context;
  let master;
  let scheduler;
  let nextNoteTime = 0;
  let step = 0;
  let enabled = false;
  let noiseBuffer;

  function midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function playNote(frequency, startAt, duration, type, volume) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(volume, startAt + 0.018);
    envelope.gain.setValueAtTime(volume, startAt + duration * 0.65);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      envelope.disconnect();
    }, { once: true });
  }

  function playKick(startAt) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(140, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(48, startAt + 0.14);
    envelope.gain.setValueAtTime(0.22, startAt);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.16);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.18);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      envelope.disconnect();
    }, { once: true });
  }

  function playSnare(startAt) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = "highpass";
    filter.frequency.value = 1400;
    envelope.gain.setValueAtTime(0.12, startAt);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.12);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start(startAt);
    source.stop(startAt + 0.13);
    source.addEventListener("ended", () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    }, { once: true });
  }

  function scheduleNotes() {
    while (nextNoteTime < context.currentTime + 0.4) {
      const note = melody[step % melody.length];
      if (note !== null) {
        playNote(midiToFrequency(note), nextNoteTime, stepDuration * 0.78, "square", 0.07);
      }
      if (step % 8 === 0) {
        const bassNote = bass[Math.floor(step / 8) % bass.length];
        playNote(midiToFrequency(bassNote), nextNoteTime, stepDuration * 3.7, "triangle", 0.16);
      }
      if (step % 4 === 0) playKick(nextNoteTime);
      else if (step % 8 === 4) playSnare(nextNoteTime);
      nextNoteTime += stepDuration;
      step++;
    }
  }

  async function startMusic() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      button.textContent = "Music unavailable";
      button.disabled = true;
      return;
    }

    try {
      context ??= new AudioContextClass();
      if (!master) {
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
        const noise = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noise.length; i++) {
          noise[i] = Math.random() * 2 - 1;
        }
      }
      await context.resume();
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0.55, now, 0.12);
      nextNoteTime = now + 0.05;
      scheduler = window.setInterval(scheduleNotes, 100);
      scheduleNotes();
      enabled = true;
      button.textContent = "Music: On";
      button.setAttribute("aria-pressed", "true");
    } catch {
      enabled = false;
      button.textContent = "Music unavailable";
      button.setAttribute("aria-pressed", "false");
    }
  }

  function stopMusic() {
    enabled = false;
    window.clearInterval(scheduler);
    scheduler = undefined;
    if (context && master) {
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0.0001, now, 0.04);
    }
    button.textContent = "Music: Off";
    button.setAttribute("aria-pressed", "false");
  }

  button.addEventListener("click", () => {
    if (enabled) stopMusic();
    else startMusic();
  });

  // Browsers may suspend audio when the tab is hidden. Resume the loop when
  // the player returns, as long as they left music enabled.
  document.addEventListener("visibilitychange", async () => {
    if (!context || !enabled) return;
    if (document.hidden) {
      window.clearInterval(scheduler);
      scheduler = undefined;
      await context.suspend();
    } else {
      try {
        await context.resume();
        nextNoteTime = context.currentTime + 0.05;
        scheduler = window.setInterval(scheduleNotes, 100);
      } catch {
        stopMusic();
      }
    }
  });
})();
