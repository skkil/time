use std::io::{BufRead, BufReader, Write};
use std::net::{Ipv4Addr, TcpListener};
use std::time::{Duration, Instant};

use url::Url;

const DONE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>skkil time</title>\
<body style=\"font:16px system-ui;padding:3rem;color:#334\">\
<p>You're signed in. You can close this tab and go back to skkil time.</p>";
const POLL: Duration = Duration::from_millis(100);

/// The RFC 8252 loopback redirect: a one-shot HTTP listener on 127.0.0.1
/// with a port the OS picks, waiting for the browser to come back with the
/// authorization code.
pub struct Loopback {
    listener: TcpListener,
    port: u16,
}

/// What the identity provider sent back.
#[derive(Debug, PartialEq)]
pub struct Callback {
    pub code: String,
    pub state: String,
}

impl Loopback {
    pub fn bind() -> std::io::Result<Self> {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))?;
        listener.set_nonblocking(true)?;
        let port = listener.local_addr()?.port();
        Ok(Self { listener, port })
    }

    pub fn redirect_uri(&self) -> String {
        format!("http://127.0.0.1:{}/callback", self.port)
    }

    /// Waits up to `timeout` for the redirect, answering every request
    /// with a page that says the browser can be closed.
    pub fn wait(self, timeout: Duration) -> Result<Callback, String> {
        let deadline = Instant::now() + timeout;
        loop {
            match self.listener.accept() {
                Ok((stream, _)) => {
                    stream
                        .set_nonblocking(false)
                        .map_err(|error| error.to_string())?;
                    let mut reader = BufReader::new(&stream);
                    let mut line = String::new();
                    reader
                        .read_line(&mut line)
                        .map_err(|error| error.to_string())?;
                    let mut writer = &stream;
                    let _ = write!(
                        writer,
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{DONE_PAGE}",
                        DONE_PAGE.len()
                    );
                    if let Some(callback) = parse(&line)? {
                        return Ok(callback);
                    }
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    if Instant::now() >= deadline {
                        return Err("Sign-in timed out. Try again.".into());
                    }
                    std::thread::sleep(POLL);
                }
                Err(error) => return Err(error.to_string()),
            }
        }
    }
}

/// The code and state of a `GET /callback?…` request line; `None` for any
/// other request (a favicon, say).
fn parse(request_line: &str) -> Result<Option<Callback>, String> {
    let Some(target) = request_line.split_whitespace().nth(1) else {
        return Ok(None);
    };
    let url =
        Url::parse(&format!("http://127.0.0.1{target}")).map_err(|error| error.to_string())?;
    if url.path() != "/callback" {
        return Ok(None);
    }
    let query = |key: &str| {
        url.query_pairs()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.into_owned())
    };
    if let Some(error) = query("error") {
        let detail = query("error_description").unwrap_or(error);
        return Err(format!("Sign-in was refused: {detail}"));
    }
    match (query("code"), query("state")) {
        (Some(code), Some(state)) => Ok(Some(Callback { code, state })),
        _ => Err("The sign-in reply was incomplete.".into()),
    }
}

#[cfg(test)]
mod tests {
    use std::io::Read;
    use std::net::TcpStream;

    use super::*;

    #[test]
    fn reads_the_code_from_the_browser_redirect() {
        let loopback = Loopback::bind().unwrap();
        let uri = Url::parse(&loopback.redirect_uri()).unwrap();
        assert_eq!(uri.host_str(), Some("127.0.0.1"));
        let port = uri.port().unwrap();
        let browser = std::thread::spawn(move || {
            let mut favicon = TcpStream::connect(("127.0.0.1", port)).unwrap();
            favicon
                .write_all(b"GET /favicon.ico HTTP/1.1\r\n\r\n")
                .unwrap();
            let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
            stream
                .write_all(b"GET /callback?code=abc%2F1&state=xyz HTTP/1.1\r\nHost: x\r\n\r\n")
                .unwrap();
            let mut page = String::new();
            stream.read_to_string(&mut page).unwrap();
            page
        });
        let callback = loopback.wait(Duration::from_secs(5)).unwrap();
        assert_eq!(
            callback,
            Callback {
                code: "abc/1".into(),
                state: "xyz".into()
            }
        );
        assert!(browser.join().unwrap().contains("signed in"));
    }

    #[test]
    fn reports_a_refusal_and_times_out() {
        assert!(
            parse("GET /callback?error=access_denied HTTP/1.1")
                .unwrap_err()
                .contains("access_denied")
        );
        assert_eq!(parse("GET /other HTTP/1.1").unwrap(), None);
        let loopback = Loopback::bind().unwrap();
        assert!(loopback.wait(Duration::from_millis(150)).is_err());
    }
}
