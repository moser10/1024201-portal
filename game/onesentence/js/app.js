import { getUser, getRoom, clearRoom } from "../../js/store.js";
import { getGame } from "../../js/games.js";
import { renderLobby } from "./lobby.js";
import { renderPlay } from "./play.js";

if (!getUser()) {
  window.location.href = `/game/register/?return=${encodeURIComponent("onesentence/")}`;
}

const game = getGame("osn");
const app = document.getElementById("app");

function route() {
  const room = getRoom();
  if (room?.id) {
    renderPlay(app, () => {
      clearRoom();
      route();
    }, game);
    return;
  }
  renderLobby(app, route, game);
}

route();
