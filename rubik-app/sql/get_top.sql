SELECT username,
       solved,
       easy,
       medium,
       hard
FROM users
ORDER BY solved DESC, hard DESC, medium DESC
LIMIT 10;
