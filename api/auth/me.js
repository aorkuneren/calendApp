import { clearSessionCookie, requireAuth } from '../_lib/auth.js'
import { getDb, getUserById, mapUserRow } from '../_lib/db.js'
import { json, methodNotAllowed } from '../_lib/http.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
    return
  }

  const session = requireAuth(req, res)
  if (!session) {
    return
  }

  try {
    const db = await getDb()
    const user = await getUserById(db, session.userId)
    const isActive = Number(user?.is_active ?? 0) === 1

    if (!user || !isActive) {
      clearSessionCookie(res)
      json(res, 401, {
        error: 'UNAUTHORIZED',
        message: 'Oturum geçersiz. Lütfen tekrar giriş yapın.',
      })
      return
    }

    json(res, 200, { user: mapUserRow(user) })
  } catch {
    json(res, 500, {
      error: 'AUTH_READ_FAILED',
      message: 'Oturum bilgisi okunamadı.',
    })
  }
}
