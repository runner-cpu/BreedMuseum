insert into storage.buckets (id, name, public) values ('generated-media', 'generated-media', true);

-- 允许匿名与登录用户读取生成结果
create policy "generated_media_read_anon" on storage.objects for select to anon using (bucket_id = 'generated-media');
create policy "generated_media_read_auth" on storage.objects for select to authenticated using (bucket_id = 'generated-media');