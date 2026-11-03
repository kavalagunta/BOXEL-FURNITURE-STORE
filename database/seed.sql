-- =====================================================================
-- boxel store — initial content
-- Import AFTER schema.sql. Contains no customers, orders, reviews or
-- admin accounts. Create the first admin with:  npm run create-admin
--
-- IMPORTANT: the Parcel Drop Box is seeded with price 0.00, which the
-- store treats as "price not set" — it is visible but cannot be bought
-- until an admin enters the real price in Admin → Products.
-- =====================================================================

SET NAMES utf8mb4;

-- Categories ------------------------------------------------------------
INSERT INTO categories (id, name, slug, description, image_url, sort_order, status, seo_title, seo_description) VALUES
(1, 'Parcel Security', 'parcel-security',
 'Secure drop boxes that receive parcels, groceries, laundry and returns while you are away.',
 '/images/parcel-drop-box-front.jpeg', 1, 'active',
 'Parcel Security — boxel', 'All-metal parcel drop boxes with a keyless number lock, designed for Indian homes and apartments.'),
(2, 'Personal Storage', 'personal-storage',
 'Compact, secure lockers for high-value gadgets — on a desk, on a wall or standing on the floor.',
 NULL, 2, 'coming_soon', NULL, NULL),
(3, 'Space-Saving Workspaces', 'space-saving-workspaces',
 'Wall-hung workstations that fit against the wall, for small homes and busy offices.',
 NULL, 3, 'coming_soon', NULL, NULL),
