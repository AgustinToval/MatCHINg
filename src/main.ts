import './style.css'
import { generateBatch, type Problem } from './problems'

const BATCH_SIZE = 8
const LOAD_THRESHOLD = 3 // start loading more when this many cards remain below viewport
const MAX_MISTAKES = 3

const TIME_OPTIONS: { label: string; seconds: number }[] = [
  { label: '30s', seconds: 30 },
  { label: '60s', seconds: 60 },
  { label: '120s', seconds: 120 },
  { label: 'No limit', seconds: 0 },
]

const app = document.querySelector<HTMLDivElement>('#app')!

let loadedCount = 0
let score = 0
let streak = 0
let bestStreak = 0
let mistakes = 0
let activeInput: HTMLInputElement | null = null
let timedMode = false
let timeLeft = 0
let timerInterval: number | undefined

let feed: HTMLDivElement
let scoreEl: HTMLSpanElement
let streakEl: HTMLSpanElement
let bestEl: HTMLSpanElement
let livesEl: HTMLSpanElement
let timeEl: HTMLSpanElement | null
let sentinel: HTMLDivElement
let observer: IntersectionObserver | null = null

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function showSetup() {
  if (timerInterval !== undefined) {
    clearInterval(timerInterval)
    timerInterval = undefined
  }
  observer?.disconnect()
  observer = null

  app.innerHTML = `
    <div class="setup">
      <div class="setup-card">
        <div class="brand">MatCHINg</div>
        <p class="setup-subtitle">Mental math, infinite scroll.</p>
        <p class="setup-label">Choose a mode</p>
        <div class="mode-options">
          ${TIME_OPTIONS.map(
            (option) => `<button class="mode-btn" data-seconds="${option.seconds}">${option.label}</button>`,
          ).join('')}
        </div>
        <p class="setup-hint">Timed modes show how many calculations you can solve before time runs out.</p>
      </div>
    </div>
  `

  app.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      startGame(Number(btn.dataset.seconds))
    })
  })
}

function startGame(seconds: number) {
  loadedCount = 0
  score = 0
  streak = 0
  bestStreak = 0
  mistakes = 0
  activeInput = null
  timedMode = seconds > 0
  timeLeft = seconds

  app.innerHTML = `
    <header class="topbar">
      <div class="brand">MatCHINg</div>
      <div class="stats">
        ${
          timedMode
            ? `<div class="stat"><span class="stat-value" id="time-value">${formatTime(timeLeft)}</span><span class="stat-label">time</span></div>`
            : ''
        }
        <div class="stat">
          <span class="stat-value" id="score-value">0</span>
          <span class="stat-label">score</span>
        </div>
        <div class="stat">
          <span class="stat-value" id="streak-value">0</span>
          <span class="stat-label">streak</span>
        </div>
        <div class="stat">
          <span class="stat-value" id="best-value">0</span>
          <span class="stat-label">best</span>
        </div>
        <div class="stat">
          <span class="stat-value" id="lives-value">●●●</span>
          <span class="stat-label">lives</span>
        </div>
      </div>
    </header>
    <main class="feed" id="feed"></main>
  `

  feed = app.querySelector<HTMLDivElement>('#feed')!
  scoreEl = app.querySelector<HTMLSpanElement>('#score-value')!
  streakEl = app.querySelector<HTMLSpanElement>('#streak-value')!
  bestEl = app.querySelector<HTMLSpanElement>('#best-value')!
  livesEl = app.querySelector<HTMLSpanElement>('#lives-value')!
  timeEl = app.querySelector<HTMLSpanElement>('#time-value')

  sentinel = document.createElement('div')
  sentinel.className = 'sentinel'

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) loadMore()
      }
    },
    { rootMargin: `${LOAD_THRESHOLD * 200}px` },
  )

  feed.appendChild(sentinel)
  loadMore()
  observer.observe(sentinel)
  updateStats()

  const firstInput = feed.querySelector<HTMLInputElement>('.answer-input')
  setActiveInput(firstInput)

  if (timedMode) {
    timerInterval = window.setInterval(() => {
      timeLeft -= 1
      if (timeEl) timeEl.textContent = formatTime(Math.max(timeLeft, 0))
      if (timeLeft <= 0) {
        endGame()
      }
    }, 1000)
  }
}

