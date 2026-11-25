-- 家族タスク 第2段階（写真・自動同期）。家計簿のテーブルには触れない。
-- 途中で失敗した場合は全体が取り消される。
begin;

-- 完了から90日後の写真の自動削除の対象外にするか
alter table public.task_items add column keep_photos boolean not null default false;

-- 写真の記録。画像本体は {item_id}/{id}.jpg、小画像は {item_id}/{id}_s.jpg に置く。
-- 画像本体が取り残されないよう、写真があるうちはタスクを完全削除できない（restrict）。
create table public.task_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.task_items (id) on delete restrict,
  size_bytes integer not null check (size_bytes > 0),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index task_photos_item_id_idx on public.task_photos (item_id);

-- 1タスク5枚まで（同時登録でも超えないよう、タスクの行をロックして数える）
create function public.task_check_photo_count() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.task_items where id = new.item_id for update;
  if (select count(*) from public.task_photos where item_id = new.item_id) >= 5 then
    raise exception '写真は1タスク5枚までです';
  end if;
  return new;
end $$;
create trigger task_photos_check_count before insert on public.task_photos
  for each row execute function public.task_check_photo_count();

alter table public.task_photos enable row level security;
revoke all on public.task_photos from anon, authenticated;
grant select, insert, delete on public.task_photos to authenticated;
create policy task_photos_all on public.task_photos for all to authenticated
  using ((select public.task_is_member())) with check ((select public.task_is_member()));

-- 写真の保存場所（非公開、1ファイル500KBまで、JPEGのみ）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-photos', 'task-photos', false, 512000, array['image/jpeg']);

create policy task_photos_files_select on storage.objects for select to authenticated
  using (bucket_id = 'task-photos' and (select public.task_is_member()));
create policy task_photos_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'task-photos' and (select public.task_is_member()));
create policy task_photos_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'task-photos' and (select public.task_is_member()));

-- 自動同期の対象にする
alter publication supabase_realtime add table
  public.task_members, public.task_categories, public.task_items, public.task_photos;

commit;
