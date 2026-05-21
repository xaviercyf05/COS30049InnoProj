ALTER TABLE EmailVerificationTokens
  DROP CHECK chk_email_verification_token_type;

ALTER TABLE EmailVerificationTokens
  ADD CONSTRAINT chk_email_verification_token_type CHECK (TokenType IN ('account_activation', 'password_reset', 'login_otp'));