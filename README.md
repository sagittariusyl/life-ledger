# 生活记账

生活记账是一个运行在自己电脑上的账本，支持导入微信、支付宝账单，按月份查看收支。账单由浏览器在本机解析并保存在浏览器的 IndexedDB 中。

## 安装与部署

1. 安装 [Node.js 22 LTS](https://nodejs.org/)，安装完成后重新打开终端。
2. 在本页面点击 **Code → Download ZIP**，解压文件；也可以运行 `git clone https://github.com/sagittariusyl/life-ledger.git`。
3. 在解压后的项目目录打开终端，依次运行：

   ```bash
   npm install
   npm run build
   ```

4. 启动应用：
   - **Windows**：双击项目内的 `打开生活记账.vbs`，自动打开浏览器。
   - **macOS / Linux**：在项目目录运行 `node serve.cjs`，然后在 30 秒内打开 <http://localhost:5175/>。

关闭最后一个账本页面后，本地服务约 3 秒退出。再次使用时重新启动即可，日常启动无需重复安装和构建。若提示端口占用，请关闭占用 5175 端口的程序后重试。

## 使用与数据

点击“导入账单”选择微信或支付宝导出的 CSV、XLSX、XLS 文件，核对预览后保存；也可以手动记账。账目按交易日期自动归入月份，按来源和交易单号去重。总消费为支出减收入，不计收支的记录不纳入统计。

每个人的账本保存在自己使用的浏览器和地址中，下载项目后需要自行导入账单。换浏览器、换地址或清理网站数据会影响原有账本的读取，请使用侧栏的“导出备份”定期保存数据。当前仅支持导出备份。

## 开发与验证

开发时运行 `npm run dev`，修改代码后运行 `npm run build` 更新日常启动页面。先构建，再运行 `npm test` 执行测试。

## 来源与许可

本项目按 [GNU GPL-3.0](LICENSE) 许可发布。内置分类关键词部分改编自 [Narymax_AutoAccount 的 classify_keywords_list.py](https://github.com/Narymax/Narymax_AutoAccount/blob/main/classify_keywords_list.py)，已合并一级分类并去除示例占位词；原项目使用 GPL-3.0。
