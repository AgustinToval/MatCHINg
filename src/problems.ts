export interface Problem {
  id: number
  question: string
  answer: number
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

type Generator = (level: number) => Omit<Problem, 'id'>

const addition: Generator = (level) => {
  const max = 15 + level * 10
  const a = randInt(1, max)
  const b = randInt(1, max)
  return { question: `${a} + ${b}`, answer: a + b }
}

const subtraction: Generator = (level) => {
  const max = 15 + level * 10
  const a = randInt(1, max)
  const b = randInt(1, max)
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return { question: `${hi} - ${lo}`, answer: hi - lo }
}

const multiplication: Generator = (level) => {
  const max = Math.min(20, 5 + Math.floor(level / 2))
  const a = randInt(2, max)
  const b = randInt(2, max)
  return { question: `${a} × ${b}`, answer: a * b }
}

const division: Generator = (level) => {
  const max = Math.min(20, 5 + Math.floor(level / 2))
  const b = randInt(2, max)
  const answer = randInt(2, max)
  const a = b * answer
  return { question: `${a} ÷ ${b}`, answer }
}

const square: Generator = (level) => {
  const max = Math.min(20, 5 + Math.floor(level / 2))
  const a = randInt(2, max)
  return { question: `${a}²`, answer: a * a }
}

const percentage: Generator = (level) => {
  const percents = [10, 20, 25, 50, 75]
  const p = percents[randInt(0, percents.length - 1)]
  const base = randInt(1, 4 + level) * (100 / gcdHundred(p))
  const answer = (base * p) / 100
  return { question: `${p}% of ${base}`, answer }
}

function gcdHundred(p: number): number {
  // ensures base * p / 100 is a whole number for clean percentages
  const denom = 100 / gcd(100, p)
  return denom
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

const chain: Generator = (level) => {
  const max = 10 + level * 4
  const a = randInt(1, max)
  const b = randInt(1, max)
  const c = randInt(1, Math.min(10, 4 + level))
  const useMultiply = Math.random() < 0.5
  if (useMultiply) {
    return { question: `${a} + ${b} × ${c}`, answer: a + b * c }
  }
  return { question: `${a} × ${c} - ${b}`, answer: a * c - b }
}

const generators: Generator[] = [addition, subtraction, multiplication, division, square, percentage, chain]

let nextId = 1

export function generateProblem(level: number): Problem {
  const pool: Generator[] = [addition, subtraction]
  if (level >= 2) pool.push(multiplication, division)
  if (level >= 4) pool.push(square)
  if (level >= 5) pool.push(percentage)
  if (level >= 7) pool.push(chain)

  const generator = pool[randInt(0, pool.length - 1)] ?? generators[0]
  const { question, answer } = generator(level)
  return { id: nextId++, question, answer }
}

const START_LEVEL = 3
const LEVEL_UP_EVERY = 4

export function generateBatch(count: number, startIndex: number): Problem[] {
  const batch: Problem[] = []
  for (let i = 0; i < count; i++) {
    const level = Math.floor((startIndex + i) / LEVEL_UP_EVERY) + START_LEVEL
    batch.push(generateProblem(level))
  }
  return batch
}
