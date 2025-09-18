pipeline {
    agent any

    stages {
        // stage('Checkout') {
        //     steps {
        //         checkout scm
        //         script {
        //             // Получаем список изменённых файлов между последним коммитом и предыдущим
        //             def changes = bat(script: 'git diff --name-only HEAD~1 HEAD', returnStdout: true).trim()
        //             echo "Изменённые файлы:\n${changes}"

        //             // Проверяем, были ли изменения в frontend/ или backend/
        //             def changedFrontend = changes.contains('frontend/')
        //             def changedBackend = changes.contains('backend/')

        //             env.CHANGED_FRONTEND = changedFrontend.toString()
        //             env.CHANGED_BACKEND = changedBackend.toString()

        //             echo "Frontend изменен: ${changedFrontend}"
        //             echo "Backend изменен: ${changedBackend}"
        //         }
        //     }
        // }

        stages {
        stage('Test') {
            steps {
                script {
                    def changes = bat(script: 'git diff --name-only HEAD~1 HEAD', returnStdout: true).trim()
                    def changedFrontend = changes.contains('frontend/')
                    def changedBackend = changes.contains('backend/')

                    if (changedFrontend) {
                        dir('frontend') {
                            echo 'Запускаем тесты фронтенда...'
                            bat 'npm install'
                            // bat 'npm test -- --watchAll=false'
                        }
                    }

                    if (changedBackend) {
                        dir('backend') {
                            echo 'Запускаем тесты бэкенда...'
                            bat 'dotnet test'
                        }
                    }

                    if (!changedFrontend && !changedBackend) {
                        echo 'Нет изменений в frontend/ или backend/ — тесты пропущены.'
                    }
                }
            }
        }

        stage('Merge fix to dev') {
            when {
                expression { env.GIT_BRANCH?.contains('fix') }
            }
            steps {
                script {
                    echo "Начинаем мерж ветки ${env.GIT_BRANCH} в dev..."

                    // Переключаемся на dev
                    bat 'git checkout dev'

                    // Пуллим актуальное состояние dev
                    bat 'git pull origin dev'

                    // Мержим fix в dev
                    bat "git merge origin/${env.GIT_BRANCH} --no-edit"

                    // Пушим изменения в dev
                    bat 'git push origin dev'

                    echo "Мерж завершён: ${env.GIT_BRANCH} → dev"
                }
            }
        }

        // stage('Deploy & Run Locally') {
        //     when {
        //         anyOf {
        //             expression { env.GIT_BRANCH?.contains('fix') }
        //             expression { env.GIT_BRANCH?.contains('master') }
        //         }
        //     }
        //     steps {
        //         script {
        //             echo "Собираем и запускаем приложение локально для ветки ${env.GIT_BRANCH}"

        //             // Останавливаем старые процессы (если есть)
        //             echo "Останавливаем предыдущие процессы..."
        //             bat 'taskkill /IM dotnet.exe /F 2>nul || echo Нет запущенных dotnet-процессов'
        //             bat 'taskkill /IM node.exe /F 2>nul || echo Нет запущенных node-процессов'

        //             // Собираем фронтенд
        //             dir('frontend') {
        //                 echo 'Собираем фронтенд...'
        //                 bat 'npm install'
        //                 bat 'npm run build'
        //             }

        //             // Копируем сборку фронтенда в wwwroot бэкенда (если бэкенд отдаёт статику)
        //             bat "xcopy /E /Y ${env.FRONTEND_BUILD_DIR} ${env.BACKEND_WWWROOT} /I"

        //             // Публикуем и запускаем бэкенд
        //             dir('backend') {
        //                 echo 'Публикуем бэкенд...'
        //                 bat 'dotnet publish -c Release -o ./publish'

        //                 echo 'Запускаем бэкенд...'
        //                 bat "start /B dotnet publish\\${env.BACKEND_PROJECT_NAME}"
        //             }

        //             // Опционально: запуск отдельного сервера для фронтенда (если не через бэкенд)
        //             // dir('frontend') {
        //             //     bat 'start /B npx serve -s build -p 3000'
        //             // }

        //             echo 'Приложение запущено! Доступно по:'
        //             echo 'Бэкенд: http://localhost:5000'
        //             echo 'Фронтенд: http://localhost:5000 (если статика в wwwroot) или http://localhost:3000'
        //         }
        //     }
        // }

        stage('Deploy (CD)') {
            when {
                expression { env.GIT_BRANCH?.contains('master') }
            }
            steps {
                script {
                    echo "Запускаем полный деплой приложения для ветки master"

                    // Frontend
                    dir('frontend') {
                        echo 'Собираем фронтенд...'
                        bat 'npm install'
                        bat 'npm run build'
                    }

                    // Backend
                    dir('backend') {
                        echo 'Публикуем бэкенд...'
                        bat 'dotnet publish -c Release -o ./publish'
                    }

                    echo 'Деплой завершён. Приложение развернуто.'
                }
            }
        }

        // stage('Test') {
        //     steps {
        //         script {
        //             if (env.CHANGED_FRONTEND.toBoolean()) {
        //                 stage('Test Frontend') {
        //                     dir('frontend') {
        //                         echo 'Запускаем тесты фронтенда...'
        //                         bat 'npm install'
        //                         // bat 'npm test -- --watchAll=false'
        //                     }
        //                 }
        //             }

        //             if (env.CHANGED_BACKEND.toBoolean()) {
        //                 stage('Test Backend') {
        //                     dir('backend') {
        //                         echo 'Запускаем тесты бэкенда...'
        //                         bat 'dotnet test'
        //                     }
        //                 }
        //             }

        //             if (!env.CHANGED_FRONTEND.toBoolean() && !env.CHANGED_BACKEND.toBoolean()) {
        //                 echo 'Нет изменений в frontend/ или backend/ — тесты пропущены.'
        //             }
        //         }
        //     }
        // }

        // stage('Deploy (CD)') {
        //     when {
        //         expression { env.GIT_BRANCH?.contains('master') }
        //     }

        //     // when {
        //     //     branch 'master'
        //     // }

        //     steps {
        //         script {
        //             def frontendChanged = env.CHANGED_FRONTEND.toBoolean()
        //             def backendChanged = env.CHANGED_BACKEND.toBoolean()

        //             if (frontendChanged) {
        //                 echo 'Фронтенд: все тесты пройдены — готов к доставке.'
        //                 // Здесь можно добавить команды деплоя фронтенда, например:
        //                 bat 'npm run build && some-deploy-command'
        //             }

        //             if (backendChanged) {
        //                 echo 'Бэкенд: все тесты пройдены — готов к доставке.'
        //                 // Здесь можно добавить команды деплоя бэкенда, например:
        //                 bat 'dotnet publish -c Release -o ./publish'
        //             }

        //             if (!frontendChanged && !backendChanged) {
        //                 echo 'Нет изменений для доставки.'
        //             }
        //         }
        //     }
        // }
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