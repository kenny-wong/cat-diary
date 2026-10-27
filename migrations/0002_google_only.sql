-- Sign-in is Google only: no passwords, reset emails or login rate limiting any more.
DROP TABLE password_resets;
DROP TABLE auth_failures;
ALTER TABLE users DROP COLUMN password_hash;
ALTER TABLE users DROP COLUMN email_verified;
