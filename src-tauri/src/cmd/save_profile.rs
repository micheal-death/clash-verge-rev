use super::CmdResult;
use crate::{
    cmd::StringifyErr as _,
    cmd::validate::{ValidationNoticeTarget, handle_validation_notice},
    config::{Config, IProfiles, PrfItem},
    core::{
        CoreManager, handle,
        validate::{CoreConfigValidator, ValidationOutcome},
    },
    module::auto_backup::{AutoBackupManager, AutoBackupTrigger},
    utils::dirs,
};
use clash_verge_logging::{Type, logging};
use serde::Deserialize;
use smartstring::alias::String;
use tokio::fs;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileOverlayFilePatch {
    index: String,
    file_data: String,
}

struct ProfileOverlayFileSaveContext {
    file_data: String,
    original_content: String,
    file_path: std::path::PathBuf,
    file_path_str: String,
    is_merge_file: bool,
    is_script_file: bool,
    affects_runtime: bool,
}

/// 保存profiles的配置
#[tauri::command]
pub async fn save_profile_file(index: String, file_data: Option<String>) -> CmdResult<ValidationOutcome> {
    let file_data = match file_data {
        Some(d) => d,
        None => return Ok(ValidationOutcome::Valid),
    };

    let backup_trigger = match index.as_str() {
        "Merge" => Some(AutoBackupTrigger::GlobalMerge),
        "Script" => Some(AutoBackupTrigger::GlobalScript),
        _ => None,
    };

    // 在异步操作前获取必要元数据并释放锁
    let (rel_path, is_merge_file, is_script_file, affects_runtime) = {
        let profiles = Config::profiles().await;
        let profiles_guard = profiles.latest_arc();
        let item = profiles_guard.get_item(&index).stringify_err()?;
        let is_merge = item.itype.as_ref().is_some_and(|t| t == "merge");
        let path = item.file.clone().ok_or("file field is null")?;
        let is_script = item.itype.as_ref().is_some_and(|t| t == "script") || path.ends_with(".js");
        let affects_runtime = profile_affects_runtime(&profiles_guard, &index);
        (path, is_merge, is_script, affects_runtime)
    };

    // 读取原始内容（在释放profiles_guard后进行）
    let original_content = PrfItem {
        file: Some(rel_path.clone()),
        ..Default::default()
    }
    .read_file()
    .await
    .stringify_err()?;

    let profiles_dir = dirs::app_profiles_dir().stringify_err()?;
    let file_path = profiles_dir.join(rel_path.as_str());
    let file_path_str = file_path.to_string_lossy().to_string();

    // 保存新的配置文件
    fs::write(&file_path, &file_data).await.stringify_err()?;

    logging!(
        info,
        Type::Config,
        "[cmd配置save] 开始验证配置文件: {}, 是否为merge文件: {}",
        file_path_str,
        is_merge_file
    );

    let changes_applied = handle_saved_profile_file(
        &file_path_str,
        &file_path,
        &original_content,
        is_merge_file,
        is_script_file,
        affects_runtime,
    )
    .await?;

    if changes_applied.is_valid()
        && let Some(trigger) = backup_trigger
    {
        AutoBackupManager::trigger_backup(trigger);
    }

    Ok(changes_applied)
}

#[tauri::command]
pub async fn save_profile_overlay_files(files: Vec<ProfileOverlayFilePatch>) -> CmdResult<ValidationOutcome> {
    if files.is_empty() {
        return Ok(ValidationOutcome::Valid);
    }

    let mut contexts = Vec::with_capacity(files.len());
    for file in files {
        contexts.push(prepare_profile_overlay_file_save(file.index, file.file_data).await?);
    }

    for context in &contexts {
        fs::write(&context.file_path, &context.file_data)
            .await
            .stringify_err()?;
    }

    for context in &contexts {
        logging!(
            info,
            Type::Config,
            "[cmd配置save] 开始批量文件验证: {}",
            context.file_path_str
        );

        match CoreConfigValidator::validate_config_file_outcome(&context.file_path_str, Some(context.is_merge_file))
            .await
        {
            Ok(outcome) if outcome.is_valid() => {
                logging!(
                    info,
                    Type::Config,
                    "[cmd配置save] 批量文件验证通过: {}",
                    context.file_path_str
                );
            }
            Ok(outcome) => {
                logging!(warn, Type::Config, "[cmd配置save] 批量文件验证失败: {}", outcome);
                restore_profile_file_contexts(&contexts).await?;
                handle_validation_notice(
                    &outcome,
                    validation_notice_target(context),
                    validation_file_type(context),
                );
                return Ok(outcome);
            }
            Err(err) => {
                logging!(error, Type::Config, "[cmd配置save] 批量验证过程发生错误: {}", err);
                restore_profile_file_contexts(&contexts).await?;
                return Err(err.to_string().into());
            }
        }
    }

    if !contexts.iter().any(|context| context.affects_runtime) {
        return Ok(ValidationOutcome::Valid);
    }

    logging!(
        info,
        Type::Config,
        "[cmd配置save] 批量保存项影响当前运行时配置，开始统一应用"
    );
    match CoreManager::global().update_config_forced().await {
        Ok(outcome) if outcome.is_valid() => {
            handle::Handle::refresh_clash();
            Ok(ValidationOutcome::Valid)
        }
        Ok(outcome) => {
            logging!(warn, Type::Config, "[cmd配置save] 批量运行时配置应用失败: {}", outcome);
            restore_profile_file_contexts(&contexts).await?;
            handle_validation_notice(&outcome, ValidationNoticeTarget::Runtime, "运行时配置");
            Ok(outcome)
        }
        Err(err) => {
            logging!(error, Type::Config, "[cmd配置save] 批量运行时配置应用错误: {}", err);
            restore_profile_file_contexts(&contexts).await?;
            Err(err.to_string().into())
        }
    }
}

