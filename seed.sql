-- Optional Sample Menu Seed Data for Café Management System
-- NOTE: 'users' table is deliberately left empty so the Initial Setup / Disaster Recovery Gate activates on fresh deployments.

INSERT OR IGNORE INTO menu_items (id, name, category, price, is_available, created_at) VALUES
  ('menu_cappuccino', 'Classic Cappuccino', 'Coffee', 180.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_flat_white', 'Silky Flat White', 'Coffee', 200.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_cold_brew', 'Nitro Cold Brew', 'Coffee', 220.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_latte_vanilla', 'Vanilla Bean Latte', 'Coffee', 210.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_espresso', 'Double Espresso Shot', 'Coffee', 140.0, 1, '2026-11-01T08:00:00.000Z'),

  ('menu_matcha_latte', 'Japanese Ceremonial Matcha', 'Beverages', 240.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_peach_iced_tea', 'Sparkling Peach Iced Tea', 'Beverages', 170.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_hot_chocolate', 'Artisan Belgian Hot Chocolate', 'Beverages', 230.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_green_smoothie', 'Detox Green Smoothie', 'Beverages', 210.0, 1, '2026-11-01T08:00:00.000Z'),

  ('menu_avocado_toast', 'Sourdough Avocado Toast', 'Snacks', 280.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_croissant', 'Butter French Croissant', 'Snacks', 150.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_cheese_garlic_bread', 'Herbed Cheese Garlic Bread', 'Snacks', 190.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_falafel_wrap', 'Crispy Mediterranean Falafel Wrap', 'Snacks', 240.0, 1, '2026-11-01T08:00:00.000Z'),

  ('menu_pesto_pasta', 'Creamy Basil Pesto Penne', 'Main Course', 340.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_paneer_sandwich', 'Smoked Paneer Tikka Panini', 'Main Course', 260.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_quinoa_bowl', 'Warm Mexican Quinoa Bowl', 'Main Course', 320.0, 1, '2026-11-01T08:00:00.000Z'),

  ('menu_cheesecake_blueberry', 'New York Blueberry Cheesecake', 'Desserts', 260.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_brownie_sizzler', 'Gooey Walnut Brownie', 'Desserts', 190.0, 1, '2026-11-01T08:00:00.000Z'),
  ('menu_tiramisu', 'Classic Italian Tiramisu Cup', 'Desserts', 250.0, 1, '2026-11-01T08:00:00.000Z');
