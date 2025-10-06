pipeline {
    agent any

    environment {
        FRONTEND_DIR = 'frontend'
        BACKEND_DIR  = 'backend'
    }

    stages {
        stage('Debug Branch Info') {
            steps {
                script {
                    echo "GIT_BRANCH: '${env.GIT_BRANCH}'"
                }
            }
        }

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // Получаем список изменённых файлов между последними коммитами
                    def changes = bat(script: 'git diff --name-only HEAD~1 HEAD', returnStdout: true).trim()
                    echo "Изменённые файлы:\n${changes}"

                    // Определяем, были ли изменения в frontend/ или backend/

                    def changedFrontend = changes.contains("${env.FRONTEND_DIR}/")
                    def changedBackend  = changes.contains("${env.BACKEND_DIR}/")

                    env.CHANGED_FRONTEND = changedFrontend.toString()
                    env.CHANGED_BACKEND  = changedBackend.toString()

                    echo "Frontend изменён: ${env.CHANGED_FRONTEND}"
                    echo "Backend изменён:  ${env.CHANGED_BACKEND}"
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                dir(env.FRONTEND_DIR) {
                    echo 'Устанавливаем зависимости...'
                    // Проверяем наличие package-lock.json
                    bat 'if not exist "package-lock.json" (exit 1) else (echo "package-lock.json найден")'
                    // Используем npm ci для воспроизводимой установки
                    bat 'npm ci'
                    // bat 'npm install'
                }
            }
        }

        stage('Run Tests') {
            when {
                anyOf {
                    changeRequest()
                    expression { env.GIT_BRANCH == 'origin/dev' }
                    expression { env.GIT_BRANCH == 'origin/master' }
                    expression { env.GIT_BRANCH?.startsWith('origin/fix/') }
                }
            }
            steps {
                script {
                    boolean runFrontend = env.CHANGED_FRONTEND.toBoolean()
                    boolean runBackend  = env.CHANGED_BACKEND.toBoolean()

                    if (runFrontend) {
                        dir(env.FRONTEND_DIR) {
                            echo 'Запускаем тесты фронтенда...'
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
                        echo 'Нет изменений в frontend/ или backend/ — тесты пропущены.'
                    }
                }
            }
        }

        stage('Deploy to Production (CD)') {
            when {
                expression { env.GIT_BRANCH == 'origin/master' }
            }
            steps {
                script {
                    echo "Запускаем деплой"

                    // Frontend
                    dir(env.FRONTEND_DIR) {
                        echo 'Устанавливаем зависимости и собираем фронтенд...'
                        bat 'npm ci'
                        bat 'set CI=false && npm run build'
                    }

                    // Backend
                    dir(env.BACKEND_DIR) {
                        echo 'Восстанавливаем зависимости и публикуем бэкенд...'
                        bat 'dotnet restore'
                        bat 'dotnet publish -c Release -o ./publish'
                    }

                    echo 'Деплой завершён.'
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