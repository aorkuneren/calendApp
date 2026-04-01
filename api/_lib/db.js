import { randomUUID } from 'node:crypto'
import { createClient } from '@libsql/client'
import { hashPassword } from './auth.js'

const SHARP_COLORS = [
  '#0057ff',
  '#ffd600',
  '#ff1f1f',
  '#00c853',
  '#ff2d96',
  '#ff6d00',
  '#7c4dff',
  '#00bcd4',
  '#00e5ff',
  '#9c27b0',
]

const INITIAL_BUNGALOWS = [
  { id: 'seed-bungalov-1', name: 'Aden Garden Suit No.1', price: '5475', status: 'aktif', color: '#00c853' },
  { id: 'seed-bungalov-2', name: 'Aden Garden Suit No.2', price: '6120', status: 'aktif', color: '#ff1f1f' },
  { id: 'seed-bungalov-3', name: 'Aden Garden Suit No.3', price: '5880', status: 'aktif', color: '#0057ff' },
  { id: 'seed-bungalov-4', name: 'Aden Family Suit No.4', price: '7340', status: 'aktif', color: '#ff2d96' },
  { id: 'seed-bungalov-5', name: 'Aden Family Suit No.5', price: '7015', status: 'aktif', color: '#ffd600' },
  { id: 'seed-bungalov-6', name: 'Aden Family Suit No.6', price: '7680', status: 'aktif', color: '#00bcd4' },
  { id: 'seed-bungalov-7', name: 'Aden Blue Suit No.7', price: '6290', status: 'aktif', color: '#7c4dff' },
  { id: 'seed-bungalov-8', name: 'Aden Blue Suit No.8', price: '6535', status: 'aktif', color: '#ff6d00' },
  { id: 'seed-bungalov-9', name: 'Aden White Suit No.9', price: '5725', status: 'aktif', color: '#9c27b0' },
  { id: 'seed-bungalov-10', name: 'Aden White Suit No.10', price: '5960', status: 'aktif', color: '#00e5ff' },
]

const DEFAULT_ADMIN_EMAIL = 'admin@adenbungalov.com'
const DEFAULT_ADMIN_PASSWORD = 'J9dmzyxe7'
const DEFAULT_ADMIN_PASSWORD_HASH =
  'scrypt$16384$8$1$w3JNrUsDdB9pRk6cSn27Dw$BhIFOVQRriXWm_didDz8kUiT8XX5qC_c6Gcoh4wFLVDpA4CFH1u1qy1WoggdBDcGHR8xUrzMwNBabv5FVsJFTw'

const databaseUrl = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!databaseUrl) {
  throw new Error('TURSO_DATABASE_URL tanımlı değil.')
}

const client = createClient({
  url: databaseUrl,
  authToken,
})

let bootstrapPromise = null

function toCount(value) {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function createUniqueRandomColor(existingColors) {
  const usedColors = new Set(existingColors.map((color) => (color ?? '').toLowerCase()).filter(Boolean))
  const availableSharpColors = SHARP_COLORS.filter((color) => !usedColors.has(color.toLowerCase()))

  if (availableSharpColors.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableSharpColors.length)
    return availableSharpColors[randomIndex]
  }

  const seedHue = (existingColors.length * 137) % 360
  for (let offset = 0; offset < 360; offset += 1) {
    const hue = (seedHue + offset) % 360
    const candidate = `hsl(${hue} 100% 50%)`
    if (!usedColors.has(candidate.toLowerCase())) {
      return candidate
    }
  }

  return SHARP_COLORS[0]
}

async function ensureSchema() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS bungalows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aktif',
      color TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  await client.execute(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      bungalow_id TEXT NOT NULL,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (bungalow_id) REFERENCES bungalows(id) ON DELETE RESTRICT,
      CHECK (check_out > check_in)
    )
  `)

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_reservations_bungalow_id
    ON reservations (bungalow_id)
  `)

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_reservations_check_dates
    ON reservations (check_in, check_out)
  `)

  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

async function ensureSeedData() {
  const { rows } = await client.execute('SELECT COUNT(*) as count FROM bungalows')
  const rowCount = toCount(rows?.[0]?.count)

  if (rowCount > 0) {
    return
  }

  for (const bungalow of INITIAL_BUNGALOWS) {
    await client.execute({
      sql: `
        INSERT INTO bungalows (id, name, price, status, color)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [bungalow.id, bungalow.name, bungalow.price, bungalow.status, bungalow.color],
    })
  }
}

