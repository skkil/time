use time_core::sync::{Engine, Uuid};
use wasm_bindgen::prelude::*;

use crate::backup;
use crate::error::{JsResult, database, invalid, to_js};
use crate::habits;
use crate::js;

/// One open time database with store installed: the commands of
/// [`Engine`], plus the synchronous functions of store's `CoreHandle`
/// (`pushRequest`, `applyPushResponse`, `pullRequest`, `applyPullResponse`,
/// `status`) for `@skkil/store-client`.
#[wasm_bindgen]
pub struct TimeCore {
    engine: Engine,
}

fn scope_id(scope: &str) -> JsResult<Uuid> {
    scope
        .parse()
        .map_err(|_| invalid(format!("“{scope}” isn't an account id.")))
}

fn parse(text: &str) -> JsResult<JsValue> {
    js_sys::JSON::parse(text).map_err(|_| database("The engine returned invalid JSON."))
}

#[wasm_bindgen]
impl TimeCore {
    /// Opens (or creates) the database `name` on OPFS. Only in a dedicated
    /// worker; rejects where OPFS sync access handles are unavailable.
    #[cfg(target_arch = "wasm32")]
    pub async fn open(name: String) -> JsResult<TimeCore> {
        let conn = crate::storage::open(&name).await.map_err(database)?;
        Self::over(conn)
    }

    /// A database that lives only as long as this handle, for tests.
    #[wasm_bindgen(js_name = openInMemory)]
    pub fn open_in_memory() -> JsResult<TimeCore> {
        Self::over(
            rusqlite::Connection::open_in_memory().map_err(|error| database(error.to_string()))?,
        )
    }

    fn over(conn: rusqlite::Connection) -> JsResult<TimeCore> {
        Ok(Self {
            engine: Engine::open(conn).map_err(to_js)?,
        })
    }

    /// Applies a write command by its contract name; `args` and the result
    /// are JSON text.
    pub fn mutate(&mut self, name: &str, args: &str) -> JsResult<String> {
        self.engine.mutate_json(name, args).map_err(to_js)
    }

    /// Answers a read command by its contract name; `args` and the result
    /// are JSON text.
    pub fn query(&self, name: &str, args: &str) -> JsResult<String> {
        self.engine.query_json(name, args).map_err(to_js)
    }

    /// The next binary `PushRequest`, or `undefined` when nothing waits.
    #[wasm_bindgen(js_name = pushRequest)]
    pub fn push_request(&self, limit: u32) -> JsResult<Option<Vec<u8>>> {
        self.engine.push_request_bytes(limit).map_err(to_js)
    }

    /// Applies a binary `PushResponse`; returns `{ applied, duplicate, rejected }`.
    #[wasm_bindgen(js_name = applyPushResponse)]
    pub fn apply_push_response(&self, bytes: &[u8]) -> JsResult<JsValue> {
        let outcome = self
            .engine
            .apply_push_response_bytes(bytes)
            .map_err(to_js)?;
        js::value(&outcome)
    }

    /// The next binary `PullRequest`.
    #[wasm_bindgen(js_name = pullRequest)]
    pub fn pull_request(&self, limit: u32) -> JsResult<Vec<u8>> {
        self.engine.pull_request_bytes(limit).map_err(to_js)
    }

    /// Applies a binary `PullResponse`; returns
    /// `{ changedTables, more, reset, versions, ackedMutationId, newIssues }`.
    #[wasm_bindgen(js_name = applyPullResponse)]
    pub fn apply_pull_response(&mut self, bytes: &[u8]) -> JsResult<JsValue> {
        let outcome = self
            .engine
            .apply_pull_response_bytes(bytes)
            .map_err(to_js)?;
        js::value(&outcome)
    }

    /// store's sync status with camelCase names (`clientId`, `scopeId`,
    /// `pending`, `issues`, `cursorVersion`, `lastPullAt`, …).
    pub fn status(&self) -> JsResult<JsValue> {
        parse(&self.engine.status_json().map_err(to_js)?)
    }

    /// The account this database syncs with, once bound.
    pub fn scope(&self) -> JsResult<Option<String>> {
        Ok(self
            .engine
            .scope()
            .map_err(to_js)?
            .map(|scope| scope.to_string()))
    }

    /// Binds the database to the signed-in account `scope`. Returns
    /// `{ kind: "synced" }`, `{ kind: "uploading", rows }` on a first
    /// sign-in, or `{ kind: "otherAccount", bound }` when it holds another
    /// account's data and the user must choose.
    #[wasm_bindgen(js_name = bindScope)]
    pub fn bind_scope(&mut self, scope: &str) -> JsResult<JsValue> {
        let signed_in = self.engine.sign_in(scope_id(scope)?).map_err(to_js)?;
        js::value(&signed_in)
    }

    /// Moves the database to `scope`, uploading the rows it holds.
    #[wasm_bindgen(js_name = keepLocal)]
    pub fn keep_local(&mut self, scope: &str) -> JsResult<u32> {
        let rows = self.engine.keep_local(scope_id(scope)?).map_err(to_js)?;
        Ok(u32::try_from(rows).unwrap_or(u32::MAX))
    }

    /// Moves the database to `scope`, dropping its rows for the account's.
    #[wasm_bindgen(js_name = startFresh)]
    pub fn start_fresh(&mut self, scope: &str) -> JsResult<()> {
        self.engine.start_fresh(scope_id(scope)?).map_err(to_js)
    }

    /// Clears every synced row and the sync state, for signing out.
    pub fn forget(&mut self) -> JsResult<()> {
        self.engine.forget().map_err(to_js)
    }

    /// Changes the server refused that the user hasn't dismissed.
    pub fn issues(&self) -> JsResult<JsValue> {
        js::value(&self.engine.issues().map_err(to_js)?)
    }

    #[wasm_bindgen(js_name = dismissIssue)]
    pub fn dismiss_issue(&self, id: f64) -> JsResult<bool> {
        self.engine.dismiss_issue(id as i64).map_err(to_js)
    }

    /// Every synced row as backup JSON text.
    pub fn dump(&self) -> JsResult<String> {
        backup::export(&self.engine).map_err(to_js)
    }

    /// Writes a backup made by [`Self::dump`]; returns the rows written.
    pub fn restore(&mut self, backup: &str) -> JsResult<u32> {
        let rows = backup::restore(&mut self.engine, backup).map_err(to_js)?;
        Ok(u32::try_from(rows).unwrap_or(u32::MAX))
    }

    /// Measures project-tracking habits; returns a `SyncReport`.
    #[wasm_bindgen(js_name = syncHabits)]
    pub fn sync_habits(&mut self) -> JsResult<JsValue> {
        let report = habits::sync_project_habits(&mut self.engine).map_err(to_js)?;
        js::value(&report)
    }
}
