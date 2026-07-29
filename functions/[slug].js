export async function onRequest(context) {
  const { request, env, params, waitUntil } = context;
  const slug = params.slug;

  // Pass through static assets (anything with a dot, e.g. favicon.ico, robots.txt)
  if (!slug || slug.includes(".")) {
    return fetch(request);
  }

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response("Server is not configured.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  const headers = {
    apikey: supabaseKey,
    Authorization: "Bearer " + supabaseKey,
    "Content-Type": "application/json"
  };

  try {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/urls?slug=eq.${encodeURIComponent(slug)}&select=original_url&limit=1`,
      { headers }
    );
    const data = await r.json();

    if (!Array.isArray(data) || data.length === 0) {
      return new Response("Short link not found.", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    const originalUrl = data[0].original_url;

    // Fire-and-forget click increment via RPC (security definer)
    waitUntil(
      fetch(`${supabaseUrl}/rest/v1/rpc/increment_clicks`, {
        method: "POST",
        headers,
        body: JSON.stringify({ p_slug: slug })
      }).catch(() => {})
    );

    return Response.redirect(originalUrl, 301);
  } catch (err) {
    return new Response("Internal error.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
