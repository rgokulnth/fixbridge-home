alter type public.payment_status add value if not exists 'Release_pending' after 'Held_in_escrow';
alter table public.quotes add column if not exists days integer, add column if not exists materials text;
alter table public.experts add column if not exists photo_path text;
alter table public.problems add column if not exists video_url text, add column if not exists voice_url text;