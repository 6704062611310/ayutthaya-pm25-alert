const SUPABASE_URL =
  "https://lzdfagvrobxfteilppxq.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_e2ThRWHJ7BxZjgsq6cCCBQ_7tJW3f8M";

const PM25_FUNCTION =
  `${SUPABASE_URL}/functions/v1/pm25`;

// =====================================
// ใส่ LIFF ID ของเรา
// =====================================
const LIFF_ID = "ใส่-LIFF-ID-ตรงนี้";

// =====================================
// รายการอำเภอ
// =====================================
const districts = [
  ["พระนครศรีอยุธยา", 14.3532, 100.5684],
  ["เสนา", 14.3270, 100.3950],
  ["บางปะอิน", 14.2400, 100.5780],
  ["บางไทร", 14.2140, 100.4760],
  ["บางซ้าย", 14.3320, 100.3060],
  ["ลาดบัวหลวง", 14.1720, 100.3180],
  ["ผักไห่", 14.4590, 100.3690],
  ["นครหลวง", 14.4610, 100.6090],
  ["ท่าเรือ", 14.5660, 100.7240],
  ["ภาชี", 14.4490, 100.6540],
  ["อุทัย", 14.3630, 100.6710],
  ["วังน้อย", 14.2260, 100.7150],
  ["มหาราช", 14.5390, 100.5310],
  ["บ้านแพรก", 14.6660, 100.5840]
];

const districtEl =
  document.querySelector("#district");

const checkBtn =
  document.querySelector("#checkBtn");

const followBtn =
  document.querySelector("#followBtn");

const lineUserIdEl =
  document.querySelector("#lineUserId");

const resultEl =
  document.querySelector("#result");

const errorEl =
  document.querySelector("#error");

const followStatusEl =
  document.querySelector("#followStatus");

const subscriptionListEl =
  document.querySelector("#subscriptionList");

// =====================================
// LINE User ID ปัจจุบัน
// =====================================
let currentLineUserId = null;

let supabaseClient = null;

// =====================================
// สร้าง Supabase Client
// =====================================
function getSupabase() {
  if (!supabaseClient) {
    if (!window.supabase) {
      throw new Error(
        "ไม่พบ Supabase JavaScript library"
      );
    }

    supabaseClient =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      );
  }

  return supabaseClient;
}

// =====================================
// สร้างรายการอำเภอ
// =====================================
districts.forEach(([name]) => {
  const option =
    document.createElement("option");

  option.value = name;
  option.textContent = name;

  districtEl.appendChild(option);
});

// =====================================
// หาอำเภอที่เลือก
// =====================================
function selectedDistrict() {
  return districts.find(
    d => d[0] === districtEl.value
  );
}

// =====================================
// แบ่งระดับ PM2.5
// =====================================
function classify(pm) {
  if (pm <= 15) {
    return [
      "ปกติ",
      "ปกติ",
      "สามารถทำกิจกรรมกลางแจ้งได้ตามปกติ"
    ];
  }

  if (pm <= 37.5) {
    return [
      "เริ่มมีผลกระทบ",
      "เริ่มมีผลกระทบ",
      "ลดกิจกรรมกลางแจ้งที่ใช้แรงมากและติดตามค่า PM2.5"
    ];
  }

  if (pm <= 75) {
    return [
      "มีผลกระทบต่อสุขภาพ",
      "มีผลกระทบต่อสุขภาพ",
      "ลดกิจกรรมกลางแจ้งและสวมหน้ากากที่เหมาะสมเมื่อจำเป็น"
    ];
  }

  return [
    "ควรเฝ้าระวัง",
    "ควรเฝ้าระวัง",
    "หลีกเลี่ยงกิจกรรมกลางแจ้งและติดตามสถานการณ์อย่างใกล้ชิด"
  ];
}

// =====================================
// แสดง Error
// =====================================
function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

// =====================================
// ล้าง Error
// =====================================
function clearError() {
  errorEl.classList.add("hidden");
  errorEl.textContent = "";
}

