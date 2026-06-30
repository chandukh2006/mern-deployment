pipeline {
    agent any

    environment {
        AWS_REGION       = 'ap-south-1'
        ECR_REPO         = '123456789012.dkr.ecr.ap-south-1.amazonaws.com/todo-backend'
        IMAGE_TAG        = "${env.BUILD_NUMBER}"
        S3_BUCKET        = 'www.mydomain.com'
        CLOUDFRONT_ID    = 'EXXXXXXXXXXXXX'
        EC2_HOST         = 'ec2-user@<EC2_PUBLIC_IP_OR_DNS>'
        REACT_APP_API_URL = 'https://api.mydomain.com/api'
    }

    stages {

        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/<your-username>/mern-todo-aws.git'
            }
        }

        stage('Backend: Build & Push to ECR') {
            steps {
                dir('backend') {
                    sh """
                        aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO}
                        docker build -t ${ECR_REPO}:${IMAGE_TAG} -t ${ECR_REPO}:latest .
                        docker push ${ECR_REPO}:${IMAGE_TAG}
                        docker push ${ECR_REPO}:latest
                    """
                }
            }
        }

        stage('Backend: Deploy to EC2') {
            steps {
                sshagent(credentials: ['ec2-ssh-key']) {
                    sh """
                        ssh -o StrictHostKeyChecking=no ${EC2_HOST} '
                            aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO} &&
                            docker pull ${ECR_REPO}:latest &&
                            docker stop todo-backend || true &&
                            docker rm todo-backend || true &&
                            docker run -d --name todo-backend --restart always -p 5000:5000 \
                                -e MONGO_URI="${MONGO_URI}" \
                                ${ECR_REPO}:latest
                        '
                    """
                }
            }
        }

        stage('Frontend: Build') {
            steps {
                dir('frontend') {
                    sh """
                        echo "REACT_APP_API_URL=${REACT_APP_API_URL}" > .env.production
                        npm install
                        npm run build
                    """
                }
            }
        }

        stage('Frontend: Deploy to S3') {
            steps {
                dir('frontend') {
                    sh """
                        aws s3 sync build/ s3://${S3_BUCKET} --delete
                    """
                }
            }
        }

        stage('Invalidate CloudFront Cache') {
            steps {
                sh """
                    aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_ID} --paths "/*"
                """
            }
        }
    }

    post {
        success {
            echo 'Deployment completed successfully!'
        }
        failure {
            echo 'Deployment failed. Check logs above.'
        }
    }
}
