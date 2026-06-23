import { getUser, getRoom, clearRoom } from "./store.js";
import { renderRegister } from "./register.js";
import { renderLobby } from "./lobby.js";
import { renderPlay } from "./play.js";

const app = document.getElementById("app");

function route() {
  const user = getUser();
  const room = getRoom();

  if (!user) {
    renderRegister(app, route);
    return;
  }

  if (room?.id) {
    renderPlay(app, () => {
      clearRoom();
      route();
    });
    return;
  }

  renderLobby(app, route);
}

route();
