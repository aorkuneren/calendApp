export function json(res, statusCode, payload) {
  res.status(statusCode).json(payload)
}

export function methodNotAllowed(res, allowedMethods) {
  res.setHeader('Allow', allowedMethods)
  json(res, 405, {
    error: 'METHOD_NOT_ALLOWED',
    message: `Desteklenen methodlar: ${allowedMethods.join(', ')}`,
  })
}

export async function readJsonBody(req) {
  if (!req.body) {
    return {}
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }

  if (typeof req.body === 'object') {
    return req.body
  }

  return {}
}
