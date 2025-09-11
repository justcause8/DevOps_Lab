import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Modal from 'react-modal';
import apiClient from "../apiContent/apiClient";
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import "./Analysis.css";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

if (typeof window !== 'undefined') {
    Modal.setAppElement('#root');
}

const generateCheckboxBarLegendLabels = (chart) => {
    const data = chart.data;
    if (data.labels && data.labels.length && data.datasets.length && data.datasets[0].data) {
        return data.labels.map((label, i) => {
            const meta = chart.getDatasetMeta(0);
            const style = meta.controller.getStyle(i);
            const labelText = Array.isArray(label) ? label.join(' ') : String(label);
            return {
                text: labelText,
                fillStyle: style.backgroundColor,
                strokeStyle: style.borderColor,
                lineWidth: style.borderWidth,
                hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                index: i,
            };
        });
    }
    return [];
};


function ScoreWheel({ score, size = 60, strokeWidth = 5 }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const minScore = 1;
    const maxScore = 5;
    const [currentDashOffset, setCurrentDashOffset] = useState(circumference);

    useEffect(() => {
        const normalizedScore = Math.max(minScore, Math.min(maxScore, score || minScore));
        const progress = (normalizedScore - minScore) / (maxScore - minScore);
        const targetDashOffset = circumference * (1 - progress);
        const timer = setTimeout(() => setCurrentDashOffset(targetDashOffset), 50);
        return () => clearTimeout(timer);
    }, [score, circumference]);

    let strokeColor = '#cccccc';
    const currentProgress = (circumference - currentDashOffset) / circumference;
    if (currentProgress > 0.01) {
        const hue = currentProgress * 120;
        strokeColor = `hsl(${hue}, 70%, 50%)`;
    }
    const center = size / 2;
    const textY = center + 2;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="score-wheel-svg">
            <circle cx={center} cy={center} r={radius} fill="none" stroke="#e6e6e6" strokeWidth={strokeWidth} />
            <circle
                cx={center} cy={center} r={radius} fill="none"
                stroke={strokeColor} strokeWidth={strokeWidth}
                strokeDasharray={circumference} strokeDashoffset={currentDashOffset}
                strokeLinecap="round" transform={`rotate(-90 ${center} ${center})`}
                style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.5s ease' }}
            />
            <text x="50%" y={textY} dominantBaseline="middle" textAnchor="middle" fontSize={size * 0.3} fontWeight="bold" fill="#333">
                {score ? score.toFixed(1) : 'N/A'}
            </text>
        </svg>
    );
}

function LoadingSpinner() {
    return (
        <div className="loading-spinner-container">
            <div className="loading-spinner"></div>
            <p>Загрузка данных...</p>
        </div>
    );
}

function RenderChartForExport({ chartId, chartData, chartTitle, chartRefs }) {
    if (!chartData || !chartData.labels || chartData.labels.length === 0) {
        return null;
    }
    const ChartComponent = (chartData.labels.length <= 5 && chartData.questionType !== 'checkbox') ? Doughnut : Bar;
    const isCheckboxBar = ChartComponent === Bar && chartData.questionType === 'checkbox';

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'top',
                display: true,
                labels: isCheckboxBar ? { generateLabels: generateCheckboxBarLegendLabels, boxWidth: 12, padding:15 } : {boxWidth: 12, padding:15},
            },
            title: { display: true, text: chartTitle, font: { size: 16, weight: 'bold' }, padding: { top: 5, bottom: isCheckboxBar ? 5: 15} },
            tooltip: { enabled: false }
        },
        scales: ChartComponent === Bar ? {
            y: {
                beginAtZero: true,
                ticks: { precision: 0 }
            },
            x: {
                ticks: {
                    display: !isCheckboxBar,
                    autoSkip: false,
                    maxRotation: (chartData.labels && chartData.labels.length > 7 && !isCheckboxBar ? 30 : 0),
                    minRotation: (chartData.labels && chartData.labels.length > 7 && !isCheckboxBar ? 30 : 0),
                    font: {
                        size: (chartData.labels && chartData.labels.length > 10 && !isCheckboxBar ? 8 : 9)
                    },
                }
            }
        } : undefined,
        animation: false
    };
    const setRef = (el) => { if (el && chartRefs) { chartRefs.current[chartId] = el; } };

    let containerHeight = ChartComponent === Doughnut ? '400px' : '350px';
     if (ChartComponent === Bar && chartData.labels) {
        const numLabels = chartData.labels.length;
        const numLinesPerLabelMax = isCheckboxBar ? 1 : chartData.labels.reduce((max, labelArray) => Math.max(max, Array.isArray(labelArray) ? labelArray.length : 1), 1);
        const calculatedHeight = 150 + (isCheckboxBar ? (numLabels * 8) : (numLabels * (20 + numLinesPerLabelMax * 5))) + (numLinesPerLabelMax * 12);
        containerHeight = `${Math.max(350, Math.min(800, calculatedHeight))}px`;
    }
    const containerPadding = '20px';

    return (
        <div
            ref={setRef}
            className="chart-export-container"
            style={{
                width: '500px',
                height: containerHeight,
                marginBottom: '20px',
                backgroundColor: 'white',
                padding: containerPadding
            }}
        >
            <ChartComponent options={chartOptions} data={chartData} />
        </div>
    );
}

const questionTypeTranslations = {
    radio: 'Один из списка',
    checkbox: 'Несколько из списка',
    select: 'Выпадающий список',
    scale: 'Шкала',
    text: 'Текстовый ответ',
    default: 'Неизвестный тип'
};

