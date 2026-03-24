export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 静态资源路由
    if (path === '/' || path === '/dashboard') {
      return handleDashboard(request, env);
    } else if (path === '/login') {
      return handleLoginPage();
    } else if (path === '/api/login' && method === 'POST') {
      return handleLoginApi(request, env);
    } else if (path === '/api/logout') {
      return handleLogout(request, env);
    } else if (path === '/ws') {
      return handleWebSocket(request, env, ctx);
    } else if (path === '/api/nodes-stream' && method === 'GET') {
      return handleNodesStream(request, env, ctx);
    } else if (path === '/api/nodes' && method === 'POST') {
      return handleAddNode(request, env);
    } else if (path.startsWith('/api/nodes/') && method === 'DELETE') {
      const id = path.split('/')[3];
      return handleDeleteNode(request, env, id);
    } else if (path.startsWith('/api/nodes/') && method === 'PUT') {
      const id = path.split('/')[3];
      return handleUpdateNode(request, env, id);
    } else if (path === '/deploy-agent' && method === 'GET') {
      return handleDeployScript(request, env);
    } else if (path.startsWith('/api/node-token/') && method === 'GET') {
      const id = path.split('/')[3];
      return handleGetNodeToken(request, env, id);
    } else if (path === '/api/change-password' && method === 'POST') {
      return handleChangePassword(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
  async scheduled(event, env, ctx) {
    // 每分钟清理过期 sessions
    await cleanupExpiredSessions(env);
    // 定时任务逻辑
    await checkHeartbeat(env);
  }
};

// 认证辅助函数
async function verifyAuth(request, env) {
  const cookies = request.headers.get('Cookie');
  const sessionId = cookies?.match(/session=([^;]+)/)?.[1];
  
  if (!sessionId) return false;
  
  const session = await verifySession(env, sessionId);
  return session !== null;
}

// 如果需要获取当前用户信息
async function getCurrentUser(request, env) {
  const cookies = request.headers.get('Cookie');
  const sessionId = cookies?.match(/session=([^;]+)/)?.[1];
  
  if (!sessionId) return null;
  
  const session = await verifySession(env, sessionId);
  if (!session) return null;
  
  const user = await env.DB.prepare('SELECT id, username FROM users WHERE id = ?')
    .bind(session.user_id).first();
  return user;
}

// 生成随机 session ID
function generateSessionId() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 创建新 session
async function createSession(env, userId) {
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7天过期
    await env.DB.prepare(`
        INSERT INTO sessions (session_id, user_id, expires_at)
        VALUES (?, ?, ?)
    `).bind(sessionId, userId, expiresAt).run();
    return sessionId;
}

// 验证 session
async function verifySession(env, sessionId) {
    if (!sessionId) return null;
    const session = await env.DB.prepare(`
        SELECT user_id, expires_at FROM sessions 
        WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP
    `).bind(sessionId).first();
    return session;
}

// 删除 session（登出）
async function deleteSession(env, sessionId) {
    await env.DB.prepare('DELETE FROM sessions WHERE session_id = ?').bind(sessionId).run();
}

// 清理过期 sessions（可选，可在定时任务中执行）
async function cleanupExpiredSessions(env) {
    await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP').run();
}

// 登录页面 HTML
function handleLoginPage() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VPS Monitor - 登录</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e2e8f0;
        }
        .login-container {
            background: rgba(30, 41, 59, 0.8);
            backdrop-filter: blur(12px);
            border-radius: 2rem;
            padding: 2.5rem;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .logo {
            text-align: center;
            margin-bottom: 2rem;
        }
        .logo h1 {
            font-size: 2rem;
            background: linear-gradient(135deg, #60a5fa, #a78bfa);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            margin-bottom: 0.5rem;
        }
        .logo p {
            color: #94a3b8;
            font-size: 0.875rem;
        }
        .form-group {
            margin-bottom: 1.5rem;
        }
        label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
            color: #cbd5e1;
        }
        input {
            width: 100%;
            padding: 0.75rem 1rem;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 0.75rem;
            color: #f1f5f9;
            font-size: 1rem;
            transition: all 0.2s;
        }
        input:focus {
            outline: none;
            border-color: #60a5fa;
            box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
        }
        button {
            width: 100%;
            padding: 0.75rem;
            background: linear-gradient(135deg, #60a5fa, #a78bfa);
            border: none;
            border-radius: 0.75rem;
            color: white;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, opacity 0.2s;
        }
        button:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        .error {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid #ef4444;
            color: #fecaca;
            padding: 0.75rem;
            border-radius: 0.75rem;
            margin-top: 1rem;
            font-size: 0.875rem;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>VPS Monitor</h1>
            <p>服务器状态监控系统</p>
        </div>
        <form id="loginForm">
            <div class="form-group">
                <label>用户名</label>
                <input type="text" id="username" required autofocus>
            </div>
            <div class="form-group">
                <label>密码</label>
                <input type="password" id="password" required>
            </div>
            <button type="submit">登录</button>
            <div id="errorMsg" class="error" style="display: none;"></div>
        </form>
    </div>
    <script>
        // 在登录页面添加密码哈希
        async function hashPasswordClient(password) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('errorMsg');

            // 前端哈希
            const hashedPassword = await hashPasswordClient(password);
            
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password: hashedPassword })
                });
                if (res.ok) {
                    window.location.href = '/dashboard';
                } else {
                    const data = await res.json();
                    errorDiv.textContent = data.error || '登录失败';
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                errorDiv.textContent = '网络错误，请稍后重试';
                errorDiv.style.display = 'block';
            }
        });
    </script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}

