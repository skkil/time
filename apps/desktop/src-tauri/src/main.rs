// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args().any(|arg| arg == skkil_time_lib::mcp::FLAG) {
        if let Err(error) = skkil_time_lib::mcp::serve() {
            eprintln!("skkil-time --mcp: {error}");
            std::process::exit(1);
        }
        return;
    }
    skkil_time_lib::run()
}
