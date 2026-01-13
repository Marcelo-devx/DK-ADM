INSERT INTO app_settings (key, value)
VALUES ('logistics_api_url', 'https://api.getcircuit.com/public/v0.2b')
ON CONFLICT (key) DO UPDATE
SET value = 'https://api.getcircuit.com/public/v0.2b';