use crate::{
    auth::encode_jwt,
    misc::{TEXT, validate},
};
use bcrypt::{DEFAULT_COST, hash, verify};
use serde::Serialize;
use sqlx::{FromRow, PgPool, Row, query};

#[derive(FromRow, Debug, Serialize)]
pub struct User {
    pub username: String,
    pub password: String,
    pub solved: i32,
    pub easy: i32,
    pub medium: i32,
    pub hard: i32,
}

pub fn hash_password(password: &str) -> String {
    hash(password, DEFAULT_COST).unwrap().to_string()
}

pub async fn register(pool: &PgPool, username: &str, password: &str) -> Result<(), Vec<String>> {
    if let Err(x) = validate(&username.to_string(), &password.to_string()).await {
        Err(x)
    } else if let Err(x) = add_user(pool, username, password).await {
        Err(vec![x])
    } else {
        Ok(())
    }
}

pub async fn login(pool: &PgPool, username: &str, password: &str) -> Result<String, String> {
    if let Ok(user) = get_user(pool, username).await {
        if verify(password, user.password.as_str()).unwrap() {
            Ok(encode_jwt(username))
        } else {
            Err(TEXT["login_wrong"].to_string())
        }
    } else {
        Err(TEXT["user_not_registered"].to_string())
    }
}

pub async fn verify_schema(pool: &PgPool) -> Result<(), String> {
    match query("SELECT username FROM users LIMIT 1")
        .fetch_optional(pool)
        .await
    {
        Ok(_) => Ok(()),
        Err(e) => Err(format!(
            "users table missing or wrong schema: {e} — run CREATE TABLE from README in database POSTGRES_DB"
        )),
    }
}

pub async fn add_user(pool: &PgPool, username: &str, password: &str) -> Result<(), String> {
    match query("SELECT username FROM users WHERE username = $1")
        .bind(username)
        .fetch_optional(pool)
        .await
    {
        Ok(Some(_)) => return Err(TEXT["user_registered"].to_string()),
        Ok(None) => {}
        Err(e) => {
            eprintln!("register: username lookup failed: {e}");
            return Err(TEXT["sorry"].to_string());
        }
    }

    match query(include_str!("../sql/add_user.sql"))
        .bind(username)
        .bind(hash_password(password))
        .execute(pool)
        .await
    {
        Ok(_) => Ok(()),
        Err(e) => {
            eprintln!("register: insert failed for {username}: {e}");
            Err(TEXT["sorry"].to_string())
        }
    }
}

pub async fn get_user(pool: &PgPool, username: &str) -> Result<User, String> {
    let query = {
        if let Ok(query) = query(include_str!("../sql/get_user.sql"))
            .bind(username)
            .fetch_one(pool)
            .await
        {
            query
        } else {
            return Err(TEXT["user_not_registered"].to_string());
        }
    };

    Ok(User {
        username: query.try_get("username").unwrap(),
        password: query.try_get("password").unwrap(),
        solved: query.try_get("solved").unwrap(),
        easy: query.try_get("easy").unwrap(),
        medium: query.try_get("medium").unwrap(),
        hard: query.try_get("hard").unwrap(),
    })
}

pub async fn get_top(pool: &PgPool) -> Vec<User> {
    query(include_str!("../sql/get_top.sql"))
        .fetch_all(pool)
        .await
        .unwrap()
        .into_iter()
        .map(|r| User {
            username: r.try_get("username").unwrap(),
            password: "".to_string(),
            solved: r.try_get("solved").unwrap(),
            easy: r.try_get("easy").unwrap(),
            medium: r.try_get("medium").unwrap(),
            hard: r.try_get("hard").unwrap(),
        })
        .collect()
}

pub async fn update_user(pool: &PgPool, username: &str, difficulty: &str) {
    let _ = query(include_str!("../sql/update_user.sql"))
        .bind(username)
        .bind(difficulty)
        .execute(pool)
        .await;
}
