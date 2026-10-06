
create type public.app_role as enum ('customer','expert','admin');
create type public.kyc_status as enum ('Not_started','Submitted','Verified','Failed');
create type public.urgency_level as enum ('Low','Med','High');
create type public.problem_status as enum ('Open','AI_Analysed','Expert_Matched','Quote_Sent','Payment_Held','Job_Started','Solved','Payment_Done','Disputed','Cancelled');
create type public.payment_status as enum ('Pending','Paid_captured','Held_in_escrow','Released_to_expert','Refunded');
create type public.notification_status as enum ('Queued','Sent','Failed');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text, name text, lat double precision, long double precision,
  created_at timestamptz not null default now()
);
create table public.experts (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text, name text,
  skills text[] not null default '{}',
  lat double precision, long double precision,
  radius_km integer not null default 10,
  kyc_status public.kyc_status not null default 'Not_started',
  aadhaar_path text, pan_path text, kyc_note text,
  payout_status text not null default 'Not_setup',
  razorpay_account_id text, stripe_account_id text,
  rating numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.customers, public.experts to authenticated;
grant all on public.customers, public.experts to service_role;
alter table public.customers enable row level security;
alter table public.experts enable row level security;

create policy "customer self" on public.customers for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "admin read customers" on public.customers for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

create policy "expert self read" on public.experts for select to authenticated using (id = auth.uid());
create policy "expert self insert" on public.experts for insert to authenticated with check (id = auth.uid());
create policy "expert self update" on public.experts for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admin all experts" on public.experts for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.experts_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(),'admin') then return new; end if;
  if tg_op = 'INSERT' then
    new.kyc_status := 'Not_started'; new.rating := 0; new.rating_count := 0; new.payout_status := 'Not_setup';
    new.razorpay_account_id := null; new.stripe_account_id := null;
  else
    if new.kyc_status is distinct from old.kyc_status and not (old.kyc_status in ('Not_started','Failed') and new.kyc_status = 'Submitted') then
      raise exception 'Not allowed to change KYC status';
    end if;
    new.rating := old.rating; new.rating_count := old.rating_count;
    new.payout_status := old.payout_status; new.razorpay_account_id := old.razorpay_account_id; new.stripe_account_id := old.stripe_account_id;
  end if;
  return new;
end $$;
create trigger experts_guard before insert or update on public.experts for each row execute function public.experts_guard();

create or replace function public.expert_cards(_ids uuid[])
returns table(id uuid, name text, skills text[], rating numeric, rating_count integer, kyc_status public.kyc_status)
language sql stable security definer set search_path=public as $$
  select id, name, skills, rating, rating_count, kyc_status from public.experts where id = any(_ids)
$$;
revoke execute on function public.expert_cards(uuid[]) from anon, public;
grant execute on function public.expert_cards(uuid[]) to authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role','customer');
begin
  if r = 'expert' then
    insert into public.user_roles(user_id, role) values (new.id,'expert') on conflict do nothing;
    insert into public.experts(id, phone, name) values (new.id, new.phone, new.raw_user_meta_data->>'name') on conflict do nothing;
  else
    insert into public.user_roles(user_id, role) values (new.id,'customer') on conflict do nothing;
    insert into public.customers(id, phone, name) values (new.id, new.phone, new.raw_user_meta_data->>'name') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  title text not null, description text not null default '',
  category text not null default 'water-pump',
  lat double precision, long double precision,
  media_urls text[] not null default '{}',
  urgency public.urgency_level not null default 'Med',
  budget_min integer, budget_max integer,
  status public.problem_status not null default 'Open',
  created_at timestamptz not null default now()
);
create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null unique references public.problems(id) on delete cascade,
  root_cause text, required_skill text, difficulty text, estimated_cost integer,
  safety_notes text, raw jsonb,
  created_at timestamptz not null default now()
);
create table public.expert_matches (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  expert_id uuid not null references public.experts(id) on delete cascade,
  score numeric not null default 0,
  status text not null default 'Invited',
  created_at timestamptz not null default now(),
  unique(problem_id, expert_id)
);
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  expert_id uuid not null references public.experts(id) on delete cascade,
  amount integer not null check (amount > 0),
  description text not null default '',
  status text not null default 'Sent',
  created_at timestamptz not null default now(),
  unique(problem_id, expert_id)
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null unique references public.problems(id) on delete cascade,
  quote_id uuid not null references public.quotes(id),
  expert_id uuid not null references public.experts(id),
  customer_id uuid not null references public.customers(id),
  status text not null default 'Awaiting_payment',
  started_at timestamptz, solved_at timestamptz, confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  expert_id uuid not null references public.experts(id),
  provider text not null check (provider in ('razorpay','stripe')),
  currency text not null default 'INR',
  amount integer not null, commission integer not null default 0,
  status public.payment_status not null default 'Pending',
  provider_order_id text, provider_payment_id text, provider_transfer_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null, event_id text, event_type text, payload jsonb,
  created_at timestamptz not null default now(),
  unique(provider, event_id)
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid(),
  text text not null,
  masked boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  message text not null,
  status public.notification_status not null default 'Queued',
  error text, sent_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  customer_id uuid not null default auth.uid(),
  expert_id uuid not null references public.experts(id),
  stars integer not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  raised_by uuid not null default auth.uid(),
  reason text not null,
  status text not null default 'Open',
  resolution text,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.problems to authenticated;