async fn restore_original(file_path: &std::path::Path, original_content: &str) -> Result<(), String> {
    fs::write(file_path, original_content).await.stringify_err()
}

async fn restore_profile_file_contexts(contexts: &[ProfileOverlayFileSaveContext]) -> CmdResult {
    for context in contexts {
        restore_original(&context.file_path, &context.original_content).await?;
    }

    Ok(())
}

async fn prepare_profile_overlay_file_save(
    index: String,
    file_data: String,
) -> CmdResult<ProfileOverlayFileSaveContext> {
    let (rel_path, is_merge_file, is_script_file, affects_runtime) = {
        let profiles = Config::profiles().await;
        let profiles_guard = profiles.latest_arc();
        let item = profiles_guard.get_item(&index).stringify_err()?;
        let is_overlay_file = item
            .itype
            .as_ref()
            .is_some_and(|t| matches!(t.as_str(), "rules" | "proxies" | "groups"));
        if !is_overlay_file {
            return Err("save_profile_overlay_files only supports rules/proxies/groups overlay files".into());
        }
        let is_merge = item.itype.as_ref().is_some_and(|t| t == "merge");
        let path = item.file.clone().ok_or("file field is null")?;
        let is_script = item.itype.as_ref().is_some_and(|t| t == "script") || path.ends_with(".js");
        let affects_runtime = profile_affects_runtime(&profiles_guard, &index);
        (path, is_merge, is_script, affects_runtime)
    };

    let original_content = PrfItem {
        file: Some(rel_path.clone()),
        ..Default::default()
    }
    .read_file()
    .await
    .stringify_err()?;

    let profiles_dir = dirs::app_profiles_dir().stringify_err()?;
    let file_path = profiles_dir.join(rel_path.as_str());
    let file_path_str = file_path.to_string_lossy().to_string();

    Ok(ProfileOverlayFileSaveContext {
        file_data,
        original_content,
        file_path,
        file_path_str: file_path_str.into(),
        is_merge_file,
        is_script_file,
        affects_runtime,
    })
}

const fn validation_notice_target(context: &ProfileOverlayFileSaveContext) -> ValidationNoticeTarget {
    if context.is_script_file {
        ValidationNoticeTarget::Script
    } else if context.is_merge_file {
        ValidationNoticeTarget::Merge
    } else {
        ValidationNoticeTarget::Runtime
    }
}

const fn validation_file_type(context: &ProfileOverlayFileSaveContext) -> &'static str {
    if context.is_script_file {
        "脚本文件"
    } else if context.is_merge_file {
        "合并配置文件"
    } else {
        "YAML配置文件"
    }
}

fn profile_affects_runtime(profiles: &IProfiles, index: &str) -> bool {
    let Some(current_uid) = profiles.get_current() else {
        return false;
    };
    if current_uid == index {
        return true;
    }

    let Ok(item) = profiles.get_item(current_uid) else {
        return false;
    };
    [
        item.current_merge().map_or("Merge", String::as_str),
        item.current_script().map_or("Script", String::as_str),
        item.current_rules().map_or("Rules", String::as_str),
        item.current_proxies().map_or("Proxies", String::as_str),
        item.current_groups().map_or("Groups", String::as_str),
    ]
    .contains(&index)
}

async fn handle_saved_profile_file(
    file_path_str: &str,
    file_path: &std::path::Path,
    original_content: &str,
    is_merge_file: bool,
    is_script_file: bool,
    affects_runtime: bool,
) -> CmdResult<ValidationOutcome> {
    let (target, file_type) = if is_script_file {
        (ValidationNoticeTarget::Script, "脚本文件")
    } else if is_merge_file {
        (ValidationNoticeTarget::Merge, "合并配置文件")
    } else {
        (ValidationNoticeTarget::Runtime, "YAML配置文件")
    };

    logging!(
        info,
        Type::Config,
        "[cmd配置save] 开始{}验证: {}",
        file_type,
        file_path_str
    );

    match CoreConfigValidator::validate_config_file_outcome(file_path_str, Some(is_merge_file)).await {
        Ok(outcome) if outcome.is_valid() => {
            logging!(info, Type::Config, "[cmd配置save] 文件验证通过: {}", file_path_str);
        }
        Ok(outcome) => {
            logging!(warn, Type::Config, "[cmd配置save] 文件验证失败: {}", outcome);
            restore_original(file_path, original_content).await?;
            handle_validation_notice(&outcome, target, file_type);
            return Ok(outcome);
        }
        Err(e) => {
            logging!(error, Type::Config, "[cmd配置save] 验证过程发生错误: {}", e);
            restore_original(file_path, original_content).await?;
            return Err(e.to_string().into());
        }
    }

    if !affects_runtime {
        return Ok(ValidationOutcome::Valid);
    }

    logging!(
        info,
        Type::Config,
        "[cmd配置save] 保存项影响当前运行时配置，开始统一应用"
    );
    match CoreManager::global().update_config_forced().await {
        Ok(outcome) if outcome.is_valid() => {
            handle::Handle::refresh_clash();
            Ok(ValidationOutcome::Valid)
        }
        Ok(outcome) => {
            logging!(warn, Type::Config, "[cmd配置save] 运行时配置应用失败: {}", outcome);
            restore_original(file_path, original_content).await?;
            handle_validation_notice(&outcome, ValidationNoticeTarget::Runtime, "运行时配置");
            Ok(outcome)
        }
        Err(err) => {
            logging!(error, Type::Config, "[cmd配置save] 运行时配置应用错误: {}", err);
            restore_original(file_path, original_content).await?;
            Err(err.to_string().into())
        }
    }
}
