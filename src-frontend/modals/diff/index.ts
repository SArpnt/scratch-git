import api, { Project } from "../../api";
import { settings } from "../../dom/index";

import { parseScripts, type ScriptStatus } from "./scripts";
import { scrollBlockIntoView, flash } from "./blocks";
import van from "vanjs-core";

interface Diff {
  oldContent: any;
  newContent: any;
  status: ScriptStatus;
  scriptNo: number | any[];
  script: string;
  added: number;
  removed: number;
  diffed: string;
}

const {
  div,
  label,
  input,
  span,
  ul,
  button,
  p,
  aside,
  main,
  br,
  hr,
  i,
  a,
  li,
} = van.tags;

const Setting = (props: {}, name: string) =>
  div(
    { class: settings.settingsLabel, ...props },
    label(
      { class: settings.settingsLabel },
      input({
        class: [settings.settingsCheckbox, settings.checkbox].join(" "),
        type: "checkbox",
        checked: false,
      }),
      span(name)
    )
  );

const StatusIcon = {
  added: "fa-solid fa-square-plus",
  removed: "fa-solid fa-square-xmark",
  modified: "fa-solid fa-square-minus",
  error: "fa-solid fa-triangle-exclamation",
};

/** Dark mode block fill colors that TurboWarp use */
const DarkBlocks = {
  "sb3-motion": "#0F1E33",
  "sb3-looks": "#1E1433",
  "sb3-sound": "#291329",
  "sb3-events": "#332600",
  "sb3-control": "#332205",
  "sb3-sensing": "#12232A",
  "sb3-operators": "#112611",
  "sb3-variables": "#331C05",
  "sb3-list": "#331405",
  "sb3-custom": "#331419",
  "sb3-extension": "#03251C",
};

/** Displays differences between previous and current project states and handles commiting the changes to Git */
export class DiffModal extends HTMLDialogElement {
  scripts!: HTMLUListElement;
  commits!: HTMLParagraphElement;
  useHighlights!: HTMLInputElement;
  plainText!: HTMLInputElement;

