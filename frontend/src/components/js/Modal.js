import React, { useState, useEffect } from 'react';
import apiClient from '../apiContent/apiClient';
import "./Modal.css";

const LoginModal = ({ onClose, onRegisterOpen, onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const savedEmail = localStorage.getItem('savedEmail');
        const savedRememberMe = localStorage.getItem('rememberMe');

        if (savedRememberMe === 'true') {
            setEmail(savedEmail || '');
            setRememberMe(true);
        }
    }, []);

    const handleLogin = async () => {
        try {
            setError('');
            const response = await apiClient.post('/auth/login', {
                Login: email,
                Password: password,
            });

            const { access_token, refresh_token } = response.data;

            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);

            if (rememberMe) {
                localStorage.setItem('savedEmail', email);
                localStorage.setItem('rememberMe', 'true');
            } else {
                localStorage.removeItem('savedEmail');
                localStorage.removeItem('rememberMe');
            }

            onLoginSuccess();
            onClose();
        } catch (error) {
            console.error('Ошибка входа:', error.response?.data || error.message);
            setError('Неверный логин или пароль.');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    ×
                </button>
                <h2>Вход в аккаунт</h2>
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
                {error && <p className="error-message">{error}</p>}
                <label>
                    <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    Запомнить меня
                </label>
                <div className="modal-buttons">
                    <button className="login-btn" onClick={handleLogin}>
                        Войти
                    </button>
                    <button
                        className="register-btn"
                        onClick={() => {
                            onClose();
                            onRegisterOpen();
                        }}
                    >
                        Регистрация
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;