use std::path::{Component, Path};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LaunchDisposition {
    Continue,
    Exit,
}

fn is_app_translocated(executable: &Path) -> bool {
    let Ok(relative) = executable.strip_prefix("/private/var/folders") else {
        return false;
    };
    let mut components = relative.components();

    matches!(components.next(), Some(Component::Normal(_)))
        && matches!(components.next(), Some(Component::Normal(_)))
        && matches!(components.next(), Some(Component::Normal(value)) if value == "T")
        && matches!(components.next(), Some(Component::Normal(value)) if value == "AppTranslocation")
        && matches!(components.next(), Some(Component::Normal(_)))
        && matches!(components.next(), Some(Component::Normal(value)) if value == "d")
        && components.next().is_some()
}

pub fn evaluate_executable(executable: &Path) -> LaunchDisposition {
    if is_app_translocated(executable) {
        LaunchDisposition::Exit
    } else {
        LaunchDisposition::Continue
    }
}

pub fn enforce_before_initialization() -> LaunchDisposition {
    clash_verge_i18n::sync_locale(None);

    let executable = match std::env::current_exe() {
        Ok(executable) => executable,
        Err(error) => {
            let message = clash_verge_i18n::t!("launchGuard.currentExeError").replace("{error}", &error.to_string());
            show_message(&message);
            return LaunchDisposition::Exit;
        }
    };

    if evaluate_executable(&executable) == LaunchDisposition::Exit {
        show_message(&clash_verge_i18n::t!("launchGuard.translocated"));
        return LaunchDisposition::Exit;
    }

    LaunchDisposition::Continue
}

fn show_message(message: &str) {
    let ok_button = clash_verge_i18n::t!("launchGuard.ok");
    let script = format!(
        "display dialog \"{}\" buttons {{\"{}\"}} default button \"{}\" with icon caution",
        escape_osascript(message),
        escape_osascript(ok_button.as_ref()),
        escape_osascript(ok_button.as_ref())
    );
    let _ = std::process::Command::new("/usr/bin/osascript")
        .args(["-e", &script])
        .status();
}

fn escape_osascript(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n")
}

#[cfg(test)]
mod tests {
    use super::{LaunchDisposition, escape_osascript, evaluate_executable};
    use std::path::Path;

    #[test]
    fn rejects_canonical_app_translocation_path() {
        let executable = Path::new(
            "/private/var/folders/wk/example/T/AppTranslocation/123/d/Clash Verge.app/Contents/MacOS/Clash Verge",
        );

        assert_eq!(evaluate_executable(executable), LaunchDisposition::Exit);
    }

    #[test]
    fn ignores_similar_but_non_translocated_component() {
        let executable = Path::new("/Applications/AppTranslocation Backup/Clash Verge.app/Contents/MacOS/Clash Verge");

        assert_eq!(evaluate_executable(executable), LaunchDisposition::Continue);
    }

    #[test]
    fn allows_regular_install_inside_app_translocation_named_directory() {
        let executable = Path::new("/Applications/AppTranslocation/Clash Verge.app/Contents/MacOS/Clash Verge");

        assert_eq!(evaluate_executable(executable), LaunchDisposition::Continue);
    }

    #[test]
    fn escapes_osascript_dialog_text() {
        assert_eq!(escape_osascript("line 1\n\\\"line 2\""), "line 1\\n\\\\\\\"line 2\\\"");
    }
}
