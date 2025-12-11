export default {
  async fetch(request, env) {
    // CORS Configuration
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With",
      "Access-Control-Max-Age": "86400"
    };

    // Handle Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    
    // --- ROUTE 1: Internal API (Auth & Data Sync) ---
    // Requires 'SUBSCRIPT_DB' KV Binding
    if (url.pathname.startsWith('/api/')) {
        if (!env.SUBSCRIPT_DB) {
            return new Response(JSON.stringify({ success: false, error: "KV Binding 'SUBSCRIPT_DB' not found. Please configure in Cloudflare Dashboard." }), {
                status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        try {
            // 1. Register
            if (url.pathname === '/api/auth/register' && request.method === 'POST') {
                const { username, password } = await request.json();
                if (!username || !password || username.length < 3) {
                    return jsonResp({ success: false, error: "Invalid username or password (min 3 chars)" }, 400, corsHeaders);
                }
                
                // Check existing
                const existing = await env.SUBSCRIPT_DB.get(`u:${username}`);
                if (existing) {
                    return jsonResp({ success: false, error: "Username already exists" }, 409, corsHeaders);
                }

                // Hash password
                const salt = crypto.randomUUID();
                const hash = await hashPassword(password, salt);
                
                // Save user: u:username -> { hash, salt }
                await env.SUBSCRIPT_DB.put(`u:${username}`, JSON.stringify({ hash, salt }));
                return jsonResp({ success: true }, 200, corsHeaders);
            }

            // 2. Login
            if (url.pathname === '/api/auth/login' && request.method === 'POST') {
                const { username, password } = await request.json();
                const userRaw = await env.SUBSCRIPT_DB.get(`u:${username}`);
                if (!userRaw) {
                    return jsonResp({ success: false, error: "User not found" }, 404, corsHeaders);
                }

                const user = JSON.parse(userRaw);
                const inputHash = await hashPassword(password, user.salt);

                if (inputHash !== user.hash) {
                    return jsonResp({ success: false, error: "Invalid password" }, 401, corsHeaders);
                }

                // Generate Token
                const token = crypto.randomUUID();
                // Store Session: s:token -> username (Expires in 7 days)
                await env.SUBSCRIPT_DB.put(`s:${token}`, username, { expirationTtl: 60 * 60 * 24 * 7 });

                return jsonResp({ success: true, data: { token } }, 200, corsHeaders);
            }

            // 3. Sync Push (Upload)
            if (url.pathname === '/api/sync/push' && request.method === 'POST') {
                const token = request.headers.get('Authorization');
                const username = await getUsernameByToken(env, token);
                if (!username) return jsonResp({ success: false, error: "Unauthorized" }, 401, corsHeaders);

                const data = await request.json();
                // Store Data: d:username -> json
                await env.SUBSCRIPT_DB.put(`d:${username}`, JSON.stringify(data));
                return jsonResp({ success: true }, 200, corsHeaders);
            }

            // 4. Sync Pull (Download)
            if (url.pathname === '/api/sync/pull' && request.method === 'GET') {
                const token = request.headers.get('Authorization');
                const username = await getUsernameByToken(env, token);
                if (!username) return jsonResp({ success: false, error: "Unauthorized" }, 401, corsHeaders);

                const data = await env.SUBSCRIPT_DB.get(`d:${username}`);
                return jsonResp({ success: true, data: data ? JSON.parse(data) : null }, 200, corsHeaders);
            }

            return jsonResp({ success: false, error: "Endpoint not found" }, 404, corsHeaders);

        } catch (e) {
            return jsonResp({ success: false, error: e.message }, 500, corsHeaders);
        }
    }

    // --- ROUTE 2: External API Proxy (iFlytek/AI) ---
    // Fallback for AI Image Generation requests
    
    const targetHost = "maas-api.cn-huabei-1.xf-yun.com";
    const targetUrl = new URL(request.url);
    targetUrl.hostname = targetHost;
    targetUrl.protocol = "https:";
    
    const newRequest = new Request(targetUrl, {
        method: request.method,
        headers: {
            "Host": targetHost,
            "Content-Type": "application/json"
        },
        body: request.body
    });
    
    let response;
    try {
      response = await fetch(newRequest);
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
          status: 500,
          headers: { ...corsHeaders, "Access-Control-Allow-Origin": "*" }
      });
    }

    const newResponse = new Response(response.body, response);
    Object.keys(corsHeaders).forEach(key => {
        newResponse.headers.set(key, corsHeaders[key]);
    });
    
    return newResponse;
  }
}

// Helpers
function jsonResp(data, status, corsHeaders) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getUsernameByToken(env, token) {
    if (!token) return null;
    return await env.SUBSCRIPT_DB.get(`s:${token}`);
}