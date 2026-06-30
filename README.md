# MERN Todo App — Full AWS Production Deployment Guide

A simple Todo app (React + Node/Express + MongoDB) wired up to deploy exactly the way an interviewer described:

- **Frontend**: React static build → S3 → CloudFront (CDN)
- **Backend**: Node.js/Express → Docker container on an EC2 instance
- **Database**: MongoDB (Atlas, or self-hosted on EC2/Docker)
- **Domain + SSL**: Route 53 (registrar + DNS) + AWS Certificate Manager (ACM)
- **CI/CD**: Jenkins pipeline, Docker images

---

## 1. Repo structure

```
mern-todo-aws/
├── backend/          # Express API + Dockerfile
├── frontend/         # React app + Dockerfile (for local docker testing)
├── docker-compose.yml  # local dev: mongo + backend + frontend
├── Jenkinsfile        # CI/CD pipeline
└── README.md
```

## 2. Run it locally first

```bash
git clone https://github.com/<you>/mern-todo-aws.git
cd mern-todo-aws
docker-compose up --build
```
Frontend → http://localhost:3000, Backend → http://localhost:5000/api/todos. Confirm CRUD works before touching AWS.

---

## 3. Database — MongoDB Atlas (recommended over self-hosting)

1. Create a free cluster at MongoDB Atlas.
2. Network Access → allow your EC2 instance's IP (or 0.0.0.0/0 temporarily, then lock down).
3. Database Access → create a user/password.
4. Copy the connection string into `backend/.env` as `MONGO_URI`.