// 登录 API
async function handleLoginApi(request, env) {
  try {
    const { username, password } = await request.json();
    const user = await env.DB.prepare('SELECT id, password_hash FROM users WHERE username = ?')
      .bind(username).first();
    
    if (!user) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    
    // 验证密码（使用之前实现的 verifyPassword）
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (isValid) {
      // 创建 session
      const sessionId = await createSession(env, user.id);
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800` // 7天
        }
      });
    } else {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err) {
    console.error('登录错误:', err);
    return new Response(JSON.stringify({ error: '服务器错误' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 密码哈希函数（使用 PBKDF2）
async function hashPassword(password) {
    // 生成 16 字节随机盐
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iterations = 100000;
    
    // 导入密码作为密钥
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    
    // 派生 256 位哈希
    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: iterations,
            hash: 'SHA-256'
        },
        key,
        256
    );
    
    // 转换为十六进制字符串
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // 存储格式: pbkdf2:sha256:iterations:salt:hash
    return `pbkdf2:sha256:${iterations}:${saltHex}:${hashHex}`;
}

// 验证密码
async function verifyPassword(password, storedHash) {
    if (!storedHash) return false;
    
    // 解析存储格式
    const parts = storedHash.split(':');
    if (parts[0] !== 'pbkdf2') return false;
    
    const iterations = parseInt(parts[2]);
    const saltHex = parts[3];
    const originalHashHex = parts[4];
    
    // 还原盐
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    
    // 导入密码
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    
    // 派生哈希
    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: iterations,
            hash: 'SHA-256'
        },
        key,
        256
    );
    
    // 转换为十六进制比较
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex === originalHashHex;
}

// 登出
async function handleLogout(request, env) {
  const cookies = request.headers.get('Cookie');
  const sessionId = cookies?.match(/session=([^;]+)/)?.[1];
  
  if (sessionId) {
    await deleteSession(env, sessionId);
  }
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/dashboard',
      'Set-Cookie': 'session=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
  });
}

async function handleChangePassword(request, env) {
    try {
        // 验证登录状态
        const isAuth = await verifyAuth(request, env);
        if (!isAuth) {
            return new Response(JSON.stringify({ error: '未登录' }), 
                { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        
        // 获取当前用户
        const user = await getCurrentUser(request, env);
        if (!user) {
            return new Response(JSON.stringify({ error: '用户不存在' }), 
                { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        
        // 解析请求体
        const { oldPassword, newPassword } = await request.json();
        
        if (!oldPassword || !newPassword) {
            return new Response(JSON.stringify({ error: '请填写完整信息' }), 
                { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        
        if (newPassword.length < 6) {
            return new Response(JSON.stringify({ error: '新密码长度至少6位' }), 
                { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        
        // 获取用户当前的密码哈希
        const userData = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
            .bind(user.id).first();
        
        // 验证旧密码
        const isValid = await verifyPassword(oldPassword, userData.password_hash);
        if (!isValid) {
            return new Response(JSON.stringify({ error: '原密码错误' }), 
                { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        
        // 生成新密码哈希
        const newPasswordHash = await hashPassword(newPassword);
        
        // 更新数据库
        await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
            .bind(newPasswordHash, user.id).run();
        
        // 可选：删除该用户的所有 session，强制重新登录
        await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?')
            .bind(user.id).run();
        
        return new Response(JSON.stringify({ success: true, message: '密码修改成功，请重新登录' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (err) {
        console.error('修改密码错误:', err);
        return new Response(JSON.stringify({ error: '服务器错误' }), 
            { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

async function handleDashboard(request, env) {
    const isLoggedIn = await verifyAuth(request, env);
    let username = '';
    
    if (isLoggedIn) {
        const user = await getCurrentUser(request, env);
        username = user?.username || '用户';
    }
  
    // 获取节点数据（无论是否登录都返回）
    const nodes = await env.DB.prepare(`
    SELECT id, name, status, cpu_usage, memory_usage, disk_usage, memory_total, disk_total,
            network_rx_bytes, network_tx_bytes, network_rx_speed, network_tx_speed, uptime_seconds,
            billing_cycle, currency, price, expire_date, country_code
    FROM vps_nodes ORDER BY id DESC
    `).all();
    const nodesData = nodes.results;

    const html = generateDashboardHTML(isLoggedIn, username, nodesData);
    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

// 仪表板页面
function generateDashboardHTML(isLoggedIn, username, nodesData) {
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>VPS Monitor - 仪表板</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
        }
        .container {
            max-width: none;
            width: 80%;
            margin-left: auto;
            margin-right: auto;
            padding: 0 2rem;
            box-sizing: border-box;
        }
        /* 头部 */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            flex-wrap: wrap;
            gap: 1rem;
        }
        .title h1 {
            font-size: 1.875rem;
            background: linear-gradient(135deg, #60a5fa, #a78bfa);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        .title p {
            color: #94a3b8;
            margin-top: 0.25rem;
        }
        .actions {
            display: flex;
            gap: 1rem;
        }
        .btn {
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            font-size: 0.875rem;
        }
        .btn-primary {
            background: linear-gradient(135deg, #60a5fa, #a78bfa);
            color: white;
        }
        .btn-secondary {
            background: #334155;
            color: #e2e8f0;
        }
        .btn-danger {
            background: #dc2626;
            color: white;
        }
        .btn-outline {
            background: transparent;
            border: 1px solid #334155;
            color: #cbd5e1;
        }
        .btn-outline:hover {
            background: #334155;
        }
        /* 统计卡片 */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .stat-card {
            background: #1e293b;
            border-radius: 1rem;
            padding: 1.25rem;
            border: 1px solid #334155;
            transition: transform 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-2px);
        }
        .stat-card .stat-title {
            font-size: 0.875rem;
            color: #94a3b8;
            margin-bottom: 0.5rem;
        }
        .stat-card .stat-value {
            font-size: 2rem;
            font-weight: 500;
            color: #f1f5f9;
            line-height: 1.2;
        }
        .stat-card .stat-unit {
            font-size: 0.875rem;
            color: #64748b;
            margin-left: 0.25rem;
        }
        .stat-number {
            font-size: 2rem;
            font-weight: 700;
            color: #f1f5f9;
            line-height: 1.2;
        }
        .stat-number.small {
            font-size: 1.5rem;
        }
        .stat-sub {
            font-size: 0.75rem;
            color: #94a3b8;
            margin-top: 0.5rem;
        }
        .stat-progress {
            margin-top: 0.75rem;
            height: 4px;
            background: #334155;
            border-radius: 2px;
            overflow: hidden;
        }

        .stat-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981, #34d399);
            border-radius: 2px;
        }

        .region-tooltip {
            position: absolute;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 0.5rem;
            padding: 0.75rem;
            font-size: 0.75rem;
            color: #e2e8f0;
            z-index: 1000;
            max-width: 300px;
            word-break: break-all;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            pointer-events: none;
        }

        #nodesContainer {
            display: flex;
            flex-direction: column;
            width: 100%;
        }
        /* 卡片网格容器 */
        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 1.5rem;
            width: 100%;
        }

        /* 单个卡片 */
        .node-card {
            background: #1e293b;
            border-radius: 1rem;
            border: 1px solid #334155;
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .node-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            border-color: #60a5fa;
        }

        /* 卡片头部：名称 + 状态 */
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;      /* 改为 center，让子元素垂直居中 */
            padding: 1.25rem 1.25rem 0.75rem 1.25rem;
            background: #0f172a;
            border-bottom: 1px solid #334155;
        }
        .title-section {
            flex: 1;
        }
        .node-name {
            font-size: 1.5rem;
            font-weight: 700;
            color: #f1f5f9;
            margin: 0 0 0.5rem 0;
        }
        .badges-container {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: 600;
        }
        /* 价格徽章 - 紫色半透明背景 + 紫色边框 */
        .badge-price {
            background: rgba(139, 92, 246, 0.2);
            color: #c4b5fd;
        }

        /* 剩余天数徽章 - 根据天数动态变化 */
        .badge-days {
            background: rgba(100, 116, 139, 0.2);
            color: #94a3b8;
        }

        .badge-days.green {
            background: rgba(16, 185, 129, 0.2);
            color: #34d399;
        }

        .badge-days.yellow {
            background: rgba(245, 158, 11, 0.2);
            color: #fbbf24;
        }

        .badge-days.red {
            background: rgba(239, 68, 68, 0.2);
            color: #f87171;
        }
        
        /* 状态徽章（圆角正方形） */
        .status-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: 600;
            margin-top: 0.25rem;
        }
        .status-online {
            background: rgba(16, 185, 129, 0.2);
            color: #10b981;
        }
        .status-offline {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
        }
        .status-unknown {
            background: rgba(107, 114, 128, 0.2);
            color: #9ca3af;
        }
        * 价格和剩余天数区域 */
        .meta-info {
            padding: 0.75rem 1.25rem;
            display: flex;
            gap: 0.75rem;
            border-bottom: 1px solid #334155;
            background: #0f172a;
        }
        /* 卡片主体指标 */
        .card-stats {
            padding: 1rem 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .stat-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 1rem;
        }

        .stat-row.os-row {
            border-bottom: 1px solid #334155;
            padding-bottom: 0.5rem;
            margin-bottom: 0.5rem;
        }

        .stat-label {
            color: #94a3b8;
        }

        .stat-value {
            color: #e2e8f0;
            font-weight: 500;
            font-size: 1rem;
        }
        .meta-badge {
            background: #334155;
            border-radius: 0.25rem;
            padding: 0.25rem 0.5rem;
            font-size: 0.7rem;        /* 从 0.75rem 缩小 */
            color: #cbd5e1;
        }

        .meta-badge strong {
            color: #f1f5f9;
            margin-right: 0.25rem;
        }
        .metric-item {
            width: 100%;
        }

        .metric-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 0.25rem;
        }

        .metric-label {
            font-size: 1rem;
            font-weight: 600;
            color: #94a3b8;
        }

        .metric-percent {
            font-size: 1rem;
            font-weight: 500;
            color: #e2e8f0;
        }

        .metric-value {
            font-size: 0.85rem;
            color: #94a3b8;
            margin-bottom: 0.25rem;
        }
        .progress-bar {
            width: 100%;
            height: 6px;
            background: #334155;
            border-radius: 3px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 0.3s ease;
        }

        /* 默认绿色（0-60%） */
        .progress-fill.green {
            background: linear-gradient(90deg, #10b981, #34d399);
        }

        /* 橙色（60-85%） */
        .progress-fill.orange {
            background: linear-gradient(90deg, #f59e0b, #fbbf24);
        }

        /* 红色（85-100%） */
        .progress-fill.red {
            background: linear-gradient(90deg, #ef4444, #f87171);
        }

        .stat-value-with-bar {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.75rem;
        }
        /* 操作按钮 */
        .card-actions {
            padding: 0.25rem 1.25rem;
            border-top: 1px solid #334155;
            display: flex;
            justify-content: flex-end;
            gap: 0.5rem;
        }
        .action-buttons {
            display: flex;
            gap: 0.5rem;
        }
        .icon-btn {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1.25rem;
            padding: 0.25rem;
            border-radius: 0.375rem;
            transition: background 0.2s;
        }
        .icon-btn:hover {
            background: #334155;
        }
        /* 模态框 */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(4px);
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .modal-content {
            background: #1e293b;
            border-radius: 1rem;
            padding: 1.5rem;
            width: 90%;
            max-width: 500px;
            border: 1px solid #334155;
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1rem;
        }
        .form-group {
            margin-bottom: 1rem;
        }
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
        }
        .form-group input, .form-group select {
            width: 100%;
            padding: 0.5rem;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 0.5rem;
            color: white;
        }
        .success {
            background: rgba(16, 185, 129, 0.2);
            border: 1px solid #10b981;
            color: #10b981;
            padding: 0.75rem;
            border-radius: 0.75rem;
            font-size: 0.875rem;
            text-align: center;
        }
        /* 用户菜单样式 */
        .user-menu {
            position: relative;
            display: inline-block;
        }

        .user-menu-trigger {
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .user-menu-dropdown {
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 0.5rem;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 0.5rem;
            min-width: 140px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            display: none;
            overflow: hidden;
        }

        .user-menu-dropdown.show {
            display: block;
        }

        .dropdown-item {
            display: block;
            width: 100%;
            padding: 0.75rem 1rem;
            text-align: left;
            background: none;
            border: none;
            color: #e2e8f0;
            cursor: pointer;
            font-size: 0.875rem;
            transition: background 0.2s;
        }

        .dropdown-item:hover {
            background: #334155;
        }

        /* 响应式 */
        @media (max-width: 768px) {
            body {
                padding-bottom: env(safe-area-inset-bottom, 20px);
            }
            .container {
                width: 100%;
            }
            .cards-grid {
                grid-template-columns: 1fr;
            }
            .user-menu-dropdown {
                position: fixed;
                top: auto;
                right: 1rem;
                left: auto;
                min-width: 160px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">
                <h1>VPS Monitor</h1>
                <p>实时监控服务器状态</p>
            </div>
            <div class="actions">
                <div id="auth-buttons">
                    ${isLoggedIn ? `
                        <button class="btn btn-primary" id="addNodeBtn">+ 添加节点</button>
                        <div class="user-menu">
                            <button class="btn btn-outline user-menu-trigger" id="userMenuTrigger">
                                👤 <span id="usernameDisplay">${username}</span> ▼
                            </button>
                            <div class="user-menu-dropdown" id="userMenuDropdown">
                                <button class="dropdown-item" id="changePwdBtn">🔑 修改密码</button>
                                <button class="dropdown-item" id="logoutBtn">🚪 登出</button>
                            </div>
                        </div>
                    ` : `
                        <button class="btn btn-primary" id="loginBtn">🔐 登录</button>
                    `}
                </div>
            </div>
        </div>
        
        <div class="stats-grid" id="statsGrid">
            <!-- 节点统计 -->
            <div class="stat-card">
                <div class="stat-title">📊 节点统计</div>
                <div class="stat-number" id="nodeStats">-</div>
                <div class="stat-sub">在线 / 总计</div>
            </div>
            
            <!-- 地区统计 -->
            <div class="stat-card">
                <div class="stat-title">🌍 覆盖地区</div>
                <div class="stat-number" id="regionCount">-</div>
                <div class="stat-sub" id="regionList" title="">-</div>
            </div>
            
            <!-- 总流量 -->
            <div class="stat-card">
                <div class="stat-title">📥📤 总流量</div>
                <div class="stat-number small" id="totalTraffic">-</div>
                <div class="stat-sub" id="trafficDetail">上传 | 下载</div>
            </div>
            
            <!-- 总速度 -->
            <div class="stat-card">
                <div class="stat-title">⚡ 实时速度</div>
                <div class="stat-number small" id="totalSpeed">-</div>
                <div class="stat-sub" id="speedDetail">上传 | 下载</div>
            </div>
        </div>
        
        <div id="nodesContainer" class="cards-grid"></div>
    </div>
    
    <!-- 添加/编辑节点模态框 -->
    <div id="nodeModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="modalTitle">添加节点</h3>
                <button class="icon-btn" onclick="closeModal()">✕</button>
            </div>
            <form id="nodeForm">
                <input type="hidden" id="nodeId">
                <div class="form-group"><label>节点名称 *</label><input type="text" id="nodeName" required></div>
                <div class="form-group">
                    <label>续费周期</label>
                    <select id="billingCycle">
                        <option value="monthly">每月</option>
                        <option value="quarterly">每季</option>
                        <option value="yearly">每年</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>币种</label>
                    <select id="currency">
                        <option value="CNY">CNY</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="HKD">HKD</option>
                        <option value="JPY">JPY</option>
                        <option value="GBP">GBP</option>
                        <option value="KRW">KRW</option>
                        <option value="SGD">SGD</option>
                        <option value="TWD">TWD</option>
                        <option value="AUD">AUD</option>
                        <option value="CAD">CAD</option>
                        <option value="CHF">CHF</option>
                        <option value="RUB">RUB</option>
                        <option value="INR">INR</option>
                        <option value="BRL">BRL</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>价格</label>
                    <input type="number" step="0.01" id="price">
                </div>
                <div class="form-group">
                    <label>计费时区</label>
                    <select id="billingTimezone">
                        <option value="Pacific/Midway">Pacific/Midway (UTC-11)</option>
                        <option value="Pacific/Honolulu">Pacific/Honolulu (UTC-10)</option>
                        <option value="America/Anchorage">America/Anchorage (UTC-9)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                        <option value="America/Denver">America/Denver (UTC-7)</option>
                        <option value="America/Chicago">America/Chicago (UTC-6)</option>
                        <option value="America/New_York">America/New_York (UTC-5)</option>
                        <option value="America/Caracas">America/Caracas (UTC-4)</option>
                        <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires (UTC-3)</option>
                        <option value="America/Noronha">America/Noronha (UTC-2)</option>
                        <option value="Atlantic/Azores">Atlantic/Azores (UTC-1)</option>
                        <option value="UTC">UTC (UTC+0)</option>
                        <option value="Europe/London">Europe/London (UTC+1)</option>
                        <option value="Europe/Paris">Europe/Paris (UTC+2)</option>
                        <option value="Europe/Moscow">Europe/Moscow (UTC+3)</option>
                        <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                        <option value="Asia/Karachi">Asia/Karachi (UTC+5)</option>
                        <option value="Asia/Dhaka">Asia/Dhaka (UTC+6)</option>
                        <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
                        <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                        <option value="Australia/Sydney">Australia/Sydney (UTC+10)</option>
                        <option value="Pacific/Noumea">Pacific/Noumea (UTC+11)</option>
                        <option value="Pacific/Auckland">Pacific/Auckland (UTC+12)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>到期日期</label>
                    <input type="date" id="expireDate">
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;">保存</button>
                <div id="deploy-info" style="display: none;">
                    <hr>
                    <div>
                        <strong>📡 上报配置</strong><br>
                        <span style="font-size: 12px;">将此命令复制到您的 VPS 上执行，将自动安装上报服务（每2秒上报一次）：</span>
                        <div style="background: #0f172a; padding: 8px; border-radius: 6px; margin: 8px 0; display: flex; justify-content: space-between; align-items: center;">
                            <code id="deploy-command" style="color: #60a5fa; word-break: break-all;"></code>
                            <button type="button" onclick="copyDeployCommand()" class="btn btn-secondary" style="padding: 4px 8px; margin-left: 8px;">复制</button>
                        </div>
                        <div style="font-size: 12px; color: #94a3b8;">
                            💡 此脚本将安装 websocat，创建一个 systemd 服务，每2秒上报 CPU/内存/磁盘使用率。
                        </div>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <!-- 修改密码模态框 -->
    <div id="changePasswordModal" class="modal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3>修改密码</h3>
                <button class="icon-btn" onclick="closeChangePasswordModal()">✕</button>
            </div>
            <form id="changePasswordForm">
                <div class="form-group">
                    <label>原密码 *</label>
                    <input type="password" id="oldPassword" required>
                </div>
                <div class="form-group">
                    <label>新密码 *</label>
                    <input type="password" id="newPassword" required minlength="6">
                    <span style="font-size: 12px; color: #94a3b8;">至少6位</span>
                </div>
                <div class="form-group">
                    <label>确认新密码 *</label>
                    <input type="password" id="confirmPassword" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;">确认修改</button>
                <div id="changePwdError" class="error" style="display: none; margin-top: 1rem;"></div>
                <div id="changePwdSuccess" class="success" style="display: none; margin-top: 1rem;"></div>
            </form>
        </div>
    </div>
    
    <script>
        let nodes = [];
        let eventSource = null;
        const IS_LOGGED_IN = ${isLoggedIn};
        
        async function fetchNodes() {
            const res = await fetch('/api/nodes');
            nodes = await res.json();
            renderNodes();
            updateStats();
        }

        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }

        function getProgressColorClass(percent) {
            if (percent >= 85) return 'red';
            if (percent >= 60) return 'orange';
            return 'green';
        }

        function copyDeployCommand() {
            const commandElement = document.getElementById('deploy-command');
            if (!commandElement) {
                console.error('未找到部署命令元素');
                return;
            }
            const command = commandElement.innerText;
            if (!command) {
                console.error('命令为空');
                return;
            }
            navigator.clipboard.writeText(command).then(() => {
                // 可选：显示短暂提示
                alert('命令已复制到剪贴板');
            }).catch(err => {
                console.error('复制失败:', err);
                alert('复制失败，请手动复制');
            });
        }

        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        function getCurrencySymbol(currency) {
            const symbols = {
                'USD': '$',
                'CNY': '￥',
                'HKD': 'HK$',
                'JPY': 'JP¥',
                'EUR': '€',
                'GBP': '£',
                'KRW': '₩',
                'SGD': 'S$',
                'TWD': 'NT$',
                'AUD': 'A$',
                'CAD': 'C$',
                'CHF': 'CHF',
                'RUB': '₽',
                'INR': '₹',
                'BRL': 'R$'
            };
            return symbols[currency] || currency;
        }

        function formatPrice(price, currency, cycle) {
            if (!price && price !== 0) return '-';
            const symbol = getCurrencySymbol(currency);
            let unit = '';
            if (cycle === 'monthly') unit = '/月';
            else if (cycle === 'yearly') unit = '/年';
            else if (cycle === 'quarterly') unit = '/季';
            
            return \`\${symbol}\${price.toFixed(2)}\${unit}\`;
        }

        function formatSpeed(speed) {
            if (speed === undefined || speed === null) return '-';
            // 速度单位 B/s，转换为 KB/s 或 MB/s
            if (speed < 1024) return speed.toFixed(0) + ' B/s';
            if (speed < 1024*1024) return (speed/1024).toFixed(1) + ' KB/s';
            return (speed/(1024*1024)).toFixed(1) + ' MB/s';
        }

        function formatUptime(seconds) {
            if (!seconds) return '-';
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            if (days > 0) return \`\${days}天 \${hours}小时\`;
            if (hours > 0) return \`\${hours}小时 \${minutes}分钟\`;
            return \`\${minutes}分钟\`;
        }

        // 获取国家代码并生成图片 URL
        function getCountryFlagUrl(countryCode) {
            if (!countryCode) return 'https://nationalflag.io/4x3/un.svg';
            // 国家代码转为小写，例如 'US' -> 'us'
            const code = countryCode.toLowerCase();
            return \`https://nationalflag.io/4x3/\${code}.svg\`;
        }

        function getOsIcon(os) {
            if (!os) return '💻';
            const osLower = os.toLowerCase();
            if (osLower.includes('debian')) return '🐧';
            if (osLower.includes('ubuntu')) return '🍕';
            if (osLower.includes('centos')) return '📕';
            if (osLower.includes('alpine')) return '🏔️';
            return '💻';
        }

        async function hashPasswordClient(password) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // 根据时区计算剩余天数
        function daysUntilInTimezone(expireDateStr, timezone) {
            if (!expireDateStr) return null;
            
            // 默认时区
            const tz = timezone || 'Asia/Shanghai';
            
            try {
                // 1. 获取当前时间在指定时区的日期
                const now = new Date();
                const nowFormatter = new Intl.DateTimeFormat('en-CA', {
                    timeZone: tz,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
                const nowDateStr = nowFormatter.format(now);
                const nowDate = new Date(nowDateStr);
                nowDate.setHours(0, 0, 0, 0);
                
                // 2. 解析到期日期
                let expireDate;
                if (expireDateStr.includes('T')) {
                    // ISO 格式，取日期部分
                    expireDate = new Date(expireDateStr.split('T')[0]);
                } else {
                    expireDate = new Date(expireDateStr);
                }
                expireDate.setHours(0, 0, 0, 0);
                
                // 3. 计算天数差
                const diffTime = expireDate - nowDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                return diffDays;
            } catch (err) {
                console.error('计算剩余天数出错:', err, { expireDateStr, timezone });
                return null;
            }
        }

        // 打开修改密码模态框
        function openChangePasswordModal() {
            document.getElementById('changePasswordModal').style.display = 'flex';
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            document.getElementById('changePwdError').style.display = 'none';
            document.getElementById('changePwdSuccess').style.display = 'none';
        }

        // 关闭修改密码模态框
        function closeChangePasswordModal() {
            document.getElementById('changePasswordModal').style.display = 'none';
        }

        // 提交修改密码
        document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const oldPassword = document.getElementById('oldPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const errorDiv = document.getElementById('changePwdError');
            const successDiv = document.getElementById('changePwdSuccess');
            
            // 前端验证
            if (newPassword !== confirmPassword) {
                errorDiv.textContent = '两次输入的新密码不一致';
                errorDiv.style.display = 'block';
                successDiv.style.display = 'none';
                return;
            }
            
            if (newPassword.length < 6) {
                errorDiv.textContent = '新密码长度至少6位';
                errorDiv.style.display = 'block';
                successDiv.style.display = 'none';
                return;
            }
            
            try {
                const hashedOldPassword = await hashPasswordClient(oldPassword);
                const hashedNewPassword = await hashPasswordClient(newPassword);

                const res = await fetch('/api/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldPassword: hashedOldPassword, newPassword: hashedNewPassword })
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    successDiv.textContent = data.message || '密码修改成功，请重新登录';
                    successDiv.style.display = 'block';
                    errorDiv.style.display = 'none';
                    
                    // 3秒后跳转到登录页
                    setTimeout(() => {
                        window.location.href = '/api/logout';
                    }, 3000);
                } else {
                    errorDiv.textContent = data.error || '修改失败';
                    errorDiv.style.display = 'block';
                    successDiv.style.display = 'none';
                }
            } catch (err) {
                errorDiv.textContent = '网络错误，请稍后重试';
                errorDiv.style.display = 'block';
                successDiv.style.display = 'none';
            }
        });
        
        // 国家名称映射
        const countryNames = {
            'CN': '🇨🇳 中国', 'US': '🇺🇸 美国', 'JP': '🇯🇵 日本', 'KR': '🇰🇷 韩国',
            'SG': '🇸🇬 新加坡', 'HK': '🇭🇰 香港', 'TW': '🇨🇳 台湾', 'DE': '🇩🇪 德国',
            'GB': '🇬🇧 英国', 'FR': '🇫🇷 法国', 'CA': '🇨🇦 加拿大', 'AU': '🇦🇺 澳大利亚',
            'RU': '🇷🇺 俄罗斯', 'BR': '🇧🇷 巴西', 'IN': '🇮🇳 印度', 'IT': '🇮🇹 意大利',
            'ES': '🇪🇸 西班牙', 'NL': '🇳🇱 荷兰', 'SE': '🇸🇪 瑞典', 'CH': '🇨🇭 瑞士'
        };

        function updateStats() {
            if (!nodes.length) {
                document.getElementById('nodeStats').innerHTML = '0/0';
                document.getElementById('regionCount').innerText = '0';
                document.getElementById('regionList').innerHTML = '-';
                document.getElementById('totalTraffic').innerHTML = '-';
                document.getElementById('totalSpeed').innerHTML = '-';
                return;
            }
            
            // 节点统计（只显示数字，不显示进度条）
            const total = nodes.length;
            const online = nodes.filter(n => n.status === 'online').length;
            document.getElementById('nodeStats').innerHTML = \`\${online}<span style="font-size: 1rem; color: #64748b;">/\${total}</span>\`;
            
            // 地区统计
            const countries = [...new Set(nodes.filter(n => n.country_code).map(n => n.country_code))];
            const regionDisplay = countries.map(c => countryNames[c] || c).join(' · ');
            const regionFullList = countries.map(c => countryNames[c] || c).join(' · ');
            document.getElementById('regionCount').innerText = countries.length;
            const regionElement = document.getElementById('regionList');
            
            // 显示缩略版（最多显示3个）
            if (regionDisplay.length > 20) {
                const shortDisplay = regionDisplay.split(' · ').slice(0, 2).join(' · ') + '...';
                regionElement.innerHTML = shortDisplay;
            } else {
                regionElement.innerHTML = regionDisplay;
            }
            
            // 设置悬浮提示
            regionElement.setAttribute('data-full', regionFullList);
            regionElement.setAttribute('title', ''); // 禁用默认 title
            
            // 总流量统计
            const totalRx = nodes.reduce((sum, n) => sum + (n.network_rx_bytes || 0), 0);
            const totalTx = nodes.reduce((sum, n) => sum + (n.network_tx_bytes || 0), 0);
            document.getElementById('totalTraffic').innerHTML = formatBytes(totalRx + totalTx);
            document.getElementById('trafficDetail').innerHTML = \`↑ \${formatBytes(totalTx)} | ↓ \${formatBytes(totalRx)}\`;
            
            // 总速度统计
            const totalRxSpeed = nodes.reduce((sum, n) => sum + (n.network_rx_speed || 0), 0);
            const totalTxSpeed = nodes.reduce((sum, n) => sum + (n.network_tx_speed || 0), 0);
            document.getElementById('totalSpeed').innerHTML = formatSpeed(totalRxSpeed + totalTxSpeed);
            document.getElementById('speedDetail').innerHTML = \`↑ \${formatSpeed(totalTxSpeed)} | ↓ \${formatSpeed(totalRxSpeed)}\`;
        }

        // 添加自定义悬浮提示
        function initRegionTooltip() {
            const regionElement = document.getElementById('regionList');
            if (!regionElement) return;
            
            let tooltipTimeout;
            let tooltipElement = null;
            
            function showTooltip(text) {
                if (tooltipElement) tooltipElement.remove();
                tooltipElement = document.createElement('div');
                tooltipElement.className = 'region-tooltip';
                tooltipElement.textContent = text;
                document.body.appendChild(tooltipElement);
                
                const rect = regionElement.getBoundingClientRect();
                tooltipElement.style.left = rect.left + 'px';
                tooltipElement.style.top = (rect.bottom + 5) + 'px';
            }
            
            function hideTooltip() {
                if (tooltipElement) {
                    tooltipElement.remove();
                    tooltipElement = null;
                }
            }
            
            regionElement.addEventListener('mouseenter', () => {
                clearTimeout(tooltipTimeout);
                const fullText = regionElement.getAttribute('data-full') || regionElement.getAttribute('title');
                if (fullText && fullText !== '-') {
                    showTooltip(fullText);
                }
            });
            
            regionElement.addEventListener('mouseleave', () => {
                tooltipTimeout = setTimeout(hideTooltip, 100);
            });
        }
        
        function renderNodes() {
            const container = document.getElementById('nodesContainer');
            if (!container) {
                console.error('未找到 nodesContainer 元素');
                return;
            }
            if (!nodes.length) {
                container.innerHTML = '<div style="text-align: center; padding: 3rem; color: #94a3b8;">暂无节点，请添加</div>';
                return;
            }

            let html = '<div class="cards-grid">';
            for (const node of nodes) {
                // 状态样式
                const statusClass = node.status === 'online' ? 'status-online' : (node.status === 'offline' ? 'status-offline' : 'status-unknown');
                const statusText = node.status === 'online' ? '在线' : (node.status === 'offline' ? '离线' : '未知');

                const flagUrl = getCountryFlagUrl(node.country_code);
                const flagDisplay = \`<img src="\${flagUrl}" style="width: 2rem; height: 1.5rem; margin-right: 0.5rem; vertical-align: middle; border-radius: 2px;">\`;

                // 资源使用率
                const osDisplay = node.os || '-';
                const osIcon = getOsIcon(node.os);
                const cpuValue = (node.cpu_usage !== null && node.cpu_usage !== undefined) ? node.cpu_usage.toFixed(1) + '%' : '-';
                const cpuPercent = node.cpu_usage || 0;
                const memPercent = node.memory_usage || 0;
                const diskPercent = node.disk_usage || 0;
                const cpuColorClass = getProgressColorClass(cpuPercent);
                const memColorClass = getProgressColorClass(memPercent);
                const diskColorClass = getProgressColorClass(diskPercent);

                // 内存/磁盘容量显示
                let memoryDetail = '';
                if (node.memory_usage !== null && node.memory_total) {
                    const usedGB = node.memory_total * node.memory_usage / 100;
                    memoryDetail = \`\${formatBytes(usedGB * 1024**3)} / \${formatBytes(node.memory_total * 1024**3)}\`;
                }
                let diskDetail = '';
                if (node.disk_usage !== null && node.disk_total) {
                    const usedGB = node.disk_total * node.disk_usage / 100;
                    diskDetail = \`\${formatBytes(usedGB * 1024**3)} / \${formatBytes(node.disk_total * 1024**3)}\`;
                }

                // 网络流量
                const totalTraffic = \`↑ \${formatBytes(node.network_tx_bytes || 0)} | ↓ \${formatBytes(node.network_rx_bytes || 0)}\`;
                const speed = \`↑ \${formatSpeed(node.network_tx_speed)} | ↓ \${formatSpeed(node.network_rx_speed)}\`;
                const uptime = formatUptime(node.uptime_seconds);

                // 价格与剩余天数
                const priceDisplay = formatPrice(node.price, node.currency, node.billing_cycle);
                const daysDisplay = daysUntilInTimezone(node.expire_date, node.billing_timezone);

                // 剩余天数及样式
                let daysClass = '';
                let daysText = '';
                if (node.expire_date) {
                    const days = daysDisplay;
                    if (days !== null) {
                        if (days > 15) {
                            daysClass = 'green';
                            daysText = days + '天';
                        } else if (days >= 5) {
                            daysClass = 'yellow';
                            daysText = days + '天';
                        } else if (days > 0) {
                            daysClass = 'red';
                            daysText = days + '天';
                        } else if (days === 0) {
                            daysClass = 'red';
                            daysText = '今天到期';
                        } else {
                            daysClass = 'red';
                            daysText = '已过期';
                        }
                    } else {
                        daysText = '-';
                    }
                } else {
                    daysText = '-';
                }

                // 操作按钮区域 - 根据登录状态显示
                const actionButtons = IS_LOGGED_IN ? \`
                    <div class="card-actions">
                        <button class="icon-btn" onclick="editNode(\${node.id})">✏️</button>
                        <button class="icon-btn" onclick="deleteNode(\${node.id})">🗑️</button>
                    </div>
                \` : '';

                html += \`
                    <div class="node-card">
                        <div class="card-header">
                            <div class="node-name">\${flagDisplay}</div>
                            <div class="title-section">
                                <div class="node-name">\${escapeHtml(node.name)}</div>
                                <div class="badges-container">
                                    <span class="badge badge-price">\${priceDisplay}</span>
                                    <span class="badge badge-days \${daysClass}">\${daysText}</span>
                                </div>
                            </div>
                            <span class="status-badge \${statusClass}">\${statusText}</span>
                        </div>
                        <div class="card-stats">
                            <div class="stat-row">
                                <span class="stat-label">系统</span>
                                <span class="stat-value">\${osIcon} \${escapeHtml(osDisplay)}</span>
                            </div>
                            <div class="metric-item">
                                <div class="metric-header">
                                    <span class="metric-label">CPU</span>
                                    <span class="metric-percent">\${cpuValue}</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill \${cpuColorClass}" style="width: \${cpuPercent}%"></div>
                                </div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-header">
                                    <span class="metric-label">内存</span>
                                    <span class="metric-percent">\${memPercent}%</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill \${memColorClass}" style="width: \${memPercent}%"></div>
                                </div>
                                <div class="metric-value">\${memoryDetail ? \`\${memoryDetail}\` : '-'}</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-header">
                                    <span class="metric-label">磁盘</span>
                                    <span class="metric-percent">\${diskPercent}%</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill \${diskColorClass}" style="width: \${diskPercent}%"></div>
                                </div>
                                <div class="metric-value">\${diskDetail ? \`\${diskDetail}\` : '-'}</div>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">流量</span>
                                <span class="stat-value">\${totalTraffic}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">速度</span>
                                <span class="stat-value">\${speed}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">运行</span>
                                <span class="stat-value">\${uptime}</span>
                            </div>
                        </div>
                        \${actionButtons}
                    </div>
                \`;
            }
            html += '</div>';
            container.innerHTML = html;
        }
        
        async function deleteNode(id) {
            if (!confirm('确定删除此节点吗？')) return;
            await fetch('/api/nodes/' + id, { method: 'DELETE' });
            fetchNodes();
        }
        
        function openModal(node = null) {
            document.getElementById('nodeModal').style.display = 'flex';
            document.getElementById('modalTitle').innerText = '添加节点';
            document.getElementById('nodeForm').reset();
            document.getElementById('nodeId').value = '';
            document.getElementById('billingCycle').value = 'monthly';
            document.getElementById('currency').value = 'CNY';
            document.getElementById('price').value = '';
            document.getElementById('billingTimezone').value = 'Asia/Shanghai';
            document.getElementById('expireDate').value = '';
            // 重置部署命令区域
            document.getElementById('deploy-info').style.display = 'none';
            document.getElementById('deploy-command').innerText = '';
        }
        
        function closeModal() {
            document.getElementById('nodeModal').style.display = 'none';
        }

        function initSSE() {
            if (eventSource) {
                eventSource.close();
            }
            
            eventSource = new EventSource('/api/nodes-stream');
            
            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                nodes = data.results || data;
                renderNodes();
                updateStats();
            };
            
            eventSource.onerror = (err) => {
                console.error('SSE 连接错误:', err);
                eventSource.close();
                // 5秒后重连
                setTimeout(initSSE, 2000);
            };
        }

        // 页面加载时启动 SSE
        initSSE();

        // 页面关闭时清理
        window.addEventListener('beforeunload', () => {
        if (eventSource) {
            eventSource.close();
        }
        });
        
        document.getElementById('nodeForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('nodeId').value;
            const data = {
                name: document.getElementById('nodeName').value,
                billing_cycle: document.getElementById('billingCycle').value,
                currency: document.getElementById('currency').value,
                price: parseFloat(document.getElementById('price').value) || null,
                billing_timezone: document.getElementById('billingTimezone').value,
                expire_date: document.getElementById('expireDate').value ? document.getElementById('expireDate').value : null
            };
            const url = id ? '/api/nodes/' + id : '/api/nodes';
            const method = id ? 'PUT' : 'POST';
            await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            closeModal();
            fetchNodes();
        });
        
        // 添加节点按钮
        document.getElementById('addNodeBtn')?.addEventListener('click', () => { openModal(); });
        // 绑定修改密码按钮
        document.getElementById('changePwdBtn')?.addEventListener('click', () => {
            menuDropdown.classList.remove('show');
            openChangePasswordModal();
        });
        // 登录按钮点击事件
        document.getElementById('loginBtn')?.addEventListener('click', () => { window.location.href = '/login'; });
        // 登出按钮点击事件
        document.getElementById('logoutBtn')?.addEventListener('click', () => { window.location.href = '/api/logout'; });

        document.addEventListener('DOMContentLoaded', initRegionTooltip);

        // 用户菜单交互
        const menuTrigger = document.getElementById('userMenuTrigger');
        const menuDropdown = document.getElementById('userMenuDropdown');
        if (menuTrigger) {
            let isExpanded = false;
            // 点击触发器切换菜单
            menuTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                isExpanded = !isExpanded;
                menuDropdown.classList.toggle('show');
                menuTrigger.setAttribute('aria-expanded', isExpanded);
            });
            
            // 点击其他地方关闭菜单
            document.addEventListener('click', (e) => {
                if (!menuTrigger.contains(e.target) && !menuDropdown.contains(e.target)) {
                    menuDropdown.classList.remove('show');
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && menuDropdown.classList.contains('show')) {
                    menuDropdown.classList.remove('show');
                    menuTrigger.setAttribute('aria-expanded', 'false');
                    menuTrigger.focus();
                }
            });
            
            // 防止菜单内点击关闭
            menuDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        window.editNode = async (id) => {
          const node = nodes.find(n => n.id === id);
          if (node) {
            document.getElementById('nodeModal').style.display = 'flex';
            document.getElementById('modalTitle').innerText = '编辑节点';
            document.getElementById('nodeId').value = node.id;
            document.getElementById('nodeName').value = node.name;
            document.getElementById('billingCycle').value = node.billing_cycle || 'monthly';
            document.getElementById('currency').value = node.currency || 'CNY';
            document.getElementById('price').value = node.price || '';
            document.getElementById('billingTimezone').value = node.billing_timezone || 'Asia/Shanghai';
            if (node.expire_date) {
                // datetime-local 需要 yyyy-MM-dd 格式
                document.getElementById('expireDate').value = node.expire_date;
            } else {
                document.getElementById('expireDate').value = '';
            }

            // 立即清空部署命令区域，避免显示上一个节点的信息
            document.getElementById('deploy-command').innerText = '加载中...';

            const tokenRes = await fetch('/api/node-token/' + id);
            const tokenData = await tokenRes.json();
            if (tokenRes.ok && tokenData.token) {
              const c = 'cur' + 'l';
              const cmdstr = c + ' -sSf https://' + window.location.host + '/deploy-agent?token=' + tokenData.token + ' | sudo bash';
              document.getElementById('deploy-command').innerText = cmdstr;
              document.getElementById('deploy-info').style.display = 'block';
            } else {
              document.getElementById('deploy-info').style.display = 'none';
            }
          }
        };
        window.deleteNode = deleteNode;
        window.closeModal = closeModal;
    </script>
</body>
</html>`;
  return html;
}

// API 路由实现
async function handleNodesStream(request, env, ctx) {
  const maxExecutions = 200;
  // 设置 SSE 响应头
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  };

  const encoder = new TextEncoder();
  let intervalId;
  let executionCount = 0;
  let isClosing = false;

  const stream = new ReadableStream({
    start(controller) {
      // 立即发送当前数据
      const sendData = async () => {
        // 检查是否达到最大执行次数
        if (executionCount >= maxExecutions || isClosing) {
          if (!isClosing) {
            console.log(`已达到最大执行次数 ${maxExecutions}，停止推送`);
            await closeStream(controller, 'completed');
          }
          return;
        }
        try {
          executionCount++;
          // 关键：将数据库操作放到 waitUntil 中，不阻塞流
          const dataPromise = getNodesData(env);
          ctx.waitUntil(dataPromise.then((data) => {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          }));
        } catch (err) {
          console.error('获取节点数据失败:', err);
        }
      };
      const closeStream = async (controller, reason) => {
        if (isClosing) return;
        isClosing = true;
        
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        
        // 发送完成事件
        const completeMessage = `event: complete\ndata: ${JSON.stringify({
          reason: reason,
          totalExecutions: executionCount,
          maxExecutions: maxExecutions,
          timestamp: new Date().toISOString()
        })}\n\n`;
        controller.enqueue(encoder.encode(completeMessage));
        
        // 延迟关闭以确保消息被发送
        setTimeout(() => {
          try {
            controller.close();
          } catch (e) {
            console.log('流已经关闭');
          }
        }, 100);
      };

      sendData();

      // 每 2 秒推送一次更新
      intervalId = setInterval(sendData, 2000);
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
    }
  });

  return new Response(stream, { headers });
}

async function getNodesData(env) {
  return await env.DB.prepare(`
    SELECT id, name, status, os, cpu_usage, memory_usage, disk_usage, memory_total, disk_total,
               network_rx_bytes, network_tx_bytes, network_rx_speed, network_tx_speed, uptime_seconds,
               billing_cycle, currency, price, billing_timezone, expire_date, country_code
        FROM vps_nodes ORDER BY expire_date DESC
  `).all();
}

async function handleAddNode(request, env) {
  if (!(await verifyAuth(request, env))) return unauthorized();
  const data = await request.json();
  const { name, billing_cycle, currency, price, billing_timezone, expire_date } = data;
  const token = crypto.randomUUID();
  const stmt = await env.DB.prepare(`
    INSERT INTO vps_nodes 
    (name, status, token, billing_cycle, currency, price, billing_timezone, expire_date) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(name, 'unknown', token, billing_cycle, currency, price, billing_timezone, expire_date).run();
  return Response.json({ success: true, id: stmt.meta.last_row_id });
}

async function handleUpdateNode(request, env, id) {
  if (!(await verifyAuth(request, env))) return unauthorized();
  const data = await request.json();
  const { name, billing_cycle, currency, price, billing_timezone, expire_date } = data;
  await env.DB.prepare(`
    UPDATE vps_nodes 
    SET name=?, billing_cycle=?, currency=?, price=?, billing_timezone=?, expire_date=?, updated_at=CURRENT_TIMESTAMP 
    WHERE id=?
  `).bind(name, billing_cycle, currency, price, billing_timezone, expire_date, id).run();
  return Response.json({ success: true });
}

async function handleDeleteNode(request, env, id) {
  if (!(await verifyAuth(request, env))) return unauthorized();
  await env.DB.prepare('DELETE FROM vps_nodes WHERE id=?').bind(id).run();
  return Response.json({ success: true });
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
}

function handleDeployScript(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('缺少 token 参数', { status: 400 });
  }
  const host = request.headers.get('Host');
  const wsUrl = `wss://${host}/ws?token=${token}`;

  const script = `#!/bin/bash
set -e

# 检测并安装 websocat
install_websocat() {
    if command -v websocat &> /dev/null; then
        echo "websocat 已安装"
        return 0
    fi
    
    echo "正在安装 websocat..."
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        echo "无法检测操作系统"
        exit 1
    fi
    
    case "$OS" in
        ubuntu|debian)
            ARCH=$(uname -m)
            case "$ARCH" in
                x86_64)  ARCH="x86_64" ;;
                aarch64) ARCH="aarch64" ;;
                armv7l)  ARCH="armv7" ;;
                *)       ARCH="x86_64" ;;
            esac
            URL="https://github.com/vi/websocat/releases/download/v1.12.0/websocat.\${ARCH}-unknown-linux-musl"
            wget -O /usr/local/bin/websocat "$URL"
            chmod +x /usr/local/bin/websocat
            ;;
        centos|rhel|fedora)
            if command -v cargo &> /dev/null; then
                cargo install websocat
            else
                ARCH=$(uname -m)
                case "$ARCH" in
                    x86_64)  ARCH="x86_64" ;;
                    aarch64) ARCH="aarch64" ;;
                    *)       ARCH="x86_64" ;;
                esac
                URL="https://github.com/vi/websocat/releases/download/v1.12.0/websocat.\${ARCH}-unknown-linux-musl"
                curl -L -o /usr/local/bin/websocat "$URL"
                chmod +x /usr/local/bin/websocat
            fi
            ;;
        alpine)
            apk add --no-cache websocat
            ;;
        *)
            ARCH=$(uname -m)
            case "$ARCH" in
                x86_64)  ARCH="x86_64" ;;
                aarch64) ARCH="aarch64" ;;
                armv7l)  ARCH="armv7" ;;
                *)       ARCH="x86_64" ;;
            esac
            URL="https://github.com/vi/websocat/releases/download/v1.12.0/websocat.\${ARCH}-unknown-linux-musl"
            curl -L -o /usr/local/bin/websocat "$URL"
            chmod +x /usr/local/bin/websocat
            ;;
    esac
    
    if command -v websocat &> /dev/null; then
        echo "websocat 安装成功"
    else
        echo "websocat 安装失败"
        exit 1
    fi
}

install_tools() {
    if ! command -v wget &> /dev/null && ! command -v curl &> /dev/null; then
        if command -v apt &> /dev/null; then
            apt update && apt install -y wget
        elif command -v yum &> /dev/null; then
            yum install -y wget
        elif command -v apk &> /dev/null; then
            apk add --no-cache wget
        fi
    fi
}

install_tools
install_websocat

mkdir -p /opt/vps-reporter
cd /opt/vps-reporter

cat > reporter.sh << 'INNER_EOF'
#!/bin/bash
WS_URL="${wsUrl}"
TOKEN="${token}"
INTERVAL=1
MAX_MESSAGES=200
LOG_FILE="/tmp/websocat.log"

# 自动检测活动的网络接口（排除 lo）
get_active_interface() {
    local iface
    for iface in $(ls /sys/class/net/); do
        if [ "$iface" != "lo" ]; then
            echo "$iface"
            return
        fi
    done
    echo "eth0"
}

INTERFACE=$(get_active_interface)

# 初始化上次变量
LAST_RX=0
LAST_TX=0
LAST_TIME=$(date +%s)
CACHED_OS=""

# 获取操作系统名称和架构
get_os_info() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME="$PRETTY_NAME"
    elif [ -f /etc/debian_version ]; then
        OS_NAME="Debian $(cat /etc/debian_version)"
    elif [ -f /etc/redhat-release ]; then
        OS_NAME=$(cat /etc/redhat-release)
    else
        OS_NAME="Unknown"
    fi
    
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)  ARCH="amd64" ;;
        aarch64) ARCH="arm64" ;;
        armv7l)  ARCH="armv7" ;;
        i386)    ARCH="i386" ;;
        *)       ARCH="$ARCH" ;;
    esac
    
    OS_SIMPLE=$(echo "$OS_NAME" | awk '{print $1}')
    echo "$OS_SIMPLE / $ARCH"
}

# 获取 CPU 使用率（百分比）
get_cpu() {
    local stat1=$(cat /proc/stat | head -n1)
    sleep 1
    local stat2=$(cat /proc/stat | head -n1)
    local arr1=($stat1)
    local arr2=($stat2)
    local user1=\${arr1[1]}
    local nice1=\${arr1[2]}
    local sys1=\${arr1[3]}
    local idle1=\${arr1[4]}
    local iowait1=\${arr1[5]}
    local irq1=\${arr1[6]}
    local softirq1=\${arr1[7]}
    local steal1=\${arr1[8]}
    local user2=\${arr2[1]}
    local nice2=\${arr2[2]}
    local sys2=\${arr2[3]}
    local idle2=\${arr2[4]}
    local iowait2=\${arr2[5]}
    local irq2=\${arr2[6]}
    local softirq2=\${arr2[7]}
    local steal2=\${arr2[8]}

    local total1=$((user1 + nice1 + sys1 + idle1 + iowait1 + irq1 + softirq1 + steal1))
    local total2=$((user2 + nice2 + sys2 + idle2 + iowait2 + irq2 + softirq2 + steal2))
    local idle1=$((idle1 + iowait1))
    local idle2=$((idle2 + iowait2))
    local diff_total=$((total2 - total1))
    local diff_idle=$((idle2 - idle1))

    if [ $diff_total -eq 0 ]; then
        echo 0
        return
    fi

    local usage=$(( (diff_total - diff_idle) * 100 / diff_total ))
    echo $usage
}

# 获取内存使用率（百分比）和总容量（GB）
get_memory() {
    local mem_info=$(free -b)
    local total=$(echo "$mem_info" | awk '/^Mem:/ {print $2}')
    local available=$(echo "$mem_info" | awk '/^Mem:/ {print $7}')
    if [ -z "$available" ]; then
        local free=$(echo "$mem_info" | awk '/^Mem:/ {print $4}')
        local buffers=$(echo "$mem_info" | awk '/^Buffers:/ {print $2}')
        local cached=$(echo "$mem_info" | awk '/^Cached:/ {print $2}')
        available=$((free + buffers + cached))
    fi
    local used=$((total - available))
    local percent=$((used * 100 / total))
    local total_gb=$(awk -v total="$total" 'BEGIN {printf "%.2f", total/1073741824}')
    echo "$percent $total_gb"
}

# 获取磁盘使用率（百分比）和总容量（GB）
get_disk() {
    local disk_info=$(df -B1 / | tail -n1)
    local total=$(echo "$disk_info" | awk '{print $2}')
    local used=$(echo "$disk_info" | awk '{print $3}')
    local percent=$((used * 100 / total))
    local total_gb=$(awk -v total="$total" 'BEGIN {printf "%.2f", total/1073741824}')
    echo "$percent $total_gb"
}

# 获取网络流量（rx tx 字节）
get_network_stats() {
    local line=$(grep "$INTERFACE:" /proc/net/dev | awk '{print $2,$10}')
    local rx=$(echo "$line" | awk '{print $1}')
    local tx=$(echo "$line" | awk '{print $2}')
    echo "$rx $tx"
}

# 获取开机时间（秒）
get_uptime() {
    awk '{print int($1)}' /proc/uptime
}

# 发送数据的函数
send_data() {
    local count=0
    local ws_url="$1"
    local token="$2"
    
    # 使用 for 循环发送指定次数
    for ((i=1; i<=$MAX_MESSAGES; i++)); do
        # 获取当前流量和开机时间
        CURRENT_STATS=($(get_network_stats))
        CURRENT_RX=\${CURRENT_STATS[0]}
        CURRENT_TX=\${CURRENT_STATS[1]}
        CURRENT_UPTIME=$(get_uptime)
        CURRENT_TIME=$(date +%s)

        # 计算速度
        TIME_DIFF=$((CURRENT_TIME - LAST_TIME))
        if [ $TIME_DIFF -gt 0 ]; then
            RX_SPEED=$(( (CURRENT_RX - LAST_RX) / TIME_DIFF ))
            TX_SPEED=$(( (CURRENT_TX - LAST_TX) / TIME_DIFF ))
        else
            RX_SPEED=0
            TX_SPEED=0
        fi

        LAST_RX=$CURRENT_RX
        LAST_TX=$CURRENT_TX
        LAST_TIME=$CURRENT_TIME

        # 获取各项指标
        cpu=$(get_cpu)
        mem_data=$(get_memory)
        mem_percent=$(echo "$mem_data" | awk '{print $1}')
        mem_total_gb=$(echo "$mem_data" | awk '{print $2}')
        disk_data=$(get_disk)
        disk_percent=$(echo "$disk_data" | awk '{print $1}')
        disk_total_gb=$(echo "$disk_data" | awk '{print $2}')
        
        if [ -z "$CACHED_OS" ] || [ $((SECONDS % 60)) -eq 0 ]; then
            CACHED_OS=$(get_os_info)
        fi

        # 构建 JSON（单行）
        payload="{\\\"token\\\":\\\"$token\\\",\\\"cpu\\\":$cpu,\\\"memory\\\":$mem_percent,\\\"disk\\\":$disk_percent,\\\"memory_total\\\":$mem_total_gb,\\\"disk_total\\\":$disk_total_gb,\\\"network_rx_bytes\\\":$CURRENT_RX,\\\"network_tx_bytes\\\":$CURRENT_TX,\\\"network_rx_speed\\\":$RX_SPEED,\\\"network_tx_speed\\\":$TX_SPEED,\\\"uptime_seconds\\\":$CURRENT_UPTIME,\\\"os\\\":\\\"$CACHED_OS\\\"}"
        
        echo "$payload"
        
        # 最后一次发送后不再 sleep，直接结束
        if [ $i -lt $MAX_MESSAGES ]; then
            sleep $INTERVAL
        fi
        if tail -n2 "$LOG_FILE" | grep -qi "error\\|closed\\|disconnected\\|failure\\|failed"; then
            break
        fi
    done
}

# 主循环：不断重建连接
while true; do
    echo "$(date): 建立 WebSocket 连接，将发送 \${MAX_MESSAGES} 次数据..."
    > "$LOG_FILE"
    send_data "$WS_URL" "$TOKEN" | websocat -v "$WS_URL" 2>&1 | tee -a "$LOG_FILE"
    echo "$(date): 连接关闭，$INTERVAL秒后重建..."
    sleep $INTERVAL
done
INNER_EOF

chmod +x reporter.sh

# 创建 systemd 服务
cat > /etc/systemd/system/vps-reporter.service << 'SERVICE_EOF'
[Unit]
Description=VPS Reporter (WebSocket)
After=network.target

[Service]
Type=simple
ExecStart=/opt/vps-reporter/reporter.sh
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# 启用并启动服务
systemctl daemon-reload
systemctl enable vps-reporter
systemctl restart vps-reporter

echo "========================================="
echo "vps-reporter 上报服务已部署！"
echo "查看日志: journalctl -u vps-reporter -f"
echo "========================================="
`;

  return new Response(script, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename="deploy-agent.sh"'
    }
  });
}

