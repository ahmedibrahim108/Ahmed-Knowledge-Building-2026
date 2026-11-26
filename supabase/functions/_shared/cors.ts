export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowedEnv = (Deno.env.get('R2_ALLOWED_ORIGINS') || '').trim();

  let allowOrigin = '*';
  if (allowedEnv) {
    const allowList = allowedEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (origin && allowList.includes(origin)) {
      allowOrigin = origin;
    } else if (allowList.length > 0) {
      allowOrigin = allowList[0];
    }
  } else if (origin) {
    // Reflect specific caller origin cleanly without mixing wildcard + credentials
    allowOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function handleCorsPreflight(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function errorResponse(
  req: Request,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): Response {
  return jsonResponse(
    req,
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    status
  );
}
