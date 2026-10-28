-- Right and left arm measured on their own ("arm" stays for the numbers saved before).
alter table public.measurements drop constraint if exists measurements_kind_check;
alter table public.measurements add constraint measurements_kind_check
  check (kind in ('weight', 'waist', 'chest', 'arm', 'arm_r', 'arm_l', 'neck', 'shoulders', 'hips', 'thigh', 'calf', 'forearm', 'bf'));
