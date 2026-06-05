SELECT username, password, solved, easy, medium, hard
FROM users
WHERE username = $1;
