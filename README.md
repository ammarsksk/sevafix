# SevaFix

SevaFix is an AWS-native companion for Indian government benefit applications. Its two user journeys are clearly separated: prepare a new application from scratch, or import/select a failed application and diagnose it as a grievance. Both journeys can use cited AI diagnosis and restart as a corrected application. Reviewer routes support policy-version and source-change workflows.

## Repository map

- `frontend/` — Next.js citizen and reviewer web app
- `backend/` — AWS SAM serverless backend and tests
- `backend/data/` — reviewed policy manifests and source documents
- `infra/bootstrap/` — least-privilege deployment user/role policies
- `SEVAFIX_AWS_BLUEPRINT.md` — architecture and workflow design
- `DATA_INGESTION_AND_ACCEPTANCE_REPORT.md` — source provenance and acceptance evidence
- `AWS_SETUP.md` — AWS account and CLI setup

## Current development deployment

- Region: `ap-south-1`
- CloudFormation stack: `sevafix-dev`
- Authentication: Amazon Cognito
- API/data pipeline: API Gateway, Lambda, Step Functions, S3, DynamoDB, Textract
- AI diagnosis: Amazon Bedrock with reviewed-policy fallback grounding

No AWS access keys are stored in this repository. Local environment files, dependencies, build output, Python caches, and SAM artifacts are ignored.

## Run the frontend

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

See `frontend/README.md` for configuration and full-browser testing.

## Test and deploy the backend

```powershell
cd backend
python -m pytest
sam build
sam deploy --config-env dev
```

The deployment profile and non-secret development parameters are in `backend/samconfig.toml`. See `backend/README.md` before deploying to another AWS account or environment.
