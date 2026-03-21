begin;

create extension if not exists pgcrypto;

create table if not exists public.dropdown_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint dropdown_categories_key_not_blank check (btrim(key) <> ''),
  constraint dropdown_categories_label_not_blank check (btrim(label) <> '')
);

create table if not exists public.dropdown_default_options (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.dropdown_categories(id) on delete cascade,
  label text not null,
  normalized_label text generated always as (lower(btrim(label))) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint dropdown_default_options_label_not_blank check (btrim(label) <> '')
);

create unique index if not exists dropdown_default_options_category_normalized_label_key
  on public.dropdown_default_options (category_id, normalized_label);

create index if not exists dropdown_default_options_category_idx
  on public.dropdown_default_options (category_id);

create table if not exists public.dropdown_user_custom_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.dropdown_categories(id) on delete cascade,
  label text not null,
  normalized_label text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint dropdown_user_custom_options_label_not_blank check (btrim(label) <> ''),
  constraint dropdown_user_custom_options_normalized_match check (normalized_label = lower(btrim(label)))
);

create unique index if not exists dropdown_user_custom_options_unique_active_label
  on public.dropdown_user_custom_options (user_id, category_id, normalized_label)
  where deleted_at is null;

create index if not exists dropdown_user_custom_options_user_category_idx
  on public.dropdown_user_custom_options (user_id, category_id)
  where deleted_at is null;

create table if not exists public.dropdown_user_hidden_defaults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  default_option_id uuid not null references public.dropdown_default_options(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint dropdown_user_hidden_defaults_unique unique (user_id, default_option_id)
);

create index if not exists dropdown_user_hidden_defaults_user_idx
  on public.dropdown_user_hidden_defaults (user_id);

create table if not exists public.dropdown_user_option_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.dropdown_categories(id) on delete cascade,
  option_source text not null,
  option_id uuid not null,
  last_selected_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint dropdown_user_option_usage_option_source_check check (option_source in ('default', 'custom')),
  constraint dropdown_user_option_usage_unique unique (user_id, category_id, option_source, option_id)
);

create index if not exists dropdown_user_option_usage_sorting_idx
  on public.dropdown_user_option_usage (user_id, category_id, last_selected_at desc);

create or replace function public.touch_dropdown_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.validate_dropdown_user_option_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.option_source = 'default' then
    if not exists (
      select 1
      from public.dropdown_default_options d
      where d.id = new.option_id
        and d.category_id = new.category_id
    ) then
      raise exception 'Invalid default option for category';
    end if;
  elsif new.option_source = 'custom' then
    if not exists (
      select 1
      from public.dropdown_user_custom_options c
      where c.id = new.option_id
        and c.category_id = new.category_id
        and c.user_id = new.user_id
        and c.deleted_at is null
    ) then
      raise exception 'Invalid custom option for this user/category';
    end if;
  else
    raise exception 'Invalid option source';
  end if;

  return new;
end;
$$;

drop trigger if exists touch_dropdown_categories_updated_at on public.dropdown_categories;
create trigger touch_dropdown_categories_updated_at
before update on public.dropdown_categories
for each row
execute function public.touch_dropdown_updated_at();

drop trigger if exists touch_dropdown_default_options_updated_at on public.dropdown_default_options;
create trigger touch_dropdown_default_options_updated_at
before update on public.dropdown_default_options
for each row
execute function public.touch_dropdown_updated_at();

drop trigger if exists touch_dropdown_user_custom_options_updated_at on public.dropdown_user_custom_options;
create trigger touch_dropdown_user_custom_options_updated_at
before update on public.dropdown_user_custom_options
for each row
execute function public.touch_dropdown_updated_at();

drop trigger if exists touch_dropdown_user_option_usage_updated_at on public.dropdown_user_option_usage;
create trigger touch_dropdown_user_option_usage_updated_at
before update on public.dropdown_user_option_usage
for each row
execute function public.touch_dropdown_updated_at();

