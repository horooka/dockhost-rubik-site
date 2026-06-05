use actix_files::{Files, NamedFile};
use actix_web::{
    App, Either, HttpRequest, HttpResponse, HttpServer, Responder,
    cookie::{Cookie, SameSite},
    get,
    middleware::from_fn,
    post,
    web::{Data, Form, Html, Redirect},
};
use rand::Rng;
use sqlx::{PgPool, postgres::PgConnectOptions};
use std::path::PathBuf;
use tera::{Context, Tera};
use time::Duration;
mod auth;
use auth::{UserLogin, decode_jwt_from_req, jwt_auth_mw};
mod misc;
use misc::{
    MACROS, SCRAMBLES, RubikSubmit, is_solved_cube, rubik_client_json,
};
mod db;
use db::{get_top, get_user, login, register, update_user, verify_schema};

#[get("/")]
async fn index() -> impl Responder {
    let path: PathBuf = "static/html/start.html".parse().unwrap();
    NamedFile::open(path).unwrap()
}

#[get("/login")]
async fn login_handler(tmpl: Data<Tera>) -> impl Responder {
    Html::new(tmpl.render("login.tera", &Context::new()).unwrap())
}

#[get("/register")]
async fn register_handler(tmpl: Data<Tera>) -> impl Responder {
    Html::new(tmpl.render("register.tera", &Context::new()).unwrap())
}

#[post("/login-processing")]
async fn login_processing(
    pool: Data<PgPool>,
    tmpl: Data<Tera>,
    Form(form): Form<UserLogin>,
) -> Either<Html, HttpResponse> {
    match login(&pool, &form.username, &form.password).await {
        Ok(jwt) => Either::Right(
            HttpResponse::SeeOther()
                .append_header(("Location", "/profile"))
                .cookie(
                    Cookie::build("token", jwt)
                        .path("/")
                        .http_only(true)
                        .same_site(SameSite::Lax)
                        .max_age(Duration::hours(1))
                        .finish(),
                )
                .finish(),
        ),
        Err(x) => {
            let mut ctx = Context::new();
            ctx.insert("err", &x);
            Either::Left(Html::new(tmpl.render("login.tera", &ctx).unwrap()))
        }
    }
}

#[post("/register-processing")]
async fn register_processing(
    pool: Data<PgPool>,
    tmpl: Data<Tera>,
    Form(form): Form<UserLogin>,
) -> Either<Html, HttpResponse> {
    if let Err(x) = register(&pool, &form.username, &form.password).await {
        let mut ctx = Context::new();
        ctx.insert("errs", &x);
        Either::Left(Html::new(tmpl.render("register.tera", &ctx).unwrap()))
    } else {
        Either::Right(
            HttpResponse::SeeOther()
                .append_header(("Location", "/profile"))
                .cookie(
                    Cookie::build(
                        "token",
                        login(&pool, &form.username, &form.password)
                            .await
                            .unwrap(),
                    )
                    .path("/")
                    .http_only(true)
                    .same_site(SameSite::Lax)
                    .max_age(Duration::hours(1))
                    .finish(),
                )
                .finish(),
        )
    }
}

#[get("/profile")]
async fn profile(req: HttpRequest, pool: Data<PgPool>, tmpl: Data<Tera>) -> impl Responder {
    let claims = decode_jwt_from_req(req.clone()).unwrap();
    let user = get_user(&pool, &claims.usrnm).await.unwrap();
    let mut ctx = Context::new();
    ctx.insert("username", user.username.as_str());
    ctx.insert("solved", &user.solved);
    Html::new(tmpl.render("profile.tera", &ctx).unwrap())
}

#[get("/top")]
async fn top(pool: Data<PgPool>, tmpl: Data<Tera>) -> impl Responder {
    let top_users = get_top(&pool).await;
    let mut ctx = Context::new();
    ctx.insert("top_users", &top_users);
    Html::new(tmpl.render("top.tera", &ctx).unwrap())
}

#[post("/logout")]
async fn logout() -> impl Responder {
    HttpResponse::SeeOther()
        .append_header(("Location", "/"))
        .cookie(
            Cookie::build("token", "")
                .max_age(Duration::hours(0))
                .finish(),
        )
        .finish()
}

