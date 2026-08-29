-- Mirrors the Streamlit sheet schema exactly.
create table if not exists seats (
  seat_id      text primary key,
  status       text not null default 'Available'
               check (status in ('Available','Pending_Verification','Booked')),
  name         text not null default '',
  phone        text not null default '',
  utr_number   text not null default '',
  booked_at    text not null default '',
  checkin_time text not null default ''
);
create index if not exists seats_status_idx on seats (status);
create index if not exists seats_phone_idx  on seats (phone);

-- One transaction reference can only ever back one booking. The Streamlit
-- build checked this in Python; here the database enforces it.
create unique index if not exists seats_utr_unique
  on seats (utr_number) where utr_number <> '';

create table if not exists settings (
  tier  text primary key,
  price text not null
);
insert into settings (tier, price) values
  ('VVIP','5000'), ('VIP','2400'), ('PREMIUM','1000')
on conflict (tier) do nothing;
