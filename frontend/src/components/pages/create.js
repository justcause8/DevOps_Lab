import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import apiClient from '../apiContent/apiClient';
import './create.css';
import { useNavigate } from 'react-router-dom';

const SurveyPage = () => {
    const navigate = useNavigate();

    const [questions, setQuestions] = useState([
        {
            uniqueId: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            displayId: 1,
            type: "Открытый",
            text: "",
            answers: [],
            leftScaleValue: "",
            rightScaleValue: "",
            divisions: 5,
            isNew: false,
            isDeleting: false,
            animationState: null,
        },
    ]);
    const [draggedId, setDraggedId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const [dropdownsOpen, setDropdownsOpen] = useState({});
    const [title, setTitle] = useState("");
    const [error, setError] = useState("");
    const [questionErrors, setQuestionErrors] = useState({});
    const [deleteError, setDeleteError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const options = ["Открытый", "Закрытый", "Множественный выбор", "Шкала", "Выпадающий список"];
    const questionRefs = useRef({});

    const questionIndices = useMemo(() => {
        const indices = {};
        questions.forEach((q, index) => {
            indices[q.uniqueId] = index;
        });
        return indices;
    }, [questions]);

    const draggedIndex = useMemo(() => (draggedId ? questionIndices[draggedId] : -1), [draggedId, questionIndices]);

    const setQuestionRef = (id, element) => {
        if (element) {
            questionRefs.current[id] = element;
        } else {
            delete questionRefs.current[id];
        }
    };

    const updateDisplayIds = (currentQuestions) => {
        return currentQuestions.map((q, index) => ({
            ...q,
            displayId: index + 1,
        }));
    };

    const ANIMATION_DURATION = 450;

    const clearAnimationState = (uniqueId) => {
        setQuestions(prev => prev.map(q =>
            q.uniqueId === uniqueId && q.animationState ? { ...q, animationState: null } : q
        ));
    };

    useEffect(() => {
        questions.forEach(q => {
            if (q.isNew) {
                const element = questionRefs.current[q.uniqueId];
                if (element) {
                    element.classList.add('question-enter');
                    requestAnimationFrame(() => {
                        element.classList.remove('question-enter');
                    });
                }
                const timer = setTimeout(() => {
                    setQuestions(prev => prev.map(pq => pq.uniqueId === q.uniqueId ? { ...pq, isNew: false } : pq));
                }, ANIMATION_DURATION);
                return () => clearTimeout(timer);
            }
        });
    }, [questions]);

    useEffect(() => {
        if (dragOverId === null) {
            setQuestions(prev => prev.map(q =>
                q.animationState?.startsWith('make-space') ? { ...q, animationState: null } : q
            ));
        }
    }, [dragOverId]);


    const getQuestionTypeId = (type) => {
        switch (type) {
            case "Открытый": return 1;
            case "Закрытый": return 2;
            case "Множественный выбор": return 3;
            case "Шкала": return 4;
            case "Выпадающий список": return 5;
            default: throw new Error(`Неизвестный тип вопроса: ${type}`);
        }
    };

    const handleScaleChange = (uniqueId, field, value) => {
        setQuestions(prevQuestions => prevQuestions.map(q =>
            q.uniqueId === uniqueId ? { ...q, [field]: value } : q
        ));
    };

    const handleSave = async () => {
        if (isLoading) return;

        setIsLoading(true);

        try {
            setError("");
            setQuestionErrors({});

            if (!title.trim()) {
                setError("Название анкеты должно быть заполнено");
                setIsLoading(false);
                return;
            }

            if (!validateQuestions()) {
                setIsLoading(false);
                return;
            }

            const questionsToSave = questions.filter(q => !q.isDeleting);

            const formattedQuestions = questionsToSave.map((question) => {
                const cleanQuestion = { ...question, animationState: null };
                if (cleanQuestion.type === "Шкала") {
                    const scaleText = `${cleanQuestion.leftScaleValue || ""}|${cleanQuestion.rightScaleValue || ""}|${cleanQuestion.divisions || 5}`;
                    return { ...cleanQuestion, text: `${cleanQuestion.text || ''}|${scaleText}` };
                }
                return cleanQuestion;
            });

            const response = await apiClient.post('/questionnaire/create', { Title: title });
            const questionnaireId = response.data.questionnaireId;
            const link = response.data.link;

            for (const question of formattedQuestions.sort((a, b) => a.displayId - b.displayId)) {
                await addQuestionApi(questionnaireId, question);
            }

            navigate("/Linkk", { state: { link } });

        } catch (error) {
            console.error('Ошибка при сохранении анкеты:', error.response?.data || error.message);
            setError(`Ошибка при сохранении анкеты: ${error.response?.data?.message || error.message}`);
        } finally {
            setIsLoading(false);
        }
    };


    const validateQuestions = () => {
        const errors = {};
        let isValid = true;

        if (!title.trim()) {
            setError("Название анкеты должно быть заполнено");
            isValid = false;
        } else if (title.length > 250) {
            setError("Название анкеты не может превышать 250 символов");
            isValid = false;
        }

        questions.forEach((question) => {
            if (question.isDeleting) return;
            const errorKey = question.displayId;


            if (!question.text.trim() && question.type !== "Шкала") {
                errors[errorKey] = "Текст вопроса не может быть пустым";
                isValid = false;
            } else if (question.text.length > 250) {
                errors[errorKey] = "Текст вопроса не может превышать 250 символов";
                isValid = false;
            }


            if (question.type === "Шкала") {
                if (!question.leftScaleValue.trim() || !question.rightScaleValue.trim()) {

                    if (question.text.trim() || question.leftScaleValue.trim() || question.rightScaleValue.trim()) {

                        errors[errorKey] = "Значения шкалы (левое и правое) должны быть заполнены";
                        isValid = false;
                    }
                } else {
                    if (question.leftScaleValue.length > 250 || question.rightScaleValue.length > 250) {
                        errors[errorKey] = "Значения шкалы не могут превышать 250 символов";
                        isValid = false;
                    }

                    if (question.divisions < 2 || question.divisions > 10) {
                        errors[errorKey] = "Количество делений должно быть от 2 до 10";
                        isValid = false;
                    }
                }
            }



            if (["Закрытый", "Множественный выбор", "Выпадающий список"].includes(question.type)) {
                if (!question.answers || question.answers.length === 0) {
                    errors[errorKey] = "Необходимо добавить хотя бы один вариант ответа";
                    isValid = false;
                } else {
                    const emptyAnswers = question.answers.filter(a => !a.text.trim());
                    if (emptyAnswers.length > 0) {


                        errors[errorKey] = "Варианты ответов не могут быть пустыми";
                        isValid = false;

                    } else {

                        const invalidAnswers = question.answers.filter(a => a.text.length > 250);
                        if (invalidAnswers.length > 0) {
                            errors[errorKey] = "Варианты ответов не могут превышать 250 символов";
                            isValid = false;
                        }
                    }

                    if (question.answers.length < 2) {
                        errors[errorKey] = "Необходимо как минимум два варианта ответа";
                        isValid = false;
                    }
                }
            }
        });

        setQuestionErrors(errors);
        return isValid;
    };

    const addQuestionApi = async (questionnaireId, question) => {
        try {
            const response = await apiClient.post(`/questionnaire/${questionnaireId}/questions/add-question`, {

                Text: question.text,
                QuestionType: getQuestionTypeId(question.type),
            });
            const questionId = response.data.questionId;



            if (["Закрытый", "Множественный выбор", "Выпадающий список"].includes(question.type) && question.answers?.length > 0) {
                for (const answer of question.answers) {

                    if (answer.text.trim()) {
                        await apiClient.post(`/questionnaire/${questionnaireId}/questions/${questionId}/options`, {
                            OptionText: answer.text,
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка при добавлении вопроса (API):', error.response?.data || error.message);

            throw new Error(`Ошибка добавления вопроса "${question.text.substring(0, 20)}...": ${error.response?.data?.message || error.message}`);
        }
    };



    const handleDragStart = useCallback((e, uniqueId) => {
        e.dataTransfer.effectAllowed = 'move';
        setDraggedId(uniqueId);

        setTimeout(() => {
            const element = questionRefs.current[uniqueId];
            if (element) element.classList.add('dragging');
        }, 0);
    }, []);

    const handleDragOver = useCallback((e, targetUniqueId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (targetUniqueId === draggedId) {

            if (dragOverId && dragOverId !== targetUniqueId) {
                clearAnimationState(dragOverId);
            }
            setDragOverId(null);
            return;
        }

        if (targetUniqueId !== dragOverId) {

            if (dragOverId) {
                clearAnimationState(dragOverId);
            }

            setDragOverId(targetUniqueId);
            const targetIndex = questionIndices[targetUniqueId];


            if (draggedIndex !== -1 && targetIndex !== -1) {
                const direction = draggedIndex < targetIndex ? 'make-space-up' : 'make-space-down';
                setQuestions(prev => prev.map(q =>
                    q.uniqueId === targetUniqueId ? { ...q, animationState: direction } : q
                ));
            }
        }
    }, [draggedId, dragOverId, questionIndices, draggedIndex]);


    const handleDragLeave = useCallback((e, uniqueId) => {

        const container = questionRefs.current[uniqueId];

        if (container && !container.contains(e.relatedTarget)) {
            if (uniqueId === dragOverId) {
                clearAnimationState(uniqueId);
                setDragOverId(null);
            }
        }
    }, [dragOverId]);


    const handleDrop = useCallback((e, targetUniqueId) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetUniqueId) {

            if (dragOverId) clearAnimationState(dragOverId);
            setDragOverId(null);

            if (draggedId && questionRefs.current[draggedId]) {
                questionRefs.current[draggedId].classList.remove('dragging');
            }
            setDraggedId(null);
            return;
        }

        const targetIndex = questionIndices[targetUniqueId];


        if (draggedIndex === -1 || targetIndex === -1) return;


        clearAnimationState(targetUniqueId);



        setQuestions(prevQuestions => {
            const updatedQuestions = [...prevQuestions];

            const [draggedItem] = updatedQuestions.splice(draggedIndex, 1);

            const cleanDraggedItem = { ...draggedItem, animationState: null, isNew: false, isDeleting: false };

            updatedQuestions.splice(targetIndex, 0, cleanDraggedItem);

            return updateDisplayIds(updatedQuestions.map(q => ({ ...q, isNew: false, isDeleting: false })));
        });


        if (questionRefs.current[draggedId]) {
            questionRefs.current[draggedId].classList.remove('dragging');
        }
        setDraggedId(null);
        setDragOverId(null);
    }, [draggedId, draggedIndex, questionIndices]);

    const handleDragEnd = useCallback(() => {

        if (draggedId && questionRefs.current[draggedId]) {
            questionRefs.current[draggedId].classList.remove('dragging');
        }
        if (dragOverId) {
            clearAnimationState(dragOverId);
        }
        setDraggedId(null);
        setDragOverId(null);
    }, [draggedId, dragOverId]);




    const addNewQuestion = (afterUniqueId) => {

        if (questions.filter(q => !q.isDeleting).length >= 10) return;

        const newQuestion = {
            uniqueId: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            displayId: 0,
            type: "Открытый",
            text: "",
            answers: [],
            leftScaleValue: "",
            rightScaleValue: "",
            divisions: 5,
            isNew: true,
            isDeleting: false,
            animationState: null,
        };

        setQuestions(prevQuestions => {
            const index = prevQuestions.findIndex(q => q.uniqueId === afterUniqueId);
            const insertIndex = index !== -1 ? index + 1 : prevQuestions.length;
            const updatedQuestions = [...prevQuestions];
            updatedQuestions.splice(insertIndex, 0, newQuestion);
            return updateDisplayIds(updatedQuestions);
        });
    };


    const moveQuestion = useCallback((uniqueId, direction) => {
        const index = questionIndices[uniqueId];
        let targetIndex = -1;
        let movingItemAnimState = null;
        let targetItemAnimState = null;

        if (direction === 'up' && index > 0) {
            targetIndex = index - 1;
            movingItemAnimState = 'levitate-up';
            targetItemAnimState = 'levitate-down';
        } else if (direction === 'down' && index < questions.length - 1) {
            targetIndex = index + 1;
            movingItemAnimState = 'levitate-down';
            targetItemAnimState = 'levitate-up';
        }

        if (targetIndex !== -1) {
            const targetUniqueId = questions[targetIndex].uniqueId;


            setQuestions(prev => prev.map(q => {
                if (q.uniqueId === uniqueId) return { ...q, animationState: movingItemAnimState };
                if (q.uniqueId === targetUniqueId) return { ...q, animationState: targetItemAnimState };
                return q;
            }));


            setTimeout(() => {
                setQuestions(prevQuestions => {

                    const currentIdx = prevQuestions.findIndex(q => q.uniqueId === uniqueId);
                    const currentTargetIdx = prevQuestions.findIndex(q => q.uniqueId === targetUniqueId);


                    if (currentIdx === -1 || currentTargetIdx === -1) return prevQuestions;

                    const updatedQuestions = [...prevQuestions];

                    [updatedQuestions[currentIdx], updatedQuestions[currentTargetIdx]] =
                        [updatedQuestions[currentTargetIdx], updatedQuestions[currentIdx]];


                    return updateDisplayIds(updatedQuestions);
                });


                setTimeout(() => {
                    clearAnimationState(uniqueId);
                    clearAnimationState(targetUniqueId);
                }, ANIMATION_DURATION);

            }, 50);
        }
    }, [questions, questionIndices, ANIMATION_DURATION]);


    const deleteQuestion = useCallback((uniqueId) => {

        if (questions.filter(q => !q.isDeleting).length <= 1) return;


        setQuestions(prevQuestions =>
            prevQuestions.map(q =>
                q.uniqueId === uniqueId ? { ...q, isDeleting: true, animationState: null } : q
            )
        );


        setTimeout(() => {
            setQuestions(prevQuestions => {
                const remainingQuestions = prevQuestions.filter(q => q.uniqueId !== uniqueId);
                return updateDisplayIds(remainingQuestions);
            });

            delete questionRefs.current[uniqueId];
        }, ANIMATION_DURATION);
    }, [questions, ANIMATION_DURATION]);


    const handleOptionSelect = (uniqueId, option) => {
        setQuestions(
            questions.map((q) =>
                q.uniqueId === uniqueId
                    ? {
                        ...q,
                        type: option,

                        answers:
                            ["Закрытый", "Множественный выбор", "Выпадающий список"].includes(option) &&
                                q.answers.length === 0
                                ? [{ id: `a_${Date.now()}_1`, text: "" }, { id: `a_${Date.now()}_2`, text: "" }]
                                : (["Закрытый", "Множественный выбор", "Выпадающий список"].includes(option) ? q.answers : []),

                        leftScaleValue: option === "Шкала" ? q.leftScaleValue : "",
                        rightScaleValue: option === "Шкала" ? q.rightScaleValue : "",
                        divisions: option === "Шкала" ? q.divisions : 5,
                        animationState: null,
                    }
                    : q
            )
        );

        const questionWithError = questions.find(q => q.uniqueId === uniqueId);
        if (questionWithError) {
            setQuestionErrors(prevErrors => {
                const newErrors = { ...prevErrors };
                delete newErrors[questionWithError.displayId];
                return newErrors;
            });
        }

        setDropdownsOpen(prev => ({ ...prev, [uniqueId]: false }));
    };


    const addAnswer = (questionUniqueId) => {
        setQuestions(
            questions.map((q) => {
                if (q.uniqueId === questionUniqueId) {

                    if (q.answers.length >= 10) {
                        setDeleteError("Нельзя добавить больше 10 ответов");
                        setTimeout(() => setDeleteError(null), 3000);
                        return q;
                    }
                    const newAnswer = {

                        id: `a_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                        text: ""
                    };

                    return { ...q, answers: [...(q.answers || []), newAnswer] };
                }
                return q;
            })
        );

        const questionWithError = questions.find(q => q.uniqueId === questionUniqueId);
        if (questionWithError && questionErrors[questionWithError.displayId]?.includes("ответ")) {
            setQuestionErrors(prevErrors => {
                const newErrors = { ...prevErrors };
                delete newErrors[questionWithError.displayId];
                return newErrors;
            });
        }
    };

    const deleteAnswer = (questionUniqueId, answerIdToDelete) => {
        setQuestions((prevQuestions) =>
            prevQuestions.map((q) => {
                if (q.uniqueId === questionUniqueId) {

                    if (q.answers.length <= 2) {
                        setDeleteError("Минимум 2 ответа");
                        setTimeout(() => setDeleteError(null), 3000);
                        return q;
                    }

                    const updatedAnswers = q.answers.filter(a => a.id !== answerIdToDelete);
                    return { ...q, answers: updatedAnswers };
                }
                return q;
            })
        );

        const questionWithError = questions.find(q => q.uniqueId === questionUniqueId);
        if (questionWithError && questionErrors[questionWithError.displayId]?.includes("ответ")) {
            setQuestionErrors(prevErrors => {
                const newErrors = { ...prevErrors };
                delete newErrors[questionWithError.displayId];
                return newErrors;
            });
        }
    };

    const handleAnswerChange = (questionUniqueId, answerId, newText) => {
        setQuestions(
            questions.map(q =>
                q.uniqueId === questionUniqueId
                    ? {
                        ...q,

                        answers: q.answers.map(a =>
                            a.id === answerId ? { ...a, text: newText } : a
                        ),
                    }
                    : q
            )
        );

        const questionWithError = questions.find(q => q.uniqueId === questionUniqueId);
        if (newText.trim() && questionWithError && questionErrors[questionWithError.displayId]?.includes("пустыми")) {
            setQuestionErrors(prevErrors => {
                const newErrors = { ...prevErrors };
                delete newErrors[questionWithError.displayId];
                return newErrors;
            });
        }
    };

    const getQuestionContainerClassName = (question) => {
        let classes = ['question-container'];
        if (question.isDeleting) classes.push('question-exit-active');
        if (question.animationState) classes.push(question.animationState);


        return classes.join(' ');
    };



    return (
        <div className="survey-page-vh">
            <div className="survey-page">

                <div className="survey-title">
                    <span>Название анкеты</span>
                    <input
                        type="text"
                        placeholder="название"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength="250"
                        aria-label="Название анкеты"
                    />

                    {error && <p className="error-message-create">{error}</p>}
                </div>


                {questions.map((question) => (
                    <div
                        ref={(el) => setQuestionRef(question.uniqueId, el)}
                        className={getQuestionContainerClassName(question)}
                        key={question.uniqueId}
                        id={`question-cont-${question.uniqueId}`}
                        draggable={!question.isDeleting}
                        onDragStart={(e) => handleDragStart(e, question.uniqueId)}
                        onDragOver={(e) => handleDragOver(e, question.uniqueId)}
                        onDrop={(e) => handleDrop(e, question.uniqueId)}
                        onDragEnd={handleDragEnd}
                        onDragLeave={(e) => handleDragLeave(e, question.uniqueId)}
                    >

                        <div className="question">

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    Тип вопроса

                                    <div className="dropdown">
                                        <button
                                            type="button"
                                            className="punkt"
                                            onClick={() =>

                                                setDropdownsOpen(prev => ({ ...prev, [question.uniqueId]: !prev[question.uniqueId] }))
                                            }
                                            aria-haspopup="listbox"
                                            aria-expanded={!!dropdownsOpen[question.uniqueId]}
                                            aria-controls={`dropdown-menu-${question.uniqueId}`}
                                            title="Выбрать тип вопроса"
                                        >

                                            <div className={`punktGalka ${dropdownsOpen[question.uniqueId] ? "rotate" : ""}`}></div>
                                        </button>

                                        <ul
                                            className={`dropdown-menu ${dropdownsOpen[question.uniqueId] ? "open" : ""}`}
                                            id={`dropdown-menu-${question.uniqueId}`}
                                            role="listbox"
                                        >

                                            {options.map((option) => (
                                                <li
                                                    key={option}
                                                    onClick={() => handleOptionSelect(question.uniqueId, option)}
                                                    className="dropdown-item"
                                                    role="option"
                                                    aria-selected={question.type === option}
                                                >
                                                    {option}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <span style={{ marginLeft: '5px', fontWeight: '500' }}>{question.type}</span>
                                </div>
                            </div>


                            <input
                                type="text"
                                placeholder="текст вопроса"
                                value={question.text}
                                onChange={(e) =>

                                    setQuestions(prev => prev.map(q =>
                                        q.uniqueId === question.uniqueId ? { ...q, text: e.target.value } : q
                                    ))
                                }
                                maxLength="250"
                                id={`question-text-${question.uniqueId}`}
                                aria-label={`Текст вопроса ${question.displayId}`}
                            />

                            {questionErrors[question.displayId] && (questionErrors[question.displayId].includes("Текст вопроса") || questionErrors[question.displayId].includes("не может быть пустым") || (question.type === "Шкала" && questionErrors[question.displayId].includes("Значения шкалы"))) && (
                                <p className="error-message-create">{questionErrors[question.displayId]}</p>
                            )}




                            {["Закрытый", "Множественный выбор", "Выпадающий список"].includes(question.type) && (
                                <div style={{ marginTop: '20px' }}>

                                    {question.answers.map((answer, index) => (
                                        <div
                                            key={answer.id}
                                            className="answer-container"
                                        >
                                            <input
                                                type="text"
                                                placeholder={`вариант ${index + 1}`}
                                                value={answer.text}
                                                onChange={(e) => handleAnswerChange(question.uniqueId, answer.id, e.target.value)}
                                                maxLength="250"
                                                id={`answer-text-${question.uniqueId}-${answer.id}`}
                                                aria-label={`Вариант ответа ${index + 1} для вопроса ${question.displayId}`}
                                            />

                                            {question.answers.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => deleteAnswer(question.uniqueId, answer.id)}
                                                    title="Удалить этот вариант"
                                                    className="delete-button"
                                                    aria-label={`Удалить вариант ответа ${index + 1}`}
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    ))}

                                    {questionErrors[question.displayId] && (questionErrors[question.displayId].includes("ответ") || questionErrors[question.displayId].includes("пустыми")) && (
                                        <p className="error-message-create">{questionErrors[question.displayId]}</p>
                                    )}

                                    {deleteError && <p className="error-message-create">{deleteError}</p>}

                                    <button
                                        type="button"
                                        className="add-button"
                                        onClick={() => addAnswer(question.uniqueId)}
                                        disabled={question.answers.length >= 10}
                                        id={`add-answer-${question.uniqueId}`}
                                    >
                                        {question.answers.length >= 10 ? "Максимум вариантов" : "добавить вариант"}
                                    </button>
                                </div>
                            )}


                            {question.type === "Шкала" && (
                                <div style={{ marginTop: '20px' }}>

                                    <input
                                        type="text"
                                        placeholder="левое значение шкалы"
                                        value={question.leftScaleValue}
                                        onChange={(e) => handleScaleChange(question.uniqueId, "leftScaleValue", e.target.value)}
                                        maxLength="250"
                                        id={`left-scale-${question.uniqueId}`}
                                        style={{ marginBottom: '10px', width: 'calc(100% - 10px)' }}
                                        aria-label={`Левое значение шкалы для вопроса ${question.displayId}`}
                                    />

                                    <input
                                        type="text"
                                        placeholder="правое значение шкалы"
                                        value={question.rightScaleValue}
                                        onChange={(e) => handleScaleChange(question.uniqueId, "rightScaleValue", e.target.value)}
                                        maxLength="250"
                                        id={`right-scale-${question.uniqueId}`}
                                        style={{ marginBottom: '10px', width: 'calc(100% - 10px)' }}
                                        aria-label={`Правое значение шкалы для вопроса ${question.displayId}`}
                                    />



                                    <div
                                        style={{ display: "flex", alignItems: "center", gap: "10px", color: "gray", fontSize: "16px", marginTop: '10px' }}
                                    >
                                        <label htmlFor={`divisions-${question.uniqueId}`} id={`label-divisions-${question.uniqueId}`}>
                                            количество делений:
                                        </label>
                                        <input
                                            id={`divisions-${question.uniqueId}`}
                                            type="number"
                                            min="2"
                                            max="10"
                                            value={question.divisions}
                                            onChange={(e) => handleScaleChange(question.uniqueId, "divisions", parseInt(e.target.value) || 2)}
                                            style={{ width: "60px", textAlign: "center", padding: '3px', border: '1px solid #ccc', borderRadius: '4px' }}
                                            aria-labelledby={`label-divisions-${question.uniqueId}`}
                                        />
                                    </div>

                                    {questionErrors[question.displayId] && questionErrors[question.displayId].includes("делений") && (
                                        <p className="error-message-create">{questionErrors[question.displayId]}</p>
                                    )}
                                </div>
                            )}

                        </div>

                        <div className="action">

                            <button
                                type="button"
                                className="newBlock"
                                onClick={() => addNewQuestion(question.uniqueId)}
                                disabled={questions.filter(q => !q.isDeleting).length >= 10}
                                style={{ opacity: questions.filter(q => !q.isDeleting).length >= 10 ? 0.5 : 1 }}
                                title={questions.filter(q => !q.isDeleting).length >= 10 ? "Достигнут лимит вопросов" : "Добавить новый вопрос после этого"}
                            >

                                <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" fill="currentColor" className="bi bi-plus" viewBox="0 0 16 16" aria-hidden="true">
                                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                                </svg>
                                новый блок
                            </button>

                            <div className="swap">

                                <button
                                    type="button"
                                    onClick={() => moveQuestion(question.uniqueId, 'up')}
                                    disabled={question.displayId === 1 || !!question.animationState}
                                    style={{ opacity: (question.displayId === 1 || !!question.animationState) ? 0.3 : 1 }}
                                    aria-label="Переместить вопрос вверх"
                                    title="Переместить вверх"
                                >

                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-arrow-up" viewBox="0 0 16 16" aria-hidden="true">
                                        <path fillRule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5" />
                                    </svg>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => moveQuestion(question.uniqueId, 'down')}
                                    disabled={question.displayId === questions.filter(q => !q.isDeleting).length || !!question.animationState}
                                    style={{ opacity: (question.displayId === questions.filter(q => !q.isDeleting).length || !!question.animationState) ? 0.3 : 1 }}
                                    aria-label="Переместить вопрос вниз"
                                    title="Переместить вниз"
                                >

                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-arrow-down" viewBox="0 0 16 16" aria-hidden="true">
                                        <path fillRule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1" />
                                    </svg>
                                </button>
                                <span style={{ marginLeft: '5px' }}>переместить</span>
                            </div>

                            <button
                                type="button"
                                className="trash"
                                onClick={() => deleteQuestion(question.uniqueId)}
                                disabled={questions.filter(q => !q.isDeleting).length <= 1 || !!question.animationState}
                                style={{ opacity: (questions.filter(q => !q.isDeleting).length <= 1 || !!question.animationState) ? 0.3 : 1 }}
                                title={questions.filter(q => !q.isDeleting).length <= 1 ? "Нельзя удалить единственный вопрос" : "Удалить этот вопрос"}
                            >

                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-trash" viewBox="0 0 16 16" aria-hidden="true">
                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
                                    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3V2h11v1z" />
                                </svg>
                                удалить
                            </button>
                        </div>
                    </div>
                ))}


                <div className="ButtonSaveContainer">
                    <button
                        onClick={handleSave}
                        className="ButtonSave"
                        type="button"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Отправка...' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SurveyPage;