  previousScripts: any;
  currentScripts: any;

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.querySelector("main")) return;

    const useHighlights = Setting({}, "Use highlights");
    const plainText = Setting({ style: "margin-left: 10px;" }, "Plain text");
    const commits = p(
      { id: "commits" },
      span({ style: "display: flex" }, useHighlights, plainText),
      hr(),
      br(),
      p({ id: "commitView" })
    );
    const closeButton = button(
      {
        id: "closeButton",
        class: settings.settingsButton,
        style: "margin-left: 10px",
        onclick: () => {
          useHighlights.querySelector("input")!.checked = false;
          plainText.querySelector("input")!.checked = false;
          this.close();
        },
      },
      "Okay"
    );

    this.scripts = ul({ id: "scripts" });
    this.useHighlights = useHighlights.querySelector("input")!;
    this.plainText = plainText.querySelector("input")!;
    this.commits = commits.querySelector("#commitView")!;

    van.add(
      this,
      div(
        { class: "sidebar" },
        aside(this.scripts),
        main(
          div(
            { class: "content" },
            commits,
            div(
              { class: ["bottom-bar", "in-diff-modal"].join(" ") },
              closeButton
            )
          )
        )
      )
    );
  }

  // highlights diff as blocks
  highlightDiff() {
    let svg = this.querySelectorAll(".scratchblocks svg > g");
    svg.forEach((blocks) => {
      blocks.querySelectorAll("path.sb3-diff").forEach((diff) => {
        let moddedBlock = diff.previousElementSibling!.cloneNode(
          true
        ) as SVGElement;
        let fillColor = diff.classList.contains("sb3-diff-ins")
          ? "green"
          : diff.classList.contains("sb3-diff-del")
            ? "red"
            : "grey";
        moddedBlock
          .querySelectorAll<SVGPathElement | SVGGElement | SVGRectElement>(
            "path,g,rect"
          ) // g selector isn't needed maybe but just in case..
          .forEach((element) => {
            element.style.cssText = `fill: ${fillColor}; opacity: 0.5`;
          });
        diff.previousElementSibling!.after(moddedBlock);
        diff.remove();
      });
    });
  }

  /** Highlights diff with plain text */
  highlightPlain(diffs: Diff[], script: number) {
    let content = diffs[script].diffed ?? "";
    this.commits.innerHTML = `<pre>${content.trimStart()}</pre><br>`;
    if (this.useHighlights.checked) {
      let highlights = content
        .split("\n")
        .map(
          (e, i) =>
            `<span style="background-color: rgba(${
              e.startsWith("-")
                ? "255,0,0,0.5"
                : e.startsWith("+")
                  ? "0,255,0,0.5"
                  : "0,0,0,0"
            })">${i == 0 ? e.trimStart() : e}</span>`
        );
      this.commits.innerHTML = `<pre>${highlights.join("<br>")}</pre><br>`;
    }
  }

  /** Enables dark diffing upon modal open */
  darkDiff(theme: "dark" | "light") {
    let svg = this.querySelectorAll(".scratchblocks svg > g");
    if (theme === "dark") {
      svg.forEach((blocks) => {
        blocks
          .querySelectorAll<SVGPathElement>("path.sb3-diff")
          .forEach(
            (diff) =>
              (diff.style.cssText = "stroke: white; stroke-width: 3.5px")
          );
      });
    } else {
      svg.forEach((blocks) => {
        blocks
          .querySelectorAll<SVGPathElement>("path.sb3-diff")
          .forEach((diff) => (diff.style.cssText = ""));
      });
    }
  }

  /** Fixes git diff snipping with loop statements */
  removeExtraEnds() {
    if (this.plainText.checked) return;
    let svg = this.querySelector(".scratchblocks svg > g")!;
    svg.querySelectorAll(":scope > g").forEach((blocks) => {
      if (blocks.querySelectorAll("path").length === 1) {
        let block = blocks.querySelector("path")!;
        if (
          block.classList.length === 1 &&
          block.classList.contains("sb3-control") &&
          blocks.querySelector("text")!.innerHTML === "end"
        ) {
          blocks.remove();
        }
      }
    });
  }

  async diff(
    project: Project | undefined,
    spriteName: string,
    script = 0,
    cached = false
  ) {
    // try again in case of undefined
    if (!project) project = await api.getCurrentProject();
    project = project!;

    let oldScripts: any, newScripts: any;
    if (cached) {
      if (
        this.previousScripts === undefined &&
        this.currentScripts === undefined
      ) {
        this.previousScripts = await project.getPreviousScripts(spriteName);
        this.currentScripts = await project.getCurrentScripts(spriteName);
      }
    } else {
      this.previousScripts = await project.getPreviousScripts(spriteName);
      this.currentScripts = await project.getCurrentScripts(spriteName);
    }
    oldScripts = this.previousScripts;
    newScripts = this.currentScripts;

    const diffs = await parseScripts(oldScripts, newScripts);

    if (diffs[script].status === "error") {
      this.useHighlights.checked = false;
      this.useHighlights.disabled = true;
      (this.useHighlights.parentElement!.style as any) =
        "opacity: 0.5; user-select: none";
      this.plainText.checked = false;
      this.plainText.disabled = true;
      (this.plainText.parentElement!.style as any) =
        "opacity: 0.5; user-select: none";
      this.commits.innerText = "Failed to display blocks.";
    } else {
      this.useHighlights.checked = true;
      this.useHighlights.disabled = false;
      (this.useHighlights.parentElement!.style as any) = "";
      this.plainText.checked = true;
      this.plainText.disabled = false;
      (this.plainText.parentElement!.style as any) = "";
    }

    let { blocks: blockTheme, gui: uiTheme } =
      window.ReduxStore.getState().scratchGui.theme.theme;

    let config = {
      style:
        blockTheme === "high-contrast" ? "scratch3-high-contrast" : "scratch3",
      scale: 0.675,
    };

    const diffBlocks = () => {
      window._lib.scratchblocks.appendStyles();
      window._lib.scratchblocks.renderMatching("#commitView", config);

      let svg = this.querySelector(".scratchblocks svg > g")!;

      svg.querySelectorAll("rect.sb3-input-string").forEach((input) => {
        input.setAttribute("rx", "4");
        input.setAttribute("ry", "4");
      });

      svg.querySelectorAll("rect.sb3-input-dropdown").forEach((input) => {
        input.setAttribute("rx", "13");
        input.setAttribute("ry", "13");
      });

      // darken blocks to match tw dark theme
      if (blockTheme === "dark") {
        svg.querySelectorAll(":scope > g").forEach((blocks) => {
          blocks
            .querySelectorAll<SVGPathElement | SVGRectElement>("path, rect")
            .forEach((element) => {
              let darkFill =
                DarkBlocks[
                  element.classList.item(0) as keyof typeof DarkBlocks
                ];
              if (darkFill) {
                element.style.fill = darkFill;
              }
            });
          blocks
            .querySelectorAll<SVGPathElement | SVGRectElement>("path, rect")
            .forEach((element) => {
              let darkFill =
                DarkBlocks[
                  element.classList.item(0) as keyof typeof DarkBlocks
                ];
              if (darkFill) {
                element.style.fill = darkFill;
              }
            });
        });
        svg
          .querySelectorAll<SVGRectElement>("rect.sb3-input")
          .forEach((input) => {
            input.style.fill = "rgb(76, 76, 76)";
          });
        svg
          .querySelectorAll<SVGTextElement>("text.sb3-label")
          .forEach((input) => {
            input.style.fill = "#fff";
          });
        return;
      }

      // adjust dropdown inputs to match tw
      let dropdownChange = {
        three: "brightness(0.83)",
        "high-contrast": "brightness(1.12) saturate(0.7)",
      }[blockTheme];
      if (dropdownChange !== undefined) {
        svg
          .querySelectorAll<SVGRectElement>("rect.sb3-input-dropdown")
          .forEach((input) => {
            input.style.filter = dropdownChange;
          });
      }
    };

    this.scripts.innerHTML = "";
    this.commits.innerText = diffs[script]?.diffed ?? "";
    diffBlocks();
    this.commits.innerHTML += "<br>";

    this.useHighlights.onchange = () => {
      if (this.useHighlights.checked) {
        this.highlightDiff();
        if (this.plainText.checked) {
          this.highlightPlain(diffs, script);
        }
      } else {
        if (this.plainText.checked) {
          let content = diffs[script].diffed ?? "";
          this.commits.innerHTML = `<pre>${content.trimStart()}</pre><br>`;
        } else {
          this.commits.innerText = diffs[script].diffed ?? "";
          diffBlocks();
          this.removeExtraEnds();
          this.commits.innerHTML += "<br>";
        }
      }
      this.darkDiff(uiTheme);
    };

    this.plainText.onchange = () => {
      if (this.plainText.checked) {
        if (this.useHighlights.checked) {
          this.highlightPlain(diffs, script);
        } else {
          let content = diffs[script].diffed ?? "";
          this.commits.innerHTML = `<pre>${content.trimStart()}</pre><br>`;
        }
      } else {
        diffBlocks();
        this.commits.innerHTML += "<br>";
        this.removeExtraEnds();
        if (this.useHighlights.checked) this.highlightDiff();
      }
      this.darkDiff(uiTheme);
    };

    // assign diff displaying to diffs
    diffs.forEach(async (diff, scriptNo) => {
      let diffButton = li(
        button(
          { class: "tab-btn" },
          i({ class: `${StatusIcon[diff.status]} change-icon` }),
          `Script ${diff.scriptNo}`,
          diff.status === "modified" || diff.status === "added"
            ? button(
                {
                  class: `${settings.settingsButton} open-script`,
                  onclick: async (e: Event) => {
                    e.stopPropagation();
                    this.close();
                    // wonder if this is flaky?
                    let id = window.changedScripts[scriptNo];
                    scrollBlockIntoView(id);
                    flash(window.Blockly.getMainWorkspace().getBlockById(id));
                  },
                },
                i({ class: "fa-solid fa-up-right-from-square" })
              )
            : undefined
        )
      );
      diffButton
        .querySelector("button")!
        .setAttribute("script-no", scriptNo.toString());

      if (scriptNo !== script) {
        diffButton.onclick = async () => {
          document
            .querySelectorAll(".tab-btn")
            .forEach((e) => e.classList.remove("active-tab"));
          diffButton.querySelector("button")!.classList.add("active-tab");
          await this.diff(
            project,
            spriteName,
            parseInt(
              this.querySelector("button.active-tab")!.getAttribute(
                "script-no"
              )!
            ),
            true
          );
        };
      }

      this.scripts.appendChild(diffButton);
    });

    document
      .querySelector(`button[script-no="${script}"]`)!
      .classList.add("active-tab");

    // dark mode
    if (uiTheme === "dark")
      document.querySelector("aside")!.classList.add("dark");
    else document.querySelector("aside")!.classList.remove("dark");

    this.darkDiff(uiTheme);
    this.removeExtraEnds();

    this.useHighlights.checked = false;
    this.plainText.checked = false;

    if (diffs[script].status === "error") {
      this.commits.classList.add("display-error");
      this.commits.innerHTML = "";
      this.commits.append(
        p(
          { style: "font-size: 15px" },
          i({ class: "fa-solid fa-circle-exclamation" }),
          br(),
          p(
            "Sorry, but we could not display blocks for this change. (likely because it has an empty if block)",
            br(),
            "However, this change can still be commited.",
            br(),
            a(
              {
                style: "font-size: 13px; text-decoration: none; color: grey",
                href: "https://github.com/apple502j/parse-sb3-blocks/issues/9",
              },
              "see apple502j/parse-sb3-blocks#9"
            )
          )
        )
      );
    } else {
      this.commits.classList.remove("display-error");
    }

    if (!this.open) this.showModal();
  }
}
