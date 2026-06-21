//! Caribe Trips mobile shell. Wraps the built React SPA in a Tauri 2 webview.
//! The native shell polish (tab bar, system bars) is added in Task 23.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Caribe Trips");
}
