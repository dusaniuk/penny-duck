# Infrastructure (Terraform, Google Cloud)

Penny Duck runs on Cloud Run in `europe-west3` (Frankfurt). The database stays on Neon. Everything in GCP except the project itself and the state bucket is defined here.

| File           | What it holds                                                      |
| -------------- | ------------------------------------------------------------------ |
| `versions.tf`  | Terraform and provider versions, GCS state backend                 |
| `variables.tf` | Inputs; real values go in `terraform.tfvars` (git-ignored)         |
| `project.tf`   | Enabled APIs, monthly budget alert (40 PLN)                        |
| `registry.tf`  | Artifact Registry repo for images (keeps the 5 newest per image)   |
| `secrets.tf`   | Secret Manager secrets (containers only, never values)             |
| `iam.tf`       | Runtime service accounts and who may call what                     |
| `run.tf`       | `api` and `web` services, `migrate` job                            |
| `github.tf`    | Workload Identity Federation + deployer account for GitHub Actions |

Terraform owns the infrastructure; CI (`.github/workflows/deploy.yml`) owns which image runs. Image changes are ignored by Terraform.

## The everyday loop

```bash
cd infra
terraform plan    # shows what would change; read it
terraform apply   # makes it so (asks for confirmation)
```

`plan` before every `apply`. A plan that wants to _destroy_ something you didn't mean to touch is the signal to stop.

## One-off bootstrap

1. Create a project in the Cloud Console, link billing, then:

   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project <project_id>
   gcloud projects describe <project_id> --format='value(projectNumber)'
   gcloud billing accounts list
   ```

   Terraform enables APIs through the Service Usage API, which a new project has switched off, so turn it on by hand once:

   ```bash
   gcloud services enable serviceusage.googleapis.com cloudresourcemanager.googleapis.com --project <project_id>
   ```

2. Create the state bucket (versioned, so a bad apply can be recovered):

   ```bash
   gcloud storage buckets create gs://<project_id>-tfstate --location=europe-west3 --uniform-bucket-level-access
   gcloud storage buckets update gs://<project_id>-tfstate --versioning
   ```

3. `cp terraform.tfvars.example terraform.tfvars` and fill it in, then:

   ```bash
   terraform init -backend-config="bucket=<project_id>-tfstate"
   ```

4. Create the secrets first. Cloud Run refuses to start a revision whose secret has no version yet:

   ```bash
   terraform apply -target=google_secret_manager_secret.app
   ```

5. Add the values (they never touch Terraform state):

   ```bash
   printf '%s' "$VALUE" | gcloud secrets versions add database-url --data-file=-
   printf '%s' "$VALUE" | gcloud secrets versions add better-auth-secret --data-file=-
   printf '%s' "$VALUE" | gcloud secrets versions add google-client-id --data-file=-
   printf '%s' "$VALUE" | gcloud secrets versions add google-client-secret --data-file=-
   ```

6. `terraform apply`. The services start with Google's hello image: `web_url` answers 200 and `api_url` answers 403 (IAM is enforced).

7. Put the outputs in GitHub → Settings → Secrets and variables → Actions → **Variables** (none of them are secret):

   | Variable             | Value                                  |
   | -------------------- | -------------------------------------- |
   | `GCP_PROJECT_ID`     | `<project_id>`                         |
   | `GCP_REGION`         | `europe-west3`                         |
   | `GCP_WIF_PROVIDER`   | `terraform output -raw wif_provider`   |
   | `GCP_DEPLOYER_EMAIL` | `terraform output -raw deployer_email` |
   | `API_URL`            | `terraform output -raw api_url`        |

The next push to `main` builds both images, runs migrations, and deploys.

## Rotating a secret

```bash
printf '%s' "$NEW" | gcloud secrets versions add <name> --data-file=-
gh workflow run deploy.yml   # new revisions resolve "latest" to the new version
gcloud secrets versions disable <old-version> --secret <name>
```

## Custom domain

Cloud Run domain mapping isn't available in `europe-west3`. Options: a Cloudflare Worker proxying to `web_url`, moving to `europe-west1` with domain mapping (change `region`, apply, redeploy), or a global load balancer (~$18/month). Firebase Hosting won't work: it only forwards a cookie named `__session`.
