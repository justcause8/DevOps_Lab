import React, { useState, useEffect } from 'react';
import './AccountEdit.css';
import { useNavigate } from 'react-router-dom';
import apiClient from '../apiContent/apiClient';

function AccountEditPage() {
    const [nick, setNick] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [initialData, setInitialData] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await apiClient.get('/User/current');
                const userData = response.data;

                setNick(userData.nick || '');
                setEmail(userData.email || '');
                setPassword('');
                setInitialData({ nick: userData.nick, email: userData.email });
                setLoading(false);
            } catch (error) {
                console.error('Ошибка при загрузке данных пользователя:', error.response?.data || error.message);
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    const hasChanges = () => {
        return (
            nick !== initialData?.nick ||
            email !== initialData?.email ||
            password !== initialData?.password
        );
    };

    const handleSave = async () => {
        if (isLoading) return;
        if (!hasChanges()) {
            alert('Нет изменений для сохранения.');
            return;
        }

        setIsLoading(true);

        try {
            await apiClient.put('/User/update', { nick, email, password });
            setInitialData({ nick, email, password });
            navigate('/Account');
        } catch (error) {
            console.error('Ошибка при сохранении данных:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (loading) {
        return <div>Загрузка...</div>;
    }

    return (
        <div className="acEdit-page-vh">
            <div className="acEdit-page">
                <div className="survey-titleLine">
                    Имя:
                    <input
                        type="text"
                        className="text-line"
                        value={nick}
                        onChange={(e) => setNick(e.target.value)}
                    />
                </div>
                <div className="survey-titleLine">
                    Почта:
                    <input
                        type="email"
                        className="text-line"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <div className="survey-titleLine">
                    Пароль:
                    <input
                        type="password"
                        className="text-line"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
                <div className="ButtonSaveContainer">
                    <button
                        className="ButtonSave"
                        onClick={handleSave}
                        disabled={isLoading} 
                    >
                        {isLoading ? 'Отправка...' : 'Сохранить'} 
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AccountEditPage;