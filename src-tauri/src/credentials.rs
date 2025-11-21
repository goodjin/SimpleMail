use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, NewAead};
use base64::{Engine as _, engine::general_purpose};
use rand::{RngCore, thread_rng};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
pub struct CredentialStore {
    pub encrypted_passwords: std::collections::HashMap<String, String>,
    pub encryption_key: String,
}

impl CredentialStore {
    pub fn new() -> Self {
        let mut rng = thread_rng();
        let mut key = [0u8; 32];
        rng.fill_bytes(&mut key);
        
        Self {
            encrypted_passwords: std::collections::HashMap::new(),
            encryption_key: general_purpose::STANDARD.encode(key),
        }
    }

    pub fn load_or_create(app_handle: &AppHandle) -> Result<Self, String> {
        let app_dir = app_handle.path().app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;
        
        let credentials_path = app_dir.join("credentials.enc");
        
        if credentials_path.exists() {
            let content = fs::read_to_string(&credentials_path)
                .map_err(|e| format!("Failed to read credentials file: {}", e))?;
            
            serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse credentials: {}", e))
        } else {
            Ok(Self::new())
        }
    }

    pub fn save(&self, app_handle: &AppHandle) -> Result<(), String> {
        let app_dir = app_handle.path().app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;
        
        if !app_dir.exists() {
            fs::create_dir_all(&app_dir)
                .map_err(|e| format!("Failed to create app data dir: {}", e))?;
        }

        let credentials_path = app_dir.join("credentials.enc");
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize credentials: {}", e))?;
        
        fs::write(&credentials_path, content)
            .map_err(|e| format!("Failed to write credentials file: {}", e))?;

        // Set file permissions to be readable only by owner
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&credentials_path)
                .map_err(|e| format!("Failed to get file metadata: {}", e))?
                .permissions();
            perms.set_mode(0o600);
            fs::set_permissions(&credentials_path, perms)
                .map_err(|e| format!("Failed to set file permissions: {}", e))?;
        }

        Ok(())
    }

    pub fn encrypt_password(&mut self, account_id: &str, password: &str) -> Result<(), String> {
        let key_bytes = general_purpose::STANDARD.decode(&self.encryption_key)
            .map_err(|e| format!("Failed to decode encryption key: {}", e))?;
        
        let key = Key::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);
        
        let mut rng = thread_rng();
        let mut nonce_bytes = [0u8; 12];
        rng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let ciphertext = cipher.encrypt(nonce, password.as_bytes())
            .map_err(|e| format!("Failed to encrypt password: {}", e))?;
        
        // Combine nonce and ciphertext
        let mut encrypted_data = nonce_bytes.to_vec();
        encrypted_data.extend_from_slice(&ciphertext);
        
        let encrypted_base64 = general_purpose::STANDARD.encode(encrypted_data);
        self.encrypted_passwords.insert(account_id.to_string(), encrypted_base64);
        
        Ok(())
    }

    pub fn decrypt_password(&self, account_id: &str) -> Result<String, String> {
        let encrypted_base64 = self.encrypted_passwords.get(account_id)
            .ok_or_else(|| format!("No encrypted password found for account: {}", account_id))?;
        
        let encrypted_data = general_purpose::STANDARD.decode(encrypted_base64)
            .map_err(|e| format!("Failed to decode encrypted data: {}", e))?;
        
        if encrypted_data.len() < 12 {
            return Err("Invalid encrypted data format".to_string());
        }
        
        let (nonce_bytes, ciphertext) = encrypted_data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        
        let key_bytes = general_purpose::STANDARD.decode(&self.encryption_key)
            .map_err(|e| format!("Failed to decode encryption key: {}", e))?;
        
        let key = Key::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);
        
        let decrypted_bytes = cipher.decrypt(nonce, ciphertext)
            .map_err(|e| format!("Failed to decrypt password: {}", e))?;
        
        String::from_utf8(decrypted_bytes)
            .map_err(|e| format!("Failed to convert decrypted bytes to string: {}", e))
    }

    pub fn remove_password(&mut self, account_id: &str) {
        self.encrypted_passwords.remove(account_id);
    }
}

// Helper functions to work with credentials
pub async fn store_credentials(app_handle: &AppHandle, account_id: &str, password: &str) -> Result<(), String> {
    let mut store = CredentialStore::load_or_create(app_handle)?;
    store.encrypt_password(account_id, password)?;
    store.save(app_handle)?;
    Ok(())
}

pub async fn retrieve_credentials(app_handle: &AppHandle, account_id: &str) -> Result<String, String> {
    let store = CredentialStore::load_or_create(app_handle)?;
    store.decrypt_password(account_id)
}

pub async fn delete_credentials(app_handle: &AppHandle, account_id: &str) -> Result<(), String> {
    let mut store = CredentialStore::load_or_create(app_handle)?;
    store.remove_password(account_id);
    store.save(app_handle)?;
    Ok(())
}
