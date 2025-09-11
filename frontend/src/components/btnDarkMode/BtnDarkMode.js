import React, { useEffect } from 'react';
import sunImg from './../../img/icons/sun.svg';
import moonImg from './../../img/icons/moon.svg';
import main from './../js/main'; 
import "./../header/header.css";

function BtnDarkModel() {
    useEffect(() => {
        main();
    }, []);
    return(
        
        <button className="dark-mode-btn">
        <img src={sunImg} alt="Light mode" className="dark-mode-btn__icon" />
        <img src={moonImg} alt="Dark mode" className="dark-mode-btn__icon" />
    </button>
    )

}
export default BtnDarkModel;