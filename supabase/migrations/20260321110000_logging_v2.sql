begin;

alter table public.dropdown_categories
  add column if not exists behavior text not null default 'variable';

alter table public.dropdown_categories
  drop constraint if exists dropdown_categories_behavior_check;

alter table public.dropdown_categories
  add constraint dropdown_categories_behavior_check
  check (behavior in ('fixed', 'variable'));

update public.dropdown_categories
set behavior = case
  when key in ('pain', 'stress') then 'fixed'
  when key in ('food', 'medicine') then 'variable'
  else coalesce(behavior, 'variable')
end
where key in ('food', 'pain', 'stress', 'medicine');

create or replace function public.validate_variable_category_for_custom_option()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.dropdown_categories c
    where c.id = new.category_id
      and c.behavior = 'variable'
  ) then
    raise exception 'Custom options are only allowed for variable categories';
  end if;

  return new;
end;
$$;

create or replace function public.validate_variable_category_for_hidden_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.dropdown_default_options d
    join public.dropdown_categories c on c.id = d.category_id
    where d.id = new.default_option_id
      and c.behavior = 'variable'
  ) then
    raise exception 'Hidden defaults are only allowed for variable categories';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_variable_category_for_custom_option_trigger on public.dropdown_user_custom_options;
create trigger validate_variable_category_for_custom_option_trigger
before insert or update of category_id
on public.dropdown_user_custom_options
for each row
execute function public.validate_variable_category_for_custom_option();

drop trigger if exists validate_variable_category_for_hidden_default_trigger on public.dropdown_user_hidden_defaults;
create trigger validate_variable_category_for_hidden_default_trigger
before insert or update of default_option_id
on public.dropdown_user_hidden_defaults
for each row
execute function public.validate_variable_category_for_hidden_default();

create table if not exists public.log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default timezone('utc', now()),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint log_entries_note_max_len check (note is null or length(note) <= 1000)
);

create table if not exists public.log_entry_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.log_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null,
  option_source text not null,
  option_id uuid not null,
  label_snapshot text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint log_entry_items_category_key_check check (category_key in ('food', 'pain', 'stress', 'medicine')),
  constraint log_entry_items_option_source_check check (option_source in ('default', 'custom')),
  constraint log_entry_items_label_not_blank check (btrim(label_snapshot) <> ''),
  constraint log_entry_items_fixed_source_check check (
    case when category_key in ('pain', 'stress') then option_source = 'default' else true end
  )
);

create unique index if not exists log_entry_items_unique_entry_category
  on public.log_entry_items (entry_id, category_key);

create index if not exists log_entries_user_logged_at_idx
  on public.log_entries (user_id, logged_at desc, created_at desc);

create index if not exists log_entry_items_user_category_entry_idx
  on public.log_entry_items (user_id, category_key, entry_id);

create or replace function public.touch_log_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.validate_log_entry_item_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.log_entries e
    where e.id = new.entry_id
      and e.user_id = new.user_id
  ) then
    raise exception 'Invalid log entry/user relation';
  end if;

  if new.option_source = 'default' then
    if not exists (
      select 1
      from public.dropdown_default_options d
      join public.dropdown_categories c on c.id = d.category_id
      where d.id = new.option_id
        and c.key = new.category_key
    ) then
      raise exception 'Invalid default option for category';
    end if;
  elsif new.option_source = 'custom' then
    if not exists (
      select 1
      from public.dropdown_user_custom_options cu
      join public.dropdown_categories c on c.id = cu.category_id
      where cu.id = new.option_id
        and cu.user_id = new.user_id
        and cu.deleted_at is null
        and c.key = new.category_key
    ) then
      raise exception 'Invalid custom option for user/category';
    end if;
  else
    raise exception 'Invalid option source';
  end if;

  return new;
end;
$$;

drop trigger if exists touch_log_entries_updated_at on public.log_entries;
create trigger touch_log_entries_updated_at
before update on public.log_entries
for each row
execute function public.touch_log_updated_at();

drop trigger if exists validate_log_entry_item_ref_trigger on public.log_entry_items;
create trigger validate_log_entry_item_ref_trigger
before insert or update of entry_id, user_id, category_key, option_source, option_id
on public.log_entry_items
for each row
execute function public.validate_log_entry_item_ref();

grant select, insert, update, delete on public.log_entries to authenticated;
grant select, insert, update, delete on public.log_entry_items to authenticated;

alter table public.log_entries enable row level security;
alter table public.log_entry_items enable row level security;

drop policy if exists log_entries_select_own on public.log_entries;
create policy log_entries_select_own
on public.log_entries
for select
using (auth.uid() = user_id);

drop policy if exists log_entries_insert_own on public.log_entries;
create policy log_entries_insert_own
on public.log_entries
for insert
with check (auth.uid() = user_id);

drop policy if exists log_entries_update_own on public.log_entries;
create policy log_entries_update_own
on public.log_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists log_entries_delete_own on public.log_entries;
create policy log_entries_delete_own
on public.log_entries
for delete
using (auth.uid() = user_id);

drop policy if exists log_entry_items_select_own on public.log_entry_items;
create policy log_entry_items_select_own
on public.log_entry_items
for select
using (auth.uid() = user_id);

drop policy if exists log_entry_items_insert_own on public.log_entry_items;
create policy log_entry_items_insert_own
on public.log_entry_items
for insert
with check (auth.uid() = user_id);

drop policy if exists log_entry_items_update_own on public.log_entry_items;
create policy log_entry_items_update_own
on public.log_entry_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists log_entry_items_delete_own on public.log_entry_items;
create policy log_entry_items_delete_own
on public.log_entry_items
for delete
using (auth.uid() = user_id);

commit;
