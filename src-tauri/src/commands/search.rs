use crate::db::Database;
use crate::models::{Email, MailAccount, MailFolder};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::command;
use chrono::{DateTime, Utc, NaiveDateTime};

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    pub account_id: Option<String>,
    pub folder_id: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub sender: Option<String>,
    pub subject_contains: Option<String>,
    pub body_contains: Option<String>,
    pub has_attachments: Option<bool>,
    pub is_read: Option<bool>,
    pub is_starred: Option<bool>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub emails: Vec<Email>,
    pub total_count: u32,
    pub query_time_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FilterOptions {
    pub date_range: Option<DateRange>,
    pub sender_filter: Option<StringFilter>,
    pub subject_filter: Option<StringFilter>,
    pub body_filter: Option<StringFilter>,
    pub attachment_filter: Option<bool>,
    pub read_status_filter: Option<bool>,
    pub starred_filter: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DateRange {
    pub from: Option<String>,
    pub to: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StringFilter {
    pub contains: Option<String>,
    pub starts_with: Option<String>,
    pub ends_with: Option<String>,
    pub exact: Option<String>,
}

#[command]
pub async fn search_emails(db: tauri::State<'_, Database>, search_query: SearchQuery) -> Result<SearchResult, String> {
    let start_time = std::time::Instant::now();
    
    let mut query_builder = String::from(
        r#"
        SELECT e.id, e.folder_id, e.uid, e.from_addr, e.to_addr, e.cc_addr, e.bcc_addr, 
               e.subject, e.body, e.html_body, e.date, e.is_read, e.is_starred, 
               e.has_attachments, e.message_id, e.in_reply_to, e.references
        FROM emails e
        WHERE 1=1
        "#
    );

    let mut params = Vec::new();
    let mut param_index = 1;

    // Add search conditions
    if !search_query.query.is_empty() {
        query_builder.push_str(&format!(
            " AND (e.subject LIKE ?{} OR e.body LIKE ?{} OR e.from_addr LIKE ?{})",
            param_index, param_index + 1, param_index + 2
        ));
        let search_pattern = format!("%{}%", search_query.query);
        params.push(search_pattern.clone());
        params.push(search_pattern.clone());
        params.push(search_pattern);
        param_index += 3;
    }

    if let Some(account_id) = &search_query.account_id {
        query_builder.push_str(&format!(" AND e.folder_id LIKE ?{}", param_index));
        params.push(format!("{}-%", account_id));
        param_index += 1;
    }

    if let Some(folder_id) = &search_query.folder_id {
        query_builder.push_str(&format!(" AND e.folder_id = ?{}", param_index));
        params.push(folder_id.clone());
        param_index += 1;
    }

    if let Some(date_from) = &search_query.date_from {
        query_builder.push_str(&format!(" AND e.date >= ?{}", param_index));
        params.push(date_from.clone());
        param_index += 1;
    }

    if let Some(date_to) = &search_query.date_to {
        query_builder.push_str(&format!(" AND e.date <= ?{}", param_index));
        params.push(date_to.clone());
        param_index += 1;
    }

    if let Some(sender) = &search_query.sender {
        query_builder.push_str(&format!(" AND e.from_addr LIKE ?{}", param_index));
        params.push(format!("%{}%", sender));
        param_index += 1;
    }

    if let Some(subject_contains) = &search_query.subject_contains {
        query_builder.push_str(&format!(" AND e.subject LIKE ?{}", param_index));
        params.push(format!("%{}%", subject_contains));
        param_index += 1;
    }

    if let Some(body_contains) = &search_query.body_contains {
        query_builder.push_str(&format!(" AND e.body LIKE ?{}", param_index));
        params.push(format!("%{}%", body_contains));
        param_index += 1;
    }

    if let Some(has_attachments) = search_query.has_attachments {
        query_builder.push_str(&format!(" AND e.has_attachments = ?{}", param_index));
        params.push(has_attachments.to_string());
        param_index += 1;
    }

    if let Some(is_read) = search_query.is_read {
        query_builder.push_str(&format!(" AND e.is_read = ?{}", param_index));
        params.push(is_read.to_string());
        param_index += 1;
    }

    if let Some(is_starred) = search_query.is_starred {
        query_builder.push_str(&format!(" AND e.is_starred = ?{}", param_index));
        params.push(is_starred.to_string());
        param_index += 1;
    }

    // Add ordering
    query_builder.push_str(" ORDER BY e.date DESC");

    // Get total count
    let count_query = query_builder.replace(
        "SELECT e.id, e.folder_id, e.uid, e.from_addr, e.to_addr, e.cc_addr, e.bcc_addr, 
               e.subject, e.body, e.html_body, e.date, e.is_read, e.is_starred, 
               e.has_attachments, e.message_id, e.in_reply_to, e.references",
        "SELECT COUNT(*) as count"
    );

    let mut count_query_builder = sqlx::query(&count_query);
    for param in &params {
        count_query_builder = count_query_builder.bind(param);
    }

    let total_count = count_query_builder
        .fetch_one(&db.pool)
        .await
        .map_err(|e| format!("Failed to get search count: {}", e))?
        .get::<i64, _>("count") as u32;

    // Add pagination
    let limit = search_query.limit.unwrap_or(50);
    let offset = search_query.offset.unwrap_or(0);
    query_builder.push_str(&format!(" LIMIT ?{} OFFSET ?{}", param_index, param_index + 1));
    params.push(limit.to_string());
    params.push(offset.to_string());

    // Execute search query
    let mut query_builder = sqlx::query(&query_builder);
    for param in &params {
        query_builder = query_builder.bind(param);
    }

    let rows = query_builder
        .fetch_all(&db.pool)
        .await
        .map_err(|e| format!("Failed to search emails: {}", e))?;

    let mut emails = Vec::new();
    for row in rows {
        let email = Email {
            id: row.get("id"),
            folder_id: row.get("folder_id"),
            uid: row.get("uid"),
            from: row.get("from_addr"),
            to: row.get("to_addr"),
            cc: row.get("cc_addr"),
            bcc: row.get("bcc_addr"),
            subject: row.get("subject"),
            body: row.get("body"),
            html_body: row.get("html_body"),
            date: row.get("date"),
            read: row.get("is_read"),
            starred: row.get("is_starred"),
            has_attachments: row.get("has_attachments"),
            message_id: row.get("message_id"),
            in_reply_to: row.get("in_reply_to"),
            references: row.get("references"),
        };
        emails.push(email);
    }

    let query_time = start_time.elapsed().as_millis() as u64;

    Ok(SearchResult {
        emails,
        total_count,
        query_time_ms: query_time,
    })
}

#[command]
pub async fn quick_search(db: tauri::State<'_, Database>, query: String, limit: Option<u32>) -> Result<Vec<Email>, String> {
    let search_query = SearchQuery {
        query,
        account_id: None,
        folder_id: None,
        date_from: None,
        date_to: None,
        sender: None,
        subject_contains: None,
        body_contains: None,
        has_attachments: None,
        is_read: None,
        is_starred: None,
        limit,
        offset: Some(0),
    };

    let result = search_emails(db, search_query).await?;
    Ok(result.emails)
}

#[command]
pub async fn search_by_sender(db: tauri::State<'_, Database>, sender: String, limit: Option<u32>) -> Result<Vec<Email>, String> {
    let search_query = SearchQuery {
        query: String::new(),
        account_id: None,
        folder_id: None,
        date_from: None,
        date_to: None,
        sender: Some(sender),
        subject_contains: None,
        body_contains: None,
        has_attachments: None,
        is_read: None,
        is_starred: None,
        limit,
        offset: Some(0),
    };

    let result = search_emails(db, search_query).await?;
    Ok(result.emails)
}

#[command]
pub async fn search_by_subject(db: tauri::State<'_, Database>, subject: String, limit: Option<u32>) -> Result<Vec<Email>, String> {
    let search_query = SearchQuery {
        query: String::new(),
        account_id: None,
        folder_id: None,
        date_from: None,
        date_to: None,
        sender: None,
        subject_contains: Some(subject),
        body_contains: None,
        has_attachments: None,
        is_read: None,
        is_starred: None,
        limit,
        offset: Some(0),
    };

    let result = search_emails(db, search_query).await?;
    Ok(result.emails)
}

#[command]
pub async fn search_with_attachments(db: tauri::State<'_, Database>, limit: Option<u32>) -> Result<Vec<Email>, String> {
    let search_query = SearchQuery {
        query: String::new(),
        account_id: None,
        folder_id: None,
        date_from: None,
        date_to: None,
        sender: None,
        subject_contains: None,
        body_contains: None,
        has_attachments: Some(true),
        is_read: None,
        is_starred: None,
        limit,
        offset: Some(0),
    };

    let result = search_emails(db, search_query).await?;
    Ok(result.emails)
}

#[command]
pub async fn search_unread_emails(db: tauri::State<'_, Database>, account_id: Option<String>, limit: Option<u32>) -> Result<Vec<Email>, String> {
    let search_query = SearchQuery {
        query: String::new(),
        account_id,
        folder_id: None,
        date_from: None,
        date_to: None,
        sender: None,
        subject_contains: None,
        body_contains: None,
        has_attachments: None,
        is_read: Some(false),
        is_starred: None,
        limit,
        offset: Some(0),
    };

    let result = search_emails(db, search_query).await?;
    Ok(result.emails)
}

#[command]
pub async fn search_starred_emails(db: tauri::State<'_, Database>, account_id: Option<String>, limit: Option<u32>) -> Result<Vec<Email>, String> {
    let search_query = SearchQuery {
        query: String::new(),
        account_id,
        folder_id: None,
        date_from: None,
        date_to: None,
        sender: None,
        subject_contains: None,
        body_contains: None,
        has_attachments: None,
        is_read: None,
        is_starred: Some(true),
        limit,
        offset: Some(0),
    };

    let result = search_emails(db, search_query).await?;
    Ok(result.emails)
}

#[command]
pub async fn search_by_date_range(
    db: tauri::State<'_, Database>, 
    date_from: String, 
    date_to: String, 
    account_id: Option<String>,
    limit: Option<u32>
) -> Result<Vec<Email>, String> {
    let search_query = SearchQuery {
        query: String::new(),
        account_id,
        folder_id: None,
        date_from: Some(date_from),
        date_to: Some(date_to),
        sender: None,
        subject_contains: None,
        body_contains: None,
        has_attachments: None,
        is_read: None,
        is_starred: None,
        limit,
        offset: Some(0),
    };

    let result = search_emails(db, search_query).await?;
    Ok(result.emails)
}

#[command]
pub async fn get_search_suggestions(db: tauri::State<'_, Database>, query: String, limit: Option<u32>) -> Result<Vec<String>, String> {
    let limit = limit.unwrap_or(10);
    let search_pattern = format!("%{}%", query);

    // Get subject suggestions
    let subjects = sqlx::query_scalar!(
        "SELECT DISTINCT subject FROM emails WHERE subject LIKE ? LIMIT ?",
        search_pattern,
        limit as i64
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| format!("Failed to get subject suggestions: {}", e))?;

    // Get sender suggestions
    let senders = sqlx::query_scalar!(
        "SELECT DISTINCT from_addr FROM emails WHERE from_addr LIKE ? LIMIT ?",
        search_pattern,
        limit as i64
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| format!("Failed to get sender suggestions: {}", e))?;

    let mut suggestions = Vec::new();
    
    // Add unique suggestions
    for subject in subjects {
        if let Some(subject) = subject {
            suggestions.push(subject);
        }
    }
    
    for sender in senders {
        if let Some(sender) = sender {
            suggestions.push(sender);
        }
    }

    // Remove duplicates and limit
    suggestions.sort();
    suggestions.dedup();
    suggestions.truncate(limit as usize);

    Ok(suggestions)
}
