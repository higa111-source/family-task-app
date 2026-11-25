-- 家族タスク 第1段階。新しいテーブルを作るだけで、家計簿のテーブルには触れない。
-- 途中で失敗した場合は全体が取り消される。
begin;

-- 使える人（夫・妻の2人）
create table public.task_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null unique check (role in ('husband', 'wife')),
  name text not null check (char_length(name) between 1 and 20),
  emoji text not null
);

create table public.task_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 50),
  emoji text not null default '📁',
  color text not null default '#059669' check (color ~ '^#[0-9a-f]{6}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- タスクとサブタスク（サブタスクは parent_id を持つ）
create table public.task_items (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.task_items (id) on delete cascade,
  category_id uuid references public.task_categories (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  assignee text check (assignee in ('husband', 'wife', 'both')), -- null は未割当
  due_date date,
  note text check (char_length(note) <= 5000),
  sort_order integer not null default 0,
  completed_at timestamptz,
  deleted_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index task_items_parent_id_idx on public.task_items (parent_id);
create index task_items_category_id_idx on public.task_items (category_id);

-- サブタスクは1階層まで
create function public.task_check_depth() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null and (
    exists (select 1 from public.task_items p where p.id = new.parent_id and p.parent_id is not null)
    or exists (select 1 from public.task_items c where c.parent_id = new.id)
  ) then
    raise exception 'サブタスクは1階層までです';
  end if;
  return null;
end $$;
create trigger task_items_check_depth after insert or update of parent_id on public.task_items
  for each row execute function public.task_check_depth();

-- ログイン中の人が登録済みメンバーか
create function public.task_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.task_members where user_id = auth.uid())
$$;
revoke all on function public.task_is_member() from public, anon;
grant execute on function public.task_is_member() to authenticated;

alter table public.task_members enable row level security;
alter table public.task_categories enable row level security;
alter table public.task_items enable row level security;

revoke all on public.task_members, public.task_categories, public.task_items from anon, authenticated;
grant select, insert, update, delete on public.task_categories, public.task_items to authenticated;
-- メンバーの追加や夫・妻の変更は、アプリからはできない
grant select, update (name, emoji) on public.task_members to authenticated;

create policy task_members_select on public.task_members for select to authenticated
  using ((select public.task_is_member()));
create policy task_members_update on public.task_members for update to authenticated
  using ((select public.task_is_member())) with check ((select public.task_is_member()));
create policy task_categories_all on public.task_categories for all to authenticated
  using ((select public.task_is_member())) with check ((select public.task_is_member()));
create policy task_items_all on public.task_items for all to authenticated
  using ((select public.task_is_member())) with check ((select public.task_is_member()));

-- 最初のカテゴリ（アプリで自由に変更できる）
insert into public.task_categories (name, emoji, color, sort_order) values
  ('家事系', '🧹', '#059669', 0),
  ('育児系', '👶', '#db2777', 1),
  ('新居系', '🏠', '#2563eb', 2);

commit;
