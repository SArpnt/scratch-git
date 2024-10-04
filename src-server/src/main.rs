pub mod diff;
pub mod git;
pub mod sb3;
pub mod zipping;

pub mod project_diff;

use actix_web::{get, App, HttpResponse, HttpServer, Responder};

use project_diff::project_diff as project_diff_service;

#[get("/")]
async fn root() -> impl Responder {
    return HttpResponse::Ok().body("i am ok");
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().service(root).service(project_diff_service))
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}
