import { randomUUID } from 'node:crypto'
import { requireAuth } from '../_lib/auth.js'
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
  const session = requireAuth(req, res)
  if (!session) {
    return
  }

  if (req.method === 'GET') {
    try {
      const db = await getDb()
      const reservations = await getReservations(db)
      json(res, 200, { reservations })
    } catch {
      json(res, 500, { error: 'DB_READ_FAILED', message: 'Rezervasyonlar okunamadı.' })
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
      const tx = await db.transaction('write')
      let createdReservation = null

      try {
        const { rows: bungalowRows } = await tx.execute({
          sql: 'SELECT id FROM bungalows WHERE id = ? LIMIT 1',
          args: [payload.bungalowId],
        })

        if (bungalowRows.length === 0) {
          await tx.rollback()
          json(res, 404, { error: 'BUNGALOW_NOT_FOUND', message: 'Seçili bungalov bulunamadı.' })
          return
        }

        const hasOverlap = await hasOverlappingReservation(tx, {
          bungalowId: payload.bungalowId,
          checkIn: payload.checkIn,
          checkOut: payload.checkOut,
        })

        if (hasOverlap) {
          await tx.rollback()
          json(res, 409, {
            error: 'RESERVATION_OVERLAP',
            message: 'Bu bungalov için seçilen tarihlerde başka rezervasyon var.',
          })
          return
        }

        const id = randomUUID()

        await tx.execute({
          sql: `
            INSERT INTO reservations (id, customer_name, bungalow_id, check_in, check_out, description)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          args: [id, payload.customerName, payload.bungalowId, payload.checkIn, payload.checkOut, payload.description],
        })

        const { rows } = await tx.execute({
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

        createdReservation = mapReservationRow(rows[0])
        await tx.commit()
      } catch (error) {
        try {
          await tx.rollback()
        } catch {
          // no-op
        }
        throw error
      } finally {
        tx.close()
      }

      if (createdReservation) {
        json(res, 201, { reservation: createdReservation })
      }
    } catch {
      json(res, 500, { error: 'DB_WRITE_FAILED', message: 'Rezervasyon kaydedilemedi.' })
    }
    return
  }

  methodNotAllowed(res, ['GET', 'POST'])
}
