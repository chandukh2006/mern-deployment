pipeline {
    agent any

    environment {
        AWS_REGION = 'us-east-1'
        ECR_REPO = '530683143872.dkr.ecr.us-east-1.amazonaws.com/mern-backend'
        BACKEND_HOST = '54.160.66.63'
        BACKEND_USER = 'ubuntu'
        S3_BUCKET = 'chandugroup.com'
        CLOUDFRONT_ID = credentials('cloudfront-distribution-id')
    }

    stages {

        stage('Checkout Source') {
            steps {
                checkout scm
            }
        }

        stage('Build Backend Docker Image') {
            steps {
                dir('mern/backend') {
                    sh '''
                    docker build -t mern-backend:${BUILD_NUMBER} .
                    docker tag mern-backend:${BUILD_NUMBER} ${ECR_REPO}:${BUILD_NUMBER}
                    docker tag mern-backend:${BUILD_NUMBER} ${ECR_REPO}:latest
                    '''
                }
            }
        }

        stage('Login to Amazon ECR') {
            steps {
                sh '''
                aws ecr get-login-password --region ${AWS_REGION} | \
                docker login --username AWS --password-stdin 530683143872.dkr.ecr.us-east-1.amazonaws.com
                '''
            }
        }

        stage('Push Image to ECR') {
            steps {
                sh '''
                docker push ${ECR_REPO}:${BUILD_NUMBER}
                docker push ${ECR_REPO}:latest
                '''
            }
        }

        stage('Deploy Backend') {
            steps {
                sshagent(['backend-ec2-key']) {
                    sh '''
ssh -o StrictHostKeyChecking=no ${BACKEND_USER}@${BACKEND_HOST} << EOF

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 530683143872.dkr.ecr.us-east-1.amazonaws.com

docker pull ${ECR_REPO}:latest

docker stop todo-backend || true
docker rm todo-backend || true

docker run -d \
  --name todo-backend \
  --restart always \
  --network mern-network \
  -e MONGO_URI=mongodb://mongodb:27017 \
  -p 5050:5050 \
  ${ECR_REPO}:latest

EOF
'''
                }
            }
        }

        stage('Build Frontend') {
            steps {
                dir('mern/frontend') {
                    sh '''
                    npm install
                    npm run build
                    '''
                }
            }
        }

        stage('Upload Frontend to S3') {
            steps {
                dir('mern/frontend') {
                    sh '''
                    aws s3 sync dist/ s3://${S3_BUCKET} --delete
                    '''
                }
            }
        }

        stage('Invalidate CloudFront Cache') {
            steps {
                sh '''
                aws cloudfront create-invalidation \
                  --distribution-id ${CLOUDFRONT_ID} \
                  --paths "/*"
                '''
            }
        }
    }

    post {
        success {
            echo "=================================="
            echo "Deployment Successful!"
            echo "=================================="
        }

        failure {
            echo "=================================="
            echo "Deployment Failed!"
            echo "=================================="
        }
    }
}