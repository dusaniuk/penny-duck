terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }

  # The bucket is passed at init time (backend blocks can't read variables):
  #   terraform init -backend-config="bucket=<project_id>-tfstate"
  backend "gcs" {
    prefix = "penny-duck"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  # The billing budgets API needs a quota project when called with user
  # credentials (gcloud auth application-default login).
  billing_project       = var.project_id
  user_project_override = true
}
