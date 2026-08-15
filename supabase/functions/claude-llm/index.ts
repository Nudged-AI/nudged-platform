import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// claude-haiku-4-5 pricing
const INPUT_COST_PER_TOKEN = 1.0 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 5.0 / 1_000_000;
const MODEL = "claude-haiku-4-5-20251001";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prompt_key, variables, file_contents, _test } = body as {
      prompt_key: string;
      variables: Record<string, string>;
      file_contents?: { media_type: string; data: string; filename?: string }[];
      _test?: boolean;
    };

    if (_test) {
      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 20,
        messages: [{ role: "user", content: "Reply with only: OK" }],
      });
      const text = msg.content[0].type === "text" ? msg.content[0].text : "";
      return new Response(JSON.stringify({ status: "ok", response: text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!prompt_key) {
      return new Response(JSON.stringify({ error: "prompt_key required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check / auto-create credit row
    let { data: creditRow } = await serviceSupabase
      .from("user_credits")
      .select("balance_usd, is_exempt")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!creditRow) {
      const { data: inserted } = await serviceSupabase
        .from("user_credits")
        .insert({
          user_id: user.id,
          balance_usd: 5.0,
          total_granted_usd: 5.0,
          is_exempt: user.email === "deepagster@gmail.com",
        })
        .select("balance_usd, is_exempt")
        .single();
      creditRow = inserted;
    }

    if (creditRow && !creditRow.is_exempt && creditRow.balance_usd <= 0) {
      return new Response(
        JSON.stringify({ error: "credit_exhausted", message: "Your AI credit balance is exhausted. Please request a top-up from your Profile page." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: promptRow } = await userSupabase
      .from("prompt_library")
      .select("prompt_text")
      .eq("prompt_key", prompt_key)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!promptRow) {
      return new Response(JSON.stringify({ error: "Prompt not found: " + prompt_key }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let promptText = promptRow.prompt_text as string;
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        const v = value ?? "";
        promptText = promptText.replaceAll(`{{${key}}}`, v).replaceAll(`{${key}}`, v);
      }
    }

    // Build message content: text prompt + optional file attachments (PDF/image)
    const messageContent: any[] = [{ type: "text", text: promptText }];
    if (file_contents && file_contents.length > 0) {
      for (const f of file_contents) {
        const isPdf = f.media_type === "application/pdf";
        const isImage = ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(f.media_type);
        if (isPdf) {
          messageContent.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: f.data },
          });
        } else if (isImage) {
          messageContent.push({
            type: "image",
            source: { type: "base64", media_type: f.media_type, data: f.data },
          });
        }
      }
    }

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: messageContent }],
    });

    const content = message.content[0];
    const text = content.type === "text" ? content.text : "";

    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const costUsd = (inputTokens * INPUT_COST_PER_TOKEN) + (outputTokens * OUTPUT_COST_PER_TOKEN);

    // Log usage and deduct (fire and forget — don't block response)
    Promise.all([
      serviceSupabase.from("llm_usage_log").insert({
        user_id: user.id,
        prompt_key,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
      }),
      !creditRow?.is_exempt
        ? serviceSupabase.rpc("deduct_credit", { p_user_id: user.id, p_cost: costUsd })
        : Promise.resolve(),
    ]).catch(() => {});

    return new Response(JSON.stringify({ result: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
