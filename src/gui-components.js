import { html } from "./utils";
import Cmp from "./accessors";

/**
 * @typedef GitMenuFunctions
 * @property {() => any} pushHandler
 * @property {() => any} repoLocationHandler
 * @property {() => any} ghTokenHandler
 * @property {() => any} commitViewHandler
 */

class FileMenu {
  constructor() {
    this.menu = document.querySelectorAll(`div.${Cmp.MENU_ITEM}`)[2];
    this.reactEventHandlers = Object.keys(this.menu).filter((e) =>
      e.startsWith("__reactEventHandlers")
    )[0];
  }

  openProject() {
    this.menu[this.reactEventHandlers].onMouseUp();
    let loadFromComputer = this.menu.querySelectorAll("li")[2];
    loadFromComputer[this.reactEventHandlers].onClick();
    this.menu[this.reactEventHandlers].children[1].props.onRequestClose();
  }

  isProjectOpen() {
    this.menu[this.reactEventHandlers].onMouseUp();
    let savedMenu = new DOMParser().parseFromString(
      this.menu.innerHTML,
      "text/html"
    );
    this.menu[this.reactEventHandlers].children[1].props.onRequestClose();
    return savedMenu.querySelectorAll("li")[3].innerText.endsWith(".sb3");
  }
}

/** Git menu instantiator from Edit menu */
class GitMenu {
  /** @type {HTMLElement} */
  savedItems;

  constructor() {
    this.menu = document.querySelectorAll(`div.${Cmp.MENU_ITEM}`)[2];
    this.reactEventHandlers = Object.keys(this.menu).filter((e) =>
      e.startsWith("__reactEventHandlers")
    )[0];
    this.savedItems = undefined;
    this.newMenu = undefined;
    this.open = false;
  }

  /** @param {number?} index */
  getListItem(index = 1) {
    let li = this.savedItems.querySelectorAll("li")[index - 1];
    return {
      label: (text) => {
        try {
          li.querySelector("span").innerText = text;
        } catch (e) {
          li.innerText = text;
        }
      },
      remove: () => li.remove(),
      onclick: (handler) => {
        li.onclick = () => {
          this.newMenu.classList.remove(Cmp.MENU_ITEM_ACTIVE);
          this.savedItems.style.display = "none";
          this.open = false;
          handler();
        };
      },
      elem: li,
    };
  }

  /**
   * @param {GitMenuFunctions}
   */
  create({
    pushHandler,
    repoLocationHandler,
    ghTokenHandler,
    commitViewHandler,
  }) {
    this.menu[this.reactEventHandlers].onMouseUp();
    /** @type {HTMLElement} */
    this.newMenu = this.menu.cloneNode(true);
    this.menu.after(this.newMenu);
    this.newMenu.classList.remove(Cmp.MENU_ITEM_ACTIVE);
    this.newMenu.querySelector("span").innerText = "Git";
    this.savedItems = this.newMenu
      .querySelector("ul")
      .parentElement.cloneNode(true);
    this.savedItems.classList.add("git-menu");
    this.newMenu.querySelector("ul").parentElement.remove();
    this.savedItems.style.display = "none";
    this.newMenu.appendChild(this.savedItems);

    this.getListItem(1).label("Push project");
    this.getListItem(1).onclick(pushHandler);
    this.getListItem(2).label("Configure repository");
    this.getListItem(2).onclick(repoLocationHandler);
    this.getListItem(3).elem.classList.remove(Cmp.MENU_SECTION);
    this.getListItem(3).label("Configure GitHub token");
    this.getListItem(3).onclick(ghTokenHandler);
    this.getListItem(4).remove();
    this.getListItem(5).remove();
    this.getListItem(4).remove();
    this.getListItem(4).label("View commits");
    this.getListItem(4).onclick(commitViewHandler);

    this.newMenu.onclick = () => {
      if (this.savedItems.style.display === "none") {
        this.newMenu.classList.add(Cmp.MENU_ITEM_ACTIVE);
        this.savedItems.style.display = "block";
        this.open = true;
      } else {
        this.newMenu.classList.remove(Cmp.MENU_ITEM_ACTIVE);
        this.savedItems.style.display = "none";
        this.open = false;
      }
    };
    document.querySelector("#app").onmouseup = (e) => {
      /** @type {Event} */
      let event = e;
      if (
        event.target !== this.newMenu &&
        event.target.parentNode !== this.newMenu &&
        this.open
      ) {
        this.newMenu.classList.remove(Cmp.MENU_ITEM_ACTIVE);
        this.savedItems.style.display = "none";
        this.open = false;
      }
    };
  }
}

class Alert {
  static CLOSE_BUTTON_SVG =
    "data:image/svg+xml;base64, \
  PHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d \
  3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3LjQ4IDcuNDgiPjxkZWZzPjxzdH \
  lsZT4uY2xzLTF7ZmlsbDpub25lO3N0cm9rZTojZmZmO3N0cm9rZS1saW5lY2FwOnJvdW5kO \
  3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2Utd2lkdGg6MnB4O308L3N0eWxlPjwvZGVm \
  cz48dGl0bGU+aWNvbi0tYWRkPC90aXRsZT48bGluZSBjbGFzcz0iY2xzLTEiIHgxPSIzLjc \
  0IiB5MT0iNi40OCIgeDI9IjMuNzQiIHkyPSIxIi8+PGxpbmUgY2xhc3M9ImNscy0xIiB4MT \
  0iMSIgeTE9IjMuNzQiIHgyPSI2LjQ4IiB5Mj0iMy43NCIvPjwvc3ZnPg==";

  /** @param {{message: string; duration: number}} */
  constructor({ message, duration }) {
    this.message = message;
    this.duration = duration;
  }

  display() {
    document.querySelector(`.${Cmp.ALERT_CONTAINER}`).innerHTML = html`<div
      class="${Cmp.ALERT_DIALOG} ${Cmp.ALERT_SUCCESS} ${Cmp.BOX}"
      style="justify-content: space-between"
    >
      <div class="${Cmp.ALERT_MESSAGE}">${this.message}</div>
      <div class="${Cmp.ALERT_BUTTONS}">
        <div class="${Cmp.ALERT_CLOSE_CONTAINER} ${Cmp.BOX}">
          <div
            aria-label="Close"
            class="${Cmp.CLOSE_BUTTON} ${Cmp.CLOSE_BUTTON_LARGE}"
            role="button"
            tabindex="0"
          >
            <img
              class="${Cmp.CLOSE_ICON} undefined"
              src="${Alert.CLOSE_BUTTON_SVG}"
            />
          </div>
        </div>
      </div>
    </div>`;
    if (document.querySelector("body").getAttribute("theme") === "dark") {
      document.querySelector(`.${Cmp.CLOSE_BUTTON}`).style.backgroundColor =
        "rgba(0, 0, 0, 0.255)";
    }
    document.querySelector(`.${Cmp.CLOSE_BUTTON}`).onclick = this.remove;
    setTimeout(this.remove, this.duration);
  }

  remove() {
    document.querySelector(`.${Cmp.ALERT_CONTAINER}`).innerHTML = "";
  }
}

/** @param {{message: string; duration: number}} */
export function scratchAlert({ message, duration }) {
  new Alert({ message, duration }).display();
}

export const fileMenu = new FileMenu();
export const gitMenu = new GitMenu();
window.gitMenu = gitMenu;
