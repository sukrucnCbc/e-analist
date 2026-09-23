-- e-analist · v0.2 başlangıç şeması
-- Kişisel veri (ad, adres, telefon, e-posta) TUTULMAZ. Müşteri yalnızca tuzlu SHA-256 kodu ile temsil edilir.

create table if not exists uploads (
  id            bigserial primary key,
  file_name     text not null,
  report_type   text not null,          -- sales | orders | distribution | store | ops | ads
  period        text,                   -- 2026-04 vb.
  row_count     int,
  uploaded_at   timestamptz not null default now()
);

create table if not exists products (
  barcode       text primary key,
  model_code    text,
  name          text,
  category      text,
  brand         text,
  color         text,
  size          text,
  current_price numeric,
  current_stock int,
  updated_at    timestamptz not null default now()
);

create table if not exists sales_monthly (
  period            date not null,      -- ayın ilk günü
  barcode           text not null,
  gross_order_qty   int,
  gross_sales_qty   int,
  cancel_qty        int,
  return_qty        int,
  net_sales_qty     int,
  gross_revenue     numeric,
  discount          numeric,
  net_revenue       numeric,
  commission        numeric,
  commission_rate   numeric,
  avg_price         numeric,
  stock             int,
  reasons           jsonb,              -- iptal/iade nedenleri
  primary key (period, barcode)
);

create table if not exists orders (
  package_no      text primary key,
  order_no        text,
  order_at        timestamptz,
  deadline_at     timestamptz,
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  carrier         text,
  status          text,
  city            text,
  district        text,
  customer_hash   text,                 -- sha256(HASH_SALT + ad|il|ilçe)
  customer_nth    text,                 -- Trendyol "Müşteri Sipariş Adedi" etiketi
  age_band        text,
  gender          text,
  gross           numeric,
  discount        numeric,
  ty_discount     numeric,
  net             numeric,
  cargo_fee       numeric,
  desi            numeric,
  commission      numeric,
  fast_delivery   text
);
create index if not exists orders_order_at_idx on orders (order_at);
create index if not exists orders_customer_idx on orders (customer_hash);

create table if not exists order_lines (
  package_no      text not null references orders(package_no) on delete cascade,
  barcode         text not null,
  qty             int,
  unit_price      numeric,
  gross           numeric,
  discount        numeric,
  ty_discount     numeric,
  net             numeric,
  commission_rate numeric,
  primary key (package_no, barcode)
);

create table if not exists distribution (
  period      date not null,
  dimension   text not null,           -- Yaş | Cinsiyet | Gün ve Saat | İl ve İlçe | ...
  bucket      text not null,
  bucket2     text not null default '',
  orders      int,
  customers   int,
  primary key (period, dimension, bucket, bucket2)
);

create table if not exists store_daily (
  day                date primary key,
  store_views        int,
  followers_total    int,
  followers_gained   int,
  followers_lost     int,
  visitors           int,
  new_visitors       int,
  follow_rate        numeric,
  customer_rate      numeric,
  store_orders       int,
  total_orders       int,
  store_units        int,
  total_units        int,
  store_conversion   numeric,
  store_revenue      numeric,
  total_revenue      numeric,
  store_customers    int,
  total_customers    int
);

create table if not exists ops_monthly (
  period  date not null,
  metric  text not null,
  value   numeric,
  primary key (period, metric)
);

create table if not exists ad_campaigns (
  name              text primary key,
  status            text,
  started_at        timestamptz,
  product_count     int,
  product_ids       text,
  total_budget      numeric,
  daily_budget      numeric,
  spent             numeric,
  cpc               numeric,
  clicks            int,
  impressions       int,
  direct_sales      int,
  indirect_sales    int,
  direct_revenue    numeric,
  indirect_revenue  numeric,
  roas              numeric
);

create table if not exists ad_totals (
  period_from  date not null,
  period_to    date not null,
  source       text not null default 'panel',
  impressions  int, clicks int, sales int, revenue numeric, spend numeric, roas numeric,
  primary key (period_from, period_to, source)
);

-- Güvenlik: tüm tablolarda RLS açık. Anon anahtar hiçbir şey okuyamaz;
-- yalnızca giriş yapmış kullanıcı okur. Yazma yalnızca service_role (yükleme betiği) ile.
do $$ declare t text; begin
  foreach t in array array['uploads','products','sales_monthly','orders','order_lines','distribution','store_daily','ops_monthly','ad_campaigns','ad_totals'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "read_authenticated" on %I', t);
    execute format('create policy "read_authenticated" on %I for select to authenticated using (true)', t);
  end loop;
end $$;
