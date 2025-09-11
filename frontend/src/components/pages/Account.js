import React, { useState, useEffect } from 'react';
import './Account.css';
import setting from './../../img/settings.png';
import { Pencil, BarChart2, Link, Lock, Unlock, Trash2 } from "lucide-react";
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import apiClient, { getUserSurveys } from '../apiContent/apiClient';

function SurveyCard({ survey, isClosed, onDelete, onEdit, onToggleLock }) {
    const [isHovered, setIsHovered] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();

    const truncateText = (text, maxLength) => {
        if (!text || text.length <= maxLength) return text;
        let truncated = text.slice(0, maxLength);
        const lastSpaceIndex = truncated.lastIndexOf(' ');
        if (lastSpaceIndex > 0) {
            truncated = truncated.slice(0, lastSpaceIndex);
        }
        return `${truncated}...`;
    };

    const handleDeleteWithConfirmation = () => {
        setIsModalOpen(true);
    };

    const confirmDelete = () => {
        onDelete(survey.id);
        setIsModalOpen(false);
    };

    const cancelDelete = () => {
        setIsModalOpen(false);
    };

    const handleOpenLink = () => {
        navigate('/Linkk', { state: { link: survey.link } });
    };

    return (
        <div
            className="Open relative animate-fade-in"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <h2
                className={`text-lg ${isHovered ? 'expanded' : ''}`}
                title={survey.title}
            >
                {isHovered
                    ? survey.title.length > 110
                        ? truncateText(survey.title, 110)
                        : survey.title
                    : truncateText(survey.title, 35)}
            </h2>
            <div className="cursorItems">
                <div className="left-cursor">
                    <Pencil
                        className="cursor-pointer icon-hover"
                        size={24}
                        onClick={() => onEdit(survey.id)}
                    />
                    <BarChart2
                        className="cursor-pointer icon-hover"
                        size={24}
                        onClick={() => navigate(`/analysis/${survey.id}`)}
                    />
                    {isClosed ? (
                        <Lock
                            className="cursor-pointer icon-hover"
                            size={24}
                            onClick={() => onToggleLock(survey.id, false)}
                        />
                    ) : (
                        <Unlock
                            className="cursor-pointer icon-hover"
                            size={24}
                            onClick={() => onToggleLock(survey.id, true)}
                        />
                    )}
                    <Link
                        className="cursor-pointer icon-hover"
                        size={24}
                        onClick={handleOpenLink}
                    />
                </div>
                <div className="right-cursor">
                    <Trash2
                        className="cursor-pointer trash-icon-hover"
                        size={24}
                        onClick={handleDeleteWithConfirmation}
                    />
                </div>
            </div>

            {isModalOpen && (
                <div className="modal-card-overlay animate-fade-in-fast" onClick={cancelDelete}>
                    <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
                        <h3>Подтверждение удаления</h3>
                        <p>Вы уверены, что хотите удалить анкету?</p>
                        <div className="modal-buttons">
                            <button className="confirm-btn" onClick={confirmDelete}>
                                Удалить
                            </button>
                            <button className="cancel-btn" onClick={cancelDelete}>
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AccountPage() {
    const [surveys, setSurveys] = useState([]);
    const [nickname, setNickname] = useState('Гость');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSurveys = async () => {
            try {
                const userSurveys = await getUserSurveys();
                setSurveys(userSurveys.map(survey => ({
                    ...survey,
                    isClosed: !survey.isPublished
                })));
            } catch (error) {
                console.error('Не удалось загрузить анкеты:', error);
            }
        };

        const fetchUserData = async () => {
            try {
                const response = await apiClient.get('/User/current');
                const userData = response.data;
                setNickname(userData.nick || 'Гость');
            } catch (error) {
                console.error('Ошибка при загрузке данных пользователя:', error.response?.data || error.message);
                setNickname('Гость');
            } finally {
                setLoading(false);
            }
        };

        fetchSurveys();
        fetchUserData();
    }, []);

    const handleDelete = async (id) => {
        if (!id) {
            alert('ID анкеты не указан.');
            return;
        }
        try {
            await apiClient.delete(`/questionnaire/${id}`);
            const updatedSurveys = surveys.filter((survey) => survey.id !== id);
            setSurveys(updatedSurveys);
        } catch (error) {
            console.error('Ошибка при удалении анкеты:', error.response?.data || error.message);
            alert('Не удалось удалить анкету.');
        }
    };

    const handleEdit = (id) => {
        navigate(`/edit-survey/${id}`);
    };

    const handleToggleLock = async (id, isClosed) => {
        try {
            await apiClient.put(`/questionnaire/${id}/status`, { IsPublished: !isClosed });

            const updatedSurveys = await getUserSurveys();
            setSurveys(updatedSurveys.map(survey => ({
                ...survey,
                isClosed: !survey.isPublished
            })));

            console.log('Анкеты успешно обновлены:', updatedSurveys);
        } catch (error) {
            console.error('Ошибка при изменении статуса анкеты:', error.response?.data || error.message);
            alert('Не удалось изменить статус анкеты.');
        }
    };

    const openSurveys = surveys.filter((survey) => !survey.isClosed);
    const closedSurveys = surveys.filter((survey) => survey.isClosed);

    if (loading) {
        return <div className="ac-page loading-state">Загрузка...</div>;
    }

    return (
        <div className="list-ancet">
            <div className="ac-page">
                <div className="Nick">
                    <span>{nickname}</span>
                    <RouterLink to="/AccountEdit">
                        <img
                            src={setting}
                            alt="setting img"
                            className="settingImg icon-hover"
                            style={{ cursor: 'pointer' }}
                        />
                    </RouterLink>
                </div>

                <div>
                    <div className="type-qw">Открытые</div>
                    <div className="Open-list">
                        {openSurveys.length > 0 ? (
                            openSurveys.map((survey) => (
                                <SurveyCard
                                    key={survey.id}
                                    survey={survey}
                                    isClosed={false}
                                    onDelete={handleDelete}
                                    onEdit={handleEdit}
                                    onToggleLock={handleToggleLock}
                                />
                            ))
                        ) : (
                            <p className="no-surveys">Нет открытых анкет</p>
                        )}
                    </div>
                </div>

                <div>
                    <div className="type-qw">Закрытые</div>
                    <div className="Open-list">
                        {closedSurveys.length > 0 ? (
                            closedSurveys.map((survey) => (
                                <SurveyCard
                                    key={survey.id}
                                    survey={survey}
                                    isClosed={true}
                                    onDelete={handleDelete}
                                    onEdit={handleEdit}
                                    onToggleLock={handleToggleLock}
                                />
                            ))
                        ) : (
                            <p className="no-surveys">Нет закрытых анкет</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AccountPage;