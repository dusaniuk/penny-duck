# Only the secret containers live here. Values are added out of band with
# `gcloud secrets versions add` so they never land in the Terraform state.
locals {
  secrets = {
    "database-url"         = "DATABASE_URL"
    "better-auth-secret"   = "BETTER_AUTH_SECRET"
    "google-client-id"     = "GOOGLE_CLIENT_ID"
    "google-client-secret" = "GOOGLE_CLIENT_SECRET"
  }
}

resource "google_secret_manager_secret" "app" {
  for_each = local.secrets

  secret_id = each.key

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  depends_on = [google_project_service.enabled]
}
