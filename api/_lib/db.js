import { createClient } from '@libsql/client'

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
}

async function ensureSeedData() {
  const { rows } = await client.execute('SELECT COUNT(*) as count FROM bungalows')
  const countValue = rows?.[0]?.count
  const rowCount = typeof countValue === 'number' ? countValue : Number(countValue ?? 0)

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

async function bootstrap() {
  await ensureSchema()
  await ensureSeedData()
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
        AND NOT (? < check_in OR ? > check_out)
      LIMIT 1
    `,
    args: [bungalowId, reservationId, reservationId, checkOut, checkIn],
  })

  return rows.length > 0
}
