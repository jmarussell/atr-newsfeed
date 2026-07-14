const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function withCors(response, env) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", env.ALLOWED_ORIGIN || "*");
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type, authorization");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders
  });
}

function isAuthorized(request, env) {
  const expected = env.PUBLISH_TOKEN;
  if (!expected) {
    return false;
  }
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

function normaliseLimit(value) {
  const limit = Number.parseInt(value || "20", 10);
  if (Number.isNaN(limit)) {
    return 20;
  }
  return Math.min(Math.max(limit, 1), 50);
}

function normaliseOffset(value) {
  const offset = Number.parseInt(value || "0", 10);
  if (Number.isNaN(offset)) {
    return 0;
  }
  return Math.max(offset, 0);
}

async function handleFeed(request, env) {
  const url = new URL(request.url);
  const limit = normaliseLimit(url.searchParams.get("limit"));
  const offset = normaliseOffset(url.searchParams.get("offset"));

  const { results } = await env.DB.prepare(
    `SELECT id, date, blurb, source, url, published_at
     FROM feed_items
     WHERE status = 'published'
     ORDER BY date DESC, published_at DESC, id DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  return json({
    items: results || [],
    limit,
    offset
  });
}

async function handlePublish(request, env) {
  if (!isAuthorized(request, env)) {
    return json({ error: "unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const date = String(body.date || "").trim();
  const blurb = String(body.blurb || "").trim();
  const source = String(body.source || "").trim();
  const url = String(body.url || "").trim();
  const submittedBy = String(body.submitted_by || "").trim() || null;
  const originalUrl = String(body.original_url || "").trim() || url;
  const originalText = String(body.original_text || "").trim() || null;

  if (!date || !blurb || !source || !url) {
    return json({ error: "missing_required_fields" }, 400);
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO feed_items
        (date, blurb, source, url, submitted_by, original_url, original_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id, date, blurb, source, url, published_at`
    ).bind(date, blurb, source, url, submittedBy, originalUrl, originalText).first();

    return json({ item: result }, 201);
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return json({ error: "duplicate_url" }, 409);
    }
    return json({ error: "database_error" }, 500);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), env);
    }

    const url = new URL(request.url);
    let response;

    if (request.method === "GET" && url.pathname === "/api/feed") {
      response = await handleFeed(request, env);
    } else if (request.method === "POST" && url.pathname === "/api/publish") {
      response = await handlePublish(request, env);
    } else if (request.method === "GET" && url.pathname === "/api/health") {
      response = json({ ok: true });
    } else {
      response = json({ error: "not_found" }, 404);
    }

    return withCors(response, env);
  }
};