(4, 'Wall-Hung Accessories', 'wall-hung-accessories',
 'Smart storage that frees your floor and keeps things organised.',
 NULL, 4, 'coming_soon', NULL, NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Product ---------------------------------------------------------------
INSERT INTO products (id, category_id, name, slug, sku, short_description, description, features, specifications,
  price, sale_price, status, is_featured, sort_order, track_stock, low_stock_threshold, shipping_info, warranty_info,
  seo_title, seo_description, og_image_url) VALUES
(1, 1, 'boxel Parcel Drop Box', 'parcel-drop-box', 'BXL-PDB-01',
 'An anti-theft, all-metal parcel drop box with a keyless number lock. One unit can serve 3 to 4 homes.',
 'The boxel Parcel Drop Box receives parcels, groceries, laundry and returns safely and holds them until you collect them — so you no longer need to wait at home for a delivery.\n\nDeliveries go in through the drop opening at the top. The front access door below is secured with a keyless number lock, so there is no key to carry or lose.\n\nEvery unit is built in all-metal construction with a durable powder-coat finish, made to order, and delivered fully assembled. Before it ships, we share a video of its quality and functions, so you see exactly what you are getting.',
 '["All-metal construction","Keyless number lock","Powder-coated finish","Delivered fully assembled","Made to order","Quality-check video shared before dispatch"]',
 '[{"label":"Construction","value":"All metal"},{"label":"Finish","value":"Powder coat"},{"label":"Lock","value":"Keyless number lock"},{"label":"Delivery","value":"Fully assembled"},{"label":"Production","value":"Made to order"},{"label":"Serves","value":"3 to 4 homes per unit"}]',
 0.00, NULL, 'active', 1, 1, 0, 3,
 'Free shipping across India. Made to order — we confirm the expected dispatch date after your order is placed.',
 'The powder-coat finish is covered by warranty. See the warranty policy for duration and terms.',
 'boxel Parcel Drop Box — all-metal, keyless number lock',
 'An all-metal parcel drop box with a keyless number lock that receives parcels, groceries, laundry and returns. Made to order, delivered fully assembled.',
 '/images/parcel-drop-box-front.jpeg')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO product_images (product_id, image_url, alt_text, sort_order) VALUES
(1, '/images/parcel-drop-box-front.jpeg', 'boxel Parcel Drop Box in white, closed, showing the drop opening and the front access door', 1),
(1, '/images/parcel-drop-box-open.jpeg', 'boxel Parcel Drop Box with the front door open, showing the drop chute and storage compartment', 2);

INSERT INTO product_variants (product_id, name, color_hex, sku, price_adjustment, stock_quantity, is_active, sort_order) VALUES
(1, 'White', '#F2F2EF', 'BXL-PDB-01-WHT', 0.00, 0, 1, 1);

-- FAQs ------------------------------------------------------------------
INSERT INTO faqs (question, answer, sort_order, is_active) VALUES
('What is a boxel Parcel Drop Box?',
 'It is an all-metal drop box that receives parcels, groceries, laundry and returns when you cannot collect them right away, and holds them until you do. One unit can serve 3 to 4 homes.', 1, 1),
('How does the keyless number lock work?',
 'The front access door is secured by a number lock instead of a key, so there is nothing to carry or lose. Deliveries go in through the drop opening; only people who know the number can open the door to collect them.', 2, 1),
('Can it serve multiple homes?',
 'Yes. One Parcel Drop Box can serve 3 to 4 homes, which makes it practical for shared entrances, apartments and housing societies.', 3, 1),
('Is the product delivered assembled?',
 'Yes. Every boxel Parcel Drop Box is delivered fully assembled.', 4, 1),
('How does made-to-order production work?',
 'Each unit is made after you place your order. Before it ships, we share a video of its quality and functions so you can see exactly what you are getting.', 5, 1),
('Is shipping available across India?',
 'Yes. We offer free shipping across India.', 6, 1),
('When will my order be dispatched?',
 'Because every unit is made to order, dispatch timing depends on the current production queue. We confirm the expected dispatch date after your order is placed. Contact us for current timelines.', 7, 1),
('What is the warranty policy?',
 'The powder-coat finish is covered by warranty. The duration and terms are listed in our warranty policy on the Shipping & returns page.', 8, 1),
('Can I return or cancel an order?',
 'Please contact us as soon as possible if you need to cancel or return an order. Our current terms are set out on the Shipping & returns page.', 9, 1),
('How can I contact boxel?',
 'Call or WhatsApp us on +91 83100 18733, or send a message through the contact form on this website.', 10, 1);

-- Homepage hero ---------------------------------------------------------
INSERT INTO banners (placement, headline, subheadline, cta_text, cta_url, secondary_cta_text, secondary_cta_url,
  desktop_image_url, mobile_image_url, image_alt, is_active, sort_order) VALUES
('hero', 'Your space. Your peace of mind.',
 'Thoughtfully designed security and storage for modern Indian living.',
 'Explore the Parcel Drop Box', '/products/parcel-drop-box',
 'Discover boxel', '/about',
 '/images/parcel-drop-box-front.jpeg', '/images/parcel-drop-box-front.jpeg',
 'The boxel Parcel Drop Box, a white all-metal cabinet with a drop opening and a locking front door', 1, 1);

-- Social links (hidden until a real URL is entered in the admin) --------
INSERT INTO social_links (platform, url, is_active, sort_order) VALUES
('instagram', NULL, 0, 1), ('youtube', NULL, 0, 2), ('facebook', NULL, 0, 3), ('x', NULL, 0, 4)
ON DUPLICATE KEY UPDATE platform = platform;

-- Settings --------------------------------------------------------------
INSERT INTO store_settings (setting_key, setting_value) VALUES
('business_name', 'boxel'),
('business_tagline', 'Smart. Safe. Simple.'),
('business_supporting_line', 'Design that protects what matters.'),
('business_description', 'boxel: smart, safe solutions for modern Indian living. Secure parcel boxes, personal lockers, wall-hung workstations and more, designed to give you back your time, space and peace of mind.'),
('business_phone', '+918310018733'),
('business_whatsapp', '+918310018733'),
('business_email', ''),
('business_city', ''),
('business_state', ''),
('business_address', ''),
('business_hours', ''),
('store_name', ''),
('location_mode', 'service_area'),
('service_area_text', 'We deliver across India, with free shipping.'),
('map_url', ''),
('map_embed_url', ''),
('logo_url', '/images/boxel-logo-trimmed.png'),
('announcement_enabled', '1'),
('announcement_text', 'Designed for modern Indian living.'),
('announcement_link', '/about'),
('home_intro_heading', 'Meet the boxel Parcel Drop Box'),
('home_intro_body', 'Parcels, groceries, laundry and returns arrive when you are out. The Parcel Drop Box receives them safely and holds them until you are back — no waiting at home, no packages left at the door.'),
('home_quality_note', 'Before your product ships, we share a video of its quality and functions, so you see exactly what you are getting.'),
('shipping_fee', '0'),
('free_shipping_threshold', '0'),
('shipping_policy', 'We offer free shipping across India.\n\nEvery boxel product is made to order. After your order is placed, we confirm the expected dispatch date with you. Before your product ships, we share a video of its quality and functions.\n\nOnce your order is dispatched, tracking details are shared on your order page and by email.'),
('returns_policy', 'Each boxel product is made to order. If you need to cancel or return an order, please contact us as soon as possible on +91 83100 18733 and we will explain the options available for your order.'),
('warranty_policy', 'The powder-coat finish on boxel products is covered by warranty. Warranty duration and terms will be listed here. Contact us for details.'),
('privacy_policy', 'This policy explains what information boxel collects through this website and how it is used.\n\nWhat we collect: when you place an order, create an account, write a review, subscribe to updates or contact us, we collect the details you enter — such as your name, email address, phone number and delivery address.\n\nHow we use it: to process and deliver your orders, respond to your enquiries, send order and account emails, and send updates you have subscribed to.\n\nCookies: we use a single essential cookie to keep you signed in and to protect forms against misuse. Your cart is stored in your browser.\n\nSharing: we share delivery details with our logistics partners only as needed to deliver your order. We do not sell your personal information.\n\nYour choices: you can ask us to access, correct or delete your information by contacting us.'),
('terms_content', 'These terms apply to purchases made on this website.\n\nOrders: an order is confirmed once we accept it and notify you. Every product is made to order.\n\nPrices: prices are shown in Indian rupees (₹) and are confirmed at checkout.\n\nPayment: available payment methods are shown at checkout. An order is marked as paid only after payment is received.\n\nDelivery: we ship across India. See the Shipping & returns page for details.\n\nContact: for any question about these terms, contact us on +91 83100 18733.'),
('cod_enabled', '0'),
('bank_transfer_enabled', '0'),
('bank_transfer_instructions', 'After you place your order, our team will contact you with payment details. Your order is processed once payment is received.'),
('tax_enabled', '0'),
('tax_label', 'GST'),
('tax_rate', '18'),
('prices_include_tax', '1'),
('seo_default_title', 'boxel — Smart. Safe. Simple.'),
('seo_default_description', 'Smart, safe solutions for modern Indian living. Secure parcel drop boxes and more, made to order with free shipping across India.'),
('seo_og_image', '/images/parcel-drop-box-front.jpeg'),
('email_notify_customer_orders', '1'),
('email_notify_admin_orders', '1'),
('email_notify_enquiries', '1'),
('email_contact_ack', '1'),
('email_notify_newsletter', '0'),
('admin_notification_email', ''),
('newsletter_enabled', '1'),
('typography_font', 'albert-sans'),
('typography_base_size', '16'),
('typography_heading_weight', '400'),
('typography_body_weight', '420')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
