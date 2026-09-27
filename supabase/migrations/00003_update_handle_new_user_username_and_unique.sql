-- 同步注册时传入的用户名到 profiles（优先取 metadata，兼容旧逻辑）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, phone, username, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), NEW.phone),
    'user'::public.user_role
  );
  RETURN NEW;
END;
$function$;

-- 用户名唯一约束（username 可为空，多个空值不冲突）
CREATE UNIQUE INDEX idx_profiles_username ON public.profiles (username);