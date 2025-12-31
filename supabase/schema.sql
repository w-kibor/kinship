-- Kinship draft schema (Supabase/Postgres)
create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key default auth.uid(),
  phone text,
  email text,
  public_key text,
  created_at timestamptz default now()
);

create table if not exists circles (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  emergency_window_until timestamptz,
  created_at timestamptz default now()
);

create table if not exists circle_members (
  circle_id uuid not null references circles(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz default now(),
  primary key (circle_id, member_id)
);

-- Enforce "Circle of 5" via trigger or app validation.

create table if not exists statuses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  circle_id uuid not null references circles(id) on delete cascade,
  status text not null check (status in ('safe', 'help', 'unknown')),
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  note text,
  battery_pct integer,
  created_at timestamptz default now()
);

create index if not exists statuses_circle_created_idx on statuses (circle_id, created_at desc);

create table if not exists magic_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table if not exists sms_triggers (
  user_id uuid primary key references profiles(id) on delete cascade,
  pin_code text not null,
  last_rotated_at timestamptz default now()
);

alter table circles enable row level security;
alter table circle_members enable row level security;
alter table statuses enable row level security;
alter table magic_links enable row level security;
alter table sms_triggers enable row level security;

create policy "circle owner manage circle" on circles
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "members view circle" on circles
  for select using (
    exists(select 1 from circle_members cm where cm.circle_id = circles.id and cm.member_id = auth.uid())
  );

create policy "owner manages members" on circle_members
  for all using (
    exists(select 1 from circles c where c.id = circle_members.circle_id and c.owner_id = auth.uid())
  ) with check (
    exists(select 1 from circles c where c.id = circle_members.circle_id and c.owner_id = auth.uid())
  );

create policy "members read membership" on circle_members
  for select using (
    member_id = auth.uid() or exists(select 1 from circles c where c.id = circle_members.circle_id and c.owner_id = auth.uid())
  );

create policy "members read statuses" on statuses
  for select using (
    exists(select 1 from circle_members cm where cm.circle_id = statuses.circle_id and cm.member_id = auth.uid())
  );

create policy "members write own status" on statuses
  for insert with check (
    user_id = auth.uid() and exists(select 1 from circle_members cm where cm.circle_id = statuses.circle_id and cm.member_id = auth.uid())
  );

create policy "members append status" on statuses
  for update using (
    exists(select 1 from circle_members cm where cm.circle_id = statuses.circle_id and cm.member_id = auth.uid())
  );

create policy "owner manage sms pins" on sms_triggers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Auto-expire: schedule a cron or edge function to mask/delete statuses older than 48h after emergency_window_until.
-- Realtime: enable replication on statuses for circle_id scope when RLS is satisfied.
