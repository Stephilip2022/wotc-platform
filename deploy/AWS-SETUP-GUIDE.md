# Rockerbox WOTC - AWS Deployment Guide

## Overview
This guide walks you through deploying the Rockerbox WOTC Platform to AWS App Runner, while continuing to use Replit for development and testing.

## Architecture
```
Replit (Development) → Docker Build → AWS ECR → AWS App Runner (Production)
                                                       ↓
                                               Neon PostgreSQL (shared DB)
                                               Resend, Twilio, Stripe (external services)
```

## Prerequisites
- AWS Account (created)
- AWS CLI installed on your local machine (for initial setup)
- Docker installed on your local machine (for building images)

---

## Step 1: Install AWS CLI (on your local computer)

### Windows
Download and run: https://awscli.amazonaws.com/AWSCLIV2.msi

### Mac
```bash
brew install awscli
```

### Verify installation
```bash
aws --version
```

---

## Step 2: Create an Admin IAM User (do NOT use root credentials)

AWS best practice: Never use your root account for day-to-day tasks. Create an IAM admin user first.

1. Go to **AWS Console** → Search for **IAM** → **Users** → **Create user**
2. Username: `rockerbox-admin`
3. Check **Provide user access to the AWS Management Console** (optional)
4. Select **Attach policies directly** → Check **AdministratorAccess**
5. Click **Create user**
6. Select the new user → **Security credentials** tab → **Create access key**
7. Select **Command Line Interface (CLI)** → Acknowledge → **Create**
8. **Save the Access Key ID and Secret Access Key** — you'll need them next

### Configure AWS CLI

Open a terminal on your local computer and run:
```bash
aws configure
```

Enter:
- **AWS Access Key ID**: (from the IAM user you just created)
- **AWS Secret Access Key**: (from the IAM user you just created)
- **Default region**: us-east-2
- **Default output format**: json

---

## Step 3: Run the AWS Setup Script

On your local computer, clone or download the `deploy/` folder, then run:
```bash
chmod +x deploy/setup-aws.sh
bash deploy/setup-aws.sh
```

This script will:
1. Create an ECR (container registry) repository
2. Create an IAM role for App Runner
3. Create a deployment IAM user with limited permissions
4. Output the credentials you need

### Create deployment access keys
After the script finishes, run:
```bash
aws iam create-access-key --user-name rockerbox-deployer
```

Save the `AccessKeyId` and `SecretAccessKey` — you'll add these as secrets in Replit.

---

## Step 4: Add AWS Secrets to Replit

In your Replit project, add these secrets:
- `AWS_ACCESS_KEY_ID` = AccessKeyId from Step 3
- `AWS_SECRET_ACCESS_KEY` = SecretAccessKey from Step 3
- `AWS_ACCOUNT_ID` = Your AWS account ID (12-digit number)
- `AWS_REGION` = us-east-2

---

## Step 5: Build and Push Docker Image

### Option A: Build locally (recommended for first deployment)
On your local computer with Docker installed:

```bash
# Clone/download your Replit project files
# Navigate to the project directory

# Login to ECR
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-2.amazonaws.com

# Build the image
docker build -t rockerbox-wotc .

# Tag it
docker tag rockerbox-wotc:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-2.amazonaws.com/rockerbox-wotc:latest

# Push to ECR
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-2.amazonaws.com/rockerbox-wotc:latest
```

Replace `YOUR_ACCOUNT_ID` with your actual 12-digit AWS account ID.

### Option B: Use the deploy script
```bash
chmod +x deploy/deploy.sh
AWS_ACCOUNT_ID=YOUR_ACCOUNT_ID bash deploy/deploy.sh
```

---

## Step 6: Create App Runner Service

1. Go to **AWS Console** → Search for **App Runner** → **Create service**

2. **Source and deployment**:
   - Source: **Container registry** → **Amazon ECR**
   - Image URI: `YOUR_ACCOUNT_ID.dkr.ecr.us-east-2.amazonaws.com/rockerbox-wotc:latest`
   - Deployment trigger: **Manual** (or Automatic if you want auto-deploy on image push)
   - ECR access role: Select `rockerbox-apprunner-ecr-role`

3. **Configure service**:
   - Service name: `rockerbox-wotc`
   - CPU: 1 vCPU (can increase later)
   - Memory: 2 GB (can increase later)
   - Port: `5000`
   - Environment variables: Add all variables from `deploy/env-template.txt`

4. **Auto scaling**:
   - Min instances: 1
   - Max instances: 5 (adjust based on expected traffic)
   - Max concurrency: 100

5. **Health check**:
   - Protocol: HTTP
   - Path: `/api/health` (or just `/`)
   - Interval: 10 seconds
   - Timeout: 5 seconds

6. Click **Create & deploy**

---

## Step 7: Connect Custom Domain

1. In App Runner console, select your service
2. Go to **Custom domains** tab → **Add domain**
3. Enter your domain (e.g., `app.rockerbox.com`)
4. AWS will provide CNAME records
5. Add these CNAME records in your domain registrar's DNS settings
6. Wait for validation (can take up to 48 hours, usually ~30 minutes)

---

## Step 8: Update Production Environment Variables

Important variables to update for production:
- `APP_BASE_URL`: Set to your custom domain (e.g., `https://app.rockerbox.com`)
- `VITE_CLERK_PUBLISHABLE_KEY`: May need a production Clerk key
- Update Clerk dashboard with your production domain

---

## Ongoing Deployments

After initial setup, deploying updates is simple:

1. Make changes in Replit (develop and test)
2. When ready, build and push a new Docker image:
   ```bash
   docker build -t rockerbox-wotc .
   docker tag rockerbox-wotc:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-2.amazonaws.com/rockerbox-wotc:latest
   docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-2.amazonaws.com/rockerbox-wotc:latest
   ```
3. In App Runner console, click **Deploy** (if not using automatic deployment)

---

## Cost Estimates

With AWS App Runner (pay-per-use):
- **Provisioned instances**: ~$5/month per vCPU (when idle with min 1 instance)
- **Active instances**: ~$0.064/vCPU-hour when handling requests
- **Memory**: ~$0.007/GB-hour
- **Estimated monthly cost**: $15-50/month for low-to-moderate traffic

Compare with:
- EC2: $30-80/month (always running)
- ECS/Fargate: $20-60/month
- Replit deployment: Included in plan

---

## Troubleshooting

### Image fails to build
- Ensure all files are included (check `.dockerignore`)
- Verify `npm run build` works locally first

### App Runner deployment fails
- Check App Runner logs in the console
- Verify all required environment variables are set
- Ensure the health check path returns 200

### Database connection issues
- Verify `DATABASE_URL` is correctly set in App Runner environment
- Ensure Neon database allows connections from AWS (it does by default)

### Custom domain not working
- Verify CNAME records are correct in DNS
- Wait for SSL certificate validation (can take 30+ minutes)
- Check App Runner custom domains tab for validation status
