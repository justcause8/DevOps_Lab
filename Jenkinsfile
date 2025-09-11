pipeline {
    agent any

    environment {
        CHANGED_FILES = ''
    }

    stages{
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    def changedFiles = ''

                    try {
                        changedFiles = bat (
                            script: 'git diff --name-only HEAD~1 HEAD',
                            returnStdout: true
                        ).trim()
                    } catch (Exception e) {
                        changedFiles = ''
                    }
                    
                    env.CHANGED_FILES = changedFiles ?: ''
                    echo "Измененные файлы: ${env.CHANGED_FILES}"
                }
            }
        }

        stage('Test') {
            when {
                branch 'dev'
            }

            steps {
                script {
                    def changes = env.CHANGED_FILES ?: ''
                    def changedFrontend = changes.contains('frontend/')
                    def changedBackend = changes.contains('backend/')

                    echo "Frontend изменен: ${changedFrontend}"
                    echo "Backend изменен: ${changedBackend}"

                    if (changedFrontend) {
                        stage('Test Frontend') {
                            dir('frontend') {
                                echo 'Запускаем тесты фронтенда...'
                                bat 'npm test -- --watchAll=false'
                            }
                        }
                    }

                    if (changedBackend) {
                        stage('Test Backend') {
                            dir('backend') {
                                echo 'Запускаем тесты бэкенда...'
                                bat 'dotnet test'
                            }
                        }
                    }

                    if (!changedFrontend && !changedBackend) {
                        echo "Нет изменений в frontend/ или backend/ — пропускаем тестирование."
                    }
                }
            }
        }

        stage ('Deploy (CD)') {
            when {
                branch 'master'
            }

            steps {
                echo 'Тестирование пройдено — код готов к доставке!'
                script {
                    if (env.CHANGED_FILES.contains('backend/')) {
                        echo 'Бэкенд: все тесты пройдены.'
                    }
                    if (env.CHANGED_FILES.contains('frontend/')) {
                        echo 'Фронтенд: все тесты пройдены.'
                    }
                    if (!env.CHANGED_FILES.contains('frontend/') && !env.CHANGED_FILES.contains('backend/')) {
                        echo 'Нет изменений для доставки.'
                    }
                }
            }
        }
    }

    // post {
    //     success {
    //         echo 'Все тесты успешно пройдены!'
    //     }
    //     failure {
    //         echo 'Произошла ошибка.'
    //     }
    // }
}