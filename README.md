部署步骤
1、打开cloudflare控制台，展开菜单"存储和数据库"，点击"D1 SQL数据库"，点击右上角的"创建数据库按钮"，数据名称"vps-monitor-db"后，点击创建按钮；
2、打开刚刚创建的数据库，点击上方菜单的"控制台"标签，依次执行vps-monitor-db.ddl中的SQL语句，最后一个SQL是创建用户的SQL，默认用户是admin，默认密码是123456，可以修改SQL中的用户名后再执行；
3、打开cloudflare控制台，展开菜单"Compute"，点击"Workers和Pages"，点击"创建应用程序"，点击"从Hello World!开始"，可自定义名称"Worker name"，点击"部署按钮"；
4、打开刚刚创建的worker，在绑定窗口点击"+"绑定D1数据库，变量名称输入"DB"，选择刚刚创建的数据库；
5、打开刚刚创建的worker，点击右上角的"编辑代码"按钮，将worker.js复制到代码框，点击右上角的"部署"按钮；
6、打开刚刚创建的worker，点击上方菜单的"设置"标签，添加"触发事件"，选择"Cron触发器"，执行频率选择1分钟，点击"添加"按钮；
7、复制设置界面的workers.dev值，打开该网址，点击右上角的登录按钮，登录后可自行修改密码。
国内访问workers：
https://langliu.github.io/posts/cloudflare-workers-in-china/
