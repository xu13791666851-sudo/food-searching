# 今天吃什么

一个手机优先的食物决策原型，用来验证“今天不知道吃什么时，能不能更快做决定”。

## 当前功能

- 在家吃 / 外面吃两个入口
- 在家吃支持：
  - 从做过的菜里挑
  - 上传保存菜品图
  - 编辑或删除菜品
  - 按今天偏好推荐家常菜
- 外面吃支持模拟附近餐厅推荐
- 结果页支持朋友提交简单反馈

## 试用方式

直接打开 `index.html` 就能使用。

## 部署到 Cloudflare Pages

推荐方式：代码放到 GitHub，Cloudflare Pages 连接这个 GitHub 仓库自动部署。

Cloudflare Pages 设置：

- Framework preset：None
- Build command：留空
- Build output directory：留空或填 `/`
- Root directory：仓库根目录

部署成功后，Cloudflare 会生成一个 `pages.dev` 链接，可以发给朋友试用。

## 注意

当前菜品和反馈会保存在使用者自己的浏览器里。也就是说，朋友提交反馈后，你不会自动集中看到所有人的反馈。后续可以接在线表单或数据库来统一收集。
