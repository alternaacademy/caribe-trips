// Desktop entry point. On Android, Tauri uses the `mobile_entry_point` in lib.rs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    caribe_trips_lib::run()
}
