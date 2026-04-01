import { createSessionToken, setSessionCookie, verifyPassword } from '../_lib/auth.js'
import { getDb, getUserByEmail, mapUserRow, normalizeEmail } from '../_lib/db.js'
import { json, methodNotAllowed, readJsonBody } from '../_lib/http.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  try {
    const body = await readJsonBody(req)
    const email = normalizeEmail(body.email)
    const password = String(body.password ?? '')

    if (!email || !password) {
      json(res, 400, {
        error: 'VALIDATION_ERROR',
        message: 'E-posta ve şifre zorunludur.',
      })
      return
    }

    const db = await getDb()
    const user = await getUserByEmail(db, email)
    const isActive = Number(user?.is_active ?? 0) === 1
    const hasValidPassword = user ? verifyPassword(password, user.password_hash) : false

    if (!user || !isActive || !hasValidPassword) {
      json(res, 401, {
        error: 'INVALID_CREDENTIALS',
        message: 'E-posta veya şifre hatalı.',
      })
      return
    }

    const sessionToken = createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })
    setSessionCookie(res, sessionToken)

    json(res, 200, { user: mapUserRow(user) })
  } catch {
    json(res, 500, {
      error: 'AUTH_LOGIN_FAILED',
      message: 'Giriş işlemi tamamlanamadı.',
    })
  }
}