function endGame() {
  if (timerInterval !== undefined) {
    clearInterval(timerInterval)
    timerInterval = undefined
  }
  observer?.disconnect()

  if (activeInput) {
    activeInput.disabled = true
    activeInput = null
  }

  const overlay = document.createElement('div')
  overlay.className = 'finished-overlay'
  overlay.innerHTML = `
    <div class="finished-card">
      <h2>Time's up!</h2>
      <p class="finished-score">${score}</p>
      <p class="finished-label">calculations solved</p>
      <p class="finished-best">Best streak: ${bestStreak}</p>
      <button class="mode-btn" id="play-again-btn">Play again</button>
    </div>
  `
  app.appendChild(overlay)

  overlay.querySelector<HTMLButtonElement>('#play-again-btn')?.addEventListener('click', () => {
    showSetup()
  })
}

function updateStats() {
  scoreEl.textContent = String(score)
  streakEl.textContent = String(streak)
  bestEl.textContent = String(bestStreak)
  const remaining = MAX_MISTAKES - mistakes
  livesEl.textContent = '●'.repeat(Math.max(remaining, 0)) + '○'.repeat(mistakes)
}

function setActiveInput(input: HTMLInputElement | null) {
  if (activeInput && activeInput !== input) {
    activeInput.disabled = true
  }
  activeInput = input
  if (activeInput) {
    activeInput.disabled = false
    activeInput.focus()
  }
}

function createCard(problem: Problem): HTMLElement {
  const card = document.createElement('section')
  card.className = 'card'
  card.dataset.answer = String(problem.answer)

  card.innerHTML = `
    <div class="question">${problem.question}</div>
    <div class="answer-row">
      <input
        class="answer-input"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        placeholder="?"
        aria-label="Your answer"
        disabled
      />
      <span class="feedback" aria-live="polite"></span>
    </div>
  `

  const input = card.querySelector<HTMLInputElement>('.answer-input')!
  const feedbackEl = card.querySelector<HTMLSpanElement>('.feedback')!

  let resolved = false

  function checkAnswer() {
    if (resolved) return
    const raw = input.value.trim().replace(',', '.')
    if (raw === '') return
    const value = Number(raw)
    if (Number.isNaN(value)) return

    resolved = true
    input.disabled = true

    if (value === problem.answer) {
      card.classList.add('correct')
      feedbackEl.textContent = '✓'
      score += 1
      streak += 1
      bestStreak = Math.max(bestStreak, streak)
    } else {
      card.classList.add('incorrect')
      feedbackEl.textContent = `✗ ${problem.answer}`
      streak = 0
      mistakes += 1
    }
    updateStats()

    if (mistakes >= MAX_MISTAKES) {
      window.setTimeout(resetFeed, 600)
      return
    }

    // Unlock the next card's input.
    const next = card.nextElementSibling as HTMLElement | null
    const nextInput = next?.querySelector<HTMLInputElement>('.answer-input') ?? null
    setActiveInput(nextInput)
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      checkAnswer()
    }
  })

  input.addEventListener('blur', () => {
    checkAnswer()
  })

  return card
}

function loadMore() {
  const batch = generateBatch(BATCH_SIZE, loadedCount)
  loadedCount += batch.length

  const fragment = document.createDocumentFragment()
  for (const problem of batch) {
    fragment.appendChild(createCard(problem))
  }

  feed.insertBefore(fragment, sentinel)
}

function resetFeed() {
  loadedCount = 0
  score = 0
  streak = 0
  mistakes = 0
  activeInput = null

  feed.innerHTML = ''
  feed.appendChild(sentinel)
  loadMore()
  updateStats()

  feed.scrollTo({ top: 0 })
  setActiveInput(feed.querySelector<HTMLInputElement>('.answer-input'))
}

showSetup()

// Register the service worker (auto-injected by vite-plugin-pwa in production builds).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        registerSW({ immediate: true })
      })
      .catch(() => {
        // virtual:pwa-register is only available in production builds.
      })
  })
}
