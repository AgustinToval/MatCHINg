import './style.css'
import { generateBatch, type Problem } from './problems'

const BATCH_SIZE = 8
const LOAD_THRESHOLD = 3 // start loading more when this many cards remain below viewport
const MAX_MISTAKES = 3

let loadedCount = 0
let score = 0
let streak = 0
let bestStreak = 0
let mistakes = 0

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <header class="topbar">
    <div class="brand">MatCHINg</div>
    <div class="stats">
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

const feed = document.querySelector<HTMLDivElement>('#feed')!
const scoreEl = document.querySelector<HTMLSpanElement>('#score-value')!
const streakEl = document.querySelector<HTMLSpanElement>('#streak-value')!
const bestEl = document.querySelector<HTMLSpanElement>('#best-value')!
const livesEl = document.querySelector<HTMLSpanElement>('#lives-value')!

function updateStats() {
  scoreEl.textContent = String(score)
  streakEl.textContent = String(streak)
  bestEl.textContent = String(bestStreak)
  const remaining = MAX_MISTAKES - mistakes
  livesEl.textContent = '●'.repeat(Math.max(remaining, 0)) + '○'.repeat(mistakes)
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

    // Move focus to the next card's input, if present.
    const next = card.nextElementSibling as HTMLElement | null
    const nextInput = next?.querySelector<HTMLInputElement>('.answer-input')
    nextInput?.focus()
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

const sentinel = document.createElement('div')
sentinel.className = 'sentinel'

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

  feed.innerHTML = ''
  feed.appendChild(sentinel)
  loadMore()
  updateStats()

  feed.scrollTo({ top: 0 })
  feed.querySelector<HTMLInputElement>('.answer-input')?.focus()
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        loadMore()
      }
    }
  },
  { rootMargin: `${LOAD_THRESHOLD * 200}px` },
)

feed.appendChild(sentinel)
loadMore()
observer.observe(sentinel)

updateStats()

// Focus the first input so the user can start typing immediately.
feed.querySelector<HTMLInputElement>('.answer-input')?.focus()

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
