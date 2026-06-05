pipeline {

agent any

triggers {
    githubPush()
}

environment {
    SERVER = "root@213.210.36.52"
    PROJECT_PATH = "/repos/logistics-ERP_FE_BE"
    BRANCH = "main"
    APP_NAME = "logistics-erp"
}

stages {

    stage('Checkout') {
        steps {
            echo "Checking latest code from GitHub..."
            checkout scm
        }
    }

    stage('Deploy') {
        steps {
            echo "Deployment started..."

            sh """
            ssh -o StrictHostKeyChecking=no $SERVER '

            set -e

            echo "============================="
            echo " LOGISTICS ERP DEPLOY START"
            echo "============================="

            cd $PROJECT_PATH

            # Validate repo
            if [ ! -d ".git" ]; then
                echo "Not a git repository!"
                exit 1
            fi

            # Backup current build
            if [ -d "dist" ]; then
                echo "Backing up existing build..."
                rm -rf dist_backup
                cp -r dist dist_backup
            fi

            echo "Pulling latest code..."
            git reset --hard
            git pull origin $BRANCH

            echo "Installing dependencies..."
            npm ci || npm install

            echo "Building project..."
            npm run build

            echo "Reloading application (zero downtime)..."

            pm2 describe $APP_NAME > /dev/null 2>&1

            if [ $? -eq 0 ]; then
                echo "App exists → Reloading"
                pm2 reload $APP_NAME --update-env
            else
                echo "First deployment → Starting app"
                pm2 start ecosystem.config.cjs --env production
            fi

            pm2 save

            echo "DEPLOYMENT SUCCESS"

            '
            """
        }
    }
}

post {

    failure {
        echo "Build failed! Starting rollback..."

        sh """
        ssh -o StrictHostKeyChecking=no $SERVER '

        cd $PROJECT_PATH

        if [ -d "dist_backup" ]; then
            echo "Restoring previous build..."
            rm -rf dist
            mv dist_backup dist

            echo "Restarting previous version..."
            pm2 restart $APP_NAME --update-env

            echo "Rollback completed"
        else
            echo "No backup available for rollback"
        fi

        '
        """
    }

    success {
        echo "Deployment completed successfully with zero downtime"
    }
}

}