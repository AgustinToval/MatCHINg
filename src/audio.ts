// Lightweight synthesized audio using the Web Audio API — no external sound files needed.

const NOTE_OFFSETS: Record<string, number> = {
  C: -9,
  'C#': -8,
  D: -7,
  'D#': -6,
  E: -5,
  F: -4,
  'F#': -3,
  G: -2,
  'G#': -1,
  A: 0,
  'A#': 1,
  B: 2,
}

function noteFreq(note: string): number {
  const match = note.match(/^([A-G]#?)(\d)$/)
  if (!match) throw new Error(`Invalid note: ${note}`)
  const [, name, octaveStr] = match
  const octave = Number(octaveStr)
  const semitone = NOTE_OFFSETS[name] + (octave - 4) * 12
  return 440 * Math.pow(2, semitone / 12)
}

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

interface PlaybackHandle {
  stop: () => void
}

let current: PlaybackHandle | null = null

function stopAudio() {
  current?.stop()
  current = null
}

const BEAT = 0.4 // seconds per quarter-note unit

const HAPPY_BIRTHDAY_NOTES: { note: string; dur: number }[] = [
  // Happy birthday to you
  { note: 'C4', dur: 0.75 },
  { note: 'C4', dur: 0.25 },
  { note: 'D4', dur: 1 },
  { note: 'C4', dur: 1 },
  { note: 'F4', dur: 1 },
  { note: 'E4', dur: 2 },
  // Happy birthday to you
  { note: 'C4', dur: 0.75 },
  { note: 'C4', dur: 0.25 },
  { note: 'D4', dur: 1 },
  { note: 'C4', dur: 1 },
  { note: 'G4', dur: 1 },
  { note: 'F4', dur: 2 },
  // Happy birthday dear Chiin
  { note: 'C4', dur: 0.75 },
  { note: 'C4', dur: 0.25 },
  { note: 'C5', dur: 1 },
  { note: 'A4', dur: 1 },
  { note: 'F4', dur: 1 },
  { note: 'E4', dur: 1 },
  { note: 'D4', dur: 2 },
  // Happy birthday to you
  { note: 'A#4', dur: 0.75 },
  { note: 'A#4', dur: 0.25 },
  { note: 'A4', dur: 1 },
  { note: 'F4', dur: 1 },
  { note: 'G4', dur: 1 },
  { note: 'F4', dur: 2 },
]

function startHappyBirthday(): PlaybackHandle {
  const ctx = getCtx()

  const masterGain = ctx.createGain()
  masterGain.gain.value = 0.18
  masterGain.connect(ctx.destination)

  let stopped = false
  let timeoutId: number | undefined
  const activeOscillators = new Set<OscillatorNode>()

  function scheduleSequence() {
    if (stopped) return
    let t = ctx.currentTime
    let totalDur = 0

    for (const { note, dur } of HAPPY_BIRTHDAY_NOTES) {
      const seconds = dur * BEAT
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = noteFreq(note)

      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.9, t + 0.02)
      gain.gain.setValueAtTime(0.9, t + seconds * 0.7)
      gain.gain.linearRampToValueAtTime(0, t + seconds * 0.95)

      osc.connect(gain)
      gain.connect(masterGain)
      osc.start(t)
      osc.stop(t + seconds)

      activeOscillators.add(osc)
      osc.addEventListener('ended', () => activeOscillators.delete(osc))

      t += seconds
      totalDur += seconds
    }

    timeoutId = window.setTimeout(scheduleSequence, (totalDur + 0.6) * 1000)
  }

  scheduleSequence()

  return {
    stop() {
      stopped = true
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      for (const osc of activeOscillators) {
        try {
          osc.stop()
        } catch {
          // already stopped
        }
      }
      activeOscillators.clear()
      masterGain.disconnect()
    },
  }
}

const AMBIENT_NOTES = ['C3', 'E3', 'G3', 'B3']

function startAmbient(): PlaybackHandle {
  const ctx = getCtx()

  const masterGain = ctx.createGain()
  masterGain.gain.value = 0.05
  masterGain.connect(ctx.destination)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 700
  filter.connect(masterGain)

  const oscillators: OscillatorNode[] = []

  for (const note of AMBIENT_NOTES) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = noteFreq(note)

    const gain = ctx.createGain()
    gain.gain.value = 0.22

    osc.connect(gain)
    gain.connect(filter)
    osc.start()
    oscillators.push(osc)
  }

  // Slow LFO gently sweeps the filter for a calm, breathing texture.
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.04
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 250
  lfo.connect(lfoGain)
  lfoGain.connect(filter.frequency)
  lfo.start()
  oscillators.push(lfo)

  return {
    stop() {
      for (const osc of oscillators) {
        try {
          osc.stop()
        } catch {
          // already stopped
        }
      }
      masterGain.disconnect()
      filter.disconnect()
    },
  }
}

export function playAmbient() {
  if (current) stopAudio()
  current = startAmbient()
}

export function playHappyBirthdayMusic() {
  if (current) stopAudio()
  current = startHappyBirthday()
}

export { stopAudio }
