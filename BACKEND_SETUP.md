# 后端反馈收集设置

当前新增了一个反馈接口：`/api/feedback`。

它适合部署在 Cloudflare Pages Functions 上，用来收集朋友试用后的反馈。

## 需要在 Cloudflare 设置两项

1. 创建一个 KV 数据库

名字可以叫：

```text
food-feedback
```

2. 在 Cloudflare Pages 项目里绑定 KV

绑定变量名必须是：

```text
FOOD_FEEDBACK
```

3. 再添加一个环境变量

变量名：

```text
FEEDBACK_ADMIN_TOKEN
```

变量值你自己设一个不容易猜到的字符串，例如：

```text
my-food-secret-2026
```

## 朋友怎么提交反馈

朋友正常打开网页，走完推荐流程，点“保存反馈”就会自动提交。

如果后端暂时没配置好，页面会自动保存在朋友自己的浏览器里，并提示可以复制反馈发给你。

## 你怎么看反馈

部署后打开：

```text
https://你的域名/api/feedback?token=你设置的FEEDBACK_ADMIN_TOKEN
```

例如：

```text
https://food-searching.xu13791666851.workers.dev/api/feedback?token=my-food-secret-2026
```

如果配置成功，会看到朋友提交过的反馈数据。

## 更方便的反馈看板

现在也可以打开：

```text
https://你的域名/admin.html
```

输入 `FEEDBACK_ADMIN_TOKEN` 后，就能看到反馈总数、愿意吃的比例、推荐准不准、流程感受和具体留言。

## 接入真实附近餐厅

外面吃推荐已经支持通过高德地图读取附近真实餐厅。

需要在 Cloudflare Pages 项目里添加环境变量：

```text
AMAP_KEY
```

变量值填写你在高德开放平台创建的 `Web服务` Key。

保存后重新部署，用户在“外面吃”流程里授权定位后，页面会优先展示附近真实餐厅。如果用户拒绝定位，或者高德接口暂时失败，页面会自动回退到模拟推荐，不会影响试用。
