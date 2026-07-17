import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import queryString from 'query-string';
import randomCodeGenerator from '../utils/randomCodeGenerator';
import logo from '../assets/logo.png';

const Homepage = () => {
  const [roomCode, setRoomCode] = useState('');
  const navigate = useNavigate();

  // SyncBoard opens /?room=...&username=... — jump straight into the match.
  useEffect(() => {
    const params = queryString.parse(window.location.search);
    const room = String(params.room || params.roomCode || '').trim();
    const username = String(params.username || '').trim();
    if (!room) {
      return;
    }
    const qs = new URLSearchParams({ roomCode: room });
    if (username) {
      qs.set('username', username);
    }
    if (params.source) {
      qs.set('source', String(params.source));
    }
    navigate(`/play?${qs.toString()}`, { replace: true });
  }, [navigate]);

  return (
    <div className="Homepage">
      <div className="homepage-menu">
        <img src={logo} width="200px" alt="UNO" />
        <div className="homepage-form">
          <div className="homepage-join">
            <input
              type="text"
              placeholder="Game Code"
              onChange={(event) => setRoomCode(event.target.value)}
            />
            <Link to={`/play?roomCode=${encodeURIComponent(roomCode)}`}>
              <button type="button" className="game-button green">JOIN GAME</button>
            </Link>
          </div>
          <h1>OR</h1>
          <div className="homepage-create">
            <Link to={`/play?roomCode=${randomCodeGenerator(5)}`}>
              <button type="button" className="game-button orange">CREATE GAME</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;
