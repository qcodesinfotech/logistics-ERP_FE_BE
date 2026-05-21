pipeline {

    agent any
 
    triggers {

        githubPush()

    }
 
    environment {

        SERVER = "root@193.203.162.101"

        PROJECT_PATH = "/root/repos/TT_Inventory"

        BRANCH = "main"

    }
 
    stages {

         stage('Checkout') {
            steps {
                echo "📥 Checking latest code from GitHub..."

                // DO NOT delete workspace
                checkout scm
            }
        }
 
        stage('Deploy') {

            steps {

                echo "🚀 Deployment triggered..."
 
                sh """

                ssh -o StrictHostKeyChecking=no $SERVER '

                set -e
 
                echo "============================="

                echo "🚀 ZERO-DOWNTIME DEPLOY START"

                echo "============================="
 
                cd $PROJECT_PATH
 
                # Ensure git repo exists

                if [ ! -d ".git" ]; then

                    echo "❌ Not a git repository!"

                    exit 1

                fi
 
                # Backup existing build

                if [ -d "dist" ]; then

                    echo "📦 Taking backup of dist..."

                    rm -rf dist_backup

                    cp -r dist dist_backup

                else

                    echo "⚠️ No existing dist to backup"

                fi
 
                echo "📥 Pulling latest code..."

                git pull origin $BRANCH
 
                echo "📦 Installing dependencies..."

                npm ci || npm install
 
                echo "🏗️ Building project..."

                npm run build
 
                echo "♻️ Reloading app (zero downtime)..."

                pm2 reload inventory || pm2 start ecosystem.config.cjs
 
                echo "✅ DEPLOYMENT SUCCESS"

                '

                """

            }

        }

    }
 
    post {
 
        failure {

            echo "❌ Build failed! Rolling back..."
 
            sh """

            ssh -o StrictHostKeyChecking=no $SERVER '

            cd $PROJECT_PATH
 
            if [ -d "dist_backup" ]; then

                echo "🔄 Restoring old build..."

                rm -rf dist

                mv dist_backup dist
 
                echo "♻️ Restarting old version..."

                pm2 restart inventory
 
                echo "⚠️ Rollback completed"

            else

                echo "⚠️ No backup available"

            fi

            '

            """

        }
 
        success {

            echo "✅ Deployment completed successfully with zero downtime"

        }

    }

}
 
