
# Queen(WIP)

> 一个用js的多线程实现的service框架

## Ant

> 业务逻辑的最小单位，整个系统由无数的ant组成

+ 隔离：每个ant之间不会互相影响
+ 联通：每个ant之间，可以通过post传递消息
+ 事件：它是一个EventEmitter对象
+ spawn：创建一个ant，与自己可能不在同一个worker
+ post：向另外一个ant发送信息

### Ant消息类型

+ start：启动命令
+ exit：退出命令，暂未实现
+ error：发生错误（未定）

## Worker

> 一条线程，用于真正驱动Ant

+ spawn：本地创建一个ant
+ gspawn：由queen决策谁来创建ant

## 启动过程

+ 创建worker：根据配置中的worker数量创建worker
+ 互联互通：联通每个worker
+ 创建boot：创建第一个ant

```bash
node ./lib/bin.js config.js
```

## 配置

+ workers：worker的数量，默认为os.cpus().length
+ search：创建ant时的模板寻找路径
+ boot：第一个ant的启动参数
