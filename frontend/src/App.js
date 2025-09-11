import "./components/header/header.css";
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import CreaturePage from "./components/pages/create";
import Header from './components/header/Header';
import Navbar from "./components/nav/Navbar";
import Footer from "./components/footer/Footer";
import LinkQuestionnairePage from "./components/pages/Linkk";
import AnswersPage from "./components/pages/Answers";
import AccountPage from "./components/pages/Account";
import AccountEditPage from "./components/pages/AccountEdit";
import { AuthProvider } from './components/apiContent/AuthContext';
import EditSurveyPage from "./components/pages/EditSurveyPage";
import ThkPage from "./components/pages/Thk";
import AnalysisPage from "./components/pages/Analysis";

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Router>
          <Navbar />

          <Routes>
            <Route path="/" element={<Header />} />
            <Route path="/Header" element={<Header />} />
            <Route path="/Create" element={<CreaturePage />} />
            <Route path="/Linkk" element={<LinkQuestionnairePage />} />
            <Route path="/Answers" element={<AnswersPage />} />
            <Route path="/Answers/:id" element={<AnswersPage />} />
            <Route path="/Account" element={<AccountPage />} />
            <Route path="/AccountEdit" element={<AccountEditPage />} />
            <Route path="/edit-survey/:id" element={<EditSurveyPage />} />
            <Route path="/Thk" element={<ThkPage />} />
            <Route path="/Analysis/:id" element={<AnalysisPage />} />
          </Routes>

          <Footer />
        </Router>
      </div>
    </AuthProvider>
  );
}

export default App;