import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");

    if (!lineToken) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "ไม่พบ LINE_CHANNEL_ACCESS_TOKEN",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // เรียก Function pm25 ที่เราทำไว้แล้ว
    const pm25Url =
      "https://lzdfagvrobxfteilppxq.supabase.co/functions/v1/pm25" +
      "?lat=14.3532" +
      "&lon=100.5689" +
      "&district=พระนครศรีอยุธยา";

    const pm25Response = await fetch(pm25Url);
    const pm25Data = await pm25Response.json();

    if (!pm25Response.ok || !pm25Data.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: pm25Data.error ?? "ไม่สามารถดึงข้อมูล PM2.5 ได้",
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const pm25 = Number(pm25Data.pm25);

    /*
      ใส่ LINE User ID ของคนที่จะรับแจ้งเตือนตรงนี้
      ตอนแรกใช้ User ID ของเราเพื่อทดสอบก่อน
    */
    const userId = Deno.env.get("LINE_ALERT_USER_ID");

    if (!userId) {
      return new Response(
        JSON.stringify({
          ok: true,
          pm25,
          status: pm25Data.status,
          message:
            "ดึงค่า PM2.5 สำเร็จ แต่ยังไม่ได้ตั้ง LINE_ALERT_USER_ID",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // แจ้งเตือนเมื่อ PM2.5 ตั้งแต่ 37.5 µg/m³ ขึ้นไป
    if (pm25 < 37.5) {
      return new Response(
        JSON.stringify({
          ok: true,
          pm25,
          status: pm25Data.status,
          alert: false,
          message: "ค่า PM2.5 ยังไม่ถึงระดับแจ้งเตือน",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const message =
      `🚨 แจ้งเตือน PM2.5\n\n` +
      `📍 พระนครศรีอยุธยา\n` +
      `💨 PM2.5: ${pm25} µg/m³\n` +
      `📊 สถานะ: ${pm25Data.status}\n\n` +
      `🏫 สถานี: ${pm25Data.station ?? "-"}\n` +
      `🕐 เวลา: ${pm25Data.measured_at ?? "-"}`;

    const lineResponse = await fetch(
      "https://api.line.me/v2/bot/message/push",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lineToken}`,
        },
        body: JSON.stringify({
          to: userId,
          messages: [
            {
              type: "text",
              text: message,
            },
          ],
        }),
      }
    );

    const lineResult = await lineResponse.text();

    if (!lineResponse.ok) {
      console.error("LINE error:", lineResult);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "ส่งข้อความแจ้งเตือนไป LINE ไม่สำเร็จ",
          detail: lineResult,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        pm25,
        status: pm25Data.status,
        alert: true,
        message: "ส่งแจ้งเตือน LINE สำเร็จ",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: "เกิดข้อผิดพลาด",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});