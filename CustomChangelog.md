## v2.5.2 Custom AutoBuild

### ✨ 功能改进

- **Surge 风格 Rules 管理**
  - 支持通过表单新增和编辑标准规则、`AND` / `OR` / `NOT` 逻辑规则。
  - 逻辑规则支持嵌套添加子规则，子规则弹窗会自动禁用 policy 选择。
  - 每条规则支持启用 / 禁用，适合临时测试复杂规则。
  - 原始配置规则不会被直接改写；禁用、恢复、替换会写入本地 overlay。
  - 最后一条 `MATCH` 作为兜底规则锁定，只允许修改 policy。

- **Effective Profile 最终配置视图**
  - Rules 页面现在基于 base profile、本地 overlay、runtime 配置合并后的有效规则渲染。
  - 规则来源会区分为 Manual、Config、Runtime 和 Disabled Config，并按来源限制可执行操作。
  - Policy 下拉会读取最终有效命名空间，本地新增的代理组可以立即被规则选择。
  - Profiles 页面新增 `View Effective Config`，可只读查看最终合并后的配置。

- **手动代理和代理组管理**
  - Proxies 页面支持新增、编辑、复制、删除本地手动代理节点。
  - 支持新增、编辑、复制、删除本地手动代理组。
  - 手动代理和代理组写入本地 overlay，不直接修改订阅原文。
  - 删除代理或代理组前会检查规则引用和代理组引用，避免产生无效策略。

- **Connections 快捷添加规则**
  - 连接列表支持从当前连接快速生成 `DOMAIN`、`IP-CIDR` / `IP-CIDR6`、`PROCESS-PATH` 规则。
  - 选择后会跳转到 Rules 页面，并自动打开规则弹窗填充表单。