function translateQuestionType(type) {
    return questionTypeTranslations[type] || questionTypeTranslations.default;
}

function AnalysisPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [questionnaire, setQuestionnaire] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [expandedUsers, setExpandedUsers] = useState({});
    const [expandedAttempts, setExpandedAttempts] = useState({});
    const chartRefsForExport = useRef({});
    const [chartsToRenderForExport, setChartsToRenderForExport] = useState(null);

    const [globalAnalysisModalState, setGlobalAnalysisModalState] = useState({
        isOpen: false,
        summary: null,
        chartData: null,
    });
    const [teamAnalysisModalState, setTeamAnalysisModalState] = useState({
        isOpen: false,
        teamScores: null,
        isLoading: false,
        error: null,
    });

    function formatLabelsForChartJS(originalLabel, idealLineLength = 20, maxLinesCount = 3) {
        if (typeof originalLabel !== 'string') {
            return [String(originalLabel)];
        }
        originalLabel = originalLabel.trim();
        if (!originalLabel) return [''];

        const words = originalLabel.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            if (lines.length === maxLinesCount) {
                if (lines.length > 0 && !lines[lines.length - 1].endsWith('...')) {
                    const lastIdx = lines.length - 1;
                    const currentLastLine = lines[lastIdx];
                    if (currentLastLine.length + 3 > idealLineLength && idealLineLength > 3) {
                         lines[lastIdx] = currentLastLine.substring(0, idealLineLength - 3) + '...';
                    } else if (currentLastLine.length < idealLineLength) {
                         lines[lastIdx] = currentLastLine + '...';
                    }
                }
                currentLine = '';
                break;
            }

            const potentialLine = currentLine === '' ? word : currentLine + ' ' + word;

            if (potentialLine.length <= idealLineLength) {
                currentLine = potentialLine;
            } else {
                if (currentLine !== '') {
                    lines.push(currentLine);
                    if (lines.length === maxLinesCount) {
                        if (!lines[lines.length - 1].endsWith('...')) {
                             const lastIdx = lines.length - 1;
                             const currentLastLine = lines[lastIdx];
                             if (currentLastLine.length + 3 > idealLineLength && idealLineLength > 3) {
                                lines[lastIdx] = currentLastLine.substring(0, idealLineLength - 3) + '...';
                             } else if (currentLastLine.length < idealLineLength) {
                                lines[lastIdx] = currentLastLine + '...';
                             }
                        }
                        currentLine = '';
                        break;
                    }
                }
                if (word.length > idealLineLength) {
                    if (lines.length < maxLinesCount) {
                        lines.push(word.substring(0, idealLineLength - 3) + '...');
                         if (lines.length === maxLinesCount) {
                            currentLine = '';
                            break;
                         }
                    }
                    currentLine = '';
                } else {
                    currentLine = word;
                }
            }
        }

        if (currentLine !== '') {
            if (lines.length < maxLinesCount) {
                lines.push(currentLine.length > idealLineLength && idealLineLength > 3 ? currentLine.substring(0, idealLineLength-3)+"..." : currentLine);
            } else if (lines.length === maxLinesCount) {
                if (lines.length > 0 && !lines[lines.length - 1].endsWith('...')) {
                    const lastIdx = lines.length - 1;
                    const currentLastLine = lines[lastIdx];
                     if (currentLastLine.length + 3 > idealLineLength && idealLineLength > 3) {
                       lines[lastIdx] = currentLastLine.substring(0, idealLineLength - 3) + '...';
                    } else if (currentLastLine.length < idealLineLength) {
                       lines[lastIdx] = currentLastLine + '...';
                    }
                }
            }
        }

        if (lines.length === 0 && originalLabel) {
             if(originalLabel.length > idealLineLength && idealLineLength > 3) return [originalLabel.substring(0, idealLineLength-3) + "..."];
            return [originalLabel];
        }

        return lines.length > 0 ? lines : [''];
    }


    useEffect(() => {
        const fetchQuestionnaire = async () => {
            setLoading(true);
            try {
                const response = await apiClient.get(`/questionnaire/${id}`);
                setQuestionnaire(response.data);
            } catch (error) {
                console.error("Ошибка загрузки анкеты:", error);
                alert("Не удалось загрузить данные анкеты. Пожалуйста, попробуйте позже.");
                navigate("/account");
            } finally {
                setLoading(false);
            }
        };
        fetchQuestionnaire();
    }, [id, navigate]);

    const allAttempts = useMemo(() => {
        if (!questionnaire?.questions) return [];
        let allAnswersRaw = [];
        questionnaire.questions.forEach((question) => {
            const questionIdentifier = question.id ?? question.text;
            const questionType = question.type || 'unknown';
            if (question.answers?.length > 0) {
                question.answers.forEach((answer) => {
                    const userId = answer.userId || `anonymous_${Date.now()}_${Math.random()}`;
                    let currentAnswerText = answer.selectedOptionText ?? answer.text;
                    if (currentAnswerText === null || currentAnswerText === undefined || String(currentAnswerText).trim() === '') {
                        return;
                    }
                    currentAnswerText = String(currentAnswerText);
                    allAnswersRaw.push({
                        userId: userId,
                        userName: answer.isAnonymous ? "Анонимный пользователь" : (answer.userName || "Пользователь"),
                        isAnonymous: !!answer.isAnonymous,
                        questionId: questionIdentifier,
                        questionRealId: question.id,
                        questionText: question.text,
                        questionType: questionType,
                        answerText: currentAnswerText,
                        createdAt: new Date(answer.createdAt),
                    });
                });
            }
        });
        if (allAnswersRaw.length === 0) return [];
        allAnswersRaw.sort((a, b) => {
            if (a.userId < b.userId) return -1;
            if (a.userId > b.userId) return 1;
            return a.createdAt.getTime() - b.createdAt.getTime();
        });
        const attempts = [];
        let currentAttempt = null;
        let questionsAnsweredInCurrentAttempt = new Set();
        allAnswersRaw.forEach((answer) => {
            let startNewAttempt = false;
            const isCheckbox = answer.questionType === 'checkbox';
            if (!currentAttempt || answer.userId !== currentAttempt.userId) {
                startNewAttempt = true;
            } else {
                const alreadyAnswered = questionsAnsweredInCurrentAttempt.has(answer.questionId);
                if (alreadyAnswered && !isCheckbox) {
                    startNewAttempt = true;
                }
            }
            if (startNewAttempt) {
                currentAttempt = {
                    attemptId: `${answer.userId}-${answer.createdAt.getTime()}-${Math.random().toString(16).slice(2)}`,
                    userId: answer.userId,
                    userName: answer.userName,
                    isAnonymous: answer.isAnonymous,
                    startTime: answer.createdAt,
                    answers: {},
                    lastAnswerTimestamp: answer.createdAt.getTime(),
                };
                attempts.push(currentAttempt);
                questionsAnsweredInCurrentAttempt = new Set();
            }
            questionsAnsweredInCurrentAttempt.add(answer.questionId);
            const questionId = answer.questionId;
            if (!currentAttempt.answers[questionId]) {
                currentAttempt.answers[questionId] = {
                    questionRealId: answer.questionRealId,
                    questionText: answer.questionText,
                    questionType: answer.questionType,
                    answerTexts: [answer.answerText],
                    firstAnswerTime: answer.createdAt.getTime()
                };
            } else {
                if (!currentAttempt.answers[questionId].answerTexts.includes(answer.answerText)) {
                    currentAttempt.answers[questionId].answerTexts.push(answer.answerText);
                }
            }
            currentAttempt.lastAnswerTimestamp = Math.max(currentAttempt.lastAnswerTimestamp, answer.createdAt.getTime());
        });
        const finalUserAttemptCounts = {};
        attempts.forEach(attempt => {
            attempt.groupedAnswers = Object.values(attempt.answers)
                .sort((a, b) => a.firstAnswerTime - b.firstAnswerTime);
            if (!finalUserAttemptCounts[attempt.userId]) {
                finalUserAttemptCounts[attempt.userId] = 0;
            }
            finalUserAttemptCounts[attempt.userId]++;
            attempt.attemptNumber = finalUserAttemptCounts[attempt.userId];
        });
        return attempts;
    }, [questionnaire]);

    const groupAttemptsByUser = (attemptsToGroup) => {
        if (!attemptsToGroup || attemptsToGroup.length === 0) return [];
        const usersData = {};
        attemptsToGroup.forEach(attempt => {
            if (!usersData[attempt.userId]) {
                usersData[attempt.userId] = {
                    userId: attempt.userId,
                    userName: attempt.userName,
                    isAnonymous: attempt.isAnonymous,
                    attempts: [],
                    firstAttemptTime: attempt.startTime.getTime(),
                    lastAttemptTime: attempt.lastAnswerTimestamp
                };
            }
            usersData[attempt.userId].attempts.push(attempt);
            usersData[attempt.userId].firstAttemptTime = Math.min(usersData[attempt.userId].firstAttemptTime, attempt.startTime.getTime());
            usersData[attempt.userId].lastAttemptTime = Math.max(usersData[attempt.userId].lastAttemptTime, attempt.lastAnswerTimestamp);
        });
        let usersArray = Object.values(usersData);
        usersArray.sort((a, b) => b.lastAttemptTime - a.lastAttemptTime);
        usersArray.forEach(user => { user.attempts.sort((a, b) => a.attemptNumber - b.attemptNumber); });
        return usersArray;
    };

    const prepareGlobalChartData = () => {
        if (!questionnaire?.questions || !allAttempts || allAttempts.length === 0) return {};
        const chartData = {};
        const allAnswersAggregated = {};
        allAttempts.forEach(attempt => {
            attempt.groupedAnswers.forEach(answerGroup => {
                const questionIdKey = answerGroup.questionRealId ?? answerGroup.questionText;
                const questionType = answerGroup.questionType;
                if (!allAnswersAggregated[questionIdKey]) {
                    allAnswersAggregated[questionIdKey] = {
                        questionText: answerGroup.questionText,
                        questionType: questionType,
                        questionRealId: answerGroup.questionRealId,
                        counts: {}
                    };
                }
                answerGroup.answerTexts.forEach(text => {
                    if (text !== null && text !== undefined) {
                        allAnswersAggregated[questionIdKey].counts[text] = (allAnswersAggregated[questionIdKey].counts[text] || 0) + 1;
                    }
                });
            });
        });
        Object.entries(allAnswersAggregated).forEach(([questionIdKey, aggregatedData]) => {
            const { questionText, questionType, questionRealId, counts } = aggregatedData;
            const canChart = Object.keys(counts).length > 0 && questionType !== 'text';
            if (!canChart) {
                chartData[questionIdKey] = { questionText, questionType, questionRealId, labels: [], datasets: [], analysisParts: ["(Нет данных для графика)"], analysisText: "(Нет данных для графика)" };
                return;
            }
            const sortedAnswers = Object.entries(counts).sort(([, countA], [, countB]) => countB - countA);

            const labelsRaw = sortedAnswers.map(([text]) => text);
            const formattedLabels = labelsRaw.map(label =>
                formatLabelsForChartJS(
                    String(label),
                    questionType === 'checkbox' ? 25 : 20,
                    questionType === 'checkbox' ? 2 : 2
                )
            );

            const data = sortedAnswers.map(([, count]) => count);
            const backgroundColors = formattedLabels.map((_, i) => `hsl(${(i * 137.508) % 360}, 70%, 65%)`);
            const borderColors = backgroundColors.map(color => color.replace('65%', '50%'));
            
            const analysisParts = [];
            if (sortedAnswers.length > 0) {
                const mostPopular = sortedAnswers[0];
                analysisParts.push(`Самый популярный ответ: "${mostPopular[0]}" (${mostPopular[1]} голос(а)).`);
                if (sortedAnswers.length > 1) {
                    const leastPopular = sortedAnswers[sortedAnswers.length - 1];
                    if (mostPopular[0] !== leastPopular[0]) {
                        analysisParts.push(`Самый редкий: "${leastPopular[0]}" (${leastPopular[1]} голос(а)).`);
                    }
                }
            } else {
                analysisParts.push("(Нет данных для анализа)");
            }

            chartData[questionIdKey] = {
                questionText: questionText,
                questionType: questionType,
                questionRealId: questionRealId,
                labels: formattedLabels,
                datasets: [{
                    label: '# голосов',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                }],
                analysisParts: analysisParts,
                analysisText: analysisParts.join('\n'),
            };
        });
        return chartData;
    };

    const calculateTeamAverageScores = () => {
        if (!questionnaire?.questions || !allAttempts || allAttempts.length === 0) {
            return { data: [], error: "Нет данных для анализа команд." };
        }
        const teamNameQuestionText = "Выберите команду";
        const teamNameQuestion = questionnaire.questions.find(q => q.text === teamNameQuestionText);
        if (!teamNameQuestion) {
            return { data: [], error: `Не удалось определить вопрос с названием команды. Убедитесь, что в анкете есть вопрос с текстом "${teamNameQuestionText}".` };
        }
        const teamNameQuestionIdentifier = teamNameQuestion.id ?? teamNameQuestion.text;
        const teamDataAggregated = {};
        allAttempts.forEach(attempt => {
            let currentTeamName = null;
            const currentAttemptScores = [];
            attempt.groupedAnswers.forEach(answerGroup => {
                const questionIdentifierFromAnswer = answerGroup.questionRealId ?? answerGroup.questionText;
                const answerText = answerGroup.answerTexts?.[0];
                if (answerText === null || answerText === undefined || String(answerText).trim() === '') return;
                if (questionIdentifierFromAnswer === teamNameQuestionIdentifier) {
                    currentTeamName = String(answerText).trim();
                }
                else if (answerGroup.questionType === 'scale' || (['radio', 'select'].includes(answerGroup.questionType) && !isNaN(parseFloat(answerText)))) {
                    const potentialScore = parseFloat(answerText);
                    if (!isNaN(potentialScore) && isFinite(potentialScore) && potentialScore >= 1 && potentialScore <= 5) {
                        currentAttemptScores.push(potentialScore);
                    }
                }
            });
            if (currentTeamName && currentAttemptScores.length > 0) {
                if (!teamDataAggregated[currentTeamName]) {
                    teamDataAggregated[currentTeamName] = { totalScore: 0, scoreCount: 0 };
                }
                teamDataAggregated[currentTeamName].totalScore += currentAttemptScores.reduce((sum, score) => sum + score, 0);
                teamDataAggregated[currentTeamName].scoreCount += currentAttemptScores.length;
            }
        });
        const teamScoresArray = Object.entries(teamDataAggregated)
            .map(([name, data]) => data.scoreCount === 0 ? null : {
                name: name,
                averageScore: data.totalScore / data.scoreCount,
                totalScore: data.totalScore,
                scoreCount: data.scoreCount,
            }).filter(Boolean);
        teamScoresArray.sort((a, b) => b.averageScore - a.averageScore);
        if (teamScoresArray.length === 0) {
            return { data: [], error: "Не найдено данных по командам и их баллам для расчета среднего." };
        }
        return { data: teamScoresArray, error: null };
    };

    const toggleUserAttempts = (userId) => setExpandedUsers((prev) => ({ ...prev, [userId]: !prev[userId] }));
    const toggleAttemptDetails = (attemptId) => setExpandedAttempts((prev) => ({ ...prev, [attemptId]: !prev[attemptId] }));
    const openGlobalAnalysisModal = () => {
        const usersGrouped = groupAttemptsByUser(allAttempts);
        const summary = { participants: usersGrouped.length, attempts: allAttempts.length, questions: questionnaire?.questions?.length || 0 };
        const charts = prepareGlobalChartData();
        setGlobalAnalysisModalState({ isOpen: true, summary, chartData: charts });
    };
    const closeGlobalAnalysisModal = () => setGlobalAnalysisModalState({ isOpen: false, summary: null, chartData: null });
    const openTeamAnalysisModal = () => {
        setTeamAnalysisModalState(prev => ({ ...prev, isOpen: true, isLoading: true, error: null }));
        const result = calculateTeamAverageScores();
        setTimeout(() => setTeamAnalysisModalState(prev => ({ ...prev, teamScores: result.data, isLoading: false, error: result.error })), 100);
    };
    const closeTeamAnalysisModal = () => setTeamAnalysisModalState({ isOpen: false, teamScores: null, isLoading: false, error: null });
    const sanitizeFilename = (name) => name.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 100);

    const handleExportToExcel = async () => {
        if (!questionnaire || !allAttempts || allAttempts.length === 0) {
            alert("Нет данных для экспорта.");
            return;
        }
        setIsExporting(true);
        const preparedChartData = prepareGlobalChartData();
        const chartableQuestions = Object.entries(preparedChartData)
            .filter(([qIdKey, data]) => data && data.labels && data.labels.length > 0);
        chartRefsForExport.current = {};
        setChartsToRenderForExport(chartableQuestions);
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'AnketaApp';
            workbook.created = new Date();
            workbook.modified = new Date();

            const ws_charts = workbook.addWorksheet("Графики");
            ws_charts.addRow(["Графики по вопросам"]).font = { bold: true, size: 14 };
            ws_charts.mergeCells('A1:E1');
            ws_charts.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
            ws_charts.getRow(1).height = 25;
            let currentRowCharts = 2;
            const imagePromises = chartableQuestions.map(async ([qIdKey, data]) => {
                const chartElement = chartRefsForExport.current[qIdKey];
                if (chartElement) {
                    try {
                        const canvas = await html2canvas(chartElement, {
                            scale: 1.5,
                            logging: false,
                            useCORS: true,
                            backgroundColor: '#ffffff'
                        });
                        const imgData = canvas.toDataURL('image/png');
                        const imageId = workbook.addImage({
                            base64: imgData,
                            extension: 'png',
                        });
                        const isDoughnut = (data.labels.length <= 5 && data.questionType !== 'checkbox');
                        return { qIdKey, imageId, error: null, questionText: data.questionText, isDoughnut };
                    } catch (err) {
                        console.error(`Ошибка захвата html2canvas для ${qIdKey}:`, err);
                        return { qIdKey, imageId: null, error: `Ошибка захвата: ${err.message || 'Неизвестная ошибка'}`, questionText: data.questionText, isDoughnut: false };
                    }
                } else {
                    console.warn(`Элемент графика не найден в refs для ключа: ${qIdKey}`);
                    return { qIdKey, imageId: null, error: 'Элемент графика не найден в ссылках (refs)', questionText: data.questionText, isDoughnut: false };
                }
            });
            const images = await Promise.all(imagePromises);
            images.forEach(({ qIdKey, imageId, error, questionText, isDoughnut }) => {
                const titleRow = ws_charts.addRow([`Вопрос: ${questionText}`]);
                titleRow.font = { bold: true };
                ws_charts.mergeCells(`A${currentRowCharts}:E${currentRowCharts}`);
                currentRowCharts++;
                const imageRowStart = currentRowCharts -1;
                if (imageId) {
                    const imgWidth = 480; 
                    const imgHeight = isDoughnut ? 380 : 330; 
                    const approxImageHeightInRows = isDoughnut ? 20 : 17;
                    
                    ws_charts.addImage(imageId, {
                        tl: { col: 0.1, row: imageRowStart },
                        ext: { width: imgWidth, height: imgHeight }
                    });
                    for (let i = 0; i < approxImageHeightInRows; i++) {
                         ws_charts.addRow([]);
                    }
                    currentRowCharts += approxImageHeightInRows;

                    const analysisTextForExcel = preparedChartData[qIdKey]?.analysisText;
                    if (analysisTextForExcel) {
                        const analysisRow = ws_charts.addRow([analysisTextForExcel]);
                        analysisRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };
                        ws_charts.mergeCells(analysisRow.number, 1, analysisRow.number, 5);
                        analysisRow.height = Math.max(30, analysisTextForExcel.split('\n').length * 15);
                        currentRowCharts++;
                    }
                } 
                // else {
                //     const errorText = `(Не удалось вставить изображение для вопроса "${questionText}". ${error ? `Причина: ${error}` : ''})`;
                //     ws_charts.addRow([errorText]);
                //     ws_charts.getCell(`A${currentRowCharts}`).font = { color: { argb: 'FFFF0000' } };
                //     ws_charts.getCell(`A${currentRowCharts}`).alignment = { wrapText: true };
                //     currentRowCharts++;
                // }
                ws_charts.addRow([]);
                currentRowCharts++;
            });
            ws_charts.columns = [{ width: 5 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }];


            const ws_questions = workbook.addWorksheet("Вопросы и опции");
            ws_questions.columns = [
                { header: 'Текст вопроса', key: 'text', width: 60 },
                { header: 'Тип вопроса', key: 'type', width: 20 },
                { header: 'Варианты / Детали шкалы', key: 'options', width: 70 }
            ];
            ws_questions.getRow(1).font = { bold: true };
            questionnaire.questions.forEach(q => {
                let optionsText = "";
                const choiceTypes = ["radio", "checkbox", "select"];
                if (choiceTypes.includes(q.type)) {
                    optionsText = q.options?.map(o => o.optionText).join(", ") || "Нет опций";
                } else if (q.type === "scale") {
                    const scaleAnswer = q.answers?.find(a => a.text?.includes('|'));
                    const scaleParts = scaleAnswer?.text?.split('|') || q.text?.split('|');
                    optionsText = scaleParts?.length >= 3 ? `Лево: ${scaleParts[1] || "?"} | Право: ${scaleParts[2] || "?"} | Делений: ${scaleParts[3] || "?"}` : "(Детали шкалы не найдены)";
                } else if (q.type === "text") {
                    optionsText = "(Открытый ответ)";
                } else {
                    optionsText = `(Тип: ${q.type})`;
                }
                ws_questions.addRow({
                    text: q.text,
                    type: translateQuestionType(q.type),
                    options: optionsText
                });
            });
            ws_questions.eachRow({ includeEmpty: false }, function (row) {
                row.alignment = { vertical: 'top', wrapText: true };
            });


            const ws_open_answers = workbook.addWorksheet("Открытые ответы");
            ws_open_answers.columns = [
                { header: 'ID Попытки', key: 'attemptId', width: 20 },
                { header: 'ID Пользователя', key: 'userId', width: 15 },
                { header: 'Имя Пользователя', key: 'userName', width: 25 },
                { header: 'Аноним', key: 'isAnonymous', width: 10 },
                { header: 'Вопрос', key: 'questionText', width: 50 },
                { header: 'Ответ', key: 'answerText', width: 60 },
                { header: 'Время ответа', key: 'answerTime', width: 20, style: { numFmt: 'dd/mm/yyyy hh:mm:ss' } }
            ];
            ws_open_answers.getRow(1).font = { bold: true };
            let hasOpenAnswers = false;
            allAttempts.forEach(attempt => {
                attempt.groupedAnswers.forEach(answerGroup => {
                    if (answerGroup.questionType === 'text') {
                        answerGroup.answerTexts.forEach(text => {
                            hasOpenAnswers = true;
                            ws_open_answers.addRow({
                                attemptId: attempt.attemptId.substring(0, 15) + '...',
                                userId: attempt.userId,
                                userName: attempt.userName,
                                isAnonymous: attempt.isAnonymous ? "Да" : "Нет",
                                questionText: answerGroup.questionText,
                                answerText: text,
                                answerTime: new Date(answerGroup.firstAnswerTime)
                            });
                        });
                    }
                });
            });
            if (!hasOpenAnswers) ws_open_answers.addRow({ questionText: "Нет открытых ответов." });
            ws_open_answers.eachRow({ includeEmpty: false }, function (row) {
                row.alignment = { vertical: 'top', wrapText: true };
            });


            const ws_all_answers = workbook.addWorksheet("Все ответы");
            ws_all_answers.columns = [
                { header: 'Номер Попытки', key: 'attemptNumber', width: 15 },
                { header: 'Имя Пользователя', key: 'userName', width: 25 },
                { header: 'Текст Вопроса', key: 'questionText', width: 50 },
                { header: 'Тип Вопроса', key: 'questionType', width: 15 },
                { header: 'Текст Ответа', key: 'answerText', width: 60 },
                { header: 'Время Ответа', key: 'answerTime', width: 20, style: { numFmt: 'dd/mm/yyyy hh:mm:ss' } }
            ];
            ws_all_answers.getRow(1).font = { bold: true };
            const sortedAttempts = [...allAttempts].sort((a, b) => {
                const nameA = (a.userName || '').toLowerCase();
                const nameB = (b.userName || '').toLowerCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return a.attemptNumber - b.attemptNumber;
            });
            const colorPalette = ['FFFFE0B3', 'FFADD8E6', 'FF90EE90', 'FFFFB6C1', 'FFE6E6FA', 'FFFFFACD', 'FFF0E68C', 'FFB0E0E6'];
            const userColorMap = new Map();
            let colorIndex = -1;
            let currentUser = null;
            let hasAnyAnswers = false;
             sortedAttempts.forEach((attempt, index) => {
                if (attempt.userName !== currentUser) {
                    if (index > 0) {
                       ws_all_answers.addRow([]);
                    }
                    currentUser = attempt.userName;
                    if (!userColorMap.has(currentUser)) {
                        colorIndex = (colorIndex + 1) % colorPalette.length;
                        userColorMap.set(currentUser, colorPalette[colorIndex]);
                    }
                }
                const userColor = userColorMap.get(currentUser);
                attempt.groupedAnswers.forEach(answerGroup => {
                    answerGroup.answerTexts.forEach(text => {
                        hasAnyAnswers = true;
                        const rowData = {
                            attemptNumber: attempt.attemptNumber,
                            userName: attempt.userName,
                            questionText: answerGroup.questionText,
                            questionType: translateQuestionType(answerGroup.questionType),
                            answerText: text,
                            answerTime: new Date(answerGroup.firstAnswerTime)
                        };
                         ws_all_answers.addRow(rowData);
                         const addedRow = ws_all_answers.lastRow;
                         if (addedRow && userColor) {
                            addedRow.eachCell({ includeEmpty: true }, cell => {
                                cell.fill = {
                                    type: 'pattern',
                                    pattern:'solid',
                                    fgColor:{argb:userColor}
                                };
                            });
                         }
                    });
                });
            });
            if (!hasAnyAnswers) ws_all_answers.addRow({ questionText: "Нет ответов для отображения." });
             ws_all_answers.eachRow({ includeEmpty: true }, function(row, rowNumber) {
               if(rowNumber > 1 && row.values.some(v => v !== null && v !== undefined && v !== '')) {
                  row.alignment = { vertical: 'top', wrapText: true };
               }
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const filename = sanitizeFilename(`Анализ_${questionnaire.title || `Анкета_${id}`}.xlsx`);
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Ошибка при экспорте в Excel:", error);
            alert("Произошла ошибка при формировании Excel файла. Пожалуйста, проверьте консоль разработчика для деталей.");
        } finally {
            setIsExporting(false);
            setChartsToRenderForExport(null);
        }
    };

    if (loading) {
        return <div className="analysis-page"><LoadingSpinner /></div>;
    }

    if (!questionnaire || !Array.isArray(questionnaire.questions)) {
        return (
            <div className="analysis-page error-page">
                <h1 className="analysis-title error-title">Ошибка</h1>
                <p className="error-message">Анкета не найдена или в ней нет вопросов.</p>
                <button onClick={() => navigate("/account")} className="btn btn-back">Вернуться</button>
            </div>
        );
    }

    const usersWithGroupedAttempts = groupAttemptsByUser(allAttempts);
    const totalAttemptsCount = allAttempts.length;

    function RenderGlobalChartsModal({ chartData, chartTitlePrefix = "" }) {
        if (!chartData || Object.keys(chartData).length === 0) return <p>Нет данных для построения графиков.</p>;
        const chartableEntries = Object.entries(chartData).filter(([qIdKey, data]) => data?.labels?.length > 0);
        if (chartableEntries.length === 0) return <p>Нет вопросов с вариантами ответов для построения графиков.</p>;
        
        return (
            <> {chartableEntries.map(([qIdKey, data]) => {
                const ChartComponent = (data.labels.length <= 5 && data.questionType !== 'checkbox') ? Doughnut : Bar;
                const isCheckboxBar = ChartComponent === Bar && data.questionType === 'checkbox';

                const chartOptions = {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { 
                            position: 'top', 
                            display: true,
                            labels: isCheckboxBar ? { generateLabels: generateCheckboxBarLegendLabels, boxWidth: 10, padding: 10 } : { boxWidth: 10, padding: 10 },
                        },
                        title: { display: false },
                        tooltip: { enabled: true }
                    },
                    scales: ChartComponent === Bar ? {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        },
                        x: {
                            ticks: {
                                display: !isCheckboxBar,
                                autoSkip: false,
                                maxRotation: 0,
                                minRotation: 0,
                                font: {
                                    size: (data.labels.length > 8 && !isCheckboxBar ? 9 : 10)
                                },
                            }
                        }
                    } : undefined,
                };

                let chartWrapperHeight = (ChartComponent === Doughnut || !data.labels) ? '300px' : 'auto';
                if (ChartComponent === Bar && data.labels) {
                    const numLabels = data.labels.length;
                    const numLinesPerLabelMax = isCheckboxBar ? 1 : data.labels.reduce((max, labelArray) => Math.max(max, Array.isArray(labelArray) ? labelArray.length : 1), 1);
                    const baseHeight = isCheckboxBar ? 80 : 120;
                    const labelSpace = isCheckboxBar ? (numLabels * 5) : (numLabels * (15 + numLinesPerLabelMax * 5));
                    const calculatedHeight = baseHeight + labelSpace + (numLinesPerLabelMax * 10);
                    chartWrapperHeight = `${Math.max(300, Math.min(650, calculatedHeight))}px`;
                }

                return (
                    <div key={qIdKey} className="modal-chart-container">
                        <h3 className="modal-chart-title">{`${chartTitlePrefix}${data.questionText}`}</h3>
                        <div className="modal-chart-wrapper" style={{ height: chartWrapperHeight }}>
                            <ChartComponent options={chartOptions} data={data} />
                        </div>
                        <div className="modal-textual-analysis-item">
                            {data.analysisParts && data.analysisParts.map((part, index) => (
                                <p key={index}>{part}</p>
                            ))}
                        </div>
                    </div>);
            })}
            </>);
    }

    return (
        <div className="analysis-page-vh">
            <div className="analysis-page">
                {isExporting && chartsToRenderForExport && (
                    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, zIndex: -10 }}>
                        {chartsToRenderForExport.map(([qIdKey, data]) => (
                            <RenderChartForExport key={qIdKey} chartId={qIdKey} chartData={data} chartTitle={data.questionText} chartRefs={chartRefsForExport} />
                        ))}
                    </div>
                )}

                <h1 className="analysis-title">{questionnaire.title || "Анализ ответов"}</h1>
                <p className="analysis-description">{questionnaire.description || "Просмотрите ответы пользователей и общую статистику"}</p>

                <div className="global-analysis-action">
                    <button className="btn btn-analysis-global" onClick={openGlobalAnalysisModal} disabled={totalAttemptsCount === 0 || isExporting}>Общий анализ</button>
                    <button className="btn btn-analysis-teams" onClick={openTeamAnalysisModal} disabled={totalAttemptsCount === 0 || isExporting}>Анализ Команд</button>
                    <button className="btn btn-export-excel" onClick={handleExportToExcel} disabled={totalAttemptsCount === 0 || isExporting || loading}>
                        {isExporting ? 'Экспорт...' : 'Скачать в Excel'}
                    </button>
                </div>

                <div className="detailed-answers-section">
                    <h2 className="detailed-answers-title">Детальные ответы по пользователям</h2>
                    <div className="users-container">
                        {usersWithGroupedAttempts?.length > 0 ? (
                            usersWithGroupedAttempts.map((user) => {
                                const isUserExpanded = !!expandedUsers[user.userId];
                                const lastActivityTime = new Date(user.lastAttemptTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                                return (
                                    <div key={user.userId} className={`user-block ${isUserExpanded ? "expanded" : ""}`}>
                                        <div className="user-header" onClick={() => toggleUserAttempts(user.userId)} role="button" tabIndex="0" aria-expanded={isUserExpanded}>
                                            <h3 className="user-name">{user.userName} {user.isAnonymous ? '(Аноним)' : ''}</h3>
                                            <span className="toggle-icon" aria-hidden="true"></span>
                                        </div>
                                        <div id={`user-attempts-${user.userId}`} className="user-attempts-wrapper" style={{ maxHeight: isUserExpanded ? '3000px' : '0', opacity: isUserExpanded ? 1 : 0, paddingTop: isUserExpanded ? '20px' : '0', paddingBottom: isUserExpanded ? '0px' : '0', transition: 'max-height 0.6s ease-in-out, opacity 0.5s 0.1s ease-out, padding 0.6s ease-in-out' }}>
                                            <div className="user-attempts-list">
                                                {user.attempts.map((attempt) => {
                                                    const isAttemptExpanded = !!expandedAttempts[attempt.attemptId];
                                                    return (
                                                        <div key={attempt.attemptId} className={`attempt-item ${isAttemptExpanded ? "expanded" : ""}`}>
                                                            <div className="attempt-item-header" onClick={() => toggleAttemptDetails(attempt.attemptId)} role="button" tabIndex="0" aria-expanded={isAttemptExpanded} aria-controls={`attempt-details-${attempt.attemptId}`}>
                                                                <span className="attempt-item-title">Ответ {attempt.attemptNumber} <small className="attempt-item-time">({attempt.startTime.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})</small></span>
                                                                <span className="toggle-icon" aria-hidden="true"></span>
                                                            </div>
                                                            <div id={`attempt-details-${attempt.attemptId}`} className="attempt-answers-wrapper" style={{ maxHeight: isAttemptExpanded ? '2000px' : '0', opacity: isAttemptExpanded ? 1 : 0, padding: isAttemptExpanded ? '15px 15px 15px 15px' : '0 15px', transition: 'max-height 0.5s ease-in-out, opacity 0.4s 0.1s ease-out, padding 0.5s ease-in-out' }}>
                                                                <div className="attempt-answers">
                                                                    {attempt.groupedAnswers.map((answerGroup, idx) => (
                                                                        <div key={`${answerGroup.questionText}-${idx}`} className="answer-item">
                                                                            <p className="answer-question">{answerGroup.questionText}</p>
                                                                            <div className="answer-texts-container">
                                                                                {answerGroup.answerTexts?.length > 0
                                                                                    ? (answerGroup.answerTexts.map((text, textIdx) => (<p key={textIdx} className="answer-text-item">{text || '(пустой ответ)'}</p>)))
                                                                                    : (<p className="answer-text-item no-answer">(Нет ответа)</p>)
                                                                                }
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>);
                                                })}
                                            </div>
                                            <div className="user-footer"><small className="user-last-answered">Последняя активность пользователя: {lastActivityTime}</small></div>
                                        </div>
                                    </div>);
                            })
                        ) : (
                            <div className="no-answers-block"><p>Пока нет ни одного ответа на эту анкету.</p></div>
                        )}
                    </div>
                </div>

                <Modal isOpen={globalAnalysisModalState.isOpen} onRequestClose={closeGlobalAnalysisModal} contentLabel="Общий анализ анкеты" className="modal-content modal-global-analysis" overlayClassName="modal-overlay-analysis" closeTimeoutMS={300}>
                    <div className="modal-header">
                        <h2 className="modal-title">Общий анализ анкеты: {questionnaire?.title || ''}</h2>
                        <button onClick={closeGlobalAnalysisModal} className="modal-close-btn" aria-label="Закрыть">×</button>
                    </div>
                    <div className="modal-body">
                        {globalAnalysisModalState.summary && (<div className="modal-summary-section"> <h3 className="modal-section-title">Сводная информация</h3> <div className="summary-items"> <div className="summary-item"><span className="summary-value">{globalAnalysisModalState.summary.participants}</span><span className="summary-label">Участник(ов)</span></div> <div className="summary-item"><span className="summary-value">{globalAnalysisModalState.summary.attempts}</span><span className="summary-label">Попыток</span></div> <div className="summary-item"><span className="summary-value">{globalAnalysisModalState.summary.questions}</span><span className="summary-label">Вопросов</span></div> </div> </div>)}
                        {globalAnalysisModalState.chartData && (<div className="modal-charts-section"> <h3 className="modal-section-title">Распределение ответов</h3> <RenderGlobalChartsModal chartData={globalAnalysisModalState.chartData} /> </div>)}
                        {(!globalAnalysisModalState.summary || globalAnalysisModalState.summary.attempts === 0) && (<p>Нет данных для анализа.</p>)}
                    </div>
                </Modal>

                <Modal isOpen={teamAnalysisModalState.isOpen} onRequestClose={closeTeamAnalysisModal} contentLabel="Анализ среднего балла команд" className="modal-content modal-team-analysis" overlayClassName="modal-overlay-analysis" closeTimeoutMS={300}>
                    <div className="modal-header"> <h2 className="modal-title">Анализ среднего балла команд</h2> <button onClick={closeTeamAnalysisModal} className="modal-close-btn" aria-label="Закрыть">×</button> </div>
                    <div className="modal-body">
                        {teamAnalysisModalState.isLoading && <LoadingSpinner />}
                        {!teamAnalysisModalState.isLoading && teamAnalysisModalState.error && (<p className="modal-error-message">{teamAnalysisModalState.error}</p>)}
                        {!teamAnalysisModalState.isLoading && !teamAnalysisModalState.error && teamAnalysisModalState.teamScores && (
                            <> {teamAnalysisModalState.teamScores.length > 0 ? (
                                <div className="team-scores-list-container">
                                    {teamAnalysisModalState.teamScores.map((team) => (
                                        <div key={team.name} className="team-score-item">
                                            <span className="team-name">{team.name}</span>
                                            <div className="score-wheel-container">
                                                <ScoreWheel score={team.averageScore} size={70} strokeWidth={7} />
                                            </div>
                                        </div>))}
                                </div>
                            ) : (
                                <p>Нет данных для отображения среднего балла команд.</p>
                            )}
                            </>
                        )}
                        {!teamAnalysisModalState.isLoading && !teamAnalysisModalState.error && !teamAnalysisModalState.teamScores && (<p>Обработка данных...</p>)}
                    </div>
                </Modal>
            </div>
        </div>
    );
}

export default AnalysisPage;