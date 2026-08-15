import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const INPUT_COST_PER_TOKEN = 3.0 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15.0 / 1_000_000;

function extractJSON(raw: string): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* continue */ }
  // Strip markdown code fences
  const stripped = raw.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").trim();
  try { return JSON.parse(stripped); } catch { /* continue */ }
  // Extract first JSON object
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch { /* continue */ } }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );

  let jobId = "";

  try {
    const body = await req.json();
    jobId = body.job_id ?? "";

    if (!jobId) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    await supabase.from("good_news_jobs")
      .update({ status: "running", progress: 5, started_at: new Date().toISOString() })
      .eq("id", jobId);

    const [{ data: profile }, { data: visions }] = await Promise.all([
      supabase.from("user_profiles").select("full_name, profession").eq("id", userId).maybeSingle(),
      supabase.from("visions").select("id, vision_name").eq("user_id", userId).eq("status", "active").order("vision_order"),
    ]);

    if (!profile || !visions || visions.length === 0) {
      await supabase.from("good_news_jobs")
        .update({ status: "done", progress: 100, completed_at: new Date().toISOString() })
        .eq("id", jobId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("good_news_jobs").update({ progress: 20 }).eq("id", jobId);

    const challengeResults = await Promise.all(
      visions.map((v: { id: string }) =>
        supabase.from("vision_challenges").select("challenge_text").eq("vision_id", v.id).limit(3)
      )
    );
    const allChallenges = challengeResults
      .flatMap((r) => (r.data ?? []).map((c: { challenge_text: string }) => c.challenge_text))
      .slice(0, 8)
      .join("; ");

    await supabase.from("good_news_jobs").update({ progress: 35 }).eq("id", jobId);

    const { data: promptRow } = await supabase
      .from("prompt_library")
      .select("prompt_text")
      .eq("prompt_key", "good_news_full_page")
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!promptRow) {
      await supabase.from("good_news_jobs").update({ status: "failed", progress: 0 }).eq("id", jobId);
      return new Response(JSON.stringify({ error: "Prompt not found" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let promptText = promptRow.prompt_text as string;
    promptText = promptText
      .replaceAll("{{name}}", profile.full_name ?? "")
      .replaceAll("{{profession}}", profile.profession ?? "")
      .replaceAll("{{location}}", "")
      .replaceAll("{{all_visions}}", visions.map((v: { vision_name: string }) => v.vision_name).join(", "))
      .replaceAll("{{all_challenges}}", allChallenges)
      .replaceAll("{{ed_agent_insight}}", "");

    await supabase.from("good_news_jobs").update({ progress: 50 }).eq("id", jobId);

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: promptText }],
    });

    await supabase.from("good_news_jobs").update({ progress: 85 }).eq("id", jobId);

    // Track cost
    const inputTokens = msg.usage.input_tokens;
    const outputTokens = msg.usage.output_tokens;
    const costUsd = (inputTokens * INPUT_COST_PER_TOKEN) + (outputTokens * OUTPUT_COST_PER_TOKEN);
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    serviceSupabase.from("llm_usage_log").insert({
      user_id: userId,
      prompt_key: "good_news_full_page",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
    }).then(() => serviceSupabase.rpc("deduct_credit", { p_user_id: userId, p_cost: costUsd }))
      .catch(() => {});

    const rawText = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const parsed = extractJSON(rawText);

    let visionSections: unknown[] = [];
    if (Array.isArray(parsed)) {
      visionSections = parsed;
    } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).vision_sections)) {
      visionSections = (parsed as Record<string, unknown>).vision_sections as unknown[];
    }

    await supabase.from("good_news_cache").upsert({
      user_id: userId,
      vision_id: visions[0].id,
      news_data: visionSections,
      stories_data: [],
      generated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    await supabase.from("good_news_jobs")
      .update({ status: "done", progress: 100, completed_at: new Date().toISOString() })
      .eq("id", jobId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (jobId) {
      await supabase.from("good_news_jobs")
        .update({ status: "failed", progress: 0 })
        .eq("id", jobId)
        .catch(() => {});
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
