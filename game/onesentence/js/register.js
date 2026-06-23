import { authApi } from "./api.js";
import { bindNameCheck } from "./nameCheck.js";
import { setUser } from "./store.js";

export function renderRegister(app, onDone) {
  app.innerHTML = `
    <div class="card">
      <h1>【一人一句，一句成书】</h1>
      <p class="sub">注册后即可创建或加入房间</p>
      <label>邮箱</label>
      <input type="email" id="regEmail" placeholder="your@email.com" maxlength="80">
      <label>昵称（唯一）</label>
      <div class="row">
        <input type="text" id="regName" placeholder="起个名字..." maxlength="20">
        <button type="button" id="regSuggest" class="btn-secondary disabled" disabled>推荐可用名</button>
      </div>
      <p id="regHint" class="hint"></p>
      <button id="regBtn" class="btn-primary">注册</button>
      <hr>
      <p class="sub">已有账号？</p>
      <div class="row">
        <input type="email" id="loginEmail" placeholder="输入注册邮箱登录">
        <button id="loginBtn" class="btn-secondary">登录</button>
      </div>
    </div>`;

  bindNameCheck({
    input: document.getElementById("regName"),
    btn: document.getElementById("regSuggest"),
    hint: document.getElementById("regHint"),
    checkFn: authApi.checkName,
  });

  document.getElementById("regBtn").onclick = async () => {
    const email = document.getElementById("regEmail").value.trim();
    const username = document.getElementById("regName").value.trim();
    if (!email || !username) return alert("请填写邮箱和昵称");
    try {
      const data = await authApi.register(email, username);
      setUser(data.user);
      onDone();
    } catch (e) {
      alert(e.message);
    }
  };

  document.getElementById("loginBtn").onclick = async () => {
    const email = document.getElementById("loginEmail").value.trim();
    if (!email) return alert("请输入邮箱");
    try {
      const data = await authApi.login(email);
      setUser(data.user);
      onDone();
    } catch (e) {
      alert(e.message);
    }
  };
}
