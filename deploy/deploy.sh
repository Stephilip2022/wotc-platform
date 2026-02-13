#!/bin/bash
set -e

AWS_REGION="${AWS_REGION:-us-east-2}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID}"
ECR_REPO_NAME="rockerbox-wotc"
IMAGE_TAG="${IMAGE_TAG:-latest}"
APP_RUNNER_SERVICE_NAME="rockerbox-wotc"

if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "ERROR: AWS_ACCOUNT_ID environment variable is required"
  exit 1
fi

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "ERROR: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required"
  exit 1
fi

ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
FULL_IMAGE="$ECR_URI/$ECR_REPO_NAME:$IMAGE_TAG"

echo "=== Rockerbox WOTC - AWS Deployment ==="
echo "Region: $AWS_REGION"
echo "ECR Repository: $ECR_REPO_NAME"
echo "Image: $FULL_IMAGE"
echo ""

echo "Step 1: Authenticating with ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_URI"

echo "Step 2: Creating ECR repository (if not exists)..."
aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" 2>/dev/null || \
  aws ecr create-repository --repository-name "$ECR_REPO_NAME" --region "$AWS_REGION" --image-scanning-configuration scanOnPush=true

echo "Step 3: Building Docker image..."
docker build -t "$ECR_REPO_NAME:$IMAGE_TAG" .

echo "Step 4: Tagging image..."
docker tag "$ECR_REPO_NAME:$IMAGE_TAG" "$FULL_IMAGE"

echo "Step 5: Pushing to ECR..."
docker push "$FULL_IMAGE"

echo ""
echo "=== Image pushed successfully! ==="
echo "Image URI: $FULL_IMAGE"
echo ""
echo "Next steps:"
echo "  1. Go to AWS App Runner in the console"
echo "  2. Create a new service using the ECR image: $FULL_IMAGE"
echo "  3. Configure environment variables (see deploy/env-template.txt)"
echo "  4. Set port to 5000"
echo "  5. Connect your custom domain"
