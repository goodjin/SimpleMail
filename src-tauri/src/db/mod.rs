use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use tauri::{AppHandle, Manager};
use std::fs;

#[derive(Clone)]
pub struct Database {
    pub pool: Pool<Sqlite>,
}

impl Database {
    pub async fn init(app_handle: &AppHandle) -> Result<Self, String> {
        let app_dir = app_handle.path().app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;
            
        if !app_dir.exists() {
            fs::create_dir_all(&app_dir)
                .map_err(|e| format!("Failed to create app data dir: {}", e))?;
        }

        let db_path = app_dir.join("mail.db");
        // Helper to create file if not exists, though sqlite mode=rwc should handle it.
        
        let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&db_url)
            .await
            .map_err(|e| format!("Failed to connect to database: {}", e))?;

        let schema = include_str!("schema.sql");
        
        // Execute schema
        sqlx::query(schema)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to initialize schema: {}", e))?;

        Ok(Database { pool })
    }
}
