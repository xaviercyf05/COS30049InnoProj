-- Email login code migration
-- Adds the passwordless email-code login token type to EmailVerificationTokens.

ALTER TABLE EmailVerificationTokens
  DROP CONSTRAINT chk_email_verification_token_type;

ALTER TABLE EmailVerificationTokens
  ADD CONSTRAINT chk_email_verification_token_type
  CHECK (TokenType IN ('account_activation', 'password_reset', 'login_code'));