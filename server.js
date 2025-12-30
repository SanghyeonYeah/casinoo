import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, RotateCcw, User } from 'lucide-react';

const ProbabilityGame = () => {
  const [studentId, setStudentId] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [money, setMoney] = useState(1);
  const [probability, setProbability] = useState(100);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [failures, setFailures] = useState(0);
  const [bestRecord, setBestRecord] = useState(1);
  const [recentHistory, setRecentHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  // 실제 서버 URL로 교체
  const API_URL = 'YOUR_API_ENDPOINT_HERE';

  const login = async () => {
    if (!studentId.trim()) {
      alert('학번을 입력해주세요!');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId.trim() })
      });

      const data = await response.json();

      if (data.success) {
        setIsLoggedIn(true);
        setIsTeacher(data.isTeacher);
        setRemainingAttempts(data.remainingAttempts);
        loadGameData(data);
      } else {
        alert(data.message || '로그인 실패');
      }
    } catch (error) {
      console.error(error);
      alert('서버 연결 실패 → 로컬 모드 실행');
      setIsLoggedIn(true);
      setIsTeacher(studentId.toLowerCase() === 'teacher');
      setRemainingAttempts(studentId.toLowerCase() === 'teacher' ? 5 : 1);
    }
    setLoading(false);
  };

  const loadGameData = (data) => {
    if (!data.gameState) return;
    setMoney(data.gameState.money || 1);
    setProbability(data.gameState.probability || 100);
    setTotalAttempts(data.gameState.totalAttempts || 0);
    setSuccesses(data.gameState.successes || 0);
    setFailures(data.gameState.failures || 0);
    setBestRecord(data.gameState.bestRecord || 1);
    setRecentHistory(data.gameState.recentHistory || []);
  };

  const saveGameState = async () => {
    try {
      await fetch(`${API_URL}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          gameState: {
            money,
            probability,
            totalAttempts,
            successes,
            failures,
            bestRecord,
            recentHistory
          },
          remainingAttempts
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isLoggedIn) saveGameState();
  }, [money, probability, totalAttempts, successes, failures, bestRecord, recentHistory, remainingAttempts]);

  const playGame = () => {
    if (remainingAttempts <= 0) {
      alert(isTeacher ? '모든 기회를 사용했습니다!' : '이미 게임을 플레이했습니다!');
      return;
    }

    if (money >= 10000) {
      alert('🎉 간식 획득! 게임 종료!');
      return;
    }

    setIsAnimating(true);
    const success = Math.random() * 100 < probability;

    setTimeout(() => {
      if (success) {
        const newMoney = money * 2;
        setMoney(newMoney);
        setProbability(Math.max(5, probability - 5));
        setSuccesses(s => s + 1);
        setMessage('🎉 성공! 돈이 두 배가 되었습니다!');

        if (newMoney > bestRecord) setBestRecord(newMoney);

        setRecentHistory(prev => [
          { attempt: totalAttempts + 1, result: '성공', amount: newMoney, prob: probability },
          ...prev
        ].slice(0, 5));

        if (newMoney >= 10000) {
          setMessage('🍪 축하합니다! 간식을 획득했습니다!');
          setRemainingAttempts(r => r - 1);
        }
      } else {
        setFailures(f => f + 1);
        setMessage('😢 실패… 처음부터 다시 도전!');

        setRecentHistory(prev => [
          { attempt: totalAttempts + 1, result: '실패', amount: money, prob: probability },
          ...prev
        ].slice(0, 5));

        setMoney(1);
        setProbability(100);
        setRemainingAttempts(r => r - 1);
      }

      setTotalAttempts(t => t + 1);
      setIsAnimating(false);
    }, 1000);
  };

  const resetStats = () => {
    if (!window.confirm('통계를 초기화할까요?')) return;
    setTotalAttempts(0);
    setSuccesses(0);
    setFailures(0);
    setRecentHistory([]);
    setMessage('통계가 초기화되었습니다.');
  };

  const logout = () => {
    setIsLoggedIn(false);
    setStudentId('');
    setMoney(1);
    setProbability(100);
    setTotalAttempts(0);
    setSuccesses(0);
    setFailures(0);
    setBestRecord(1);
    setRecentHistory([]);
    setRemainingAttempts(0);
    setMessage('');
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <User className="w-16 h-16 mx-auto mb-4 text-purple-600" />
            <h1 className="text-3xl font-bold">확률 도전 게임</h1>
            <p className="text-gray-600">학번을 입력하세요</p>
          </div>

          <input
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="학번 (선생님: teacher)"
            className="w-full border-2 rounded-lg px-4 py-3 mb-4"
          />

          <button
            onClick={login}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold"
          >
            {loading ? '로그인 중…' : '게임 시작'}
          </button>

          <p className="text-sm mt-4 text-center text-gray-600">
            학생 1회 / 선생님 5회 플레이 가능
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
          <h1 className="text-3xl font-bold">🎲 확률 도전 게임</h1>
          <p className="text-sm">🍪 간식을 획득해보세요!</p>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="bg-green-500 text-white p-6 rounded-xl">
            <p>현재 금액</p>
            <p className="text-4xl font-bold">{money.toLocaleString()}원</p>
          </div>
          <div className="bg-blue-500 text-white p-6 rounded-xl">
            <p>성공 확률</p>
            <p className="text-4xl font-bold">{probability}%</p>
          </div>
        </div>

        <div className="p-6">
          <button
            onClick={playGame}
            disabled={isAnimating || remainingAttempts <= 0}
            className="w-full py-6 text-2xl font-bold rounded-xl bg-yellow-400"
          >
            {isAnimating ? '도전 중…' : '🎰 도전하기'}
          </button>
        </div>

        <div className="p-6 bg-gray-50">
          <p>총 시도: {totalAttempts}</p>
          <p>성공: {successes}</p>
          <p>실패: {failures}</p>
          <p>최고 기록: {bestRecord.toLocaleString()}원</p>
        </div>
      </div>
    </div>
  );
};

export default ProbabilityGame;
