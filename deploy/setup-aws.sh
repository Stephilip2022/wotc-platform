#!/bin/bash
set -e

AWS_REGION="${AWS_REGION:-us-east-2}"
ECR_REPO_NAME="rockerbox-wotc"
APP_RUNNER_SERVICE_NAME="rockerbox-wotc"
APP_RUNNER_ROLE_NAME="rockerbox-apprunner-ecr-role"

echo "=== Rockerbox WOTC - AWS Initial Setup ==="
echo "Region: $AWS_REGION"
echo ""

if ! command -v aws &> /dev/null; then
  echo "ERROR: AWS CLI is not installed."
  echo "Install it from: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  exit 1
fi

echo "Checking AWS credentials..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "ERROR: AWS credentials not configured. Run 'aws configure' first."
  exit 1
fi
echo "AWS Account ID: $AWS_ACCOUNT_ID"
echo ""

echo "Step 1: Creating ECR repository..."
aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" 2>/dev/null || \
  aws ecr create-repository \
    --repository-name "$ECR_REPO_NAME" \
    --region "$AWS_REGION" \
    --image-scanning-configuration scanOnPush=true \
    --image-tag-mutability MUTABLE
echo "ECR repository ready: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"
echo ""

echo "Step 2: Creating IAM role for App Runner ECR access..."
TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "build.apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}'

aws iam get-role --role-name "$APP_RUNNER_ROLE_NAME" 2>/dev/null || \
  aws iam create-role \
    --role-name "$APP_RUNNER_ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY"

aws iam attach-role-policy \
  --role-name "$APP_RUNNER_ROLE_NAME" \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess" 2>/dev/null || true

ROLE_ARN=$(aws iam get-role --role-name "$APP_RUNNER_ROLE_NAME" --query 'Role.Arn' --output text)
echo "IAM Role ARN: $ROLE_ARN"
echo ""

echo "Step 3: Creating deployment IAM user for Replit..."
DEPLOY_USER_NAME="rockerbox-deployer"

aws iam get-user --user-name "$DEPLOY_USER_NAME" 2>/dev/null || \
  aws iam create-user --user-name "$DEPLOY_USER_NAME"

DEPLOY_POLICY='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeRepositories",
        "ecr:CreateRepository"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "apprunner:CreateService",
        "apprunner:UpdateService",
        "apprunner:DescribeService",
        "apprunner:ListServices",
        "apprunner:StartDeployment"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "'$ROLE_ARN'"
    }
  ]
}'

aws iam put-user-policy \
  --user-name "$DEPLOY_USER_NAME" \
  --policy-name "rockerbox-deploy-policy" \
  --policy-document "$DEPLOY_POLICY"

echo "Deployment user '$DEPLOY_USER_NAME' configured."
echo ""
echo "=== Setup Complete! ==="
echo ""
echo "IMPORTANT: Create access keys for the deployment user:"
echo "  aws iam create-access-key --user-name $DEPLOY_USER_NAME"
echo ""
echo "Then add these as secrets in Replit:"
echo "  AWS_ACCESS_KEY_ID = <AccessKeyId from above>"
echo "  AWS_SECRET_ACCESS_KEY = <SecretAccessKey from above>"
echo "  AWS_ACCOUNT_ID = $AWS_ACCOUNT_ID"
echo "  AWS_REGION = $AWS_REGION"
echo ""
echo "ECR Image URI: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"
echo "App Runner Role ARN: $ROLE_ARN"
