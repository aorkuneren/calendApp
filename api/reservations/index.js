import { randomUUID } from 'node:crypto'
import { getDb, getReservations, hasOverlappingReservation, mapReservationRow } from '../_lib/db.js'
import { json, methodNotAllowed, readJsonBody } from '../_lib/http.js'

function normalizeReservationBody(body) {
  return {
    customerName: String(body.customerName ?? body.title ?? '').trim(),
    bungalowId: String(body.bungalowId ?? '').trim(),
    checkIn: String(body.checkIn ?? '').trim(),
    checkOut: String(body.checkOut ?? '').trim(),
    description: String(body.description ?? '').trim(),
  }
}

function validateReservationBody(payload) {
  if (!payload.customerName || !payload.bungalowId || !payload.checkIn || !payload.checkOut) {
    return 'Müşteri, bungalov, giriş ve çıkış tarihi zorunludur.'
  }

  if (payload.checkOut <= payload.checkIn) {
    return 'Çıkış tarihi giriş tarihinden sonra olmalıdır.'
  }

  return ''
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const db = await getDb()
      const reservations = await getReservations(db)
      json(res, 200, { reservations })
    } catch (error) {
      json(res, 500, { error: 'DB_READ_FAILED', message: error.message })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      const payload = normalizeReservationBody(body)
      const validationError = validateReservationBody(payload)

      if (validationError) {
        json(res, 400, { error: 'VALIDATION_ERROR', message: validationError })
        return
      }

      const db = await getDb()

      const { rows: bungalowRows } = await db.execute({
        sql: 'SELECT id FROM bungalows WHERE id = ? LIMIT 1',
        args: [payload.bungalowId],
      })

      if (bungalowRows.length === 0) {
        json(res, 404, { error: 'BUNGALOW_NOT_FOUND', message: 'Seçili bungalov bulunamadı.' })
        return
      }

      const hasOverlap = await hasOverlappingReservation(db, {
        bungalowId: payload.bungalowId,
        checkIn: payload.checkIn,
        checkOut: payload.checkOut,
      })

      if (hasOverlap) {
        json(res, 409, {
          error: 'RESERVATION_OVERLAP',
          message: 'Bu tarih aralığında seçili bungalov için başka rezervasyon var.',
        })
        return
      }

      const id = randomUUID()

      await db.execute({
        sql: `
          INSERT INTO reservations (id, customer_name, bungalow_id, check_in, check_out, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [id, payload.customerName, payload.bungalowId, payload.checkIn, payload.checkOut, payload.description],
      })

      const { rows } = await db.execute({
        sql: `
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
          WHERE r.id = ?
          LIMIT 1
        `,
        args: [id],
      })

      json(res, 201, { reservation: mapReservationRow(rows[0]) })
    } catch (error) {
      json(res, 500, { error: 'DB_WRITE_FAILED', message: error.message })
    }
    return
  }

  methodNotAllowed(res, ['GET', 'POST'])
}
