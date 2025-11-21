use tauri::command;
use std::fs;
use std::path::PathBuf;

#[command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[command]
pub fn save_attachment(filename: String, content: Vec<u8>) -> Result<String, String> {
    let downloads_dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("."));
    let file_path = downloads_dir.join(filename);
    
    fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().to_string())
}
