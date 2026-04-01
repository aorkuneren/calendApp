import { clearSessionCookie } from '../_lib/auth.js'
import { json, methodNotAllowed } from '../_lib/http.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  clearSessionCookie(res)
  json(res, 200, { success: true })
}
