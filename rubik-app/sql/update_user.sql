UPDATE users
SET
  solved = solved + 1,
  easy = easy + CASE WHEN $2 = 'easy' THEN 1 ELSE 0 END,
  medium = medium + CASE WHEN $2 = 'medium' THEN 1 ELSE 0 END,
  hard = hard + CASE WHEN $2 = 'hard' THEN 1 ELSE 0 END
WHERE username = $1;
