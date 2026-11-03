(() => {
  const button = document.getElementById("music-button");
  if (!button) return;

  // A small original, synthesized arcade loop. No audio files or external
  // services are needed, and playback begins only after the user opts in.
  const melody = [
    72, null, 76, 79, null, 76, 74, null,
    69, null, 72, 76, null, 72, 71, null,
    67, null, 72, 76, null, 79, 76, null,
    71, null, 74, 79, null, 74, 72, null
  ];
  const bass = [48, 45, 41, 43];
  const stepDuration = 60 / 112 / 2;

  let context;
  let master;
  let scheduler;
  let nextNoteTime = 0;
  let step = 0;
  let enabled = false;

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

  function scheduleNotes() {
    while (nextNoteTime < context.currentTime + 0.4) {
      const note = melody[step % melody.length];
      if (note !== null) {
        playNote(midiToFrequency(note), nextNoteTime, stepDuration * 0.88, "triangle", 0.12);
      }
      if (step % 8 === 0) {
        const bassNote = bass[Math.floor(step / 8) % bass.length];
        playNote(midiToFrequency(bassNote), nextNoteTime, stepDuration * 3.7, "sine", 0.16);
      }
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