// =====================================
// ตั้งค่า LINE User ID ในหน้าเว็บ
// =====================================
function setLineUserId(userId) {
  currentLineUserId = userId;

  if (lineUserIdEl) {
    lineUserIdEl.value = userId;

    // ไม่ให้ผู้ใช้แก้ User ID เอง
    lineUserIdEl.readOnly = true;
  }
}

// =====================================
// LINE Login / LIFF
// =====================================
async function initLINE() {
  clearError();

  if (!LIFF_ID || LIFF_ID === "ใส่-LIFF-ID-ตรงนี้") {
    showError(
      "ยังไม่ได้ตั้งค่า LIFF ID"
    );

    return false;
  }

  if (!window.liff) {
    showError(
      "ไม่พบ LINE LIFF SDK กรุณาตรวจสอบไฟล์ HTML"
    );

    return false;
  }

  try {
    await liff.init({
      liffId: LIFF_ID
    });

    // ถ้ายังไม่ได้ Login
    if (!liff.isLoggedIn()) {
      return false;
    }

    // ขอข้อมูล Profile
    const profile =
      await liff.getProfile();

    if (!profile || !profile.userId) {
      throw new Error(
        "ไม่สามารถอ่าน LINE User ID ได้"
      );
    }

    setLineUserId(profile.userId);

    // โหลดรายการอำเภอที่ติดตาม
    const supabase = getSupabase();

    await loadSubscriptions(
      supabase,
      profile.userId
    );

    return true;

  } catch (err) {
    console.error(
      "LINE init error:",
      err
    );

    showError(
      "ไม่สามารถเชื่อมต่อ LINE ได้: " +
      (err.message || "เกิดข้อผิดพลาด")
    );

    return false;
  }
}

// =====================================
// Login LINE
// =====================================
async function loginLINE() {
  clearError();

  if (!LIFF_ID || LIFF_ID === "ใส่-LIFF-ID-ตรงนี้") {
    showError(
      "ยังไม่ได้ตั้งค่า LIFF ID"
    );

    return false;
  }

  if (!window.liff) {
    showError(
      "ไม่พบ LINE LIFF SDK"
    );

    return false;
  }

  try {
    await liff.init({
      liffId: LIFF_ID
    });

    if (!liff.isLoggedIn()) {
      liff.login();
      return false;
    }

    const profile =
      await liff.getProfile();

    if (!profile || !profile.userId) {
      throw new Error(
        "ไม่สามารถอ่าน LINE User ID ได้"
      );
    }

    setLineUserId(profile.userId);

    return true;

  } catch (err) {
    console.error(
      "LINE Login error:",
      err
    );

    showError(
      "เข้าสู่ระบบ LINE ไม่สำเร็จ: " +
      (err.message || "เกิดข้อผิดพลาด")
    );

    return false;
  }
}

// =====================================
// ตรวจสอบ PM2.5
// =====================================
async function getPM25() {
  clearError();

  const districtData =
    selectedDistrict();

  if (!districtData) {
    showError(
      "กรุณาเลือกอำเภอก่อน"
    );

    return;
  }

  const [name, lat, lon] =
    districtData;

  checkBtn.disabled = true;
  checkBtn.textContent =
    "กำลังโหลด...";

  try {
    const params =
      new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        district: name
      });

    const url =
      `${PM25_FUNCTION}?${params.toString()}`;

    console.log(
      "PM2.5 Request:",
      url
    );

    const response =
      await fetch(url);

    const data =
      await response.json();

    console.log(
      "PM2.5 Response:",
      data
    );

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "ไม่สามารถอ่านข้อมูล PM2.5 ได้"
      );
    }

    const pm =
      Number(data.pm25);

    if (!Number.isFinite(pm)) {
      throw new Error(
        "ข้อมูล PM2.5 ไม่ถูกต้อง"
      );
    }

    const [, risk, advice] =
      classify(pm);

    document.querySelector(
      "#districtName"
    ).textContent = name;

    document.querySelector(
      "#pm25"
    ).textContent = pm.toFixed(1);

    document.querySelector(
      "#risk"
    ).textContent = risk;

    document.querySelector(
      "#advice"
    ).textContent = advice;

    document.querySelector(
      "#levelPill"
    ).textContent =
      data.aqi
        ? `AQI ${data.aqi}`
        : risk;

    document.querySelector(
      "#source"
    ).textContent =
      `แหล่งข้อมูล: WAQI / ${
        data.station ||
        "สถานีใกล้เคียง"
      } • อัปเดต ${
        data.updated ||
        data.measured_at ||
        data.time ||
        "-"
      }`;

    resultEl.classList.remove(
      "hidden"
    );

  } catch (err) {
    console.error(
      "PM2.5 Error:",
      err
    );

    showError(
      err.message ||
      "เกิดข้อผิดพลาดในการอ่านข้อมูล PM2.5"
    );

    resultEl.classList.add(
      "hidden"
    );

  } finally {
    checkBtn.disabled = false;
    checkBtn.textContent =
      "ตรวจสอบ PM2.5";
  }
}

