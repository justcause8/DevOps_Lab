// src/utils/authUtils.js
import { jwtDecode } from 'jwt-decode';

/**
 * Функция для получения никнейма пользователя из JWT-токена.
 * Если токен отсутствует или не содержит никнейм, возвращается "Гость".
 */
export const getNicknameFromToken = () => {
    const token = localStorage.getItem('access_token'); // Получаем токен из localStorage
    if (!token) return 'Гость'; // Если токена нет, возвращаем "Гость"

    try {
        const decoded = jwtDecode(token); // Декодируем токен
        return decoded.nickname || decoded.Username || 'Гость'; // Поддерживаем nickname или Username
    } catch (error) {
        console.error('Ошибка при декодировании токена:', error);
        return 'Гость';
    }
};