use std::path::PathBuf;
use crate::LocalLlmPluginExt;

use ollama_rs::Ollama;
use tauri::{ipc::Channel, Manager};

#[tauri::command]
#[specta::specta]
pub async fn is_server_running<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> bool {
    app.is_server_running().await
}

#[tauri::command]
#[specta::specta]
pub async fn is_model_downloaded<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<bool, String> {
    app.is_model_downloaded().await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn is_model_downloading<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<bool, String> {
    Ok(app.is_model_downloading().await)
}

#[tauri::command]
#[specta::specta]
pub async fn download_model<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    channel: Channel<u8>,
) -> Result<(), String> {
    app.download_model(channel).await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn start_server<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<String, String> {
    app.start_server().await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn stop_server<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    app.stop_server().await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_ollama_models<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
) -> Result<Vec<String>, String> {
    let ollama = Ollama::default();
    let models = ollama
        .list_local_models()
        .await
        .map_err(|e| e.to_string())?;

    Ok(models.into_iter().map(|m| m.name).collect::<Vec<_>>())
}

#[tauri::command]
#[specta::specta]
pub async fn list_available_gguf_models<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<Vec<PathBuf>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    // Look for GGUF files in the app_data_dir
    let mut models = vec![];

    if let Ok(entries) = std::fs::read_dir(&app_data_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "gguf") {
                models.push(path);
            }
        }
    }

    Ok(models)
}

#[tauri::command]
#[specta::specta]
pub async fn get_active_model_path<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    let state = app.state::<crate::SharedState>();
    let guard = state.lock().await;
    Ok(guard.get_active_model_path())
}

#[tauri::command]
#[specta::specta]
pub async fn set_custom_model_path<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    path: Option<PathBuf>,
) -> Result<(), String> {
    let state = app.state::<crate::SharedState>();
    let mut guard = state.lock().await;

    // Set the custom model path, or use None to revert to default
    guard.custom_model_path = path;

    // If server is running, stop it to ensure it restarts with the new model
    if let Some(server) = &guard.server {
        let _ = server.clone().shutdown();
        guard.server = None;
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn select_model_file<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
) -> Result<Option<PathBuf>, String> {
    // Since we can't use tauri::dialog directly, we'll return a special response
    // that indicates the frontend should handle file selection
    // This allows us to keep the frontend and backend separation of concerns

    // Return a special error that the frontend can recognise
    Err("FILE_SELECTION_REQUIRED".to_string())
}