grant select on public.ai_analyses, public.expert_matches, public.jobs, public.payments, public.conversations, public.disputes to authenticated;
grant select, insert, update on public.quotes to authenticated;
grant select, insert on public.messages, public.ratings to authenticated;
grant insert on public.disputes to authenticated;
grant select, update on public.notifications to authenticated;
grant all on public.problems, public.ai_analyses, public.expert_matches, public.quotes, public.jobs, public.payments, public.payment_events, public.conversations, public.messages, public.notifications, public.ratings, public.disputes to service_role;

alter table public.problems enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.expert_matches enable row level security;
alter table public.quotes enable row level security;
alter table public.jobs enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.ratings enable row level security;
alter table public.disputes enable row level security;

create or replace function public.is_verified_expert(_uid uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.experts where id=_uid and kyc_status='Verified')
$$;
create or replace function public.is_job_party(_job uuid, _uid uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.jobs where id=_job and (customer_id=_uid or expert_id=_uid))
$$;
create or replace function public.owns_problem(_problem uuid, _uid uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.problems where id=_problem and customer_id=_uid)
$$;
create or replace function public.is_problem_expert(_problem uuid, _uid uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.jobs where problem_id=_problem and expert_id=_uid)
$$;

create policy "customer own problems" on public.problems for select to authenticated using (customer_id = auth.uid());
create policy "customer create problem" on public.problems for insert to authenticated
  with check (customer_id = auth.uid() and status = 'Open' and public.has_role(auth.uid(),'customer'));
create policy "verified experts see open problems" on public.problems for select to authenticated
  using (public.is_verified_expert(auth.uid()) and status in ('Open','AI_Analysed','Expert_Matched','Quote_Sent'));
create policy "assigned expert sees problem" on public.problems for select to authenticated
  using (public.is_problem_expert(id, auth.uid()));
create policy "admin problems" on public.problems for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "read analysis" on public.ai_analyses for select to authenticated using (
  public.has_role(auth.uid(),'admin') or public.is_verified_expert(auth.uid()) or public.owns_problem(problem_id, auth.uid()));

create policy "read matches" on public.expert_matches for select to authenticated using (
  expert_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.owns_problem(problem_id, auth.uid()));

create policy "read quotes" on public.quotes for select to authenticated using (
  expert_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.owns_problem(problem_id, auth.uid()));