#[get("/rubik")]
async fn get_rubik(tmpl: Data<Tera>) -> impl Responder {
    if SCRAMBLES.is_empty() {
        eprintln!("rubik: no scrambles loaded");
        return HttpResponse::InternalServerError().body("no scrambles configured");
    }

    let mut rng = rand::rng();
    let rubik_id = rng.random_range(0..SCRAMBLES.len());
    let scramble = &SCRAMBLES[rubik_id];

    let rubik_json = match rubik_client_json(rubik_id, scramble, &MACROS) {
        Ok(json) => json,
        Err(e) => {
            eprintln!("rubik: {e}");
            return HttpResponse::InternalServerError().body("rubik config error");
        }
    };

    let mut ctx = tera::Context::new();
    ctx.insert("difficulty", scramble.difficulty);
    ctx.insert("prompt", scramble.prompt);
    ctx.insert("rubik_id", &rubik_id);
    ctx.insert("scramble", scramble.scramble);
    ctx.insert("rubik_json", &rubik_json);

    match tmpl.render("rubik.html", &ctx) {
        Ok(html) => HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(html),
        Err(e) => {
            eprintln!("rubik: template render failed: {e}");
            HttpResponse::InternalServerError().body("rubik page error")
        }
    }
}

#[post("/rubik-check")]
async fn check_rubik(
    req: HttpRequest,
    Form(form): Form<RubikSubmit>,
    pool: Data<PgPool>,
) -> impl Responder {
    let rubik_id = form.rubik_id as usize;
    let Some(scramble) = SCRAMBLES.get(rubik_id) else {
        return Redirect::to("/rubik").see_other();
    };
    if scramble.difficulty != form.difficulty || !is_solved_cube(&form.facelets) {
        return Redirect::to("/rubik").see_other();
    }

    let claims = decode_jwt_from_req(req).unwrap();
    update_user(&pool, claims.usrnm.as_str(), scramble.difficulty).await;
    Redirect::to("/rubik").see_other()
}

fn require_env(name: &str) -> String {
    match std::env::var(name) {
        Ok(value) => value,
        Err(_) => {
            eprintln!("startup error: missing env var {name}");
            std::process::exit(1);
        }
    }
}

fn startup_fail(message: impl std::fmt::Display) -> ! {
    eprintln!("startup error: {message}");
    std::process::exit(1);
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    eprintln!("rubik-app: starting…");

    if !std::path::Path::new("/app/rubik.yaml").exists() {
        startup_fail("missing /app/rubik.yaml");
    }

    let tera = match Tera::new("/app/static/html/*") {
        Ok(t) => t,
        Err(e) => startup_fail(format!("template init failed: {e}")),
    };

    if let Err(e) = tera.render("rubik.html", &{
        let mut ctx = Context::new();
        ctx.insert("prompt", "test");
        ctx.insert("difficulty", "easy");
        ctx.insert("rubik_id", &0usize);
        ctx.insert("scramble", "R U R'");
        ctx.insert("rubik_json", r#"{"rubik_id":0,"scramble":"R U R'","difficulty":"easy","macros":[]}"#);
        ctx
    }) {
        startup_fail(format!("rubik.html template check failed: {e}"));
    }

    let _ = SCRAMBLES.len();
    let _ = MACROS.len();
    eprintln!(
        "rubik-app: loaded {} scrambles, {} macros",
        SCRAMBLES.len(),
        MACROS.len()
    );

    let postgres_host = require_env("POSTGRES_HOST");
    let postgres_user = require_env("POSTGRES_USER");
    let postgres_password = require_env("POSTGRES_PASSWORD");
    let postgres_db = require_env("POSTGRES_DB");
    require_env("JWT_SECRET");

    eprintln!(
        "rubik-app: connecting to postgres at {postgres_host}:5432/db={postgres_db}…"
    );

    let options = PgConnectOptions::new()
        .host(postgres_host.as_str())
        .port(5432)
        .username(postgres_user.as_str())
        .password(postgres_password.as_str())
        .database(postgres_db.as_str());

    let pool: PgPool = match sqlx::Pool::connect_with(options).await {
        Ok(pool) => pool,
        Err(e) => startup_fail(format!("postgres connect failed: {e}")),
    };

    if let Err(e) = verify_schema(&pool).await {
        startup_fail(e);
    }

    eprintln!("rubik-app: postgres connected, users table ok, binding 0.0.0.0:8000…");

    HttpServer::new(move || {
        App::new()
            .wrap(from_fn(jwt_auth_mw))
            .service(index)
            .service(login_handler)
            .service(register_handler)
            .service(login_processing)
            .service(register_processing)
            .service(profile)
            .service(top)
            .service(logout)
            .service(get_rubik)
            .service(check_rubik)
            .service(Files::new("/static", "./static"))
            .app_data(Data::new(tera.clone()))
            .app_data(Data::new(pool.clone()))
    })
    .bind(("0.0.0.0", 8000))?
    .run()
    .await?;

    Ok(())
}
