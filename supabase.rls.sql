-- Execute no SQL Editor do Supabase
alter table "Category" enable row level security;
alter table "Product" enable row level security;
alter table "Order" enable row level security;
alter table "OrderItem" enable row level security;
alter table "Table" enable row level security;

create policy "public_read_menu" on "Category" for select using (true);
create policy "public_read_products" on "Product" for select using (available = true);
create policy "public_insert_orders" on "Order" for insert with check (true);
create policy "public_insert_order_items" on "OrderItem" for insert with check (true);

create policy "admin_full_category" on "Category" for all using (auth.role() = 'authenticated');
create policy "admin_full_product" on "Product" for all using (auth.role() = 'authenticated');
create policy "admin_full_order" on "Order" for all using (auth.role() = 'authenticated');
create policy "admin_full_order_item" on "OrderItem" for all using (auth.role() = 'authenticated');
create policy "admin_full_table" on "Table" for all using (auth.role() = 'authenticated');