async function handleWebSocket(request, env, ctx) {
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const countryCode = request.cf?.country || 'unknown';

  if (!token) {
    server.close(1008, 'Missing token');
    return new Response(null, { status: 401 });
  }

  let nodeId;
  try {
    const node = await env.DB.prepare('SELECT id FROM vps_nodes WHERE token = ?').bind(token).first();
    if (!node) {
      server.close(1008, 'Invalid token');
      return new Response(null, { status: 401 });
    }
    nodeId = node.id;
  } catch (err) {
    console.error('数据库验证失败:', err);
    server.close(1011, 'Internal error');
    return new Response(null, { status: 500 });
  }

  console.log(`WebSocket 连接建立: 节点 ${nodeId}`);

  // 标记连接是否已关闭，避免重复操作
  let isClosed = false;

  // 处理消息
  server.addEventListener('message', async (event) => {
    if (isClosed) return;
    try {
        const data = JSON.parse(event.data);

        // 使用 ctx.waitUntil 将数据库操作移到后台
        ctx.waitUntil(updateNodeData(env, nodeId, data, countryCode));

        // 立即返回成功响应
        if (!isClosed) {
            server.send(JSON.stringify({ success: true }));
        }
    } catch (err) {
      console.error('处理消息错误:', err);
      if (!isClosed) {
        server.send(JSON.stringify({ error: err.message }));
      }
    }
  });

  server.addEventListener('close', (event) => {
    // 1000 正常关闭，1005 客户端主动断开（无关闭帧）
    if (event.code === 1000) {
      console.log(`WebSocket 正常关闭: 节点 ${nodeId}`);
    } else if (event.code === 1005) {
      console.log(`WebSocket 客户端主动断开 (正常重建): 节点 ${nodeId}`);
    } else {
      console.log(`WebSocket 关闭: 节点 ${nodeId}, 代码: ${event.code}, 原因: ${event.reason}`);
    }
    isClosed = true;
    server.close(event.code, event.reason);
  });

  server.addEventListener('error', (event) => {
    // 如果已经关闭，忽略错误
    if (isClosed) return;
    
    const error = event.error || event.message || '未知错误';
    console.error(`WebSocket 错误 (节点 ${nodeId}):`, error);
    isClosed = true;
    server.close(1011, String(error));
  });

  return new Response(null, { status: 101, webSocket: client });
}