create policy "verified expert sends quote" on public.quotes for insert to authenticated with check (
  expert_id = auth.uid() and status = 'Sent' and public.is_verified_expert(auth.uid())
  and exists(select 1 from public.problems p where p.id = problem_id and p.status in ('Open','AI_Analysed','Expert_Matched','Quote_Sent')));
create policy "expert edits own pending quote" on public.quotes for update to authenticated
  using (expert_id = auth.uid() and status = 'Sent') with check (expert_id = auth.uid() and status = 'Sent');

create policy "read jobs" on public.jobs for select to authenticated using (customer_id = auth.uid() or expert_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "read payments" on public.payments for select to authenticated using (customer_id = auth.uid() or expert_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "read conversations" on public.conversations for select to authenticated using (public.is_job_party(job_id, auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "read disputes" on public.disputes for select to authenticated using (public.is_job_party(job_id, auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "party raises dispute" on public.disputes for insert to authenticated with check (raised_by = auth.uid() and public.is_job_party(job_id, auth.uid()) and status='Open');

create policy "read messages" on public.messages for select to authenticated using (
  public.has_role(auth.uid(),'admin') or exists(select 1 from public.conversations c where c.id = conversation_id and public.is_job_party(c.job_id, auth.uid())));
create policy "send messages" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and exists(select 1 from public.conversations c where c.id = conversation_id and public.is_job_party(c.job_id, auth.uid())));

create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());

create policy "read ratings" on public.ratings for select to authenticated using (true);
create policy "customer rates completed job" on public.ratings for insert to authenticated with check (
  customer_id = auth.uid() and exists(select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid() and j.expert_id = ratings.expert_id and j.status in ('Customer_Confirmed','Completed')));

create or replace function public.mask_contact() returns trigger language plpgsql set search_path=public as $$
declare original text := new.text;
begin
  new.text := regexp_replace(new.text, '(\+?\d[\d\s\-\.\(\)]{7,}\d)', '[number hidden]', 'g');
  new.text := regexp_replace(new.text, '[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}', '[email hidden]', 'g');
  new.text := regexp_replace(new.text, '(whats\s*app|wa\.me|telegram|t\.me)\S*', '[contact hidden]', 'gi');
  new.masked := new.text is distinct from original;
  return new;
end $$;
create trigger messages_mask before insert on public.messages for each row execute function public.mask_contact();

create or replace function public.update_expert_rating() returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.experts e set rating = s.avg, rating_count = s.cnt
  from (select avg(stars)::numeric(3,2) avg, count(*)::int cnt from public.ratings where expert_id = new.expert_id) s
  where e.id = new.expert_id;
  return new;
end $$;
create trigger ratings_agg after insert on public.ratings for each row execute function public.update_expert_rating();

create or replace function public.on_quote_insert() returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.problems set status='Quote_Sent' where id=new.problem_id and status in ('Open','AI_Analysed','Expert_Matched');
  update public.expert_matches set status='Quoted' where problem_id=new.problem_id and expert_id=new.expert_id;
  insert into public.notifications(user_id,type,message)
    select p.customer_id, t, 'New quote of Rs.'||new.amount||' for "'||p.title||'"'
    from public.problems p, unnest(array['in_app','push','sms']) t where p.id=new.problem_id;
  return new;
end $$;
create trigger quotes_after_insert after insert on public.quotes for each row execute function public.on_quote_insert();

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;

create policy "upload own problem media" on storage.objects for insert to authenticated
  with check (bucket_id='problem-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read problem media" on storage.objects for select to authenticated
  using (bucket_id='problem-media' and ((storage.foldername(name))[1] = auth.uid()::text
    or public.is_verified_expert(auth.uid()) or public.has_role(auth.uid(),'admin')));
create policy "upload own kyc" on storage.objects for insert to authenticated
  with check (bucket_id='kyc-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own kyc" on storage.objects for update to authenticated
  using (bucket_id='kyc-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read kyc own or admin" on storage.objects for select to authenticated
  using (bucket_id='kyc-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(),'admin')));
