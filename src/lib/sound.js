// Notification sound: a recorded sound file, or a soft harp arpeggio made with the Web Audio API if the file is missing.
// The admin can turn it off on the Notifications page; the choice is remembered in this browser.
const KEY = 'wheelsync-notification-sound'
export const SOUND_EVENT = 'wheelsync-sound-setting'

export function soundEnabled() {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}

export function setSoundEnabled(enabled) {
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off') } catch { /* storage unavailable: stays on for this visit */ }
  window.dispatchEvent(new Event(SOUND_EVENT))
}

let context = null

// Soft harp arpeggio (about 2 seconds): G4 – D5 – G5, low and mellow so it is easy on the ears.
// Each note starts gently and is filtered to take away harsh highs; a quiet echo adds warmth.
const MELODY = [
  // [frequency Hz, start s, ring-out s]
  [392.0, 0.0, 1.4], // G4
  [587.33, 0.2, 1.4], // D5
  [783.99, 0.4, 1.8], // G5
]

function pluck(output, frequency, at, ring) {
  const tone = context.createOscillator()
  const soft = context.createBiquadFilter()
  const volume = context.createGain()
  tone.type = 'triangle'
  tone.frequency.value = frequency
  soft.type = 'lowpass'
  soft.frequency.value = 1800 // removes the sharp, tinny part of the tone
  volume.gain.setValueAtTime(0.0001, at)
  volume.gain.exponentialRampToValueAtTime(0.16, at + 0.04) // gentle start, no click
  volume.gain.exponentialRampToValueAtTime(0.0001, at + ring)
  tone.connect(soft).connect(volume).connect(output)
  tone.start(at)
  tone.stop(at + ring + 0.05)
}

// Recorded notification sound (public/sounds/notification.mp3). When the file is missing or can't play,
// the soft harp arpeggio below is played instead.
const SOUND_FILE = '/sounds/notification.mp3'
let fileSound = null
let fileWorks = true

export function playChime() {
  if (fileWorks) {
    fileSound ||= new Audio(SOUND_FILE)
    fileSound.currentTime = 0
    fileSound.volume = 0.8
    fileSound.play().catch((error) => {
      // NotAllowedError = the page hasn't been clicked yet (browsers block sound until then): stay silent.
      if (error?.name === 'NotAllowedError') return
      fileWorks = false
      playArpeggio()
    })
    return
  }
  playArpeggio()
}

function playArpeggio() {
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)()
    if (context.state === 'suspended') context.resume()
    const start = context.currentTime + 0.02

    const master = context.createGain()
    master.gain.value = 0.8
    const echo = context.createDelay(1)
    echo.delayTime.value = 0.22
    const feedback = context.createGain()
    feedback.gain.value = 0.18
    const wet = context.createGain()
    wet.gain.value = 0.2
    master.connect(context.destination)
    master.connect(echo)
    echo.connect(feedback).connect(echo)
    echo.connect(wet).connect(context.destination)

    MELODY.forEach(([frequency, delay, ring]) => pluck(master, frequency, start + delay, ring))
  } catch {
    // Browsers only allow sound after the page has been clicked once; a missed chime is harmless.
  }
}
