use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use store_http::{Endpoints, HttpTransport};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;
use time_core::data::SYNCED_TABLES;
use time_core::sync::protocol::PROTOCOL_VERSION;
use time_core::sync::protocol::v1::PokesRequest;
use time_core::sync::{SignIn, Uuid};

use super::api::{self, ApiError};
use super::auth::loopback::Loopback;
use super::auth::oidc::Oidc;
use super::auth::pkce::{Pkce, random_token};
use super::auth::tokens::TokenStore;
use super::config::SyncConfig;
use super::credentials::SessionCredentials;
use super::cycle::{self, CycleError};
use super::schedule::{Schedule, Trigger};
use super::session::Session;
use super::view::{AccountChoice, AccountView, RemoteChange, SyncPhase, SyncView};
use crate::db::Db;

pub const STATUS_EVENT: &str = "sync-status";
pub const REMOTE_CHANGE_EVENT: &str = "remote-change";
const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(300);
const POKE_BACKOFF_CAP: Duration = Duration::from_secs(60);

enum Message {
    Trigger(Trigger),
    Stop,
}

/// Desktop sync: the signed-in session, a worker thread that runs sync
/// cycles when the [`Schedule`] says so, and a thread listening to the
/// store service's pokes. Status changes go to the UI as `sync-status`,
/// pulled changes as `remote-change`.
pub struct SyncService {
    app: AppHandle,
    session: Arc<Session>,
    worker: Mutex<Option<Sender<Message>>>,
    generation: AtomicU64,
    phase: Mutex<(SyncPhase, Option<String>)>,
    other_account: Mutex<Option<Uuid>>,
}

type Outcome<T> = Result<T, String>;

impl SyncService {
    pub fn new(app: AppHandle, store: Box<dyn TokenStore>) -> Arc<Self> {
        Arc::new(Self {
            app,
            session: Arc::new(Session::new(store)),
            worker: Mutex::new(None),
            generation: AtomicU64::new(0),
            phase: Mutex::new((SyncPhase::SignedOut, None)),
            other_account: Mutex::new(None),
        })
    }

