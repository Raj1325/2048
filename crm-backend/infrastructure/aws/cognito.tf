# ─── Cognito User Pool ────────────────────────────────────────────────────────
resource "aws_cognito_user_pool" "crm" {
  name = "${var.app_name}-${var.environment}"

  # Password policy
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Auto-verify email
  auto_verified_attributes = ["email"]

  # MFA (optional per tenant, enforced at app level)
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  # Schema: custom attributes for multi-tenant
  schema {
    name                     = "crm_user_id"
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    string_attribute_constraints {
      min_length = 1
      max_length = 36
    }
  }

  schema {
    name                     = "tenant_id"
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    string_attribute_constraints {
      min_length = 1
      max_length = 36
    }
  }

  # Email configuration via SES
  email_configuration {
    email_sending_account = "DEVELOPER"
    source_arn            = aws_ses_domain_identity.crm.arn
  }

  tags = local.common_tags
}

# ─── Cognito User Pool Client ─────────────────────────────────────────────────
resource "aws_cognito_user_pool_client" "crm" {
  name         = "${var.app_name}-client"
  user_pool_id = aws_cognito_user_pool.crm.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  # OAuth / social login
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  supported_identity_providers = ["COGNITO", "Google", "SignInWithApple"]

  callback_urls = ["https://app.yourcrm.com/auth/callback"]
  logout_urls   = ["https://app.yourcrm.com/auth/logout"]

  # Token validity
  access_token_validity  = 1     # hours
  refresh_token_validity = 30    # days
  id_token_validity      = 1     # hours

  token_validity_units {
    access_token  = "hours"
    refresh_token = "days"
    id_token      = "hours"
  }

  generate_secret = true
}

# ─── Google Identity Provider ─────────────────────────────────────────────────
resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.crm.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "email profile openid"
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
    name     = "name"
    picture  = "picture"
  }
}

# ─── Apple Identity Provider ──────────────────────────────────────────────────
resource "aws_cognito_identity_provider" "apple" {
  user_pool_id  = aws_cognito_user_pool.crm.id
  provider_name = "SignInWithApple"
  provider_type = "SignInWithApple"

  provider_details = {
    client_id        = var.apple_client_id
    team_id          = var.apple_team_id
    key_id           = var.apple_key_id
    private_key      = var.apple_private_key
    authorize_scopes = "email name"
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
  }
}

variable "google_client_id"     {}
variable "google_client_secret" { sensitive = true }
variable "apple_client_id"      {}
variable "apple_team_id"        {}
variable "apple_key_id"         {}
variable "apple_private_key"    { sensitive = true }

output "cognito_user_pool_id"  { value = aws_cognito_user_pool.crm.id }
output "cognito_client_id"     { value = aws_cognito_user_pool_client.crm.id }
output "cognito_client_secret" {
  value     = aws_cognito_user_pool_client.crm.client_secret
  sensitive = true
}
