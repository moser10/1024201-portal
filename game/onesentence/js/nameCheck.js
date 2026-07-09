export function bindNameCheck({ input, btn, hint, checkFn, onStatus, getOriginalName }) {
  let timer = null;

  const grayBtn = () => {
    btn.disabled = true;
    btn.classList.add("disabled");
    btn.textContent = btn.dataset.defaultLabel || "推荐可用名";
    delete btn.dataset.v;
    if (hint) {
      hint.textContent = "";
      hint.className = "hint";
    }
    onStatus?.(false);
  };

  if (!btn.dataset.defaultLabel) {
    btn.dataset.defaultLabel = btn.textContent.trim() || "推荐可用名";
  }

  grayBtn();

  input.addEventListener("input", () => {
    const value = input.value.trim();
    const original = getOriginalName?.()?.trim();

    if (original && value === original) {
      grayBtn();
      if (hint) {
        hint.textContent = "与当前书名相同";
        hint.className = "hint";
      }
      return;
    }

    grayBtn();
    clearTimeout(timer);
    if (!value) return;

    timer = setTimeout(async () => {
      try {
        const data = await checkFn(value);
        if (data.available) {
          if (hint) {
            hint.textContent = "✓ 可以使用";
            hint.className = "hint ok";
          }
          onStatus?.(true);
        } else {
          if (hint) {
            hint.textContent = "已被占用";
            hint.className = "hint warn";
          }
          btn.textContent = `推荐: ${data.recommend}`;
          btn.dataset.v = data.recommend;
          btn.disabled = false;
          btn.classList.remove("disabled");
          onStatus?.(false);
        }
      } catch (e) {
        if (hint) {
          hint.textContent = e.message;
          hint.className = "hint err";
        }
        onStatus?.(false);
      }
    }, 500);
  });

  btn.addEventListener("click", () => {
    if (!btn.dataset.v) return;
    input.value = btn.dataset.v;
    grayBtn();
    input.dispatchEvent(new Event("input"));
  });
}