    fn db(&self) -> tauri::State<'_, Db> {
        self.app.state::<Db>()
    }

    fn config(&self) -> Outcome<SyncConfig> {
        self.db()
            .call(|conn| SyncConfig::load(conn))
            .map_err(|error| error.to_string())
    }

    fn set_phase(&self, phase: SyncPhase, error: Option<String>) {
        *self
            .phase
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = (phase, error);
        self.emit();
    }

    fn phase(&self) -> (SyncPhase, Option<String>) {
        self.phase
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    pub fn view(&self) -> Outcome<SyncView> {
        let status = self
            .db()
            .engine(|engine| engine.status())
            .map_err(|error| error.to_string())?;
        let (phase, error) = self.phase();
        Ok(SyncView {
            phase,
            account: self.session.profile().map(|profile| AccountView {
                name: profile.name,
                email: profile.email,
            }),
            pending: status.pending as u32,
            last_synced_at: status.last_pull_at,
            issues: status.open_issues as u32,
            error,
        })
    }

    pub fn emit(&self) {
        if let Ok(view) = self.view() {
            let _ = self.app.emit(STATUS_EVENT, view);
        }
    }

    pub fn trigger(&self, trigger: Trigger) {
        if let Some(worker) = self
            .worker
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .as_ref()
        {
            let _ = worker.send(Message::Trigger(trigger));
        }
    }

    /// Picks up where the last launch left off: a signed-in desktop that
    /// belongs to an account starts syncing.
    pub fn resume(self: &Arc<Self>) {
        let bound = self.db().engine(|engine| engine.scope()).ok().flatten();
        match (self.session.signed_in(), bound) {
            (true, Some(_)) => self.start(),
            (true, None) => self.set_phase(
                SyncPhase::NeedsSignIn,
                Some("Sign in again to finish setting up sync.".into()),
            ),
            (false, _) => self.set_phase(SyncPhase::SignedOut, None),
        }
    }

    /// Signs in through the system browser and binds this desktop to the
    /// account, or asks the user first when it holds another account's
    /// data. Blocks until the browser comes back.
    pub fn sign_in(self: &Arc<Self>) -> Outcome<()> {
        self.set_phase(SyncPhase::SigningIn, None);
        let result = self.authorize();
        if let Err(error) = &result {
            let phase = if self.session.signed_in() {
                SyncPhase::NeedsSignIn
            } else {
                SyncPhase::SignedOut
            };
            self.set_phase(phase, Some(error.clone()));
        }
        result
    }

    fn authorize(self: &Arc<Self>) -> Outcome<()> {
        let config = self.config()?;
        let oidc = Oidc::discover(&config)?;
        let pkce = Pkce::new();
        let state = random_token(16);
        let loopback = Loopback::bind().map_err(|error| error.to_string())?;
        let redirect_uri = loopback.redirect_uri();
        self.app
            .opener()
            .open_url(
                oidc.authorize_url(&redirect_uri, &pkce, &state),
                None::<&str>,
            )
            .map_err(|error| format!("Couldn't open the browser: {error}"))?;
        let callback = loopback.wait(SIGN_IN_TIMEOUT)?;
        if callback.state != state {
            return Err("The sign-in reply didn't match. Try again.".into());
        }
        let tokens = oidc.exchange(&callback.code, &redirect_uri, &pkce)?;
        let scope = api::scope_of(&config.server_url, &tokens.access_token)
            .map_err(|error| error.to_string())?;
        self.stop();
        self.session.keep(tokens)?;
        let signed_in = self
            .db()
            .engine(|engine| engine.sign_in(scope))
            .map_err(|error| error.to_string())?;
        match signed_in {
            SignIn::Synced | SignIn::Uploading { .. } => self.start(),
            SignIn::OtherAccount { .. } => {
                *self
                    .other_account
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(scope);
                self.set_phase(SyncPhase::NeedsChoice, None);
            }
        }
        Ok(())
    }

    /// Settles a sign-in to another account: upload this desktop's data
    /// into it, or replace the data with the account's.
    pub fn choose(self: &Arc<Self>, choice: AccountChoice) -> Outcome<()> {
        let scope = self
            .other_account
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take()
            .ok_or("Nothing is waiting for a choice.")?;
        self.db()
            .engine(|engine| match choice {
                AccountChoice::KeepLocal => engine.keep_local(scope).map(|_| ()),
                AccountChoice::StartFresh => engine.start_fresh(scope),
            })
            .map_err(|error| error.to_string())?;
        self.changed(
            SYNCED_TABLES
                .iter()
                .map(|table| (*table).to_owned())
                .collect(),
        );
        self.start();
        Ok(())
    }

    /// Stops syncing and forgets the sign-in. The data stays and waits for
    /// the same account.
    pub fn sign_out(&self) -> Outcome<()> {
        self.stop();
        self.other_account
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take();
        self.session.sign_out()?;
        self.set_phase(SyncPhase::SignedOut, None);
        Ok(())
    }

    fn changed(&self, tables: Vec<String>) {
        if !tables.is_empty() {
            let _ = self.app.emit(REMOTE_CHANGE_EVENT, RemoteChange { tables });
        }
    }

    fn start(self: &Arc<Self>) {
        self.stop();
        let (sender, receiver) = mpsc::channel();
        *self
            .worker
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(sender);
        let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        self.set_phase(SyncPhase::Syncing, None);
        let worker = Arc::clone(self);
        std::thread::spawn(move || worker.run_worker(receiver));
        let pokes = Arc::clone(self);
        std::thread::spawn(move || pokes.run_pokes(generation));
    }

    fn stop(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        if let Some(worker) = self
            .worker
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take()
        {
            let _ = worker.send(Message::Stop);
        }
    }

    fn run_worker(self: Arc<Self>, receiver: mpsc::Receiver<Message>) {
        let mut schedule = Schedule::new(Instant::now());
        loop {
            if schedule.is_due(Instant::now()) {
                self.set_phase(SyncPhase::Syncing, None);
                match self.cycle() {
                    Ok(()) => {
                        schedule.succeeded(Instant::now());
                        self.set_phase(SyncPhase::Idle, None);
                    }
                    Err(CycleError::Unauthorized(reason)) => {
                        schedule.failed(Instant::now());
                        self.set_phase(SyncPhase::NeedsSignIn, Some(reason));
                    }
                    Err(CycleError::Failed(reason)) => {
                        schedule.failed(Instant::now());
                        self.set_phase(SyncPhase::Offline, Some(reason));
                    }
                }
            }
            match receiver.recv_timeout(schedule.wait(Instant::now())) {
                Ok(Message::Trigger(trigger)) => schedule.on(trigger, Instant::now()),
                Ok(Message::Stop) | Err(RecvTimeoutError::Disconnected) => return,
                Err(RecvTimeoutError::Timeout) => {}
            }
        }
    }

    fn transport(&self) -> Result<HttpTransport<SessionCredentials>, CycleError> {
        let config = self.config().map_err(CycleError::Failed)?;
        let client_id = self.db().engine(|engine| engine.status())?.client_id;
        let grant = self
            .session
            .grant(&config, client_id)
            .map_err(|error| match error {
                ApiError::Unauthorized => CycleError::Unauthorized(error.to_string()),
                other => CycleError::Failed(other.to_string()),
            })?;
        Ok(HttpTransport::new(
            Endpoints::new(grant.push_url, grant.store_url),
            SessionCredentials {
                session: Arc::clone(&self.session),
                config,
                client_id,
            },
        ))
    }

    /// One cycle, retried once with fresh tokens when they were refused.
    fn cycle(&self) -> Result<(), CycleError> {
        let attempt = || -> Result<(), CycleError> {
            let report = cycle::run(&self.db(), &self.transport()?)?;
            self.changed(report.changed_tables.into_iter().collect());
            Ok(())
        };
        match attempt() {
            Err(CycleError::Unauthorized(_)) => {
                self.session.forget_grant();
                attempt()
            }
            other => other,
        }
    }

    fn running(&self, generation: u64) -> bool {
        self.generation.load(Ordering::SeqCst) == generation
    }

    /// Listens to the poke stream, syncing when a poke is ahead of the
    /// cursor and after every reconnect, with backoff between attempts.
    fn run_pokes(self: Arc<Self>, generation: u64) {
        let mut failures = 0u32;
        while self.running(generation) {
            let opened = self.transport().ok().and_then(|transport| {
                let client_id = self.db().engine(|engine| engine.status()).ok()?.client_id;
                transport
                    .pokes(&PokesRequest {
                        protocol_version: PROTOCOL_VERSION,
                        client_id: client_id.to_string(),
                    })
                    .ok()
            });
            if let Some(stream) = opened {
                failures = 0;
                self.trigger(Trigger::Start);
                for poke in stream {
                    if !self.running(generation) {
                        return;
                    }
                    let Ok(poke) = poke else { break };
                    let cursor = self
                        .db()
                        .engine(|engine| engine.status())
                        .map_or(0, |status| status.cursor_version);
                    if poke.version > cursor {
                        self.trigger(Trigger::Poke);
                    }
                }
            }
            failures += 1;
            let delay = Duration::from_secs(1 << failures.min(6)).min(POKE_BACKOFF_CAP);
            std::thread::sleep(delay);
        }
    }
}
