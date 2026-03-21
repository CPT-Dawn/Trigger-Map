insert into public.dropdown_categories (key, label, behavior)
values
  ('food', 'Food', 'variable'),
  ('pain', 'Pain', 'fixed'),
  ('stress', 'Stress', 'fixed'),
  ('medicine', 'Medicine', 'variable')
on conflict (key) do update
set label = excluded.label,
    behavior = excluded.behavior,
    updated_at = timezone('utc', now());

with default_values as (
  select 'food'::text as category_key, unnest(array[
    'Breakfast',
    'Lunch',
    'Dinner',
    'Snack',
    'Coffee'
  ]) as label
  union all
  select 'pain', unnest(array[
    'None',
    'Mild',
    'Moderate',
    'Severe',
    'Extreme/Flare'
  ])
  union all
  select 'stress', unnest(array[
    'Very Low',
    'Low',
    'Medium',
    'High',
    'Very High'
  ])
  union all
  select 'medicine', unnest(array[
    'NSAID',
    'Methotrexate',
    'Biologic',
    'Steroid',
    'Vitamin D'
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
