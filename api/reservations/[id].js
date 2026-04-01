import { getDb, hasOverlappingReservation, mapReservationRow } from '../_lib/db.js'
import { json, methodNotAllowed, readJsonBody } from '../_lib/http.js'

function resolveId(queryId) {
  if (Array.isArray(queryId)) {
    return queryId[0] ?? ''
  }
  return String(queryId ?? '')
}

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
  const id = resolveId(req.query.id).trim()

  if (!id) {
    json(res, 400, { error: 'VALIDATION_ERROR', message: 'Rezervasyon kimliği gerekli.' })
    return
  }

  if (req.method === 'PUT') {
    try {
      const body = await readJsonBody(req)
      const payload = normalizeReservationBody(body)
      const validationError = validateReservationBody(payload)

      if (validationError) {
        json(res, 400, { error: 'VALIDATION_ERROR', message: validationError })
        return
      }

      const db = await getDb()

      const { rows: reservationRows } = await db.execute({
        sql: 'SELECT id FROM reservations WHERE id = ? LIMIT 1',
        args: [id],
      })

      if (reservationRows.length === 0) {
        json(res, 404, { error: 'NOT_FOUND', message: 'Rezervasyon bulunamadı.' })
        return
      }

      const { rows: bungalowRows } = await db.execute({
        sql: 'SELECT id FROM bungalows WHERE id = ? LIMIT 1',
        args: [payload.bungalowId],
      })

      if (bungalowRows.length === 0) {
        json(res, 404, { error: 'BUNGALOW_NOT_FOUND', message: 'Seçili bungalov bulunamadı.' })
        return
      }

      const hasOverlap = await hasOverlappingReservation(db, {
        reservationId: id,
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

      await db.execute({
        sql: `
          UPDATE reservations
          SET
            customer_name = ?,
            bungalow_id = ?,
            check_in = ?,
            check_out = ?,
            description = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `,
        args: [
          payload.customerName,
          payload.bungalowId,
          payload.checkIn,
          payload.checkOut,
          payload.description,
          id,
        ],
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

      json(res, 200, { reservation: mapReservationRow(rows[0]) })
    } catch (error) {
      json(res, 500, { error: 'DB_WRITE_FAILED', message: error.message })
    }
    return
  }

  methodNotAllowed(res, ['PUT'])
}
