pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // Получаем список изменённых файлов между последним коммитом и предыдущим
                    def changes = bat(script: 'git diff --name-only HEAD~1 HEAD', returnStdout: true).trim()
                    echo "Изменённые файлы:\n${changes}"

                    // Проверяем, были ли изменения в frontend/ или backend/
                    def changedFrontend = changes.contains('frontend/')
                    def changedBackend = changes.contains('backend/')

                    env.CHANGED_FRONTEND = changedFrontend.toString()
                    env.CHANGED_BACKEND = changedBackend.toString()

                    echo "Frontend изменен: ${changedFrontend}"
                    echo "Backend изменен: ${changedBackend}"
                }
            }
        }

        stage('Test') {
            steps {
                script {
                    if (env.CHANGED_FRONTEND.toBoolean()) {
                        stage('Test Frontend') {
                            dir('frontend') {
                                echo 'Запускаем тесты фронтенда...'
                                bat 'npm install'
                                bat 'npm test -- --watchAll=false'
                            }
                        }
                    }

                    if (env.CHANGED_BACKEND.toBoolean()) {
                        stage('Test Backend') {
                            dir('backend') {
                                echo 'Запускаем тесты бэкенда...'
                                bat 'dotnet test'
                            }
                        }
                    }

                    if (!env.CHANGED_FRONTEND.toBoolean() && !env.CHANGED_BACKEND.toBoolean()) {
                        echo 'Нет изменений в frontend/ или backend/ — тесты пропущены.'
                    }
                }
            }
        }

        stage('Deploy (CD)') {
            when {
                expression { env.GIT_BRANCH?.contains('master') }
            }

            // when {
            //     branch 'master'
            // }

            steps {
                script {
                    def frontendChanged = env.CHANGED_FRONTEND.toBoolean()
                    def backendChanged = env.CHANGED_BACKEND.toBoolean()

                    if (frontendChanged) {
                        echo 'Фронтенд: все тесты пройдены — готов к доставке.'
                        // Здесь можно добавить команды деплоя фронтенда, например:
                        // bat 'npm run build && some-deploy-command'
                    }

                    if (backendChanged) {
                        echo 'Бэкенд: все тесты пройдены — готов к доставке.'
                        // Здесь можно добавить команды деплоя бэкенда, например:
                        // bat 'dotnet publish -c Release -o ./publish'
                    }

                    if (!frontendChanged && !backendChanged) {
                        echo 'Нет изменений для доставки.'
                    }
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
    }
}








// pipeline {
//     agent any

//     environment {
//         CHANGED_FILES = ''
//     }

//     stages{
//         stage('Checkout') {
//             steps {
//                 checkout scm
//                 script {
//                     def changedFiles = ''

//                     try {
//                         changedFiles = bat (
//                             script: 'git diff --name-only HEAD~1 HEAD',
//                             returnStdout: true
//                         ).trim()
//                     } catch (Exception e) {
//                         changedFiles = ''
//                     }
                    
//                     env.CHANGED_FILES = changedFiles ?: ''
//                     echo "Измененные файлы: ${env.CHANGED_FILES}"
//                 }
//             }
//         }

//         stage('Test') {
//             when {
//                 branch 'dev'
//             }

//             steps {
//                 script {
//                     def changes = env.CHANGED_FILES ?: ''
//                     def changedFrontend = changes.contains('frontend/')
//                     def changedBackend = changes.contains('backend/')

//                     echo "Frontend изменен: ${changedFrontend}"
//                     echo "Backend изменен: ${changedBackend}"

//                     if (changedFrontend) {
//                         stage('Test Frontend') {
//                             dir('frontend') {
//                                 echo 'Запускаем тесты фронтенда...'
//                                 bat 'npm test -- --watchAll=false'
//                             }
//                         }
//                     }

//                     if (changedBackend) {
//                         stage('Test Backend') {
//                             dir('backend') {
//                                 echo 'Запускаем тесты бэкенда...'
//                                 bat 'dotnet test'
//                             }
//                         }
//                     }

//                     if (!changedFrontend && !changedBackend) {
//                         echo "Нет изменений в frontend/ или backend/ — пропускаем тестирование."
//                     }
//                 }
//             }
//         }

//         stage ('Deploy (CD)') {
//             when {
//                 branch 'master'
//             }

//             steps {
//                 echo 'Тестирование пройдено — код готов к доставке!'
//                 script {
//                     if (env.CHANGED_FILES.contains('backend/')) {
//                         echo 'Бэкенд: все тесты пройдены.'
//                     }
//                     if (env.CHANGED_FILES.contains('frontend/')) {
//                         echo 'Фронтенд: все тесты пройдены.'
//                     }
//                     if (!env.CHANGED_FILES.contains('frontend/') && !env.CHANGED_FILES.contains('backend/')) {
//                         echo 'Нет изменений для доставки.'
//                     }
//                 }
//             }
//         }
//     }

//     // post {
//     //     success {
//     //         echo 'Все тесты успешно пройдены!'
//     //     }
//     //     failure {
//     //         echo 'Произошла ошибка.'
//     //     }
//     // }
// }