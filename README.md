# ระบบแจ้งเตือนค่าฝุ่น PM2.5 รายอำเภอ

โปรเจกต์ต้นแบบสำหรับจังหวัดพระนครศรีอยุธยา มีหน้าเว็บเลือกอำเภอ ตรวจค่า PM2.5 จริง และบันทึกผู้ติดตามลง Supabase พร้อมระบบตรวจสอบ/ส่ง LINE อัตโนมัติ

## โครงสร้าง

- `index.html` / `style.css` / `app.js` — หน้าเว็บ
- `supabase/schema.sql` — ตาราง `subscriptions` และ RLS
- `supabase/functions/pm25` — ตัวกลางเรียก WAQI API
- `supabase/functions/check-alerts` — ตรวจผู้ติดตามและส่ง LINE
- `.github/workflows/pm25-alert.yml` — เรียกระบบแจ้งเตือนทุกชั่วโมง

## 1) สร้าง Supabase

1. สร้างโปรเจกต์ Supabase
2. เปิด SQL Editor แล้วรัน `supabase/schema.sql`
3. Deploy Edge Functions `pm25` และ `check-alerts`

Supabase แนะนำให้เก็บ secret ของ Edge Functions ไว้ใน Secrets ไม่ใส่ในหน้าเว็บ

## 2) ตั้งค่า Secrets

ตั้งค่าอย่างน้อย:

- `WAQI_TOKEN` — token จาก WAQI
- `LINE_CHANNEL_ACCESS_TOKEN` — LINE Messaging API Channel access token
- `ALERT_CRON_SECRET` — รหัสลับสำหรับ GitHub Actions เรียกฟังก์ชันแจ้งเตือน

## 3) ตั้งค่า app.js

แก้:

```js
const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";
```

ใช้ publishable key ฝั่งเว็บเท่านั้น ห้ามเอา secret key/service role key ใส่ใน `app.js`

## 4) GitHub Actions

ตั้ง Repository Secrets:

- `SUPABASE_ALERT_FUNCTION_URL`
  - `https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-alerts`
- `ALERT_CRON_SECRET`
  - ต้องตรงกับ Supabase Secret

Workflow จะเรียกตรวจประมาณชั่วโมงละครั้ง

## 5) LINE

LINE Messaging API ใช้ endpoint push message เพื่อส่งข้อความไปยัง LINE User ID

ผู้ใช้ต้องเพิ่ม LINE Official Account เป็นเพื่อนก่อนจึงจะรับ push message ได้ตามเงื่อนไขของ LINE

## 6) Deploy หน้าเว็บ

Push โปรเจกต์ขึ้น GitHub แล้วเปิด Settings → Pages → Deploy from branch

จากนั้นใช้ URL GitHub Pages เป็นหน้าเว็บของระบบ

## หมายเหตุสำคัญ

1. พิกัดใน `app.js` และ `check-alerts/index.ts` เป็นจุดตัวแทนของแต่ละอำเภอเพื่อค้นหาสถานีวัดใกล้เคียง ไม่ได้หมายความว่ามีสถานีอยู่ตรงจุดนั้น
2. เกณฑ์ PM2.5 ในโค้ดเป็น "ตัวอย่างของระบบต้นแบบ" ต้องเปลี่ยนให้ตรงกับเกณฑ์ที่อาจารย์หรือหน่วยงานกำหนดก่อนส่งจริง
3. การรับ LINE User ID จาก input เป็นวิธีทำต้นแบบที่ง่ายที่สุด ระบบจริงควรใช้ LIFF/LINE Login เพื่อผูกตัวตนผู้ใช้โดยตรง
4. WAQI ระบุว่าการใช้ JSON API ต้องมี token และมีเงื่อนไขการใช้งาน/การแสดง attribution ควรอ่านเงื่อนไขล่าสุดก่อนเผยแพร่ระบบสาธารณะ
