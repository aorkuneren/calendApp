import { requireAuth } from '../_lib/auth.js'
import { getDb, mapBungalowRow } from '../_lib/db.js'
import { json, methodNotAllowed, readJsonBody } from '../_lib/http.js'

function resolveId(queryId) {
  if (Array.isArray(queryId)) {
    return queryId[0] ?? ''
  }
  return String(queryId ?? '')
}

export default async function handler(req, res) {
  const session = requireAuth(req, res)
  if (!session) {
    return
  }

  const id = resolveId(req.query.id).trim()

  if (!id) {
    json(res, 400, { error: 'VALIDATION_ERROR', message: 'Bungalov kimliği gerekli.' })
    return
  }

  if (req.method === 'PUT') {
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
      const { rows: currentRows } = await db.execute({
        sql: 'SELECT id, color FROM bungalows WHERE id = ? LIMIT 1',
        args: [id],
      })

      if (currentRows.length === 0) {
        json(res, 404, { error: 'NOT_FOUND', message: 'Bungalov bulunamadı.' })
        return
      }

      await db.execute({
        sql: `
          UPDATE bungalows
          SET name = ?, price = ?, status = ?
          WHERE id = ?
        `,
        args: [name, price, status, id],
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

      json(res, 200, { bungalow: mapBungalowRow(rows[0]) })
    } catch {
      json(res, 500, { error: 'DB_WRITE_FAILED', message: 'Bungalov güncellenemedi.' })
    }
    return
  }

  if (req.method === 'DELETE') {
    try {
      const db = await getDb()
      const { rows: existingRows } = await db.execute({
        sql: 'SELECT id FROM bungalows WHERE id = ? LIMIT 1',
        args: [id],
      })

      if (existingRows.length === 0) {
        json(res, 404, { error: 'NOT_FOUND', message: 'Bungalov bulunamadı.' })
        return
      }

      const { rows: reservationRows } = await db.execute({
        sql: 'SELECT COUNT(*) as count FROM reservations WHERE bungalow_id = ?',
        args: [id],
      })
      const countValue = reservationRows?.[0]?.count
      const reservationCount = typeof countValue === 'number' ? countValue : Number(countValue ?? 0)

      if (reservationCount > 0) {
        json(res, 409, {
          error: 'BUNGALOW_HAS_RESERVATIONS',
          message: 'Bu bungalova bağlı rezervasyonlar olduğu için silinemez.',
        })
        return
      }

      await db.execute({
        sql: 'DELETE FROM bungalows WHERE id = ?',
        args: [id],
      })

      json(res, 200, { success: true })
    } catch {
      json(res, 500, { error: 'DB_DELETE_FAILED', message: 'Bungalov silinemedi.' })
    }
    return
  }

  methodNotAllowed(res, ['PUT', 'DELETE'])
}
