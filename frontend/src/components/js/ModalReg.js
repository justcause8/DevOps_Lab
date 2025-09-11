import React, { useState } from 'react';
import apiClient from '../apiContent/apiClient'; // Импортируем API-клиент
import './ModalReg.css';

const RegisterModal = ({ onClose, onLoginOpen, onRegisterSuccess }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChecked, setIsChecked] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(''); // Состояние для хранения текста ошибки

    const handleRegister = async () => {
        setError(''); // Очищаем предыдущие ошибки перед новой попыткой регистрации

        // Проверка обязательных полей
        if (!username || !email || !password || !confirmPassword) {
            setError('Пожалуйста, заполните все поля.');
            return;
        }

        // Проверка формата email
        const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!isValidEmail(email)) {
            setError('Пожалуйста, введите корректный email.');
            return;
        }

        // Проверка длины пароля
        if (password.length < 2) {
            setError('Пароль должен содержать минимум 3 символа.');
            return;
        }

        // Проверка совпадения паролей
        if (password !== confirmPassword) {
            setError('Пароли не совпадают.');
            return;
        }

        // Проверка согласия на обработку персональных данных
        if (!isChecked) {
            setError('Пожалуйста, подтвердите согласие на обработку персональных данных.');
            return;
        }

        setIsLoading(true);

        try {
            // Отправка данных для регистрации
            const response = await apiClient.post('/auth/register', {
                Username: username,
                Email: email,
                PasswordHash: password,
                AccessLevelId: 2, // Уровень доступа по умолчанию
            });

            const { access_token } = response.data;

            if (!access_token) {
                throw new Error("Ответ сервера не содержит токен.");
            }

            localStorage.setItem('access_token', access_token);

            onRegisterSuccess();

            onClose(); // Закрываем модальное окно
        } catch (error) {
            console.error('Ошибка регистрации:', error.response?.data || error.message);
            setError('Ошибка регистрации. Проверьте введенные данные.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    ×
                </button>
                <h2>Регистрация</h2>

                <input
                    type="text"
                    placeholder="Имя пользователя"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <input
                    type="email"
                    placeholder="Эл. почта"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Подтвердите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {error && <p className="error-message">{error}</p>}

                <label>
                    <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => setIsChecked(e.target.checked)}
                    />
                    Я согласен на&nbsp;
                    <button
                        type="button"
                        className="link-button"
                        onClick={() =>
                            window.open(
                                'https://www.figma.com/design/FnqNuTY0TwAiTo1mSKRADx/Конструктор-анкет?node-id=0-1&node-type=canvas&t=AVcmbkWQHdclinB5-0',
                                '_blank'
                            )
                        }
                    >
                        обработку персональных данных
                    </button>
                </label>
                <label>
                    <input type="checkbox" />
                    Я ознакомлен&nbsp;
                    <button
                        type="button"
                        className="link-button"
                        onClick={() => window.open('https://avatars.mds.yandex.net/i?id=7f227e472ce817cdad5bb5a582e0e331_l-10340874-images-thumbs&n=13')}
                    >
                        с политикой конфиденциальности
                    </button>
                </label>
                <div className='modal-buttons'>
                    <button
                        className="reg-btn"
                        onClick={handleRegister}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
                    </button>
                </div>

                <div className="perehod">
                    <label
                        className="link-button"
                        onClick={() => {
                            onClose();
                            onLoginOpen();
                        }}
                    >
                        уже есть аккаунт
                    </label>
                </div>
            </div>
        </div>
    );
};

export default RegisterModal;