import gql from 'graphql-tag';

export const authTypeDefs = gql`
  # ─── Enums ──────────────────────────────────────────────────────────────────

  enum UserRole {
    SUPER_ADMIN
    TENANT_ADMIN
    MANAGER
    MEMBER
    READ_ONLY
  }

  enum TenantPlan {
    FREE
    STARTER
    PROFESSIONAL
    ENTERPRISE
  }

  enum TenantStatus {
    ACTIVE
    SUSPENDED
    TRIAL
    CANCELLED
  }

  enum AuthProvider {
    LOCAL
    GOOGLE
    APPLE
    COGNITO
  }

  # ─── Types ──────────────────────────────────────────────────────────────────

  type User {
    id: ID!
    email: String!
    firstName: String
    lastName: String
    fullName: String
    avatarUrl: String
    role: UserRole!
    isActive: Boolean!
    emailVerified: Boolean!
    lastLoginAt: String
    createdAt: String!
  }

  type Tenant {
    id: ID!
    name: String!
    domain: String!
    slug: String!
    logoUrl: String
    plan: TenantPlan!
    status: TenantStatus!
    settings: TenantSettings
  }

  type TenantSettings {
    allowGoogleLogin: Boolean!
    allowAppleLogin: Boolean!
    allowPasswordLogin: Boolean!
    requireMfa: Boolean!
    sessionTimeoutMinutes: Int!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    expiresIn: Int!
    tokenType: String!
    user: User!
    tenant: Tenant!
  }

  type MessagePayload {
    success: Boolean!
    message: String!
  }

  # ─── Inputs ─────────────────────────────────────────────────────────────────

  input LoginInput {
    email: String!
    password: String!
    tenantDomain: String!
  }

  input RegisterInput {
    email: String!
    password: String!
    firstName: String!
    lastName: String!
    tenantDomain: String!
  }

  input GoogleAuthInput {
    idToken: String!
    tenantDomain: String!
  }

  input AppleAuthInput {
    identityToken: String!
    authorizationCode: String!
    tenantDomain: String!
    firstName: String
    lastName: String
  }

  input RefreshTokenInput {
    refreshToken: String!
  }

  input ForgotPasswordInput {
    email: String!
    tenantDomain: String!
  }

  input ResetPasswordInput {
    token: String!
    newPassword: String!
  }

  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  input CreateTenantInput {
    name: String!
    domain: String!
    slug: String!
    adminEmail: String!
    adminPassword: String!
    adminFirstName: String!
    adminLastName: String!
    plan: TenantPlan
  }

  input UpdateProfileInput {
    firstName: String
    lastName: String
    avatarUrl: String
  }

  # ─── Queries ────────────────────────────────────────────────────────────────

  type Query {
    me: User!
    myTenant: Tenant!
    tenantByDomain(domain: String!): Tenant
    validateToken: Boolean!
  }

  # ─── Mutations ──────────────────────────────────────────────────────────────

  type Mutation {
    # Standard auth
    login(input: LoginInput!): AuthPayload!
    register(input: RegisterInput!): AuthPayload!
    logout(refreshToken: String!): MessagePayload!
    revokeAllSessions: MessagePayload!

    # Token management
    refreshToken(input: RefreshTokenInput!): AuthPayload!

    # Password management
    forgotPassword(input: ForgotPasswordInput!): MessagePayload!
    resetPassword(input: ResetPasswordInput!): MessagePayload!
    changePassword(input: ChangePasswordInput!): MessagePayload!

    # Email verification
    verifyEmail(token: String!): MessagePayload!
    resendVerificationEmail: MessagePayload!

    # Social login
    loginWithGoogle(input: GoogleAuthInput!): AuthPayload!
    loginWithApple(input: AppleAuthInput!): AuthPayload!

    # Profile
    updateProfile(input: UpdateProfileInput!): User!

    # Tenant management (SUPER_ADMIN / TENANT_ADMIN only)
    createTenant(input: CreateTenantInput!): Tenant!
  }
`;
