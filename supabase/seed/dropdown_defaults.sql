insert into public.dropdown_categories (key, label)
values
  ('pain_type', 'Pain Type'),
  ('activity_type', 'Activity Type'),
  ('weather_condition', 'Weather Condition'),
  ('trigger_type', 'Trigger Type'),
  ('relief_method', 'Relief Method')
on conflict (key) do update
set label = excluded.label,
    updated_at = timezone('utc', now());

with default_values as (
  select 'pain_type'::text as category_key, unnest(array[
    'Joint Stiffness',
    'Swelling',
    'Burning Pain',
    'Morning Flare',
    'Fatigue Ache'
  ]) as label
  union all
  select 'activity_type', unnest(array[
    'Walking',
    'Stretching',
    'Yoga',
    'Strength Training',
    'Rest Day'
  ])
  union all
  select 'weather_condition', unnest(array[
    'Sunny',
    'Humid',
    'Rainy',
    'Cold Front',
    'Windy'
  ])
  union all
  select 'trigger_type', unnest(array[
    'Stress',
    'Poor Sleep',
    'Diet Change',
    'Overexertion',
    'Infection'
  ])
  union all
  select 'relief_method', unnest(array[
    'Hydration',
    'Heat Pack',
    'Medication',
    'Breathing Exercise',
    'Short Nap'
  ])
)
insert into public.dropdown_default_options (category_id, label)
select c.id, d.label
from default_values d
join public.dropdown_categories c
  on c.key = d.category_key
on conflict (category_id, normalized_label) do update
set label = excluded.label,
    updated_at = timezone('utc', now());
