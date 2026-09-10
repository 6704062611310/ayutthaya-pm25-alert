create extension if not exists pgcrypto;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  district text not null,
  enabled boolean not null default true,
  last_alert_level text,
  last_alert_pm25 numeric,
  last_alert_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(line_user_id, district)
);

create index if not exists subscriptions_district_enabled_idx
  on public.subscriptions (district, enabled);

alter table public.subscriptions enable row level security;

-- สำหรับงานส่ง:
-- หน้าเว็บใช้ publishable key จึงอนุญาตให้ผู้ใช้เพิ่ม/ดูรายการของตัวเองตาม
-- line_user_id ที่กรอกเข้ามา (ระบบจริงควรผูก LINE identity ด้วย LIFF/OAuth
-- แทนการรับ ID จาก input ตรง ๆ)
create policy "insert subscriptions"
on public.subscriptions
for insert
to anon, authenticated
with check (true);

create policy "select subscriptions"
on public.subscriptions
for select
to anon, authenticated
using (true);

create policy "update subscriptions"
on public.subscriptions
for update
to anon, authenticated
using (true)
with check (true);