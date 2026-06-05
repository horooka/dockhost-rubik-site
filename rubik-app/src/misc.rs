use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use yaml_rust2::{YamlLoader, yaml::Yaml};

pub static TEXT: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    HashMap::from([
        ("username_short", "Username should be longer than 5 symbols"),
        ("password_short", "Password should be longer than 8 symbols"),
        ("password_long", "Password should be shorter than 30 symbols"),
        ("username_long", "Username should be shorter than 15 symbols"),
        ("username_cont", "Username should consist only from alphanumeric symbols"),
        (
            "password_cont",
            "Password should consist only from alphanumeric symbols + !@#$%^&*()_+=-?><",
        ),
        ("user_registered", "Username is already registered"),
        ("user_not_registered", "Username is not registered"),
        ("sorry", "Sorry, try again later"),
        ("login_wrong", "Wrong username of password"),
    ])
});

static FILE: Lazy<String> = Lazy::new(|| std::fs::read_to_string("/app/rubik.yaml").unwrap());
static YAML: Lazy<Yaml> =
    Lazy::new(|| YamlLoader::load_from_str(FILE.as_str()).unwrap()[0].clone());

pub static MACROS: Lazy<Vec<Macro>> = Lazy::new(|| {
    YAML["macros"]
        .as_vec()
        .unwrap()
        .iter()
        .map(|m| Macro {
            key: m["key"].as_str().unwrap(),
            label: m["label"].as_str().unwrap(),
            moves: m["moves"].as_str().unwrap(),
        })
        .collect()
});

pub static SCRAMBLES: Lazy<Vec<Scramble>> = Lazy::new(|| {
    YAML["scrambles"]
        .as_vec()
        .unwrap()
        .iter()
        .map(|s| Scramble {
            scramble: s["scramble"].as_str().unwrap(),
            difficulty: s["difficulty"].as_str().unwrap(),
            prompt: s["prompt"].as_str().unwrap(),
        })
        .collect()
});

#[derive(Serialize)]
pub struct RubikClientConfig<'a> {
    pub rubik_id: usize,
    pub scramble: &'a str,
    pub difficulty: &'a str,
    pub macros: &'a [Macro],
}

pub fn rubik_client_json(
    rubik_id: usize,
    scramble: &Scramble,
    macros: &[Macro],
) -> Result<String, String> {
    let config = RubikClientConfig {
        rubik_id,
        scramble: scramble.scramble,
        difficulty: scramble.difficulty,
        macros,
    };
    serde_json::to_string(&config).map_err(|e| format!("rubik json encode failed: {e}"))
}

#[derive(Hash, Serialize)]
pub struct Macro {
    pub key: &'static str,
    pub label: &'static str,
    pub moves: &'static str,
}

#[derive(Hash)]
pub struct Scramble {
    pub scramble: &'static str,
    pub difficulty: &'static str,
    pub prompt: &'static str,
}

#[derive(Deserialize)]
pub struct RubikSubmit {
    pub difficulty: String,
    pub rubik_id: u8,
    pub facelets: String,
    pub moves: u32,
}

pub fn is_solved_cube(facelets: &str) -> bool {
    if facelets.len() != 54 {
        return false;
    }
    if !facelets.bytes().all(|b| matches!(b, b'U' | b'D' | b'F' | b'B' | b'L' | b'R')) {
        return false;
    }
    for face in 0..6 {
        let base = face * 9;
        let color = facelets.as_bytes()[base];
        for i in 1..9 {
            if facelets.as_bytes()[base + i] != color {
                return false;
            }
        }
    }
    true
}

pub async fn validate(username: &String, password: &String) -> Result<(), Vec<String>> {
    let mut errs: Vec<String> = vec![];
    if username.len() < 5 {
        errs.push(TEXT["username_short"].to_string());
    }
    if password.len() < 8 {
        errs.push(TEXT["password_short"].to_string());
    }
    if password.len() > 30 {
        errs.push(TEXT["password_long"].to_string());
    }
    if username.len() > 15 {
        errs.push(TEXT["username_short"].to_string());
    }
    if !username.chars().all(char::is_alphanumeric) {
        errs.push(TEXT["username_cont"].to_string());
    }
    if !password
        .chars()
        .all(|x| char::is_alphanumeric(x) || "!@#$%^&*()_+=-?><".contains(x))
    {
        errs.push(TEXT["password_cont"].to_string());
    }

    if errs.is_empty() { Ok(()) } else { Err(errs) }
}
