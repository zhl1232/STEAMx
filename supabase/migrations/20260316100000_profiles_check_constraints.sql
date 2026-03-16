-- Prevent negative coins / xp at the database level
ALTER TABLE profiles
  ADD CONSTRAINT profiles_coins_non_negative CHECK (coins >= 0),
  ADD CONSTRAINT profiles_xp_non_negative    CHECK (xp >= 0);