async function updateNodeData(env, id, data, countryCode) {
    const countryName = getCountryName(countryCode);
    const now = new Date().toISOString();
    await env.DB.prepare(`
            UPDATE vps_nodes 
            SET status = 'online', 
                last_check = ?, 
                cpu_usage = ?, 
                memory_usage = ?, 
                disk_usage = ?,
                memory_total = COALESCE(?, memory_total),
                disk_total = COALESCE(?, disk_total),
                network_rx_bytes = COALESCE(?, network_rx_bytes),
                network_tx_bytes = COALESCE(?, network_tx_bytes),
                network_rx_speed = COALESCE(?, network_rx_speed),
                network_tx_speed = COALESCE(?, network_tx_speed),
                uptime_seconds = COALESCE(?, uptime_seconds),
                os = COALESCE(?, os),
                country_code = ?,
                country_name = ?
            WHERE id = ?
        `).bind(now, data.cpu, data.memory, data.disk, data.memory_total, 
                data.disk_total, data.network_rx_bytes, data.network_tx_bytes,
                data.network_rx_speed, data.network_tx_speed, data.uptime_seconds, 
                data.os, countryCode, countryName, id).run();
}

// 国家代码转名称
function getCountryName(code) {
  const countries = {
    // 亚洲
    'CN': '中国',
    'TW': '中国台湾',
    'HK': '中国香港',
    'MO': '中国澳门',
    'JP': '日本',
    'KR': '韩国',
    'SG': '新加坡',
    'MY': '马来西亚',
    'TH': '泰国',
    'VN': '越南',
    'IN': '印度',
    'ID': '印度尼西亚',
    'PH': '菲律宾',
    // 北美洲
    'US': '美国',
    'CA': '加拿大',
    'MX': '墨西哥',
    // 欧洲
    'GB': '英国',
    'DE': '德国',
    'FR': '法国',
    'IT': '意大利',
    'ES': '西班牙',
    'PT': '葡萄牙',
    'NL': '荷兰',
    'CH': '瑞士',
    'SE': '瑞典',
    'NO': '挪威',
    'DK': '丹麦',
    'FI': '芬兰',
    'RU': '俄罗斯',
    // 大洋洲
    'AU': '澳大利亚',
    'NZ': '新西兰',
    // 其他
    'BR': '巴西',
    'ZA': '南非',
  };
  return countries[code] || code;
}

async function handleGetNodeToken(request, env, id) {
  if (!(await verifyAuth(request, env))) return unauthorized();
  const node = await env.DB.prepare('SELECT token FROM vps_nodes WHERE id = ?').bind(id).first();
  if (!node) return new Response(JSON.stringify({ error: '节点不存在' }), { status: 404 });
  return Response.json({ token: node.token });
}

async function checkHeartbeat(env) {
  const threshold = new Date(Date.now() - 30000).toISOString();
  await env.DB.prepare(`
    UPDATE vps_nodes 
    SET status = 'offline', cpu_usage = null, memory_usage = null, disk_usage = null
    WHERE last_check < ? AND status = 'online'
  `).bind(threshold).run();
}
