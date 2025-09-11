import React, { useContext, useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../apiContent/AuthContext';
import ModalLogin from '../js/Modal';
import ModalRegister from '../js/ModalReg';
import BtnDarkMode from '../btnDarkMode/BtnDarkMode';
import logo from './../../img/logo_checklist.png';
import './Navbar.css';

const Navbar = () => {
    const { isLoggedIn, login, logout, setIsLoggedIn } = useContext(AuthContext);
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);
    const [isMenuOpen, setMenuOpen] = useState(false);
    const [notification, setNotification] = useState(''); // <-- Новое состояние
    const menuRef = useRef(null);
    const navigate = useNavigate();

    const openLoginModal = () => setLoginModalOpen(true);
    const closeLoginModal = () => setLoginModalOpen(false);
    const openRegisterModal = () => setRegisterModalOpen(true);
    const closeRegisterModal = () => setRegisterModalOpen(false);

    const toggleMenu = () => setMenuOpen(!isMenuOpen);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/Header');
        setNotification('Вы успешно вышли из аккаунта');
        setTimeout(() => setNotification(''), 3000); // Скрыть через 3 сек
    };

    return (
        <>
            {/* Уведомление */}
            {notification && <div className="notification">{notification}</div>}

            <nav className="nav">
                <div className="container">
                    <div className="nav-row">
                        <img src={logo} alt="Project img" className="project__img" />
                        <NavLink to="/HEADER" className="logo">
                            Конструктор<span>анкет</span>
                        </NavLink>

                        <button className="hamburger" onClick={toggleMenu}>
                            ☰
                        </button>

                        <ul ref={menuRef} className={`nav-list ${isMenuOpen ? 'open' : ''}`}>
                            {isLoggedIn ? (
                                <>
                                    <li className="nav-list__item">
                                        <button onClick={() => { navigate('/Account'); setMenuOpen(false); }} className="nav-button">
                                            Личный кабинет
                                        </button>
                                    </li>
                                    <li className="nav-list__item">
                                        <button onClick={handleLogout} className="nav-button">
                                            Выйти
                                        </button>
                                    </li>
                                </>
                            ) : (
                                <>
                                    <li className="nav-list__item">
                                        <button onClick={() => { openLoginModal(); setMenuOpen(false); }} className="nav-button">
                                            Войти
                                        </button>
                                    </li>
                                    <li className="nav-list__item">
                                        <button onClick={() => { openRegisterModal(); setMenuOpen(false); }} className="nav-button">
                                            Регистрация
                                        </button>
                                    </li>
                                </>
                            )}
                        </ul>
                    </div>
                </div>
            </nav>

            {/* Модальные окна */}
            {isLoginModalOpen && (
                <ModalLogin
                    onClose={closeLoginModal}
                    onRegisterOpen={openRegisterModal}
                    onLoginSuccess={() => {
                        login();
                        setNotification('Вы вошли в аккаунт');
                        setTimeout(() => setNotification(''), 3000);
                        closeLoginModal();
                    }}
                />
            )}

            {isRegisterModalOpen && (
                <ModalRegister
                    onClose={closeRegisterModal}
                    onLoginOpen={openLoginModal}
                    onRegisterSuccess={() => {
                        login();
                        setNotification('Регистрация прошла успешно!');
                        setTimeout(() => setNotification(''), 3000);
                        closeRegisterModal();
                    }}
                />
            )}
        </>
    );
};

export default Navbar;