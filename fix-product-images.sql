-- =====================================================
-- FreshMeat: Fix product image_url values.
--
-- The seed data used placeholder codes like
--   IMG-FM-CHICKENCURRY01
-- in the image_url column. The new image system expects
-- local paths like
--   /images/chicken-curry-cut.jpg
--
-- This script maps the old placeholder codes to the
-- correct local image paths for ANY existing rows.
-- Run it against the 'freshmeat' database.
-- =====================================================

USE freshmeat;

-- Map old placeholder image_url -> new local path
UPDATE products SET image_url = '/images/chicken-curry-cut.jpg'          WHERE name = 'Chicken Curry Cut';
UPDATE products SET image_url = '/images/chicken-boneless-breast.jpg'    WHERE name = 'Chicken Boneless Breast';
UPDATE products SET image_url = '/images/mutton-curry-cut.jpg'          WHERE name = 'Mutton Curry Cut';
UPDATE products SET image_url = '/images/mutton-biryani-cut.jpg'        WHERE name = 'Mutton Biryani Cut';
UPDATE products SET image_url = '/images/mutton-keema.jpg'              WHERE name = 'Mutton Keema';
UPDATE products SET image_url = '/images/beef-steak-cut.jpg'            WHERE name = 'Beef Steak Cut';
UPDATE products SET image_url = '/images/beef-curry-cut.jpg'            WHERE name = 'Beef Curry Cut';
UPDATE products SET image_url = '/images/fresh-fish-rohu.jpg'           WHERE name = 'Fresh Fish - Rohu';
UPDATE products SET image_url = '/images/pomfret-fish.jpg'              WHERE name = 'Pomfret Fish';
UPDATE products SET image_url = '/images/country-chicken.jpg'           WHERE name = 'Country Chicken';
UPDATE products SET image_url = '/images/farm-fresh-eggs.jpg'           WHERE name = 'Farm Fresh Eggs (Pack of 12)';
UPDATE products SET image_url = '/images/chicken-tikka.jpg'             WHERE name = 'Chicken Tikka (Ready-to-Cook)';
UPDATE products SET image_url = '/images/mutton-seekh-kebab.jpg'        WHERE name = 'Mutton Seekh Kebab (Ready-to-Cook)';
UPDATE products SET image_url = '/images/prawns.jpg'                    WHERE name = 'Prawns - Peeled & Cleaned';
UPDATE products SET image_url = '/images/chicken-wings.jpg'             WHERE name = 'Chicken Wings';

-- OPTIONAL: If any row still has a leftover placeholder code (e.g. IMG-FM-...),
-- this catches rows not matched above.
UPDATE products SET image_url = '/images/default-meat.jpg' WHERE image_url LIKE 'IMG-FM-%' OR image_url LIKE 'https://placehold.co%';
