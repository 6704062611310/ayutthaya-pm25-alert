import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();

    console.log("LINE webhook:", JSON.stringify(body));

    const events = body.events ?? [];

    for (const event of events) {
      if (event.type !== "message") continue;
      if (event.message?.type !== "text") continue;

      const userText = event.message.text.trim().toLowerCase();

      if (userText !== "pm25") continue;

      const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");

      if (!token) {
        console.error("LINE_CHANNEL_ACCESS_TOKEN is missing");
        continue;
      }

      // พิกัดอยุธยา
      const lat = 14.3532;
      const lon = 100.5689;

      const pm25Url =
        `https://lzdfagvrobxfteilppxq.supabase.co/functions/v1/pm25` +
        `?lat=${lat}&lon=${lon}&district=พระนครศรีอยุธยา`;

      const pm25Response = await fetch(pm25Url);
      const pm25Data = await pm25Response.json();

      console.log("PM2.5:", JSON.stringify(pm25Data));

      let message = "";

      if (!pm25Data.ok) {
        message =
          `❌ ไม่สามารถดึงข้อมูล PM2.5 ได้\n\n` +
          `${pm25Data.error ?? "เกิดข้อผิดพลาด"}`;
      } else {
        message =
          `🌫️ รายงาน PM2.5\n\n` +
          `📍 อำเภอ: ${pm25Data.district}\n` +
          `💨 PM2.5: ${pm25Data.pm25} µg/m³\n` +
          `📊 สถานะ: ${pm25Data.status}\n\n` +
          `🏫 สถานี: ${pm25Data.station ?? "-"}\n` +
          `🕐 เวลา: ${pm25Data.measured_at ?? "-"}`;
      }

      const replyResponse = await fetch(
        "https://api.line.me/v2/bot/message/reply",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: message,
              },
            ],
          }),
        }
      );

      const replyText = await replyResponse.text();

      console.log(
        "LINE reply:",
        replyResponse.status,
        replyText
      );
    }

    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Webhook error:", error);

    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
    });
  }
});