drop trigger if exists validate_dropdown_user_option_usage_trigger on public.dropdown_user_option_usage;
create trigger validate_dropdown_user_option_usage_trigger
before insert or update of option_source, option_id, category_id, user_id
on public.dropdown_user_option_usage
for each row
execute function public.validate_dropdown_user_option_usage();

grant select on public.dropdown_categories to authenticated;
grant select on public.dropdown_default_options to authenticated;
grant select, insert, update, delete on public.dropdown_user_custom_options to authenticated;
grant select, insert, update, delete on public.dropdown_user_hidden_defaults to authenticated;
grant select, insert, update, delete on public.dropdown_user_option_usage to authenticated;

alter table public.dropdown_categories enable row level security;
alter table public.dropdown_default_options enable row level security;
alter table public.dropdown_user_custom_options enable row level security;
alter table public.dropdown_user_hidden_defaults enable row level security;
alter table public.dropdown_user_option_usage enable row level security;

drop policy if exists dropdown_categories_select_authenticated on public.dropdown_categories;
create policy dropdown_categories_select_authenticated
on public.dropdown_categories
for select
using (auth.role() = 'authenticated');

drop policy if exists dropdown_default_options_select_authenticated on public.dropdown_default_options;
create policy dropdown_default_options_select_authenticated
on public.dropdown_default_options
for select
using (auth.role() = 'authenticated');

drop policy if exists dropdown_user_custom_options_select_own on public.dropdown_user_custom_options;
create policy dropdown_user_custom_options_select_own
on public.dropdown_user_custom_options
for select
using (auth.uid() = user_id);

drop policy if exists dropdown_user_custom_options_insert_own on public.dropdown_user_custom_options;
create policy dropdown_user_custom_options_insert_own
on public.dropdown_user_custom_options
for insert
with check (auth.uid() = user_id);

drop policy if exists dropdown_user_custom_options_update_own on public.dropdown_user_custom_options;
create policy dropdown_user_custom_options_update_own
on public.dropdown_user_custom_options
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists dropdown_user_custom_options_delete_own on public.dropdown_user_custom_options;
create policy dropdown_user_custom_options_delete_own
on public.dropdown_user_custom_options
for delete
using (auth.uid() = user_id);

drop policy if exists dropdown_user_hidden_defaults_select_own on public.dropdown_user_hidden_defaults;
create policy dropdown_user_hidden_defaults_select_own
on public.dropdown_user_hidden_defaults
for select
using (auth.uid() = user_id);

drop policy if exists dropdown_user_hidden_defaults_insert_own on public.dropdown_user_hidden_defaults;
create policy dropdown_user_hidden_defaults_insert_own
on public.dropdown_user_hidden_defaults
for insert
with check (auth.uid() = user_id);

drop policy if exists dropdown_user_hidden_defaults_update_own on public.dropdown_user_hidden_defaults;
create policy dropdown_user_hidden_defaults_update_own
on public.dropdown_user_hidden_defaults
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists dropdown_user_hidden_defaults_delete_own on public.dropdown_user_hidden_defaults;
create policy dropdown_user_hidden_defaults_delete_own
on public.dropdown_user_hidden_defaults
for delete
using (auth.uid() = user_id);

drop policy if exists dropdown_user_option_usage_select_own on public.dropdown_user_option_usage;
create policy dropdown_user_option_usage_select_own
on public.dropdown_user_option_usage
for select
using (auth.uid() = user_id);

drop policy if exists dropdown_user_option_usage_insert_own on public.dropdown_user_option_usage;
create policy dropdown_user_option_usage_insert_own
on public.dropdown_user_option_usage
for insert
with check (auth.uid() = user_id);

drop policy if exists dropdown_user_option_usage_update_own on public.dropdown_user_option_usage;
create policy dropdown_user_option_usage_update_own
on public.dropdown_user_option_usage
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists dropdown_user_option_usage_delete_own on public.dropdown_user_option_usage;
create policy dropdown_user_option_usage_delete_own
on public.dropdown_user_option_usage
for delete
using (auth.uid() = user_id);

commit;
