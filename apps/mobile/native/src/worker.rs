use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::mpsc;
use std::thread;

use futures_channel::oneshot;
use time_core::sync::Engine;

use crate::error::{CoreError, Result};

type Job = Box<dyn FnOnce(&mut Engine) + Send>;

/// The thread that owns the [`Engine`]. Jobs run one at a time in the
/// order they were sent, so writes keep the order the user made them in,
/// whether a caller awaits them ([`Worker::call`]) or blocks
/// ([`Worker::run`]).
pub struct Worker {
    jobs: mpsc::Sender<Job>,
}

impl Worker {
    /// Starts the thread and opens the engine on it.
    pub async fn open(open: impl FnOnce() -> Result<Engine> + Send + 'static) -> Result<Self> {
        let (jobs, queue) = mpsc::channel::<Job>();
        let (opened, ready) = oneshot::channel();
        thread::Builder::new()
            .name("time-core".into())
            .spawn(move || {
                let mut engine = match open() {
                    Ok(engine) => {
                        let _ = opened.send(Ok(()));
                        engine
                    }
                    Err(error) => {
                        let _ = opened.send(Err(error));
                        return;
                    }
                };
                for job in queue {
                    let _ = catch_unwind(AssertUnwindSafe(|| job(&mut engine)));
                }
            })
            .map_err(|error| CoreError::Database {
                message: error.to_string(),
            })?;
        ready.await.map_err(|_| CoreError::stopped())??;
        Ok(Self { jobs })
    }

    fn send<T: Send + 'static>(
        &self,
        job: impl FnOnce(&mut Engine) -> Result<T> + Send + 'static,
        reply: impl FnOnce(Result<T>) + Send + 'static,
    ) -> Result<()> {
        self.jobs
            .send(Box::new(move |engine| reply(job(engine))))
            .map_err(|_| CoreError::stopped())
    }

    /// Runs `job` on the engine thread and waits for it, blocking the caller.
    pub fn run<T: Send + 'static>(
        &self,
        job: impl FnOnce(&mut Engine) -> Result<T> + Send + 'static,
    ) -> Result<T> {
        let (sender, receiver) = mpsc::sync_channel(1);
        self.send(job, move |result| {
            let _ = sender.send(result);
        })?;
        receiver.recv().map_err(|_| CoreError::stopped())?
    }

    /// Runs `job` on the engine thread; the caller's thread stays free.
    pub async fn call<T: Send + 'static>(
        &self,
        job: impl FnOnce(&mut Engine) -> Result<T> + Send + 'static,
    ) -> Result<T> {
        let (sender, receiver) = oneshot::channel();
        self.send(job, move |result| {
            let _ = sender.send(result);
        })?;
        receiver.await.map_err(|_| CoreError::stopped())?
    }
}
