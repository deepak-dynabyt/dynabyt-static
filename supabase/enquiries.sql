-- Run once in Supabase: SQL Editor > New query > paste > Run.
create table if not exists public.enquiries (
  id           text primary key,
  received_at  timestamptz not null default now(),
  name         text not null,
  email        text not null,
  company      text not null,
  website      text,
  service      text not null,
  budget       text,
  timeline     text,
  message      text not null,
  consent      boolean not null default true,
  page         text,
  ip_hash      text,
  user_agent   text,
  status       text not null default 'new'   -- change to 'contacted', 'won', 'lost' as you work them
);

create index if not exists enquiries_received_at_idx on public.enquiries (received_at desc);

-- Lock the table down. With row-level security on and no policies, the public anon key
-- can neither read nor write it. Only the server-side service key (kept as a Cloudflare
-- secret, used by the contact form function) can insert, and only you can read it here.
alter table public.enquiries enable row level security;
