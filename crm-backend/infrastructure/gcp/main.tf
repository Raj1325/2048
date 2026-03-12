terraform {
  required_version = ">= 1.9"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "crm-terraform-state-gcp"
    prefix = "crm-backend"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {}
variable "region"     { default = "us-central1" }
variable "environment" { default = "production" }
variable "app_name"   { default = "crm-backend" }

locals {
  common_labels = {
    project     = var.app_name
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ─── Enable APIs ─────────────────────────────────────────────────────────────
resource "google_project_service" "services" {
  for_each = toset([
    "pubsub.googleapis.com",
    "bigquery.googleapis.com",
    "storage.googleapis.com",
    "identitytoolkit.googleapis.com",
    "cloudlogging.googleapis.com",
    "cloudmonitoring.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# ─── Pub/Sub Topics ──────────────────────────────────────────────────────────
resource "google_pubsub_topic" "auth_events" {
  name   = "crm-auth-events"
  labels = local.common_labels

  message_retention_duration = "86400s" # 24 hours

  depends_on = [google_project_service.services]
}

resource "google_pubsub_topic" "user_events" {
  name   = "crm-user-events"
  labels = local.common_labels

  message_retention_duration = "86400s"
}

# Dead-letter topics
resource "google_pubsub_topic" "auth_events_dlq" {
  name   = "crm-auth-events-dlq"
  labels = local.common_labels
}

# Subscriptions for analytics consumers
resource "google_pubsub_subscription" "auth_events_analytics" {
  name  = "crm-auth-events-analytics"
  topic = google_pubsub_topic.auth_events.name

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s" # 7 days
  retain_acked_messages      = false
  expiration_policy { ttl = "" } # never expire

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.auth_events_dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  labels = local.common_labels
}

# ─── BigQuery Dataset (analytics) ────────────────────────────────────────────
resource "google_bigquery_dataset" "crm" {
  dataset_id  = "crm_analytics"
  description = "CRM analytics and audit data"
  location    = var.region
  labels      = local.common_labels

  delete_contents_on_destroy = false
}

resource "google_bigquery_table" "auth_events" {
  dataset_id = google_bigquery_dataset.crm.dataset_id
  table_id   = "auth_events"
  labels     = local.common_labels

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  schema = jsonencode([
    { name = "event_type", type = "STRING", mode = "REQUIRED" },
    { name = "user_id",    type = "STRING", mode = "NULLABLE" },
    { name = "tenant_id",  type = "STRING", mode = "NULLABLE" },
    { name = "provider",   type = "STRING", mode = "NULLABLE" },
    { name = "ip_address", type = "STRING", mode = "NULLABLE" },
    { name = "user_agent", type = "STRING", mode = "NULLABLE" },
    { name = "timestamp",  type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ─── GCS Bucket (file uploads / exports) ─────────────────────────────────────
resource "google_storage_bucket" "crm" {
  name          = "${var.project_id}-crm-${var.environment}"
  location      = var.region
  force_destroy = false
  labels        = local.common_labels

  versioning { enabled = true }

  lifecycle_rule {
    condition { age = 365 }
    action    { type = "Delete" }
  }

  uniform_bucket_level_access = true
}

# ─── Service Account ──────────────────────────────────────────────────────────
resource "google_service_account" "crm_backend" {
  account_id   = "crm-backend-sa"
  display_name = "CRM Backend Service Account"
}

resource "google_project_iam_member" "pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.crm_backend.email}"
}

resource "google_project_iam_member" "bq_data_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.crm_backend.email}"
}

output "pubsub_auth_topic"  { value = google_pubsub_topic.auth_events.id }
output "pubsub_user_topic"  { value = google_pubsub_topic.user_events.id }
output "gcs_bucket"         { value = google_storage_bucket.crm.name }
output "service_account"    { value = google_service_account.crm_backend.email }
