-- Esquema del catálogo de Nélida (Supabase). RLS en todas las tablas.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create policy admins_self_read on public.admins for select to authenticated using (user_id = auth.uid());

-- Productos
create table if not exists public.products (
  id text primary key,
  cat text not null,
  tag text not null default '',
  name text not null,
  meta text not null default '',
  price integer not null check (price >= 0),
  stock integer check (stock is null or stock >= 0),
  tones text,
  note text,
  feat boolean not null default false,
  is_new boolean not null default false,
  img text,
  active boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy products_public_read on public.products for select to anon, authenticated using (active or public.is_admin());
create policy products_admin_update on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_admin_insert on public.products for insert to authenticated with check (public.is_admin());
revoke insert, update, delete on public.products from anon;
grant select on public.products to anon, authenticated;
grant insert, update on public.products to authenticated;

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

-- Eventos anónimos (visitas / vistas de producto). Inserción pública, sin lectura pública.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  visitor_id text not null check (visitor_id ~ '^[a-z0-9-]{8,40}$'),
  kind text not null check (kind in ('visit','product_view','add_to_cart','order_sent')),
  product_id text references public.products(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists events_created_idx on public.events (created_at);
create index if not exists events_visitor_idx on public.events (visitor_id);
alter table public.events enable row level security;
create policy events_public_insert on public.events for insert to anon, authenticated with check (true);
create policy events_admin_read on public.events for select to authenticated using (public.is_admin());
revoke all on public.events from anon, authenticated;
grant insert (visitor_id, kind, product_id) on public.events to anon, authenticated;
grant select on public.events to authenticated;

-- Mi red (solo admin)
create table if not exists public.network_members (
  id bigint generated always as identity primary key,
  name text not null check (length(name) between 1 and 120),
  contact text,
  joined_on date,
  sponsor_id bigint references public.network_members(id) on delete set null,
  status text not null default 'activa' check (status in ('activa','inactiva')),
  notes text,
  created_at timestamptz not null default now()
);
alter table public.network_members enable row level security;
create policy members_admin_all on public.network_members for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.network_members from anon;
grant select, insert, update, delete on public.network_members to authenticated;

create table if not exists public.sales (
  id bigint generated always as identity primary key,
  member_id bigint not null references public.network_members(id) on delete cascade,
  sale_date date not null default current_date,
  amount numeric(12,2) not null check (amount >= 0),
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists sales_member_idx on public.sales (member_id);
alter table public.sales enable row level security;
create policy sales_admin_all on public.sales for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.sales from anon;
grant select, insert, update, delete on public.sales to authenticated;

-- Funciones de estadísticas (security invoker: aplican RLS, solo devuelven datos a la admin)
create or replace function public.stats_visits_by_day(days integer default 30)
returns table(day date, visits bigint, visitors bigint, product_views bigint)
language sql stable security invoker set search_path = public as $$
  select (created_at at time zone 'America/Argentina/Mendoza')::date as day,
         count(*) filter (where kind='visit'),
         count(distinct visitor_id),
         count(*) filter (where kind='product_view')
  from public.events
  where created_at >= now() - make_interval(days => days)
  group by 1 order by 1 desc;
$$;
create or replace function public.stats_top_products(days integer default 30, lim integer default 20)
returns table(product_id text, name text, views bigint, visitors bigint)
language sql stable security invoker set search_path = public as $$
  select e.product_id, p.name, count(*), count(distinct e.visitor_id)
  from public.events e left join public.products p on p.id = e.product_id
  where e.kind='product_view' and e.product_id is not null and e.created_at >= now() - make_interval(days => days)
  group by 1,2 order by 3 desc limit lim;
$$;
create or replace function public.stats_visitors(days integer default 30, lim integer default 100)
returns table(visitor_id text, first_seen timestamptz, last_seen timestamptz, visits bigint, products text[])
language sql stable security invoker set search_path = public as $$
  select e.visitor_id, min(e.created_at), max(e.created_at),
         count(*) filter (where e.kind='visit'),
         coalesce(array_agg(distinct p.name) filter (where e.kind='product_view' and p.name is not null), '{}')
  from public.events e left join public.products p on p.id = e.product_id
  where e.created_at >= now() - make_interval(days => days)
  group by 1 order by 3 desc limit lim;
$$;
revoke execute on function public.stats_visits_by_day(integer), public.stats_top_products(integer,integer), public.stats_visitors(integer,integer) from public, anon;
grant execute on function public.stats_visits_by_day(integer), public.stats_top_products(integer,integer), public.stats_visitors(integer,integer) to authenticated;
