variable "project_id" {
  description = "GCP project ID, e.g. penny-duck-123456"
  type        = string
}

variable "project_number" {
  description = "GCP project number (gcloud projects describe <id> --format='value(projectNumber)'); used to build the deterministic run.app URLs"
  type        = string
}

variable "billing_account_id" {
  description = "Billing account linked to the project (gcloud billing accounts list)"
  type        = string
}

variable "budget_currency" {
  description = "Must match the billing account's currency"
  type        = string
  default     = "USD"
}

variable "region" {
  type    = string
  default = "europe-west3"
}

variable "github_repository_id" {
  description = "Numeric ID of dusaniuk/penny-duck (gh api repos/dusaniuk/penny-duck --jq .id); IDs can't be reused like names can"
  type        = string
  default     = "1426190247"
}

variable "github_owner_id" {
  description = "Numeric ID of the repo owner (gh api repos/dusaniuk/penny-duck --jq .owner.id)"
  type        = string
  default     = "20459871"
}
