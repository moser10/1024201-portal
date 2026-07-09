function ensureToastRoot() {
  let root = document.getElementById("app-toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "app-toast-root";
    document.body.appendChild(root);
  }
  return root;
}

export function showToast(message, duration = 2400) {
  const root = ensureToastRoot();
  const el = document.createElement("div");
  el.className = "app-toast";
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 200);
  }, duration);
}

export function showSheet(message, actions = []) {
  return new Promise((resolve) => {
    const mask = document.createElement("div");
    mask.className = "app-sheet-mask";
    const sheet = document.createElement("div");
    sheet.className = "app-sheet";
    sheet.onclick = (e) => e.stopPropagation();

    const body = document.createElement("p");
    body.className = "app-sheet-text";
    body.textContent = message;
    sheet.appendChild(body);

    const row = document.createElement("div");
    row.className = "app-sheet-actions";
    actions.forEach((act) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = act.danger ? "app-sheet-btn danger" : "app-sheet-btn";
      btn.textContent = act.label;
      btn.onclick = () => {
        close(act.value);
      };
      row.appendChild(btn);
    });
    sheet.appendChild(row);
    mask.appendChild(sheet);
    document.body.appendChild(mask);

    function close(value) {
      mask.classList.remove("show");
      setTimeout(() => mask.remove(), 200);
      resolve(value);
    }

    mask.onclick = () => close(false);
    requestAnimationFrame(() => mask.classList.add("show"));
  });
}

export function confirmSheet(message) {
  return showSheet(message, [
    { label: "取消", value: false },
    { label: "确定", value: true },
  ]);
}
