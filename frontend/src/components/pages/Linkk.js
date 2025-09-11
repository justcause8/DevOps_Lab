import React, { useState, useEffect } from 'react';
import './Link.css'; // Убедитесь, что CSS импортирован
import Copy from './../../img/copy.png';
import Arrow from './../../img/Arrow.png';
import QrIcon from './../../img/QrIcon.png';
import { Link, useLocation } from 'react-router-dom';

function LinkQuestionnairePage() {
    const [link, setLink] = useState("");
    const [popup, setPopup] = useState({ visible: false, text: '', x: 0, y: 0 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false); // Для анимации

    const location = useLocation();
    const stateLink = location.state?.link;

    useEffect(() => {
        if (stateLink) {
            setLink(stateLink);
        }
    }, [stateLink]);

    useEffect(() => {
        if (isModalOpen) {
            setIsModalVisible(true); 
        }
    }, [isModalOpen]);


    const showPopup = (text, event) => {
        const xPos = event ? event.clientX : window.innerWidth / 2;
        const yPos = event ? event.clientY : window.innerHeight / 2;
        setPopup({ visible: true, text: text, x: xPos, y: yPos });
        setTimeout(() => setPopup({ ...popup, visible: false }), 1800); 
    };

    const handleCopy = (event) => {
        if (!link) return;
        navigator.clipboard.writeText(link).then(() => {
            showPopup("Ссылка скопирована!", event);
        }).catch(err => {
            console.error("Ошибка копирования ссылки:", err);
            showPopup("Ошибка копирования", event);
        });
    };

    const handleDownloadQR = async () => {
        if (!link) {
            console.error("Ссылка не найдена.");
            return;
        }

        try {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(link)}`; 

            const response = await fetch(qrUrl);
            if (!response.ok) {
                throw new Error(`Ошибка при загрузке QR-кода: ${response.status}`);
            }

            const blob = await response.blob();

            const linkElement = document.createElement('a');
            linkElement.href = URL.createObjectURL(blob);
            linkElement.download = 'QR-code.png';
            document.body.appendChild(linkElement);
            linkElement.click();
            document.body.removeChild(linkElement);
            URL.revokeObjectURL(linkElement.href);
        } catch (error) {
            console.error("Ошибка при скачивании QR-кода:", error);
        }
    };

    const handleCopyQR = async (event) => {
        if (!link) return;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(link)}`;
        try {
            const response = await fetch(qrUrl);
            if (!response.ok) throw new Error('Не удалось получить QR-код');
            const blob = await response.blob();
            if (navigator.clipboard && typeof ClipboardItem !== 'undefined' && ClipboardItem.supports && ClipboardItem.supports('image/png')) {
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                showPopup("QR скопирован!", null);
            } else {
                console.warn("Копирование изображений в буфер обмена не поддерживается или требует HTTPS.");
                 showPopup("Копирование QR не поддерживается", null);
                 await handleDownloadQR();
            }
        } catch (error) {
            console.error('Ошибка при копировании QR-кода:', error);
            showPopup("Ошибка копирования QR", null);
        }
    };

    const closeModal = () => {
        setIsModalVisible(false);
        setTimeout(() => {
            setIsModalOpen(false);
        }, 300);
    };


    if (!link && !stateLink) { 
       return <div>Ошибка: ссылка не найдена.</div>;
    }

    return (
        <div className="page-container">
            <div className="survey-pageLink">
                <div className="You">Ваша анкета создана!</div>
                <div className="survey-titleLink">
                    <span className="link-text">{link || stateLink}</span> 
                    <div className="button-group">
                        <img
                            src={QrIcon}
                            alt="Показать QR-код"
                            title="Показать QR-код" 
                            className="QRButton icon-button"
                            onClick={() => setIsModalOpen(true)} 
                        /> 
                        <img
                            src={Copy}
                            alt="Копировать ссылку"
                            title="Копировать ссылку"
                            className="Copy icon-button" 
                            onClick={handleCopy}
                        />
                    </div>
                </div>

                {isModalOpen && (
                    <div
                        className={`modal-overlay-link ${isModalVisible ? 'visible' : ''}`}
                        onClick={closeModal} 
                    >
                        <div
                            className={`modal-content-qr ${isModalVisible ? 'visible' : ''}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <span className="close-modal" onClick={closeModal}>
                                ×
                            </span>
                            <h3>QR-код для вашей анкеты</h3>
                            <div className="qr-image-wrapper"> 
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link || stateLink)}`}
                                    alt="QR Code"
                                    className="qr-image"
                                />
                            </div>
                            <div className="qr-actions">
                                <button className="qr-btn download-btn" onClick={handleDownloadQR}>
                                    Скачать QR
                                </button>
                                <button className="qr-btn copy-btn" onClick={handleCopyQR}>
                                    Копировать QR
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <Link to="/Account" className="HomeLink-wrapper"> 
                    <div className="HomeLink">
                        <span>Личный кабинет</span>
                        <img src={Arrow} alt="Перейти в личный кабинет" className="Arrow" />
                    </div>
                </Link>

                {/* Всплывающее сообщение */}
                {popup.visible && (
                    <div
                        className="copy-popup"
                        style={{ top: popup.y - 20, left: popup.x - 10 }}
                    >
                        {popup.text}
                    </div>
                )}
            </div>
        </div>
    );
}

export default LinkQuestionnairePage;