async function ensureAdminUser() {
  const email = normalizeEmail(process.env.SEED_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL)
  const configuredPasswordHash = String(process.env.SEED_ADMIN_PASSWORD_HASH ?? '').trim()
  const configuredPassword = String(process.env.SEED_ADMIN_PASSWORD ?? '').trim()
  const hasPepper = String(process.env.APP_PASSWORD_PEPPER ?? '').length > 0
  const passwordHash =
    configuredPasswordHash ||
    (configuredPassword
      ? hashPassword(configuredPassword)
      : hasPepper
        ? hashPassword(DEFAULT_ADMIN_PASSWORD)
        : DEFAULT_ADMIN_PASSWORD_HASH)

  if (!email || !passwordHash) {
    return
  }

  const { rows } = await client.execute({
    sql: 'SELECT id FROM users WHERE email = ? LIMIT 1',
    args: [email],
  })

  if (rows.length > 0) {
    return
  }

  await client.execute({
    sql: `
      INSERT INTO users (id, email, password_hash, role, is_active)
      VALUES (?, ?, ?, 'admin', 1)
    `,
    args: [randomUUID(), email, passwordHash],
  })
}

async function bootstrap() {
  await ensureSchema()
  await ensureSeedData()
  await ensureAdminUser()
}

export async function getDb() {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap().catch((error) => {
      bootstrapPromise = null
      throw error
    })
  }

  await bootstrapPromise
  return client
}

export function mapBungalowRow(row) {
  return {
    id: row.id,
    name: row.name,
    price: String(row.price ?? ''),
    status: row.status ?? 'aktif',
    color: row.color,
  }
}

export function mapReservationRow(row) {
  return {
    id: row.id,
    title: row.customer_name,
    color: row.color,
    bungalowId: row.bungalow_id,
    bungalowName: row.bungalow_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    description: row.description ?? '',
  }
}

export function mapUserRow(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role ?? 'admin',
  }
}

export async function getBungalows(db) {
  const { rows } = await db.execute(`
    SELECT id, name, price, status, color
    FROM bungalows
    ORDER BY name COLLATE NOCASE ASC
  `)
  return rows.map(mapBungalowRow)
}

export async function getReservations(db) {
  const { rows } = await db.execute(`
    SELECT
      r.id,
      r.customer_name,
      r.bungalow_id,
      r.check_in,
      r.check_out,
      r.description,
      b.name AS bungalow_name,
      b.color AS color
    FROM reservations r
    INNER JOIN bungalows b ON b.id = r.bungalow_id
    ORDER BY r.check_in ASC, r.check_out ASC, r.customer_name COLLATE NOCASE ASC
  `)
  return rows.map(mapReservationRow)
}

export async function resolveColorForNewBungalow(db) {
  const { rows } = await db.execute('SELECT color FROM bungalows')
  const existingColors = rows.map((row) => row.color)
  return createUniqueRandomColor(existingColors)
}

export async function hasOverlappingReservation(db, { reservationId = null, bungalowId, checkIn, checkOut }) {
  const { rows } = await db.execute({
    sql: `
      SELECT id
      FROM reservations
      WHERE bungalow_id = ?
        AND (? IS NULL OR id != ?)
        AND check_in < ?
        AND check_out > ?
      LIMIT 1
    `,
    args: [bungalowId, reservationId, reservationId, checkOut, checkIn],
  })

  return rows.length > 0
}

export async function getUserByEmail(db, email) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) {
    return null
  }

  const { rows } = await db.execute({
    sql: `
      SELECT id, email, password_hash, role, is_active
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    args: [normalizedEmail],
  })

  return rows[0] ?? null
}

export async function getUserById(db, userId) {
  const id = String(userId ?? '').trim()
  if (!id) {
    return null
  }

  const { rows } = await db.execute({
    sql: `
      SELECT id, email, password_hash, role, is_active
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    args: [id],
  })

  return rows[0] ?? null
}
