import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { json } from './http.js'

const SESSION_COOKIE_NAME = 'aden_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14
const PASSWORD_ALGO = 'scrypt'
const PASSWORD_N = 16384
const PASSWORD_R = 8
const PASSWORD_P = 1
const PASSWORD_KEYLEN = 64

function getSessionSecret() {
  const secret = String(process.env.APP_SESSION_SECRET ?? '')
  if (secret.length < 32) {
    throw new Error('APP_SESSION_SECRET en az 32 karakter olmalıdır.')
  }
  return secret
}

function getPasswordPepper() {
  return String(process.env.APP_PASSWORD_PEPPER ?? '')
}

function toBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signSessionPayload(payloadSegment) {
  const secret = getSessionSecret()
  return createHmac('sha256', secret).update(payloadSegment).digest('base64url')
}

function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) {
    return {}
  }

  return cookieHeader.split(';').reduce((carry, token) => {
    const [namePart, ...valueParts] = token.split('=')
    const name = namePart?.trim()
    if (!name) {
      return carry
    }

    carry[name] = decodeURIComponent(valueParts.join('=').trim())
    return carry
  }, {})
}

export function hashPassword(plainPassword) {
  const password = String(plainPassword ?? '')
  if (!password) {
    throw new Error('Şifre boş olamaz.')
  }

  const salt = randomBytes(16).toString('base64url')
  const derivedKey = scryptSync(password + getPasswordPepper(), salt, PASSWORD_KEYLEN, {
    N: PASSWORD_N,
    r: PASSWORD_R,
    p: PASSWORD_P,
  }).toString('base64url')

  return `${PASSWORD_ALGO}$${PASSWORD_N}$${PASSWORD_R}$${PASSWORD_P}$${salt}$${derivedKey}`
}

export function verifyPassword(plainPassword, encodedHash) {
  try {
    const [algo, nText, rText, pText, salt, hashText] = String(encodedHash ?? '').split('$')
    if (algo !== PASSWORD_ALGO || !salt || !hashText) {
      return false
    }

    const n = Number(nText)
    const r = Number(rText)
    const p = Number(pText)
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
      return false
    }

    const expected = Buffer.from(hashText, 'base64url')
    const candidate = scryptSync(String(plainPassword ?? '') + getPasswordPepper(), salt, expected.length, {
      N: n,
      r,
      p,
    })

    if (candidate.length !== expected.length) {
      return false
    }

    return timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

export function createSessionToken({ userId, email, role }) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload = {
    sub: String(userId),
    email: String(email ?? ''),
    role: String(role ?? 'admin'),
    iat: issuedAt,
    exp: issuedAt + SESSION_MAX_AGE_SECONDS,
  }

  const payloadSegment = toBase64Url(JSON.stringify(payload))
  const signature = signSessionPayload(payloadSegment)
  return `${payloadSegment}.${signature}`
}

function verifySessionToken(token) {
  const [payloadSegment, signature] = String(token ?? '').split('.')
  if (!payloadSegment || !signature) {
    return null
  }

  const expectedSignature = signSessionPayload(payloadSegment)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null
  }
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadSegment))
    const now = Math.floor(Date.now() / 1000)
    if (!payload?.sub || !payload?.exp || payload.exp <= now) {
      return null
    }

    return {
      userId: String(payload.sub),
      email: String(payload.email ?? ''),
      role: String(payload.role ?? 'admin'),
    }
  } catch {
    return null
  }
}

export function setSessionCookie(res, sessionToken) {
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ]

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure')
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '))
}

export function clearSessionCookie(res) {
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ]

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure')
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '))
}

export function getSessionFromRequest(req) {
  const cookieHeader = req.headers?.cookie
  const cookies = parseCookieHeader(cookieHeader)
  const token = cookies[SESSION_COOKIE_NAME]
  if (!token) {
    return null
  }

  return verifySessionToken(token)
}

export function requireAuth(req, res) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) {
      json(res, 401, {
        error: 'UNAUTHORIZED',
        message: 'Oturum açmanız gerekiyor.',
      })
      return null
    }

    return session
  } catch {
    json(res, 500, {
      error: 'AUTH_CONFIG_ERROR',
      message: 'Kimlik doğrulama ayarı eksik.',
    })
    return null
  }
}
