alter table public.profiles
  add column if not exists profile_completion_notice_dismissed boolean not null default false;

comment on column public.profiles.profile_completion_notice_dismissed is
  'User preference: permanently hide the progressive profile completion notice after dismissal.';
