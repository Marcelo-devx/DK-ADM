INSERT INTO app_settings (key, value)
VALUES ('auth_redirect_url', 'https://dk-l-andpage.vercel.app/login')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;