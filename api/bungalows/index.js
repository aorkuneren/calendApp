import { randomUUID } from 'node:crypto'
import { requireAuth } from '../_lib/auth.js'
import { getBungalows, getDb, mapBungalowRow, resolveColorForNewBungalow } from '../_lib/db.js'
import { json, methodNotAllowed, readJsonBody } from '../_lib/http.js'

export default async function handler(req, res) {
  const session = requireAuth(req, res)
  if (!session) {
    return
  }

  if (req.method === 'GET') {
    try {
      const db = await getDb()
      const bungalows = await getBungalows(db)
      json(res, 200, { bungalows })
    } catch {
      json(res, 500, { error: 'DB_READ_FAILED', message: 'Bungalovlar okunamadı.' })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      const name = String(body.name ?? '').trim()
      const price = String(body.price ?? '').trim()
      const status = String(body.status ?? 'aktif').trim() || 'aktif'

      if (!name || !price) {
        json(res, 400, {
          error: 'VALIDATION_ERROR',
          message: 'Bungalov adı ve gecelik fiyat zorunludur.',
        })
        return
      }

      const db = await getDb()
      const color = await resolveColorForNewBungalow(db)
      const id = randomUUID()

      await db.execute({
        sql: `
          INSERT INTO bungalows (id, name, price, status, color)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [id, name, price, status, color],
      })

      const { rows } = await db.execute({
        sql: `
          SELECT id, name, price, status, color
          FROM bungalows
          WHERE id = ?
          LIMIT 1
        `,
        args: [id],
      })

      json(res, 201, { bungalow: mapBungalowRow(rows[0]) })
    } catch {
      json(res, 500, { error: 'DB_WRITE_FAILED', message: 'Bungalov kaydedilemedi.' })
    }
    return
  }

  methodNotAllowed(res, ['GET', 'POST'])
}
