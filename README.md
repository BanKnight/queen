# queen-core(WIP)

> 用 vue 的方式写服务端，并且自带多线程 rpc等功能

## Hooks

> 生命周期函数

```javascript
export default {
    hooks:{
        start()
        {
            console.log("ant.start",this.$ant.template)

            this.$ant.setTimeout(console.log,5000,"timeout timer")
        },
        stop()
        {
            console.log("ant.stop",this.$ant.template)
        }
    },
}
```

## 定时器

> 系统自动注册定时器实现

```javascript
export default {
    data()
    {
        return {
            count:0
        }
    },
    hooks:{
        start()
        {
            this.$ant.setTimeout(console.log,5000,"timeout timer")
        },
    },
    timers:{
        "1s": {
            interval: 1000,
            handler()
            {
                console.log("1s", ++this.count)
            }
        }
    }
}
```

## 概念

+ Application:系统启动类，管理多个线程worker
+ WorkerApplication：某个worker管理类
+ Ant：一个实体,可用于挂载多个实体
+ Component：挂载在Ant的组件，组件可以嵌套

## RPC

+ client
  ```javascript
  export default {
      hooks:{
          async start()
          {
              console.log("ant.start",this.$ant.template)

              this.server = await this.$ant.spawn("rpc-server", {
                  props: {
                      name: "server"
                  }
              })

              const back = await this.$ant.call(this.server, "echo", "hello")

              console.log("get back", back)
          },
          stop()
          {
              console.log("ant.stop",this.$ant.template)
          }
      },
  }
  ```
+ server
  ```javascript
  export default {
      props: {
          name: "unknown name"
      },
      hooks: {
          async start()
          {
              console.log("this is", this.name)
          }
      },
      remotes: {
          echo(from)
          {
              return from + " world"
          }
      }
  }
  ```

## 设计大纲

[设计大纲](设计大纲.md)
