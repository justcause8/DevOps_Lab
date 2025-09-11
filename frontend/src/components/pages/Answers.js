import React, { useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './Answers.css';
import { AuthContext } from '../apiContent/AuthContext';
import ModalLogin from '../js/Modal';
import ModalRegister from '../js/ModalReg';

function AnswersPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isLoggedIn, login } = useContext(AuthContext);
    const [author, setAuthor] = useState({ firstName: '', lastName: '' });
    const [ansTitle, setAnsTitle] = useState('');
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const [validationErrors, setValidationErrors] = useState({});
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);

    useEffect(() => {
        const fetchQuestionnaire = async () => {
            setIsLoading(true);
            setApiError('');
            setValidationErrors({});
            try {
                // const response = await axios.get(`https://localhost:7109/questionnaire/access/${id}`, {
                //     headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
                // });


                
                const response = await axios.get(`http://localhost:5000/questionnaire/access/${id}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
                });
                // const response = await axios.get(`https://5.129.207.189/questionnaire/access/${id}`, {
                //     headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
                // });
                const { title, questions: fetchedQuestions, author: fetchedAuthor } = response.data;
                if (!fetchedQuestions || !Array.isArray(fetchedQuestions)) {
                    console.error('Данные вопросов отсутствуют или имеют неверный формат:', response.data);
                    setApiError('Не удалось загрузить структуру анкеты.');
                    return;
                }
                setAuthor(fetchedAuthor || { firstName: '', lastName: '' });
                const processedQuestions = fetchedQuestions.map((q) => {
                    if (q.questionTypeId === 4) {
                        const parts = q.text.split('|');
                        if (parts.length < 4) {
                            return {
                                ...q,
                                text: parts[0] || q.text,
                                leftScaleValue: "Min",
                                rightScaleValue: "Max",
                                divisions: 5,
                            };
                        }
                        const text = parts[0] || "";
                        const leftScaleValue = parts[1] || "";
                        const rightScaleValue = parts[2] || "";
                        const divisions = parseInt(parts[3], 10) || 5;
                        return {
                            ...q,
                            text,
                            leftScaleValue,
                            rightScaleValue,
                            divisions,
                        };
                    }
                    return q;
                });
                setAnsTitle(title);
                setQuestions(processedQuestions);
                const initialAnswers = {};
                processedQuestions.forEach((q) => {
                    if (q.questionTypeId === 3) {
                        initialAnswers[q.id] = [];
                    } else if (q.questionTypeId === 4) {
                        const divisions = q.divisions || 5;
                        initialAnswers[q.id] = Math.ceil(divisions / 2);
                    } else {
                        initialAnswers[q.id] = '';
                    }
                });
                setAnswers(initialAnswers);
            } catch (err) {
                console.error('Ошибка при загрузке анкеты:', err.response?.data || err.message);
                if (err.response?.status === 404) {
                    setApiError('Анкета закрыта или была удалена');
                } else if (err.response?.status === 401 || err.response?.status === 403) {
                    setApiError('Доступ запрещен. Возможно, вам нужно войти в систему.');
                } else {
                    setApiError('Произошла ошибка при загрузке анкеты.');
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchQuestionnaire();
    }, [id]);

    const validateAnswers = () => {
        const errors = {};
        let firstErrorId = null;
        for (const question of questions) {
            const answer = answers[question.id];
            let isEmpty = false;
            let errorMsg = 'Пожалуйста, ответьте на этот вопрос';
            switch (parseInt(question.questionTypeId, 10)) {
                case 1:
                    isEmpty = !answer || !String(answer).trim();
                    errorMsg = 'Пожалуйста, заполните это поле';
                    break;
                case 2:
                    isEmpty = answer === '' || answer === null || answer === undefined;
                    errorMsg = 'Пожалуйста, выберите один вариант';
                    break;
                case 3:
                    isEmpty = !Array.isArray(answer) || answer.length === 0;
                    errorMsg = 'Пожалуйста, выберите хотя бы один вариант';
                    break;
                case 4:
                    const scaleValueCheck = parseInt(answer, 10);
                    isEmpty = isNaN(scaleValueCheck);
                    errorMsg = 'Пожалуйста, выберите значение на шкале';
                    break;
                case 5:
                    isEmpty = answer === '' || answer === null || answer === undefined;
                    errorMsg = 'Пожалуйста, выберите один вариант из списка';
                    break;
                default:
                    break;
            }
            if (isEmpty) {
                errors[question.id] = errorMsg;
                if (firstErrorId === null) {
                    firstErrorId = question.id;
                }
            }
        }
        setValidationErrors(errors);
        if (firstErrorId !== null) {
            const element = document.getElementById(`question-${firstErrorId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = () => {
        if (!isLoggedIn) {
            setLoginModalOpen(true);
        } else {
            submitAnswers();
        }
    };

    const submitAnswers = async () => {
        setApiError('');
        setValidationErrors({});
        if (!validateAnswers()) return;
        setIsLoading(true);
        try {
            for (const question of questions) {
                const answer = answers[question.id];
                let payload = null;
                const questionType = parseInt(question.questionTypeId, 10);
                switch (questionType) {
                    case 1:
                        payload = { AnswerText: String(answer).trim() };
                        break;
                    case 2:
                        const selectedOptionSingle = question.options.find((opt) => opt.id === parseInt(answer, 10));
                        if (!selectedOptionSingle) {
                            setApiError(`Внутренняя ошибка: неверный вариант для вопроса ID ${question.id}`);
                            setIsLoading(false);
                            return;
                        }
                        payload = { AnswerClose: selectedOptionSingle.order };
                        break;
                    case 3:
                        if (!Array.isArray(answer) || answer.length === 0) {
                            setApiError(`Внутренняя ошибка: неверный формат для вопроса ID ${question.id}`);
                            setIsLoading(false);
                            return;
                        }
                        const selectedOrdersMultiple = answer.map((id) => {
                            const option = question.options.find((opt) => opt.id === id);
                            return option ? option.order : null;
                        }).filter(order => order !== null);
                        if (selectedOrdersMultiple.length !== answer.length) {
                            setApiError(`Внутренняя ошибка: неверный вариант в множественном выборе для вопроса ID ${question.id}`);
                            setIsLoading(false);
                            return;
                        }
                        payload = { AnswerMultiple: selectedOrdersMultiple };
                        break;
                    case 4:
                        const scaleValue = parseInt(answer, 10);
                        if (isNaN(scaleValue) || scaleValue < 1 || scaleValue > question.divisions) {
                            setApiError(`Внутренняя ошибка: неверное значение шкалы для вопроса ID ${question.id}`);
                            setIsLoading(false);
                            return;
                        }
                        payload = { AnswerScale: scaleValue };
                        break;
                    case 5:
                        const selectedOptionIdDropdown = parseInt(answer, 10);
                        if (isNaN(selectedOptionIdDropdown) || answer === '') {
                            setApiError(`Внутренняя ошибка: не выбран вариант для вопроса ID ${question.id}`);
                            setIsLoading(false);
                            return;
                        }
                        payload = { AnswerClose: selectedOptionIdDropdown };
                        break;
                    default:
                        console.warn(`Неизвестный тип вопроса: Исходный=${question.questionTypeId}, Преобразованный=${questionType}`);
                        continue;
                }

                if (payload) {
                    await axios.post(
                        // `https://localhost:7109/questionnaire/access/${id}/questions/${question.id}/answer`,
                        `http://localhost:5000/questionnaire/access/${id}/questions/${question.id}/answer`,
                        // `https://5.129.207.189/questionnaire/access/${id}/questions/${question.id}/answer`,
                        payload,
                        {
                            headers: {
                                Authorization: `Bearer ${localStorage.getItem('access_token')}`,
                                'Content-Type': 'application/json',
                            },
                        }
                    );
                }
            }
            navigate('/Thk', { state: { questionnaireId: id } });
        } catch (err) {
            console.error('Ошибка при отправке ответов:', err);
            if (err.response?.status === 404) {
                setApiError('Не удалось отправить ответ. Возможно, анкета была закрыта или удалена.');
            } else if (err.response?.status === 401 || err.response?.status === 403) {
                setApiError('Ошибка прав доступа при отправке ответов.');
            } else {
                setApiError('Произошла непредвиденная ошибка при отправке ответов.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
        if (validationErrors[questionId]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[questionId];
                return newErrors;
            });
        }
    };

    const handleCheckboxChange = (questionId, optionId) => {
        setAnswers((prev) => {
            const currentAnswers = prev[questionId] || [];
            const updatedAnswers = currentAnswers.includes(optionId)
                ? currentAnswers.filter((id) => id !== optionId)
                : [...currentAnswers, optionId];
            return { ...prev, [questionId]: updatedAnswers };
        });
        if (validationErrors[questionId]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[questionId];
                return newErrors;
            });
        }
    };

    const renderQuestionInput = (question) => {
        const hasError = !!validationErrors[question.id];
        const errorMessage = validationErrors[question.id];
        const questionType = parseInt(question.questionTypeId, 10);
        switch (questionType) {
            case 1:
                return (
                    <div className={`otv-title ${hasError ? 'error' : ''}`}>
                        <span>{question.text}</span>
                        <input
                            type="text"
                            placeholder="Ваш ответ..."
                            value={answers[question.id] || ''}
                            onChange={(e) => handleInputChange(question.id, e.target.value)}
                            aria-invalid={hasError}
                        />
                        {hasError && <p className="inline-error">{errorMessage}</p>}
                    </div>
                );
            case 2:
                return (
                    <div className={`rad-title ${hasError ? 'error' : ''}`}>
                        <span>{question.text}</span>
                        {(question.options || []).map((option) => (
                            <label key={option.id}>
                                <input
                                    type="radio"
                                    name={`question-${question.id}`}
                                    value={option.id}
                                    checked={answers[question.id] === option.id}
                                    onChange={() => handleInputChange(question.id, option.id)}
                                    aria-invalid={hasError}
                                />
                                {option.optionText}
                            </label>
                        ))}
                        {hasError && <p className="inline-error">{errorMessage}</p>}
                    </div>
                );
            case 3:
                return (
                    <div className={`checkbox-title ${hasError ? 'error' : ''}`}>
                        <span className="text-qw">{question.text}</span>
                        {(question.options || []).map((option) => (
                            <label key={option.id} className="custom-checkbox">
                                <input
                                    type="checkbox"
                                    name={`question-${question.id}`}
                                    value={option.id}
                                    checked={(answers[question.id] || []).includes(option.id)}
                                    onChange={() => handleCheckboxChange(question.id, option.id)}
                                    aria-invalid={hasError}
                                />
                                <span>{option.optionText}</span>
                            </label>
                        ))}
                        {hasError && <p className="inline-error">{errorMessage}</p>}
                    </div>
                );
            case 4:
                const divisions = question.divisions || 5;
                let currentValue = parseInt(answers[question.id], 10);
                if (isNaN(currentValue) || currentValue < 1 || currentValue > divisions) {
                    currentValue = Math.ceil(divisions / 2);
                }
                return (
                    <div className={`slider-title ${hasError ? 'error' : ''}`}>
                        <div className="scale-title">
                            <span className="text-slider">{question.text}</span>
                            <div className="scale-endpoints">
                                <p className="scale-endpoint-left">{question.leftScaleValue || 'Min'}</p>
                                <p className="scale-endpoint-right">{question.rightScaleValue || 'Max'}</p>
                            </div>
                            <div className="slider-container">
                                <input
                                    type="range"
                                    min="1"
                                    max={divisions}
                                    step="1"
                                    value={currentValue}
                                    onChange={(e) => handleInputChange(question.id, parseInt(e.target.value, 10))}
                                    className="slider"
                                    aria-invalid={hasError}
                                />
                                <div className="slider-labels" style={{ gridTemplateColumns: `repeat(${divisions}, 1fr)` }}>
                                    {Array.from({ length: divisions }, (_, i) => (
                                        <span key={i + 1} className={`label ${currentValue === (i + 1) ? 'active' : ''}`}>{i + 1}</span>
                                    ))}
                                </div>
                                <span className="slider-current-value">Выбрано: {currentValue}</span>
                            </div>
                        </div>
                        {hasError && <p className="inline-error">{errorMessage}</p>}
                    </div>
                );
            case 5:
                return (
                    <div className={`select-title ${hasError ? 'error' : ''}`}>
                        <span>{question.text}</span>
                        <select
                            value={answers[question.id] || ''}
                            onChange={(e) => handleInputChange(question.id, e.target.value)}
                            aria-invalid={hasError}
                            className="dropdown-select"
                        >
                            <option value="" disabled>-- Выберите вариант --</option>
                            {(question.options || []).map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.optionText}
                                </option>
                            ))}
                        </select>
                        {hasError && <p className="inline-error">{errorMessage}</p>}
                    </div>
                );
            default:
                return <div key={question.id}>Неизвестный тип вопроса: {question.questionTypeId}</div>;
        }
    };

    if (isLoading && !questions.length && !apiError) {
        return <div className="loading-indicator">Загрузка анкеты...</div>;
    }

    if (apiError && !isLoading && questions.length === 0) {
        return <div className="ans-page-vh"><div className="ans-page"><div className="error-message-answers">{apiError}</div></div></div>;
    }

    return (
        <div className="ans-page-vh">
            <div className="ans-page">
                {apiError && <div className="error-message-answers api-error-top">{apiError}</div>}
                {questions.length > 0 && (
                    <>
                        <div className="answers-title">
                            <span className="ans-title">{ansTitle}</span>
                        </div>
                        {questions.map((question) => (
                            <div
                                key={question.id}
                                id={`question-${question.id}`}
                                className={`question-block question-type-${question.questionTypeId}${validationErrors[question.id] ? ' has-error' : ''}`}
                                role="group"
                                aria-labelledby={`question-text-${question.id}`}
                            >
                                {renderQuestionInput(question)}
                            </div>
                        ))}
                        <div className="ButtonSaveContainer">
                            <button
                                className="ButtonSave"
                                onClick={handleSubmit}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Отправка...' : 'Отправить ответы'}
                            </button>
                        </div>
                    </>
                )}
                {!isLoading && questions.length === 0 && !apiError && (
                    <div className="no-questions-message">В этой анкете пока нет вопросов.</div>
                )}

                {/* Модальные окна */}
                {isLoginModalOpen && (
                    <ModalLogin
                        onClose={() => setLoginModalOpen(false)}
                        onRegisterOpen={() => {
                            setLoginModalOpen(false);
                            setRegisterModalOpen(true);
                        }}
                        onLoginSuccess={() => {
                            login();
                            setLoginModalOpen(false);
                            submitAnswers();
                        }}
                    />
                )}

                {isRegisterModalOpen && (
                    <ModalRegister
                        onClose={() => setRegisterModalOpen(false)}
                        onLoginOpen={() => {
                            setRegisterModalOpen(false);
                            setLoginModalOpen(true);
                        }}
                        onRegisterSuccess={() => {
                            login();
                            setRegisterModalOpen(false);
                            submitAnswers();
                        }}
                    />
                )}
            </div>
        </div>
    );
}

export default AnswersPage;