(Self-hosting Mongo in a Docker container on the same EC2 instance also works — that's what `docker-compose.yml` does for local testing — but Atlas is easier to manage in production and is what most interviewers expect for "managed DB.")

---

## 4. Backend — Dockerize and run on EC2

### 4.1 Launch EC2
- Amazon Linux 2023, t2.micro (free tier).
- Security group: allow inbound 22 (SSH, your IP only), 5000 (or just 80/443 if you put Nginx in front), and 443/80 if using a reverse proxy.
- Create/download a key pair for SSH.

### 4.2 Install Docker on EC2
```bash
sudo yum update -y
sudo yum install docker -y
sudo service docker start
sudo usermod -aG docker ec2-user
```

### 4.3 Push image to ECR (so Jenkins/EC2 can pull it)
```bash
aws ecr create-repository --repository-name todo-backend
# Build locally or in Jenkins:
docker build -t todo-backend ./backend
docker tag todo-backend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/todo-backend:latest
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/todo-backend:latest
```

### 4.4 Run on EC2
```bash
docker pull <account-id>.dkr.ecr.<region>.amazonaws.com/todo-backend:latest
docker run -d --name todo-backend --restart always -p 5000:5000 \
  -e MONGO_URI="<your atlas connection string>" \
  <account-id>.dkr.ecr.<region>.amazonaws.com/todo-backend:latest
```

### 4.5 Put HTTPS in front of the backend
Easiest path: put an **Application Load Balancer (ALB)** in front of the EC2 instance, attach an ACM certificate to the ALB listener (443), and target group → EC2:5000. This gives you `https://api.mydomain.com` cleanly, and ACM certs on EC2 directly otherwise require manual Nginx + certbot config (ACM certs can't be installed directly on EC2 — they're only usable via ALB/CloudFront/API Gateway).

---

## 5. Domain — Route 53

1. **Register the domain in Route 53** (Registered Domains → Register Domain). The interviewer specifically wants it bought through Route 53, not GoDaddy, so Route 53 is both registrar and DNS host — no nameserver delegation hassle.
2. Route 53 auto-creates a **Hosted Zone** for the domain.

---

## 6. SSL/TLS — AWS Certificate Manager (ACM)

You need **two** certificates because S3/CloudFront and ALB are in different "regions" for ACM purposes:

1. **For CloudFront (frontend)**: request the cert in ACM in **us-east-1** (CloudFront only accepts certs from us-east-1, regardless of where your bucket/users are), for `mydomain.com` and `www.mydomain.com`.
2. **For ALB (backend API)**: request a cert in ACM in **your EC2/ALB region** for `api.mydomain.com`.
3. Validate both via DNS — ACM gives you a CNAME record to add; since your domain is already in Route 53, click "Create record in Route 53" and it auto-validates in a few minutes.

---

## 7. Frontend — S3 + CloudFront

### 7.1 Build the React app
```bash
cd frontend
echo "REACT_APP_API_URL=https://api.mydomain.com/api" > .env.production
npm install
npm run build
```

### 7.2 Create S3 bucket
- Bucket name **must match the domain**: `www.mydomain.com` (and optionally a redirect bucket `mydomain.com` → `www.mydomain.com`).
- Keep "Block all public access" ON — CloudFront will access it privately via Origin Access Control (OAC), not a public bucket policy. This is the modern, secure approach (no more public S3 website hosting needed).

```bash
aws s3 mb s3://www.mydomain.com
aws s3 sync build/ s3://www.mydomain.com --delete
```

### 7.3 Create CloudFront distribution
- Origin: your S3 bucket (select it from the dropdown; CloudFront will offer to set up Origin Access Control automatically and update the bucket policy for you).
- Viewer protocol policy: **Redirect HTTP to HTTPS**.
- Alternate domain names (CNAMEs): `mydomain.com`, `www.mydomain.com`.
- Custom SSL certificate: select the **us-east-1 ACM cert** from step 6.
- Default root object: `index.html`.
- **Error pages**: add a custom error response for 403/404 → `/index.html`, HTTP 200 (required for React Router client-side routing to work).

### 7.4 Point Route 53 at CloudFront
In your Hosted Zone, create:
- `A` record (Alias) for `mydomain.com` → CloudFront distribution.
- `A` record (Alias) for `www.mydomain.com` → CloudFront distribution.

### 7.5 Point Route 53 at the backend
- `A` record (Alias) for `api.mydomain.com` → your ALB.

---

## 8. Jenkins CI/CD

The included `Jenkinsfile` does, on every push to `main`:
1. Checkout code.
2. Build backend Docker image, push to ECR.
3. SSH into EC2, pull latest image, restart container.
4. Build React app with the production API URL baked in.
5. Sync the build to S3.
6. Invalidate the CloudFront cache so users get the new files immediately.

### Jenkins setup checklist
- Install plugins: Docker Pipeline, SSH Agent, Pipeline AWS Steps, Git.
- Add credentials in Jenkins (Manage Jenkins → Credentials):
  - `ec2-ssh-key`: SSH private key for the EC2 instance.
  - AWS credentials (or better, attach an **IAM role** to the Jenkins EC2 instance with permissions for ECR, S3, CloudFront, and EC2 SSH access — avoids storing AWS keys at all).
- Update the placeholders at the top of `Jenkinsfile` (account ID, region, bucket name, CloudFront distribution ID, EC2 host, domain).
- Create a Multibranch Pipeline or regular Pipeline job pointing at your GitHub repo, pointing to this `Jenkinsfile`.
- Optional: add a GitHub webhook so pushes trigger the build automatically.

---

## 9. Architecture summary

```
User Browser
   │
   ├── https://mydomain.com  ──► Route 53 ──► CloudFront ──► S3 (React static build)
   │
   └── https://api.mydomain.com ──► Route 53 ──► ALB (ACM cert) ──► EC2 (Docker: Node/Express)
                                                                          │
                                                                          └──► MongoDB Atlas
```

CI/CD: GitHub push → Jenkins → builds Docker image → pushes to ECR → deploys to EC2; builds React → syncs to S3 → invalidates CloudFront.

---

## 10. Suggested talking points for the interview

- Why S3+CloudFront for the frontend instead of EC2: it's a static SPA build, so a CDN-backed object store is cheaper, scales infinitely, and needs no server management.
- Why ALB in front of EC2 rather than installing ACM cert directly on the box: ACM certs are only attachable to CloudFront, ALB/NLB, and API Gateway — not directly to EC2 — so an ALB is the standard way to terminate TLS for an EC2-hosted API.
- Why Route 53 as registrar: keeps domain + DNS + ACM validation in one place, avoids cross-provider nameserver delegation issues.
- Why Docker + ECR: consistent build artifact from Jenkins to EC2, easy rollback by re-pulling a previous image tag.
- Could mention scaling path: replace single EC2 + Docker run with an ECS/Fargate service or an Auto Scaling Group behind the same ALB for production-grade resilience.