// =====================================
// บันทึกการติดตามอำเภอ
// =====================================
async function saveSubscription() {
  clearError();

  followStatusEl.classList.add(
    "hidden"
  );

  const district =
    districtEl.value;

  if (!district) {
    showError(
      "กรุณาเลือกอำเภอก่อน"
    );

    return;
  }

  // ถ้ายังไม่มี User ID ให้ Login LINE
  if (!currentLineUserId) {
    const loggedIn =
      await loginLINE();

    if (!loggedIn) {
      return;
    }
  }

  const lineUserId =
    currentLineUserId;

  followBtn.disabled = true;
  followBtn.textContent =
    "กำลังบันทึก...";

  try {
    const supabase =
      getSupabase();

    const { error } =
      await supabase
        .from("subscriptions")
        .upsert(
          {
            line_user_id:
              lineUserId,

            district:
              district,

            enabled:
              true
          },
          {
            onConflict:
              "line_user_id,district"
          }
        );

    if (error) {
      throw error;
    }

    followStatusEl.textContent =
      `กำลังติดตามอำเภอ ${district} เรียบร้อยแล้ว`;

    followStatusEl.classList.remove(
      "hidden"
    );

    await loadSubscriptions(
      supabase,
      lineUserId
    );

  } catch (err) {
    console.error(
      "Subscription Error:",
      err
    );

    showError(
      `บันทึกไม่สำเร็จ: ${
        err.message ||
        "เกิดข้อผิดพลาด"
      }`
    );

  } finally {
    followBtn.disabled = false;
    followBtn.textContent =
      "ติดตามอำเภอนี้";
  }
}

// =====================================
// โหลดรายการอำเภอที่ติดตาม
// =====================================
async function loadSubscriptions(
  supabase,
  lineUserId
) {
  if (!lineUserId) {
    subscriptionListEl.textContent =
      "ยังไม่ได้เชื่อมต่อ LINE";

    return;
  }

  const {
    data,
    error
  } = await supabase
    .from("subscriptions")
    .select(
      "district, enabled"
    )
    .eq(
      "line_user_id",
      lineUserId
    )
    .eq(
      "enabled",
      true
    )
    .order("district");

  if (error) {
    console.error(
      "Load subscriptions error:",
      error
    );

    subscriptionListEl.textContent =
      "ไม่สามารถโหลดรายการติดตามได้";

    return;
  }

  if (!data || !data.length) {
    subscriptionListEl.textContent =
      "ยังไม่ได้ติดตามอำเภอใด";

    return;
  }

  subscriptionListEl.innerHTML =
    data
      .map(
        row => `
          <div class="sub-item">
            <span>📍 ${row.district}</span>
            <strong>กำลังติดตาม</strong>
          </div>
        `
      )
      .join("");
}

// =====================================
// Event Listeners
// =====================================
checkBtn.addEventListener(
  "click",
  getPM25
);

followBtn.addEventListener(
  "click",
  saveSubscription
);

// =====================================
// เริ่มต้นระบบ
// =====================================
document.addEventListener(
  "DOMContentLoaded",
  async () => {
    try {
      await initLINE();
    } catch (err) {
      console.error(
        "Startup error:",
        err
      );
    }
  }
);