import axios from 'axios';

// Создаем экземпляр axios с базовым URL бэкенда
const apiClient = axios.create({
    //baseURL: 'https://localhost:7109', // URL бэкенда
    baseURL: 'http://localhost:5000', // URL бэкенда
    // baseURL: 'https://5.129.207.189',
    // baseURL: 'https://5.129.207.189',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Перехватчик для добавления токена в заголовки запросов
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Перехватчик для обработки ошибок
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Если получаем статус 401 (Unauthorized), очищаем токены
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            alert('Сессия истекла. Пожалуйста, войдите снова.');
        }
        return Promise.reject(error);
    }
);

/**
 * Создание новой анкеты
 * @param {string} title - Название анкеты
 * @returns {Promise<{ questionnaireId: number }>}
 */
export const createQuestionnaire = async (title) => {
    try {
        const response = await apiClient.post('/questionnaire/create', {
            Title: title,
        });
        return response.data; // Возвращает ID созданной анкеты
    } catch (error) {
        console.error('Ошибка при создании анкеты:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Добавление вопроса к анкете
 * @param {number} questionnaireId - ID анкеты
 * @param {Object} questionData - Данные вопроса
 * @returns {Promise<{ questionId: number }>}
 */
export const addQuestion = async (questionnaireId, questionData) => {
    try {
        const response = await apiClient.post(`/questionnaire/${questionnaireId}/questions/add-question`, {
            Text: questionData.text,
            QuestionType: getQuestionTypeId(questionData.type),
            Options: questionData.answers?.map((a) => ({ OptionText: a.text })) || [],
        });
        return response.data; // Возвращает ID созданного вопроса
    } catch (error) {
        console.error('Ошибка при добавлении вопроса:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Получение списка анкет пользователя
 * @returns {Promise<Array<{ id: number, title: string, createdAt: string, isPublished: boolean }>>}
 */
export const getUserSurveys = async () => {
    try {
        const response = await apiClient.get('/user/questionnaires');
        return response.data.questionnaires; // Возвращает массив анкет
    } catch (error) {
        console.error('Ошибка при получении списка анкет:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Удаление анкеты
 */
export const deleteSurvey = async (questionnaireId) => {
    try {
        await apiClient.delete(`/questionnaire/${questionnaireId}`);
    } catch (error) {
        console.error('Ошибка при удалении анкеты:', error.response?.data || error.message);
        throw error;
    }
};
/**
 * Обновление названия анкеты
 * @param {number} questionnaireId - ID анкеты
 * @param {string} newTitle - Новое название анкеты
 * @returns {Promise<void>}
 */
export const updateSurveyTitle = async (questionnaireId, newTitle) => {
    try {
        await apiClient.put(`/questionnaire/${questionnaireId}/title`, {
            NewTitle: newTitle,
        });
    } catch (error) {
        console.error('Ошибка при обновлении названия анкеты:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Изменение статуса публикации анкеты
 * @param {number} questionnaireId - ID анкеты
 * @param {boolean} isPublished - Новый статус публикации
 * @returns {Promise<void>}
 */
export const updateSurveyStatus = async (questionnaireId, isPublished) => {
    try {
        await apiClient.put(`/questionnaire/${questionnaireId}/status`, {
            IsPublished: isPublished,
        });
    } catch (error) {
        console.error('Ошибка при изменении статуса анкеты:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Преобразование типа вопроса в числовой ID
 * @param {string} type - Тип вопроса
 * @returns {number}
 */
const getQuestionTypeId = (type) => {
    switch (type) {
        case "Открытый":
            return 1;
        case "Закрытый":
            return 2;
        case "Множественный выбор":
            return 3;
        case "Шкала":
            return 4;
        default:
            throw new Error("Неизвестный тип вопроса.");
    }


};

// Получение данных пользователя
export const getUserProfile = async () => {
    try {
        const response = await apiClient.get('/user/profile');
        return response.data; // Возвращает данные пользователя
    } catch (error) {
        console.error('Ошибка при получении данных пользователя:', error.response?.data || error.message);
        throw error;
    }
};

export const checkUsernameAndEmail = async (username, email) => {
    try {
        const response = await apiClient.post('/user/check-availability', {
            Username: username,
            Email: email,
        });

        const { isUsernameAvailable, isEmailAvailable } = response.data;

        if (!isUsernameAvailable) {
            alert('Имя пользователя уже занято.');
            return false;
        }

        if (!isEmailAvailable) {
            alert('Электронная почта уже используется.');
            return false;
        }

        return true; // Имя и email доступны
    } catch (error) {
        console.error('Ошибка при проверке доступности:', error.response?.data || error.message);
        alert('Не удалось проверить доступность данных.');
        return false;
    }
};

// Обновление данных пользователя
export const updateUserProfile = async (userData) => {
    try {
        const response = await apiClient.put('/user/profile', userData);
        return response.data; // Возвращает обновленные данные
    } catch (error) {
        console.error('Ошибка при обновлении данных пользователя:', error.response?.data || error.message);
        throw error;
    }
};

export default apiClient;

