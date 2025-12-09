
export default {
  async fetch(request, env) {
    // Target iFlytek API
    const targetHost = "maas-api.cn-huabei-1.xf-yun.com";
    
    // Handle OPTIONS preflight request explicitly
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    
    const url = new URL(request.url);
    const targetUrl = new URL(request.url);
    targetUrl.hostname = targetHost;
    targetUrl.protocol = "https:";
    
    // Create new request pointing to the real API
    // We recreate the request to avoid passing conflicting headers from the browser
    const newRequest = new Request(targetUrl, {
        method: request.method,
        headers: {
            "Host": targetHost,
            "Content-Type": "application/json"
            // We do NOT pass 'Origin' or 'Referer' to the upstream API to avoid checks
        },
        body: request.body
    });
    
    let response;
    try {
      response = await fetch(newRequest);
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    // Handle CORS: Recreate response with CORS headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    return newResponse;
  }
}
