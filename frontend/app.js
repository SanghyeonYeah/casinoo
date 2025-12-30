const API_URL = 'http://localhost:3000/api';

let currentUser = null;
let gameState = {
    money: 100,
    probability: 100,
    attempts: 5,
    isTeacher: false
};

// 오토마우스 방지
let lastClickTime = 0;
const MIN_CLICK_INTERVAL = 200; // 밀리초

// DOM 요소
const loginSection = document.getElementById('loginSection');
const gameSection = document.getElementById('gameSection');
const rankingSection = document.getElementById('rankingSection');
const showRankingBtn = document.getElementById('showRankingBtn');

// 로그인
document.getElementById('loginBtn').addEventListener('click', async () => {
    const studentId = document.getElementById('studentId').value.trim();
    const name = document.getElementById('studentName').value.trim();
    const isTeacher = document.getElementById('isTeacher').checked;

    if (!studentId || !name) {
        alert('학번과 이름을 모두 입력해주세요.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, name, isTeacher })
        });

        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            gameState = {
                money: data.gameState.current_money,
                probability: data.gameState.current_probability,
                attempts: data.gameState.remaining_attempts,
                isTeacher: data.user.is_teacher
            };
            
            showGameSection();
            updateUI();
        } else {
            alert(data.message || '로그인 실패');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('서버 연결에 실패했습니다.');
    }
});

// 게임 플레이
document.getElementById('playBtn').addEventListener('click', async () => {
    // 오토마우스 방지
    const currentTime = Date.now();
    if (currentTime - lastClickTime < MIN_CLICK_INTERVAL) {
        return;
    }
    lastClickTime = currentTime;

    if (gameState.attempts <= 0 && !gameState.isTeacher) {
        alert('기회를 모두 사용했습니다!');
        return;
    }

    const playBtn = document.getElementById('playBtn');
    playBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/play`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                studentId: currentUser.student_id,
                currentMoney: gameState.money,
                currentProbability: gameState.probability
            })
        });

        const data = await response.json();

        if (data.success) {
            const result = data.result;
            
            // 애니메이션 효과
            showResult(result);
            
            setTimeout(() => {
                if (result.win) {
                    // 6000원 달성
                    gameState.money = 100;
                    gameState.probability = 100;
                    if (!gameState.isTeacher) {
                        gameState.attempts = result.remaining_attempts;
                    }
                } else if (result.success) {
                    // 성공
                    gameState.money = result.new_money;
                    gameState.probability = result.new_probability;
                } else {
                    // 실패
                    gameState.money = 100;
                    gameState.probability = 100;
                    if (!gameState.isTeacher) {
                        gameState.attempts = result.remaining_attempts;
                    }
                }
                
                updateUI();
                loadHistory();
                playBtn.disabled = false;
            }, 2000);
        }
    } catch (error) {
        console.error('Play error:', error);
        alert('게임 플레이 중 오류가 발생했습니다.');
        playBtn.disabled = false;
    }
});

// 결과 표시
function showResult(result) {
    const resultMessage = document.getElementById('resultMessage');
    
    if (result.win) {
        resultMessage.textContent = '🎉 축하합니다! 6000원 달성! 간식을 받으세요! 🎉';
        resultMessage.className = 'result-message win';
    } else if (result.success) {
        resultMessage.textContent = `✅ 성공! ${result.new_money}원 (확률: ${result.new_probability}%)`;
        resultMessage.className = 'result-message success';
    } else {
        resultMessage.textContent = `❌ 실패! 100원으로 초기화 (남은 기회: ${result.remaining_attempts})`;
        resultMessage.className = 'result-message failure';
    }
}

// UI 업데이트
function updateUI() {
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userStudentId').textContent = currentUser.student_id;
    
    if (gameState.isTeacher) {
        document.getElementById('attemptsInfo').textContent = '무제한 기회 (선생님)';
    } else {
        document.getElementById('remainingAttempts').textContent = gameState.attempts;
    }
    
    document.getElementById('currentMoney').textContent = `${gameState.money}원`;
    document.getElementById('currentProbability').textContent = `${gameState.probability}%`;
    
    loadStats();
}

// 통계 로드
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/stats/${currentUser.student_id}`);
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('bestRecord').textContent = `${data.stats.best_record}원`;
            document.getElementById('totalAttempts').textContent = data.stats.total_attempts;
            document.getElementById('successCount').textContent = data.stats.successes;
            document.getElementById('failureCount').textContent = data.stats.failures;
        }
    } catch (error) {
        console.error('Stats error:', error);
    }
}

// 기록 로드
async function loadHistory() {
    try {
        const response = await fetch(`${API_URL}/history/${currentUser.student_id}`);
        const data = await response.json();
        
        if (data.success && data.history.length > 0) {
            const historyList = document.getElementById('historyList');
            historyList.innerHTML = data.history.map(record => {
                const resultText = record.win ? '🎉 6000원 달성!' : 
                                  record.success ? `✅ ${record.new_money}원` : 
                                  '❌ 실패';
                const className = record.win ? 'win' : record.success ? 'success' : 'failure';
                const time = new Date(record.timestamp).toLocaleString('ko-KR');
                
                return `
                    <div class="history-item ${className}">
                        <div>${resultText}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">${time}</div>
                    </div>
                `;
            }).join('');
        } else {
            document.getElementById('historyList').innerHTML = '<p style="color: #999;">아직 기록이 없습니다.</p>';
        }
    } catch (error) {
        console.error('History error:', error);
    }
}

// 랭킹 보기
showRankingBtn.addEventListener('click', async () => {
    try {
        const response = await fetch(`${API_URL}/ranking`);
        const data = await response.json();
        
        if (data.success) {
            const rankingList = document.getElementById('rankingList');
            rankingList.innerHTML = data.ranking.map((user, index) => {
                const rank = index + 1;
                const topClass = rank <= 3 ? `top-${rank}` : '';
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
                
                return `
                    <div class="ranking-item ${topClass}">
                        <div class="ranking-rank">${medal} ${rank}</div>
                        <div class="ranking-info">
                            <div class="ranking-name">${user.name}</div>
                            <div class="ranking-id">${user.student_id}</div>
                        </div>
                        <div class="ranking-score">${user.best_record}원</div>
                    </div>
                `;
            }).join('');
            
            rankingSection.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Ranking error:', error);
        alert('랭킹을 불러오는데 실패했습니다.');
    }
});

document.getElementById('closeRankingBtn').addEventListener('click', () => {
    rankingSection.classList.add('hidden');
});

// 로그아웃
document.getElementById('logoutBtn').addEventListener('click', () => {
    currentUser = null;
    gameState = { money: 100, probability: 100, attempts: 5, isTeacher: false };
    
    loginSection.classList.remove('hidden');
    gameSection.classList.add('hidden');
    showRankingBtn.classList.add('hidden');
    
    document.getElementById('studentId').value = '';
    document.getElementById('studentName').value = '';
    document.getElementById('isTeacher').checked = false;
    document.getElementById('resultMessage').textContent = '';
    document.getElementById('resultMessage').className = 'result-message';
});

// 게임 섹션 표시
function showGameSection() {
    loginSection.classList.add('hidden');
    gameSection.classList.remove('hidden');
    showRankingBtn.classList.remove('hidden');
    loadHistory();
}