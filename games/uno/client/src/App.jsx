import './App.css';
import { Routes, Route } from 'react-router-dom';
import Homepage from './components/Homepage';
import Game from './components/Game';

const App = () => (
  <div className="App">
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/play" element={<Game />} />
    </Routes>
  </div>
);

export default App;
