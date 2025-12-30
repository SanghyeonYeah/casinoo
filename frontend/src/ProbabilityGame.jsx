import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, RotateCcw, User, Database, Crown } from 'lucide-react';

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
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [loading, setLoading] = useState(false);

  // API URL 설정 (배포 시 실제 서버 URL로 변경)
  const API_URL = 'http://localhost:3001/api';

  // 사용자 데이터 로드
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
        
        if (data.gameState) {
          setMoney(data.gameState.money || 1);
          setProbability(data.gameState.probability || 100);
          setTotalAttempts(data.gameState.totalAttempts || 0);
          setSuccesses(data.gameState.successes || 0);
          setFailures(data.gameState.failures || 0);
          setBestRecord(data.gameState.bestRecord || 1);
          setRecentHistory(data.gameState.recentHistory || []);
        }
      } else {
        alert(data.message || '로그인 실패');
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      alert('서버 연결 실패. 서버가 실행 중인지 확인해주세요.');
    }
    setLoading(false);
  };

  // 게임 상태 저장
  const saveGameState = async () => {
    if (!isLoggedIn || !studentId) return;

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
          remainingAttempts: isTeacher ? 999 : remainingAttempts
        })
      });
    } catch (error) {
      console.error('저장 오류:', error);
    }
  };

  // 데이터가 변경될 때마다 자동 저장
  useEffect(() => {
    if (isLoggedIn) {
      const timer = setTimeout(() => {
        saveGameState();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [money, probability, totalAttempts, successes, failures, bestRecord, recentHistory, remainingAttempts]);

  const playGame = () => {
    if (!isTeacher && remainingAttempts <= 0) {
      alert('모든 기회(5회)를 사용했습니다! 더 이상 플레이할 수 없습니다.');
      return;
    }

    if (money >= 10000) {
      alert('🎉 이미 간식을 획득했습니다!');
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
        ].slice(0, 10));

        if (newMoney >= 10000) {
          setMessage('🍪 축하합니다! 간식을 획득했습니다!');
        }
      } else {
        setFailures(f => f + 1);
        setMessage('😢 실패… 처음부터 다시 도전!' + (isTeacher ? '' : ' (기회 차감)'));

        setRecentHistory(prev => [
          { attempt: totalAttempts + 1, result: '실패', amount: money, prob: probability },
          ...prev
        ].slice(0, 10));

        setMoney(1);
        setProbability(100);
        
        if (!isTeacher) {
          setRemainingAttempts(r => r - 1);
        }
      }

      setTotalAttempts(t => t + 1);
      setIsAnimating(false);
    }, 1000);
  };

  const resetStats = () => {
    if (!window.confirm('통계를 초기화하시겠습니까? (기회는 초기화되지 않습니다)')) return;
    setTotalAttempts(0);
    setSuccesses(0);
    setFailures(0);
    setRecentHistory([]);
    setMessage('통계가 초기화되었습니다.');
  };

  const resetAll = async () => {
    if (!window.confirm('모든 데이터를 초기화하시겠습니까?')) return;
    
    try {
      const response = await fetch(`${API_URL}/reset/${studentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        setMoney(1);
        setProbability(100);
        setTotalAttempts(0);
        setSuccesses(0);
        setFailures(0);
        setBestRecord(1);
        setRecentHistory([]);
        
        if (!isTeacher) {
          setRemainingAttempts(5);
        }
        
        setMessage('모든 데이터가 초기화되었습니다!');
      }
    } catch (error) {
      console.error('초기화 오류:', error);
      alert('초기화 실패');
    }
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
    setRemainingAttempts(5);
    setMessage('');
    setIsTeacher(false);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <Database className="w-16 h-16 mx-auto mb-4 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-800">확률 도전 게임</h1>
            <p className="text-gray-600 mt-2">학번을 입력하세요</p>
            <p className="text-sm text-purple-600 mt-1">💾 PostgreSQL 연동</p>
          </div>

          <input
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="학번 입력 (선생님: teacher)"
            className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-purple-500"
          />

          <button
            onClick={login}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold transition disabled:bg-gray-400"
          >
            {loading ? '로딩 중...' : '게임 시작'}
          </button>

          <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
            <p className="text-sm text-gray-700 font-semibold">⚠️ 게임 규칙</p>
            <ul className="text-xs text-gray-600 mt-2 space-y-1">
              <li>• 학생: 총 <strong>5회</strong>의 기회</li>
              <li>• 선생님: <strong className="text-purple-600">무제한</strong> 플레이</li>
              <li>• 성공하면 돈이 2배, 확률 5% 감소</li>
              <li>• 실패하면 처음부터 + 기회 차감</li>
              <li>• 10,000원 달성 시 간식 획득! 🍪</li>
            </ul>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
            <p className="text-xs text-blue-800">
              ℹ️ 서버 주소: <code className="bg-blue-200 px-1 rounded">{API_URL}</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className={`bg-gradient-to-r p-6 text-white ${
          isTeacher ? 'from-yellow-500 to-orange-600' : 'from-purple-600 to-pink-600'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">🎲 확률 도전 게임</h1>
                {isTeacher && <Crown className="w-8 h-8" />}
              </div>
              <p className="text-sm mt-1">🍪 10,000원을 모아 간식을 획득하세요!</p>
              <p className="text-sm mt-1 font-semibold">
                👤 {studentId} {isTeacher && '(선생님 - 무제한)'}
              </p>
            </div>
            <button
              onClick={logout}
              className="bg-white text-purple-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              로그아웃
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-green-500 text-white p-6 rounded-xl shadow-lg">
              <p className="text-sm opacity-90">현재 금액</p>
              <p className="text-4xl font-bold mt-2">{money.toLocaleString()}원</p>
            </div>
            <div className="bg-blue-500 text-white p-6 rounded-xl shadow-lg">
              <p className="text-sm opacity-90">성공 확률</p>
              <p className="text-4xl font-bold mt-2">{probability}%</p>
            </div>
          </div>

          <div className={`border-2 rounded-xl p-4 mb-6 ${
            isTeacher ? 'bg-yellow-100 border-yellow-400' :
            remainingAttempts > 2 ? 'bg-green-100 border-green-400' :
            remainingAttempts > 0 ? 'bg-orange-100 border-orange-400' :
            'bg-red-100 border-red-400'
          }`}>
            <p className="text-center font-semibold text-gray-700">
              {isTeacher ? (
                <span className="text-xl">👑 무제한 플레이 가능</span>
              ) : (
                <>
                  남은 기회: <span className={`text-2xl ${
                    remainingAttempts > 2 ? 'text-green-600' :
                    remainingAttempts > 0 ? 'text-orange-600' :
                    'text-red-600'
                  }`}>{remainingAttempts}</span> / 5회
                </>
              )}
            </p>
          </div>

          <button
            onClick={playGame}
            disabled={isAnimating || (!isTeacher && remainingAttempts <= 0)}
            className={`w-full py-6 text-2xl font-bold rounded-xl transition shadow-lg ${
              isAnimating || (!isTeacher && remainingAttempts <= 0)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-yellow-400 hover:bg-yellow-500'
            }`}
          >
            {isAnimating ? '🎰 도전 중…' : 
             (!isTeacher && remainingAttempts <= 0) ? '❌ 기회 소진' : 
             '🎰 도전하기'}
          </button>

          {message && (
            <div className="mt-6 p-4 bg-purple-100 border-2 border-purple-400 rounded-xl text-center">
              <p className="text-lg font-semibold text-purple-800">{message}</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">📊 통계</h2>
            <div className="flex gap-2">
              <button
                onClick={resetStats}
                className="flex items-center gap-2 bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                통계 초기화
              </button>
              <button
                onClick={resetAll}
                className="flex items-center gap-2 bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition text-sm"
              >
                <AlertCircle className="w-4 h-4" />
                전체 리셋
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">총 시도</p>
              <p className="text-2xl font-bold text-gray-800">{totalAttempts}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">성공</p>
              <p className="text-2xl font-bold text-green-600">{successes}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">실패</p>
              <p className="text-2xl font-bold text-red-600">{failures}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">최고 기록</p>
              <p className="text-2xl font-bold text-purple-600">{bestRecord.toLocaleString()}원</p>
            </div>
          </div>

          {recentHistory.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-3">📝 최근 기록</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recentHistory.map((record, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      record.result === '성공' ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">
                        시도 #{record.attempt}: {record.result}
                      </span>
                      <span className="text-sm">
                        {record.amount.toLocaleString()}원 (확률: {record.prob}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProbabilityGame;