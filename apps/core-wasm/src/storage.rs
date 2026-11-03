use rusqlite::{Connection, OpenFlags};
use sqlite_wasm_rs::WasmOsCallback;
use sqlite_wasm_vfs::sahpool::{OpfsSAHPoolCfgBuilder, install};

const VFS: &str = "time-opfs";
const DIRECTORY: &str = ".skkil-time";

/// Opens `name` on OPFS through the sync-access-handle pool, installing
/// the pool on first use. The pool holds every handle it owns, so only one
/// worker per origin can have it installed at a time.
pub async fn open(name: &str) -> Result<Connection, String> {
    let config = OpfsSAHPoolCfgBuilder::new()
        .vfs_name(VFS)
        .directory(DIRECTORY)
        .build();
    install::<WasmOsCallback>(&config, false)
        .await
        .map_err(|error| format!("Couldn't open browser storage: {error}"))?;
    Connection::open_with_flags_and_vfs(format!("/{name}"), OpenFlags::default(), VFS)
        .map_err(|error| error.to_string())
}
