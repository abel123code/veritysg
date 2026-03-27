const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

let cachedToken: { token: string; expiry: number } | null = null;

async function getAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiry) {
    return cachedToken.token;
  }

  const email = Deno.env.get('ONEMAP_EMAIL');
  const password = Deno.env.get('ONEMAP_EMAIL_PASSWORD');

  if (!email || !password) {
    throw new Error('OneMap credentials not configured');
  }

  const res = await fetch('https://www.onemap.gov.sg/api/auth/post/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`OneMap auth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiry: Date.now() + 3 * 24 * 60 * 60 * 1000,
  };

  return cachedToken.token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, lat, lng, searchVal, postalCode } = body;
    const token = await getAuthToken();

    let result;

    if (action === 'reverseGeocode') {
      if (!lat || !lng) {
        return new Response(
          JSON.stringify({ success: false, error: 'lat and lng required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const url = `https://www.onemap.gov.sg/api/public/revgeocode?location=${lat},${lng}&buffer=200&addressType=All`;
      const res = await fetch(url, {
        headers: { Authorization: token },
      });

      if (!res.ok) throw new Error(`Reverse geocode failed: ${res.status}`);
      result = await res.json();

    } else if (action === 'search') {
      if (!searchVal) {
        return new Response(
          JSON.stringify({ success: false, error: 'searchVal required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(searchVal)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
      const res = await fetch(url, {
        headers: { Authorization: token },
      });

      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      result = await res.json();

    } else if (action === 'getPlanningArea') {
      // Resolve a lat/lng to a planning area name (used for HDB town matching)
      if (!lat || !lng) {
        return new Response(
          JSON.stringify({ success: false, error: 'lat and lng required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const url = `https://www.onemap.gov.sg/api/public/popapi/getPlanningarea?latitude=${lat}&longitude=${lng}`;
      const res = await fetch(url, {
        headers: { Authorization: token },
      });

      if (!res.ok) throw new Error(`Planning area lookup failed: ${res.status}`);
      const data = await res.json();

      // The API returns an array; extract the planning area name
      const planningArea = data?.[0]?.pln_area_n || data?.pln_area_n || null;
      result = { planningArea: planningArea ? planningArea.toUpperCase() : null };

    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action. Use "reverseGeocode", "search", or "getPlanningArea"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('OneMap error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Request failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
