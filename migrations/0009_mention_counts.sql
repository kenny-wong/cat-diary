-- How many times a page has mentioned each friend (the most it has ever been). A save that raises it
-- tells the friend again, so each new "@Name" on a page sends a notification, but re-saving doesn't.
ALTER TABLE page_mentions ADD COLUMN times INTEGER NOT NULL DEFAULT 1;
