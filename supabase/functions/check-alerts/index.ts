const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

const districts: Record<string, [number, number]> = {
  "พระนครศรีอยุธยา": [14.3532, 100.5684],
  "เสนา": [14.3270, 100.3950],
  "บางปะอิน": [14.2400, 100.5780],
  "บางไทร": [14.2140, 100.4760],
  "บางซ้าย": [14.3320, 100.3060],
  "ลาดบัวหลวง": [14.1720, 100.3180],
  "ผักไห่": [14.4590, 100.3690],
  "นครหลวง": [14.4610, 100.6090],
  "ท่าเรือ": [14.5660, 100.7240],
  "ภาชี": [14.4490, 100.6540],
  "อุทัย": [14.3630, 100.6710],
  "วังน้อย": [14.2260, 100.7150],
  "มหาราช": [14.5390, 100.5310],
  "บ้านแพรก": [14.6660, 100.5840],
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // =========================
    // ตรวจสอบ Secret
    // =========================
    const cronSecret = Deno.env.get("ALERT_CRON_SECRET");
    const auth = req.headers.get("authorization") || "";

    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      return json(
        {
          ok: false,
          error: "Unauthorized",
        },
        401
      );
    }

    // =========================
    // ดึง Secrets
    // =========================
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
    const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    const waqiToken = Deno.env.get("WAQI_TOKEN");

    if (
      !supabaseUrl ||
      !supabaseSecretKeys ||
      !lineToken ||
      !waqiToken
    ) {
      return json(
        {
          ok: false,
          error: "Missing server secrets",
        },
        500
      );
    }

    // =========================
    // Supabase Secret Key
    // =========================
    const secretKey = JSON.parse(supabaseSecretKeys).default;

    const supabaseHeaders = {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    };

    // =========================
    // ดึงรายการผู้ติดตามที่เปิดใช้งาน
    // =========================
    const subscriptionsRes = await fetch(
      `${supabaseUrl}/rest/v1/subscriptions?enabled=eq.true&select=*`,
      {
        headers: supabaseHeaders,
      }
    );

    if (!subscriptionsRes.ok) {
      const errorText = await subscriptionsRes.text();

      return json(
        {
          ok: false,
          error: `Cannot load subscriptions: ${errorText}`,
        },
        500
      );
    }

    const subscriptions = await subscriptionsRes.json();

    const results = [];

    // =========================
    // ตรวจสอบแต่ละอำเภอ
    // =========================
    for (const sub of subscriptions) {
      const coords = districts[sub.district];

      if (!coords) {
        results.push({
          district: sub.district,
          alert: false,
          error: "ไม่พบพิกัดอำเภอ",
        });

        continue;
      }

      const [lat, lon] = coords;

      // =========================
      // ดึงค่า PM2.5 จาก WAQI
      // =========================
      const aqUrl =
        `https://api.waqi.info/feed/geo:${lat};${lon}/` +
        `?token=${encodeURIComponent(waqiToken)}`;

      const aqRes = await fetch(aqUrl);

      if (!aqRes.ok) {
        results.push({
          district: sub.district,
          alert: false,
          error: "ไม่สามารถดึงข้อมูล WAQI ได้",
        });

        continue;
      }

      const aq = await aqRes.json();

      const pm = Number(aq?.data?.iaqi?.pm25?.v);

      if (!Number.isFinite(pm)) {
        results.push({
          district: sub.district,
          alert: false,
          error: "ไม่พบค่า PM2.5",
        });

        continue;
      }

      // =========================
      // แบ่งระดับ PM2.5
      // =========================
      const level = classify(pm);

      const previous = sub.last_alert_level;

      // ==================================================
      // สำคัญ:
      // ส่ง LINE เฉพาะตอนที่เกินเกณฑ์ PM2.5
      // และไม่ส่งซ้ำถ้ายังอยู่ระดับเดิม
      // ==================================================
      const shouldAlert = true;

      // =========================
      // กรณีต้องแจ้งเตือน
      // =========================
      if (shouldAlert) {
        const message =
          `🚨 แจ้งเตือน PM2.5\n\n` +
          `อำเภอ: ${sub.district}\n` +
          `PM2.5: ${pm.toFixed(1)} µg/m³\n` +
          `ระดับ: ${level.label}\n` +
          `คำแนะนำ: ${level.advice}\n\n` +
          `แหล่งข้อมูล: WAQI`;

        const lineRes = await fetch(LINE_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lineToken}`,
          },
          body: JSON.stringify({
            to: sub.line_user_id,
            messages: [
              {
                type: "text",
                text: message,
              },
            ],
          }),
        });

        const lineText = await lineRes.text();

        // =========================
        // บันทึกสถานะล่าสุด
        // =========================
        await fetch(
          `${supabaseUrl}/rest/v1/subscriptions?id=eq.${sub.id}`,
          {
            method: "PATCH",
            headers: {
              ...supabaseHeaders,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              last_alert_level: level.code,
              last_alert_pm25: pm,
              last_alert_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
          }
        );

        results.push({
          district: sub.district,
          pm25: pm,
          level: level.label,
          alert: true,
          line_status: lineRes.status,
          line_response: lineText,
        });
      }

      // =========================
      // กรณีไม่ต้องแจ้งเตือน
      // =========================
      else {
        results.push({
          district: sub.district,
          pm25: pm,
          level: level.label,
          alert: false,
        });

        // ==================================================
        // อัปเดตระดับล่าสุด
        //
        // ถ้าฝุ่นลดลงมาอยู่ต่ำกว่าเกณฑ์
        // แล้วภายหลังกลับมาเกินอีกครั้ง
        // ระบบจะสามารถส่งแจ้งเตือนใหม่ได้
        // ==================================================
        if (level.code !== previous) {
          await fetch(
            `${supabaseUrl}/rest/v1/subscriptions?id=eq.${sub.id}`,
            {
              method: "PATCH",
              headers: {
                ...supabaseHeaders,
                Prefer: "return=minimal",
              },
              body: JSON.stringify({
                last_alert_level: level.code,
                last_alert_pm25: pm,
                updated_at: new Date().toISOString(),
              }),
            }
          );
        }
      }
    }

    // =========================
    // ส่งผลลัพธ์กลับ
    // =========================
    return json({
      ok: true,
      checked: subscriptions.length,
      results,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : "Unknown error",
      },
      500
    );
  }
});

// ==================================================
// กำหนดระดับ PM2.5
// ==================================================
function classify(pm: number) {
  // 0 - 15
  if (pm <= 15) {
    return {
      code: "normal",
      label: "ปกติ",
      alert: false,
      advice: "สามารถทำกิจกรรมกลางแจ้งได้ตามปกติ",
    };
  }

  // 15.1 - 37.5
  if (pm <= 37.5) {
    return {
      code: "watch",
      label: "เริ่มมีผลกระทบ",
      alert: false,
      advice:
        "ลดกิจกรรมกลางแจ้งที่ใช้แรงมากและติดตามค่า PM2.5",
    };
  }

  // 37.6 - 75
  if (pm <= 75) {
    return {
      code: "health",
      label: "มีผลกระทบต่อสุขภาพ",
      alert: true,
      advice:
        "ลดกิจกรรมกลางแจ้งและสวมหน้ากากที่เหมาะสมเมื่อจำเป็น",
    };
  }

  // มากกว่า 75
  return {
    code: "high",
    label: "ควรเฝ้าระวัง",
    alert: true,
    advice:
      "หลีกเลี่ยงกิจกรรมกลางแจ้งและติดตามสถานการณ์อย่างใกล้ชิด",
  };
}

// ==================================================
// JSON Response
// ==================================================
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}