create extension if not exists pgcrypto;

create table if not exists public.ecommerce_products (
  id uuid primary key default gen_random_uuid(),
  product_key text not null unique,
  name text not null,
  description text not null default '',
  image_url text,
  sort_order integer not null default 0,
  price_tiers jsonb not null default '[]'::jsonb,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ecommerce_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'stock_error')),
  amount integer not null check (amount >= 0),
  currency text not null default 'XOF',
  customer_name text not null,
  customer_phone text not null,
  customer_area text,
  payment_operator text not null check (payment_operator in ('ORANGE_MONEY_BF', 'MOOV_MONEY_BF')),
  cinetpay_transaction_id text not null unique,
  cinetpay_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ecommerce_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ecommerce_orders(id) on delete cascade,
  product_id uuid not null references public.ecommerce_products(id),
  product_key text not null,
  product_name text not null,
  variant text,
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  line_total integer not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ecommerce_order_items_order_id_idx on public.ecommerce_order_items(order_id);
create index if not exists ecommerce_products_active_idx on public.ecommerce_products(is_active, sort_order);

alter table public.ecommerce_products enable row level security;
alter table public.ecommerce_orders enable row level security;
alter table public.ecommerce_order_items enable row level security;

drop policy if exists "Public can read active ecommerce products" on public.ecommerce_products;
create policy "Public can read active ecommerce products"
on public.ecommerce_products
for select
using (is_active = true);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ecommerce_products_touch_updated_at on public.ecommerce_products;
create trigger ecommerce_products_touch_updated_at
before update on public.ecommerce_products
for each row execute function public.touch_updated_at();

drop trigger if exists ecommerce_orders_touch_updated_at on public.ecommerce_orders;
create trigger ecommerce_orders_touch_updated_at
before update on public.ecommerce_orders
for each row execute function public.touch_updated_at();

create or replace function public.finalize_paid_order(
  p_order_id uuid,
  p_transaction_id text,
  p_cinetpay_payload jsonb
)
returns public.ecommerce_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.ecommerce_orders;
  v_item record;
  v_stock integer;
begin
  select *
    into v_order
  from public.ecommerce_orders
  where id = p_order_id
    and cinetpay_transaction_id = p_transaction_id
  for update;

  if not found then
    raise exception 'Order not found for transaction %', p_transaction_id;
  end if;

  if v_order.status = 'paid' then
    return v_order;
  end if;

  if v_order.status <> 'pending' then
    raise exception 'Order % is not pending', v_order.order_code;
  end if;

  for v_item in
    select oi.*, p.stock_quantity
    from public.ecommerce_order_items oi
    join public.ecommerce_products p on p.id = oi.product_id
    where oi.order_id = v_order.id
    order by oi.created_at
    for update of p
  loop
    select stock_quantity
      into v_stock
    from public.ecommerce_products
    where id = v_item.product_id
    for update;

    if v_stock < v_item.quantity then
      update public.ecommerce_orders
        set status = 'stock_error',
            cinetpay_payload = coalesce(p_cinetpay_payload, '{}'::jsonb)
      where id = v_order.id;
      raise exception 'Insufficient stock for %', v_item.product_key;
    end if;

    update public.ecommerce_products
      set stock_quantity = stock_quantity - v_item.quantity
    where id = v_item.product_id;
  end loop;

  update public.ecommerce_orders
    set status = 'paid',
        paid_at = now(),
        cinetpay_payload = coalesce(p_cinetpay_payload, '{}'::jsonb)
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.finalize_paid_order(uuid, text, jsonb) from public;
grant execute on function public.finalize_paid_order(uuid, text, jsonb) to service_role;

insert into public.ecommerce_products
  (product_key, name, description, image_url, sort_order, price_tiers, stock_quantity, metadata)
values
  (
    'coque-airbag',
    'Coques Antichoc Airbag Silicone',
    'Coques Airbag, MagSafe, béquille et silicone soft-touch.',
    'coque1.png',
    10,
    '[{"min":1,"max":49,"unit":1000,"label":"Détail 1-49 pcs"},{"min":50,"max":null,"unit":600,"label":"Gros 50+ pcs"}]'::jsonb,
    100,
    '{"variants":["Airbag","MagSafe","Béquille","Silicone"]}'::jsonb
  ),
  (
    'cable-tresse',
    'Câbles tressés de charge rapide',
    'Câbles Type-C, Lightning et Micro-USB.',
    'cable-charge.jpg',
    20,
    '[{"min":1,"max":49,"unit":1000,"label":"Détail 1-49 pcs"},{"min":50,"max":null,"unit":500,"label":"Gros 50+ pcs"}]'::jsonb,
    150,
    '{"variants":["Type-C","Lightning","Micro-USB"]}'::jsonb
  ),
  (
    'verre-hd',
    'Verres trempés 9D HD',
    'Verres 9D HD pour Tecno, Infinix, Samsung et iPhone.',
    'V2.png',
    30,
    '[{"min":1,"max":49,"unit":1000,"label":"Détail 1-49 pcs"},{"min":50,"max":null,"unit":500,"label":"Gros 50+ pcs"}]'::jsonb,
    200,
    '{"variants":["Tecno","Infinix","Samsung","iPhone"]}'::jsonb
  ),
  (
    'verre-privacy',
    'Verre Trempé Anti-Espion',
    'Filtre confidentialité 28 degrés, verre trempé 9H.',
    'VIN1.png',
    40,
    '[{"min":1,"max":19,"unit":1500,"label":"Détail 1-19 pcs"},{"min":20,"max":null,"unit":1000,"label":"Gros 20+ pcs"}]'::jsonb,
    100,
    '{"variants":["Tecno","Infinix","Samsung","iPhone"]}'::jsonb
  ),
  (
    'chargeur-fast',
    'Chargeurs Fast Charge 20W',
    'Kits complets en boîte chargeur 20W avec câble.',
    'bloc-charge.jpg',
    50,
    '[{"min":1,"max":9,"unit":2500,"label":"Détail 1-9 pcs"},{"min":10,"max":null,"unit":1800,"label":"Gros 10+ pcs"}]'::jsonb,
    80,
    '{"variants":["Kit 20W"]}'::jsonb
  ),
  (
    'audio-air31',
    'Écouteurs Air31 TWS Crystal LED',
    'Écouteurs Bluetooth 5.3 avec boîtier transparent et écran LED.',
    'air31-1.jpg',
    60,
    '[{"min":1,"max":1,"unit":3500,"label":"Détail 1 pc"},{"min":2,"max":2,"unit":3250,"label":"Duo 2 pcs"},{"min":3,"max":9,"unit":3500,"label":"Détail 3-9 pcs"},{"min":10,"max":null,"unit":2500,"label":"Gros 10+ pcs"}]'::jsonb,
    60,
    '{"variants":["Noir","Blanc","Vert","Bleu","Violet"]}'::jsonb
  ),
  (
    'briquet-electric',
    'Mini Briquet Électrique Smartphone Porte-Clés',
    'Mini briquet électrique porte-clés en coffret, Type-C ou Lightning.',
    'briquet-coffret.jpg',
    70,
    '[{"min":1,"max":19,"unit":5000,"label":"Détail 1-19 pcs"},{"min":20,"max":null,"unit":4000,"label":"Gros 20+ pcs"}]'::jsonb,
    40,
    '{"variants":["Type-C","Lightning"]}'::jsonb
  )
on conflict (product_key) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  sort_order = excluded.sort_order,
  price_tiers = excluded.price_tiers,
  metadata = excluded.metadata,
  updated_at = now();
