const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// PostgreSQL 연결
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// 로그인 API
app.post('/api/login', async (req, res) => {
    const { studentId, name, isTeacher } = req.body;

    try {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 학생 테이블에 추가 (이미 있으면 무시)
            await client.query(
                'INSERT INTO students (student_id, name) VALUES ($1, $2) ON CONFLICT (student_id) DO UPDATE SET name = $2',
                [studentId, name]
            );

            // 선생님이면 teachers 테이블에도 추가
            if (isTeacher) {
                await client.query(
                    'INSERT INTO teachers (teacher_id, name) VALUES ($1, $2) ON CONFLICT (teacher_id) DO NOTHING',
                    [studentId, name]
                );
            }

            // 게임 기록 확인 또는 생성
            let gameRecord = await client.query(
                'SELECT * FROM game_records WHERE student_id = $1',
                [studentId]
            );

            if (gameRecord.rows.length === 0) {
                // 새 게임 기록 생성
                gameRecord = await client.query(
                    `INSERT INTO game_records 
                    (student_id, is_teacher, remaining_attempts, current_money, current_probability) 
                    VALUES ($1, $2, $3, 100, 100) 
                    RETURNING *`,
                    [studentId, isTeacher, isTeacher ? 999999 : 5]
                );
            } else {
                // 선생님 권한 업데이트
                if (isTeacher && !gameRecord.rows[0].is_teacher) {
                    gameRecord = await client.query(
                        'UPDATE game_records SET is_teacher = true, remaining_attempts = 999999 WHERE student_id = $1 RETURNING *',
                        [studentId]
                    );
                }
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                user: {
                    student_id: studentId,
                    name: name,
                    is_teacher: isTeacher
                },
                gameState: gameRecord.rows[0]
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: '로그인 실패' });
    }
});

// 게임 플레이 API
app.post('/api/play', async (req, res) => {
    const { studentId, currentMoney, currentProbability } = req.body;

    try {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 현재 게임 상태 가져오기
            const gameRecord = await client.query(
                'SELECT * FROM game_records WHERE student_id = $1',
                [studentId]
            );

            if (gameRecord.rows.length === 0) {
                throw new Error('게임 기록을 찾을 수 없습니다.');
            }

            const record = gameRecord.rows[0];

            // 기회 확인 (선생님은 무제한)
            if (!record.is_teacher && record.remaining_attempts <= 0) {
                return res.json({
                    success: false,
                    message: '남은 기회가 없습니다.'
                });
            }

            // 확률 계산
            const random = Math.random() * 100;
            const success = random < currentProbability;

            let newMoney = currentMoney;
            let newProbability = currentProbability;
            let win = false;
            let remainingAttempts = record.remaining_attempts;

            if (success) {
                // 성공: 돈 2배
                newMoney = currentMoney * 2;
                newProbability = Math.max(1, Math.floor(currentProbability / 2));

                // 6000원 이상 달성
                if (newMoney >= 6000) {
                    win = true;
                    newMoney = 100;
                    newProbability = 100;
                }
            } else {
                // 실패: 초기화 및 기회 차감
                newMoney = 100;
                newProbability = 100;
                if (!record.is_teacher) {
                    remainingAttempts -= 1;
                }
            }

            // 최고 기록 업데이트
            const bestRecord = Math.max(record.best_record, win ? 6000 : (success ? newMoney : record.best_record));

            // 기록 추가
            const recentHistory = record.recent_history || [];
            recentHistory.unshift({
                timestamp: new Date().toISOString(),
                success: success,
                win: win,
                old_money: currentMoney,
                new_money: success ? newMoney : 100,
                probability: currentProbability
            });

            // 최근 20개만 유지
            if (recentHistory.length > 20) {
                recentHistory.pop();
            }

            // 데이터베이스 업데이트
            await client.query(
                `UPDATE game_records SET 
                remaining_attempts = $1,
                total_attempts = total_attempts + 1,
                current_money = $2,
                current_probability = $3,
                successes = successes + $4,
                failures = failures + $5,
                best_record = $6,
                recent_history = $7,
                last_played_at = NOW()
                WHERE student_id = $8`,
                [
                    remainingAttempts,
                    newMoney,
                    newProbability,
                    success ? 1 : 0,
                    success ? 0 : 1,
                    bestRecord,
                    JSON.stringify(recentHistory),
                    studentId
                ]
            );

            await client.query('COMMIT');

            res.json({
                success: true,
                result: {
                    success: success,
                    win: win,
                    new_money: newMoney,
                    new_probability: newProbability,
                    remaining_attempts: remainingAttempts
                }
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Play error:', error);
        res.status(500).json({ success: false, message: '게임 플레이 중 오류 발생' });
    }
});

// 통계 조회 API
app.get('/api/stats/:studentId', async (req, res) => {
    const { studentId } = req.params;

    try {
        const result = await pool.query(
            'SELECT total_attempts, successes, failures, best_record FROM game_records WHERE student_id = $1',
            [studentId]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                stats: {
                    total_attempts: 0,
                    successes: 0,
                    failures: 0,
                    best_record: 100
                }
            });
        }

        res.json({
            success: true,
            stats: result.rows[0]
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, message: '통계 조회 실패' });
    }
});

// 기록 조회 API
app.get('/api/history/:studentId', async (req, res) => {
    const { studentId } = req.params;

    try {
        const result = await pool.query(
            'SELECT recent_history FROM game_records WHERE student_id = $1',
            [studentId]
        );

        if (result.rows.length === 0 || !result.rows[0].recent_history) {
            return res.json({ success: true, history: [] });
        }

        res.json({
            success: true,
            history: result.rows[0].recent_history
        });
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ success: false, message: '기록 조회 실패' });
    }
});

// 랭킹 조회 API
app.get('/api/ranking', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT s.student_id, s.name, g.best_record 
            FROM game_records g 
            JOIN students s ON g.student_id = s.student_id 
            WHERE g.best_record > 100
            ORDER BY g.best_record DESC 
            LIMIT 10`
        );

        res.json({
            success: true,
            ranking: result.rows
        });
    } catch (error) {
        console.error('Ranking error:', error);
        res.status(500).json({ success: false, message: '랭킹 조회 실패' });
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
});