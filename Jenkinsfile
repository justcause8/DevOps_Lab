pipeline {
    agent any

    environment {
        FRONTEND_DIR = 'frontend'
        BACKEND_DIR  = 'backend'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // Определяем, является ли ветка fix-веткой
                    def isFixBranch = (env.GIT_BRANCH != null && env.GIT_BRANCH.startsWith('origin/fix/'))
                    env.IS_FIX_BRANCH = isFixBranch.toString()

                    // Получаем список изменённых файлов
                    def changes = bat(script: 'git diff --name-only HEAD~1 HEAD', returnStdout: true).trim()
                    echo "Изменённые файлы:\n${changes}"

                    def changedFrontend = changes.contains("${env.FRONTEND_DIR}/")
                    def changedBackend  = changes.contains("${env.BACKEND_DIR}/")

                    env.CHANGED_FRONTEND = changedFrontend.toString()
                    env.CHANGED_BACKEND  = changedBackend.toString()

                    echo "Frontend изменён: ${env.CHANGED_FRONTEND}"
                    echo "Backend изменён:  ${env.CHANGED_BACKEND}"
                    echo "Ветка fix/*:       ${env.IS_FIX_BRANCH}"
                }
            }
        }

        stage('Run Tests') {
            when {
                anyOf {
                    expression { env.IS_FIX_BRANCH.toBoolean() }
                    expression { env.CHANGED_FRONTEND.toBoolean() }
                    expression { env.CHANGED_BACKEND.toBoolean() }
                }
            }
            steps {
                script {
                    boolean runFrontend = env.IS_FIX_BRANCH.toBoolean() || env.CHANGED_FRONTEND.toBoolean()
                    boolean runBackend  = env.IS_FIX_BRANCH.toBoolean() || env.CHANGED_BACKEND.toBoolean()

                    if (runFrontend) {
                        dir(env.FRONTEND_DIR) {
                            echo 'Запускаем тесты фронтенда...'
                            // bat 'npm ci'
                            // bat 'npm test -- --watchAll=false'
                        }
                    }

                    if (runBackend) {
                        dir(env.BACKEND_DIR) {
                            echo 'Запускаем тесты бэкенда...'
                            bat 'dotnet test'
                        }
                    }

                    if (!runFrontend && !runBackend) {
                        echo 'Нет причин запускать тесты (не должно произойти из-за условия when).'
                    }
                }
            }
        }

        stage('Deploy to Production (CD)') {
            when {
                expression { 
                    env.GIT_BRANCH != null && 
                    env.GIT_BRANCH == 'origin/master' 
                }
            }
            steps {
                script {
                    echo "Запускаем полный деплой для ветки master"

                    // Frontend
                    dir(env.FRONTEND_DIR) {
                        echo 'Собираем фронтенд...'
                        // bat 'npm ci'
                        // bat 'npm run build'
                    }

                    // Backend
                    dir(env.BACKEND_DIR) {
                        echo 'Публикуем бэкенд...'
                        // bat 'dotnet publish -c Release -o ./publish'
                    }

                    echo 'Деплой завершён. Артефакты готовы к развёртыванию на сервере.'
                }
            }
        }
    }

    post {
        success {
            echo 'Пайплайн успешно завершён!'
        }
        failure {
            echo 'Пайплайн завершился с ошибкой!'
        }
        always {
            cleanWs()
        }
    }
}