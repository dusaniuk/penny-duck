resource "google_service_account" "api" {
  account_id   = "api-runtime"
  display_name = "Penny Duck API (Cloud Run)"
}

resource "google_service_account" "web" {
  account_id   = "web-runtime"
  display_name = "Penny Duck web (Cloud Run)"
}

resource "google_secret_manager_secret_iam_member" "api_reads_secrets" {
  for_each = google_secret_manager_secret.app

  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.api.member
}

resource "google_cloud_run_v2_service_iam_member" "web_invokes_api" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = google_service_account.web.member
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  name     = google_cloud_run_v2_service.web.name
  location = google_cloud_run_v2_service.web.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
