-- Blog newsletter subscribers (supports email, SMS, or both)
CREATE TABLE IF NOT EXISTS blog_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,                    -- nullable: subscriber might use phone only
  phone TEXT,                    -- nullable: subscriber might use email only, E.164 format (+1234567890)
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),  -- which channel this subscription is for
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  confirmation_token UUID DEFAULT gen_random_uuid(),
  confirmation_code TEXT,        -- 6-digit code for SMS confirmation
  unsubscribe_token UUID DEFAULT gen_random_uuid(),
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- At least one contact method required
  CONSTRAINT email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL),
  -- Unique per channel: same person can subscribe via both email and SMS
  CONSTRAINT unique_email_sub UNIQUE (email, channel),
  CONSTRAINT unique_phone_sub UNIQUE (phone, channel)
);

-- Indexes
CREATE INDEX idx_blog_subscribers_status ON blog_subscribers(status);
CREATE INDEX idx_blog_subscribers_email ON blog_subscribers(email);
CREATE INDEX idx_blog_subscribers_phone ON blog_subscribers(phone);
CREATE INDEX idx_blog_subscribers_confirmation_token ON blog_subscribers(confirmation_token);
CREATE INDEX idx_blog_subscribers_unsubscribe_token ON blog_subscribers(unsubscribe_token);

-- Auto-update updated_at (reuses the existing trigger function from blog_posts)
CREATE TRIGGER trigger_blog_subscribers_updated_at
  BEFORE UPDATE ON blog_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION blog_posts_update_timestamp();
