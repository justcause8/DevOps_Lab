import React from "react";
import './Thk.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';

function ThkPage() {
    const location = useLocation();
    const navigate = useNavigate();

    const questionnaireId = new URLSearchParams(location.search).get('id') || location.state?.questionnaireId;
    
    const handleRetry = () => {
        if (questionnaireId) {
            navigate(`/answers/${questionnaireId}`);
        } else {
            alert('ID анкеты не найден.');
        }
    };

    return (
        <div className="Thk-container">
            <div className="survey-pageThk">
                <div className="text-thk">Спасибо за ответ!</div>
                <div className="ButtonThkContainer">
                    <Link to="/Header" className="ButtonThk">Главная</Link>
                    <button className="ButtonThk" onClick={handleRetry}>Пройти еще раз</button>
                </div>
            </div>
        </div>
    );
}

export default ThkPage;