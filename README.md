部署步骤<br>
1、打开cloudflare控制台，展开菜单"存储和数据库"，点击"D1 SQL数据库"，点击右上角的"创建数据库按钮"，数据名称"vps-monitor-db"后，点击创建按钮；<br>
2、打开刚刚创建的数据库，点击上方菜单的"控制台"标签，依次执行vps-monitor-db.ddl中的SQL语句，最后一个SQL是创建用户的SQL，默认用户是admin，默认密码是123456，可以修改SQL中的用户名后再执行；<br>
3、打开cloudflare控制台，展开菜单"Compute"，点击"Workers和Pages"，点击"创建应用程序"，点击"从Hello World!开始"，可自定义名称"Worker name"，点击"部署按钮"；<br>
4、打开刚刚创建的worker，在绑定窗口点击"+"绑定D1数据库，变量名称输入"DB"，选择刚刚创建的数据库；<br>
5、打开刚刚创建的worker，点击右上角的"编辑代码"按钮，将worker.js复制到代码框，点击右上角的"部署"按钮；<br>
6、打开刚刚创建的worker，点击上方菜单的"设置"标签，添加"触发事件"，选择"Cron触发器"，执行频率选择1分钟，点击"添加"按钮；<br>
7、复制设置界面的workers.dev值，打开该网址，点击右上角的登录按钮，登录后可自行修改密码。<br>
国内访问workers：<br>
1、在cloudflare域中选择一个已绑定的域名，配置DNS，添加记录，类型选择CNAME，名称自行定义，内容填写CF优选域名（例如：www.cloudflare.19931110.xyz），点击保存<br>
2、打开刚刚创建的worker，点击上方菜单的"设置"标签，添加"域和路由"，选择区域，配置路由。如域名为xxx.com，DNS名称为www，路由可以填"www.xxx.com/*"<br>
3、使用刚刚配置的路由地址，访问vps-monitor<br>
