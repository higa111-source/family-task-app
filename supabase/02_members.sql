-- 2人のメールアドレスに書き換えて、Supabase の SQL Editor で実行する。
-- リポジトリは公開されるため、書き換えた内容はこのファイルに保存しないこと。
begin;
insert into public.task_members (user_id, role, name, emoji)
select id, 'husband', '夫', '👨' from auth.users where email = lower('夫のメールアドレス');
insert into public.task_members (user_id, role, name, emoji)
select id, 'wife', '妻', '👩' from auth.users where email = lower('妻のメールアドレス');
do $$ begin
  if (select count(*) from public.task_members) <> 2 then
    raise exception '2人分を登録できませんでした。メールアドレスを確認してください';
  end if;
end $$;
commit;
