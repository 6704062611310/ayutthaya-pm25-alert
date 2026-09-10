import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);

    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");
    const district =
      url.searchParams.get("district") || "ไม่ระบุอำเภอ";

    const token = Deno.env.get("WAQI_TOKEN");

    if (!lat || !lon) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "ต้องระบุ lat และ lon",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!token) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "ยังไม่ได้ตั้งค่า WAQI_TOKEN ใน Supabase Secrets",
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

    const apiUrl =
      `https://api.waqi.info/feed/geo:${encodeURIComponent(lat)};${encodeURIComponent(lon)}/?token=${encodeURIComponent(token)}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!response.ok || data.status !== "ok") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: data.data || "WAQI API error",
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

    const pm25 = data?.data?.iaqi?.pm25?.v;

    if (pm25 === undefined || pm25 === null) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "สถานีใกล้เคียงยังไม่มีข้อมูล PM2.5",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const status =
      Number(pm25) <= 15
        ? "ดีมาก"
        : Number(pm25) <= 25
        ? "ดี"
        : Number(pm25) <= 37.5
        ? "ปานกลาง"
        : Number(pm25) <= 75
        ? "เริ่มมีผลกระทบต่อสุขภาพ"
        : "มีผลกระทบต่อสุขภาพ";

    const station = data?.data?.city?.name || null;
    const measuredAt = data?.data?.time?.s || null;

    return new Response(
      JSON.stringify({
        ok: true,
        district,
        pm25: Number(pm25),
        status,
        station,
        measured_at: measuredAt,
        time: measuredAt,
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
        error: "เกิดข้อผิดพลาดในการเรียกข้อมูล PM2.5",
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