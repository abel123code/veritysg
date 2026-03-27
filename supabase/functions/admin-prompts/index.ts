import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json();
    const { action, password } = body;

    const adminPassword = Deno.env.get('ADMIN_PASSWORD');
    if (!adminPassword) return json({ success: false, error: 'Admin password not configured' }, 500);

    if (action === 'verify') return json({ verified: password === adminPassword });

    // Public-read actions (no password needed)
    if (action === 'get_room_images') {
      const { data, error } = await supabase.from('room_images').select('*');
      if (error) throw error;
      return json({ success: true, data });
    }
    if (action === 'get_public_settings') {
      const { data, error } = await supabase.from('tool_settings').select('*');
      if (error) throw error;
      return json({ success: true, data });
    }
    if (action === 'get_guide_content') {
      const [tactics, regulations, glossary] = await Promise.all([
        supabase.from('guide_tactics').select('*').order('sort_order'),
        supabase.from('guide_regulations').select('*').order('sort_order'),
        supabase.from('guide_glossary').select('*').order('sort_order'),
      ]);
      if (tactics.error) throw tactics.error;
      if (regulations.error) throw regulations.error;
      if (glossary.error) throw glossary.error;
      return json({ success: true, tactics: tactics.data, regulations: regulations.data, glossary: glossary.data });
    }

    // All other actions require valid password
    if (password !== adminPassword) return json({ success: false, error: 'Invalid password' }, 401);

    // --- Prompts ---
    if (action === 'list') {
      const { data, error } = await supabase.from('system_prompts').select('*').order('key');
      if (error) throw error;
      return json({ success: true, data });
    }
    if (action === 'update') {
      const { key, prompt, model, label } = body;
      if (!key) return json({ success: false, error: 'Key is required' }, 400);
      const updates: Record<string, string> = { updated_at: new Date().toISOString() };
      if (prompt !== undefined) updates.prompt = prompt;
      if (model !== undefined) updates.model = model;
      if (label !== undefined) updates.label = label;
      const { error } = await supabase.from('system_prompts').update(updates).eq('key', key);
      if (error) throw error;
      return json({ success: true });
    }

    // --- Hotspots ---
    if (action === 'list_hotspots') {
      const { data, error } = await supabase.from('room_hotspots').select('*').order('sort_order');
      if (error) throw error;
      return json({ success: true, data });
    }
    if (action === 'upsert_hotspot') {
      const { id, room_key, x_percent, y_percent, title, description, sort_order, tactics_label, mobile_x_percent, mobile_y_percent } = body;
      if (!room_key) return json({ success: false, error: 'room_key is required' }, 400);
      const row: Record<string, unknown> = { room_key, x_percent: x_percent ?? 50, y_percent: y_percent ?? 50, title: title ?? '', description: description ?? '', sort_order: sort_order ?? 0, tactics_label: tactics_label ?? '' };
      if (mobile_x_percent !== undefined) row.mobile_x_percent = mobile_x_percent;
      if (mobile_y_percent !== undefined) row.mobile_y_percent = mobile_y_percent;
      if (id) {
        const { error } = await supabase.from('room_hotspots').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('room_hotspots').insert(row);
        if (error) throw error;
      }
      return json({ success: true });
    }
    if (action === 'delete_hotspot') {
      const { id } = body;
      if (!id) return json({ success: false, error: 'id is required' }, 400);
      const { error } = await supabase.from('room_hotspots').delete().eq('id', id);
      if (error) throw error;
      return json({ success: true });
    }

    // --- Room Images ---
    if (action === 'upsert_room_image') {
      const { room_key, image_url, title, tactics_label, mobile_image_url } = body;
      if (!room_key) return json({ success: false, error: 'room_key is required' }, 400);
      const row: Record<string, unknown> = { room_key, updated_at: new Date().toISOString() };
      if (image_url !== undefined) row.image_url = image_url;
      if (title !== undefined) row.title = title;
      if (tactics_label !== undefined) row.tactics_label = tactics_label;
      if (mobile_image_url !== undefined) row.mobile_image_url = mobile_image_url;
      const { error } = await supabase.from('room_images').upsert(row, { onConflict: 'room_key' });
      if (error) throw error;
      return json({ success: true });
    }

    // --- Guide Tactics ---
    if (action === 'upsert_tactic') {
      const { id, phase, question, answer, sort_order } = body;
      if (!phase) return json({ success: false, error: 'phase is required' }, 400);
      const row = { phase, question: question ?? '', answer: answer ?? '', sort_order: sort_order ?? 0 };
      if (id) {
        const { error } = await supabase.from('guide_tactics').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('guide_tactics').insert(row);
        if (error) throw error;
      }
      return json({ success: true });
    }
    if (action === 'delete_tactic') {
      const { id } = body;
      if (!id) return json({ success: false, error: 'id is required' }, 400);
      const { error } = await supabase.from('guide_tactics').delete().eq('id', id);
      if (error) throw error;
      return json({ success: true });
    }

    // --- Guide Regulations ---
    if (action === 'upsert_regulation') {
      const { id, title, content, sort_order } = body;
      if (!title) return json({ success: false, error: 'title is required' }, 400);
      const row = { title, content: content ?? '', sort_order: sort_order ?? 0 };
      if (id) {
        const { error } = await supabase.from('guide_regulations').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('guide_regulations').insert(row);
        if (error) throw error;
      }
      return json({ success: true });
    }
    if (action === 'delete_regulation') {
      const { id } = body;
      if (!id) return json({ success: false, error: 'id is required' }, 400);
      const { error } = await supabase.from('guide_regulations').delete().eq('id', id);
      if (error) throw error;
      return json({ success: true });
    }

    // --- Guide Glossary ---
    if (action === 'upsert_glossary') {
      const { id, term, definition, sort_order } = body;
      if (!term) return json({ success: false, error: 'term is required' }, 400);
      const row = { term, definition: definition ?? '', sort_order: sort_order ?? 0 };
      if (id) {
        const { error } = await supabase.from('guide_glossary').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('guide_glossary').insert(row);
        if (error) throw error;
      }
      return json({ success: true });
    }
    if (action === 'delete_glossary') {
      const { id } = body;
      if (!id) return json({ success: false, error: 'id is required' }, 400);
      const { error } = await supabase.from('guide_glossary').delete().eq('id', id);
      if (error) throw error;
      return json({ success: true });
    }

    // --- Tool Settings ---
    if (action === 'get_settings') {
      const { data, error } = await supabase.from('tool_settings').select('*');
      if (error) throw error;
      return json({ success: true, data });
    }
    if (action === 'upsert_setting') {
      const { key: settingKey, value: settingValue } = body;
      if (!settingKey) return json({ success: false, error: 'key is required' }, 400);
      const { error } = await supabase.from('tool_settings').upsert(
        { key: settingKey, value: settingValue, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      return json({ success: true });
    }

    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('Error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
