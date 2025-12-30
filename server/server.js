import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* 임시 메모리 DB */
const users = {};

/* 로그인 */
app.post("/login", (req, res) => {
  const { studentId } = req.body;

  const isTeacher = studentId.toLowerCase() === "teacher";
  const remainingAttempts = isTeacher ? 5 : 1;

  if (!users[studentId]) {
    users[studentId] = {
      money: 1,
      probability: 100,
      totalAttempts: 0,
      successes: 0,
      failures: 0,
      bestRecord: 1,
      recentHistory: []
    };
  }

  res.json({
    success: true,
    isTeacher,
    remainingAttempts,
    gameState: users[studentId]
  });
});

/* 저장 */
app.post("/save", (req, res) => {
  const { studentId, gameState } = req.body;
  users[studentId] = gameState;
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on ${PORT}`);
});
