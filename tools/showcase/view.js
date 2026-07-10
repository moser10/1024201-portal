const params = new URLSearchParams(location.search);
const id = params.get("id");

const errBox = document.getElementById("errBox");
const img = document.getElementById("workImg");

async function load() {
  if (!id) {
    errBox.textContent = "Not found";
    errBox.hidden = false;
    return;
  }
  try {
    const res = await fetch(`/api/portal?action=showcase_get&id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "not_found");
    img.src = data.imageUrl;
    img.alt = data.title || "";
    img.onload = () => {
      img.hidden = false;
    };
    img.onerror = () => {
      throw new Error("image_load_failed");
    };
  } catch (e) {
    errBox.textContent = e.message || "Not found";
    errBox.hidden = false;
    img.hidden = true;
  }
}

load();
