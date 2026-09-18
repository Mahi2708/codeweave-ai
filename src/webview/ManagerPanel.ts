import * as vscode from "vscode";
import { ProjectNode } from "../types";
import { formatMarkdownTree } from "../tree/TreeFormatter";

export class ManagerPanel {
    private panel?: vscode.WebviewPanel;
    private root?: ProjectNode;

    constructor(
        private readonly extensionUri: vscode.Uri
    ) {}

    public show(
        root: ProjectNode,
        onRename: (
            relativePath: string,
            newName: string
        ) => Promise<void>
    ): void {
        this.root = root;

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            this.panel.webview.postMessage({
                command: "setRoot",
                root
            });
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            "codeweaveManager",
            "Editree AI",
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getHtml(root);

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                try {
                    switch (message.command) {
                        case "generateTree": {
                            if (!this.root) {
                                return;
                            }

                            const selected = new Set<string>(
                                message.selected ?? []
                            );

                            const tree = formatMarkdownTree(
                                this.root,
                                selected
                            );

                            await vscode.env.clipboard.writeText(tree);

                            this.panel?.webview.postMessage({
                                command: "previewTree",
                                tree
                            });

                            vscode.window.showInformationMessage(
                                "Project tree copied to clipboard."
                            );

                            break;
                        }

                        case "copyPreview": {
                            const tree = String(message.tree ?? "");

                            await vscode.env.clipboard.writeText(tree);

                            vscode.window.showInformationMessage(
                                "Project tree copied."
                            );

                            break;
                        }

                        case "rename": {
                            const relativePath =
                                String(message.relativePath);

                            const currentName =
                                relativePath.split(/[\\/]/).pop() || "";

                            const newName =
                                await vscode.window.showInputBox({
                                    title: "Rename",
                                    prompt: "Enter the new file or folder name",
                                    value: currentName,
                                    validateInput: (value) => {
                                        const trimmed = value.trim();

                                        if (!trimmed) {
                                            return "Name cannot be empty.";
                                        }

                                        if (
                                            /[<>:"/\\|?*]/.test(trimmed)
                                        ) {
                                            return "Name contains invalid characters.";
                                        }

                                        return undefined;
                                    }
                                });

                            if (!newName) {
                                break;
                            }

                            await onRename(
                                relativePath,
                                newName.trim()
                            );

                            break;
                        }
                    }
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : String(error);

                    vscode.window.showErrorMessage(
                        `Editree: ${message}`
                    );
                }
            },
            undefined,
            []
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private getHtml(root: ProjectNode): string {
        const nonce = getNonce();

        const rootJson = JSON.stringify(root).replace(
            /</g,
            "\\u003c"
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">

    <meta
        http-equiv="Content-Security-Policy"
        content="
            default-src 'none';
            style-src 'unsafe-inline';
            script-src 'nonce-${nonce}';
        "
    />

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    />

    <title>Editree AI</title>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            font-family: var(
                --vscode-font-family
            );
            font-size: var(--vscode-font-size);
        }

        h1 {
            margin: 0 0 6px;
            font-size: 24px;
        }

        .description {
            margin-bottom: 18px;
            color: var(
                --vscode-descriptionForeground
            );
            line-height: 1.5;
        }

        .toolbar {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 12px;
        }

        .search {
            flex: 1;
            min-width: 220px;
            padding: 8px 10px;
            border: 1px solid
                var(--vscode-input-border);
            background:
                var(--vscode-input-background);
            color:
                var(--vscode-input-foreground);
            outline: none;
        }

        .search:focus {
            border-color:
                var(--vscode-focusBorder);
        }

        button {
            border: none;
            padding: 8px 13px;
            cursor: pointer;
            color:
                var(--vscode-button-foreground);
            background:
                var(--vscode-button-background);
        }

        button:hover {
            background:
                var(--vscode-button-hoverBackground);
        }

        .secondary {
            color:
                var(--vscode-button-secondaryForeground);
            background:
                var(--vscode-button-secondaryBackground);
        }

        .secondary:hover {
            background:
                var(--vscode-button-secondaryHoverBackground);
        }

        .tree-container {
            border: 1px solid
                var(--vscode-panel-border);

            background:
                var(--vscode-sideBar-background);

            max-height: 58vh;
            overflow: auto;

            padding: 8px 8px 12px;
        }

        .tree {
            min-width: max-content;
        }

        .node {
            position: relative;
        }

        .node-row {
            display: flex;
            align-items: center;

            min-height: 28px;

            padding: 2px 5px;

            border-radius: 4px;

            white-space: nowrap;
        }

        .node-row:hover {
            background:
                var(--vscode-list-hoverBackground);
        }

        .node-row.selected-row {
            background:
                var(--vscode-list-activeSelectionBackground);
        }

        .branch {
            display: inline-block;

            width: 22px;

            text-align: center;

            color:
                var(--vscode-descriptionForeground);

            flex-shrink: 0;
        }

        .branch-button {
            border: none;

            width: 22px;
            height: 22px;

            padding: 0;

            background: transparent;

            color:
                var(--vscode-foreground);

            cursor: pointer;

            font-size: 13px;
        }

        .branch-button:hover {
            background:
                var(--vscode-toolbar-hoverBackground);
        }

        .tree-checkbox {
            width: 16px;
            height: 16px;

            margin: 0 7px 0 2px;

            flex-shrink: 0;
        }

        .icon {
            width: 22px;

            display: inline-block;

            margin-right: 5px;

            text-align: center;

            flex-shrink: 0;
        }

        .name {
            overflow: hidden;

            text-overflow: ellipsis;
        }

        .folder-name {
            font-weight: 500;
        }

        .children {
            margin-left: 22px;

            padding-left: 7px;

            border-left: 1px solid
                var(--vscode-tree-indentGuidesStroke);
        }

        .actions {
            margin-left: auto;

            padding-left: 20px;

            opacity: 0;
        }

        .node-row:hover .actions {
            opacity: 1;
        }

        .rename {
            padding: 3px 7px;

            color:
                var(--vscode-descriptionForeground);

            background: transparent;
        }

        .rename:hover {
            color:
                var(--vscode-foreground);

            background:
                var(--vscode-toolbar-hoverBackground);
        }

        .ignored {
            opacity: 0.45;
        }

        .count {
            margin-top: 8px;

            color:
                var(--vscode-descriptionForeground);
        }

        .preview {
            margin-top: 16px;

            border: 1px solid
                var(--vscode-panel-border);

            background:
                var(--vscode-textCodeBlock-background);

            padding: 12px;
        }

        .preview-header {
            display: flex;

            align-items: center;

            justify-content: space-between;

            margin-bottom: 8px;
        }

        .preview-title {
            font-weight: 600;
        }

        pre {
            margin: 0;

            overflow: auto;

            white-space: pre;

            font-family:
                var(--vscode-editor-font-family);

            font-size:
                var(--vscode-editor-font-size);

            line-height: 1.45;
        }

        .hidden {
            display: none;
        }

        .empty {
            padding: 20px;

            color:
                var(--vscode-descriptionForeground);

            text-align: center;
        }
    </style>
</head>

<body>

    <h1>Editree AI</h1>

    <div class="description">
        Select files and folders to generate a project tree.
        Ignored paths are excluded by default.
    </div>

    <div class="toolbar">

        <input
            id="search"
            class="search"
            type="text"
            placeholder="Filter files and folders..."
        />

        <button id="selectAll">
            Select all
        </button>

        <button
            id="clear"
            class="secondary"
        >
            Clear
        </button>

        <button id="generate">
            Generate & Copy Tree
        </button>

    </div>

    <div
        id="treeContainer"
        class="tree-container"
    >
        <div
            id="tree"
            class="tree"
        ></div>
    </div>

    <div
        id="count"
        class="count"
    ></div>

    <div
        id="preview"
        class="preview hidden"
    >

        <div class="preview-header">

            <div class="preview-title">
                Generated Project Tree
            </div>

            <button
                id="copyPreview"
                class="secondary"
            >
                Copy
            </button>

        </div>

        <pre id="previewText"></pre>

    </div>

<script nonce="${nonce}">

    const vscode =
        acquireVsCodeApi();

    let root =
        ${rootJson};

    const selected =
        new Set();

    const expanded =
        new Set();

    let searchQuery = "";

    const treeElement =
        document.getElementById("tree");

    const countElement =
        document.getElementById("count");

    const searchElement =
        document.getElementById("search");

    const previewElement =
        document.getElementById("preview");

    const previewTextElement =
        document.getElementById("previewText");

    const matchCache =
        new Map();

    const selectionCache =
        new Map();


    // --------------------------------------------------
    // Tree utilities
    // --------------------------------------------------

    function getChildren(node) {
        return Array.isArray(node.children)
            ? node.children
            : [];
    }


    function walk(node, callback) {

        callback(node);

        for (const child of getChildren(node)) {
            walk(child, callback);
        }
    }


    function collectAll(node) {

        for (const child of getChildren(node)) {

            if (!child.ignored) {
                selected.add(
                    child.relativePath
                );
            }

            collectAll(child);
        }
    }


    function setBranch(
        node,
        shouldSelect
    ) {

        if (
            node.relativePath &&
            !node.ignored
        ) {

            if (shouldSelect) {
                selected.add(
                    node.relativePath
                );
            } else {
                selected.delete(
                    node.relativePath
                );
            }
        }

        for (const child of getChildren(node)) {
            setBranch(
                child,
                shouldSelect
            );
        }
    }


    // --------------------------------------------------
    // Search
    // --------------------------------------------------

    function calculateMatches(node) {

        const selfMatches =
            !searchQuery ||
            node.name
                .toLowerCase()
                .includes(searchQuery);

        let childMatches = false;

        for (
            const child of getChildren(node)
        ) {

            if (
                calculateMatches(child)
            ) {
                childMatches = true;
            }
        }

        const result = {
            self: selfMatches,
            descendant: childMatches,
            visible:
                selfMatches ||
                childMatches
        };

        matchCache.set(
            node.relativePath,
            result
        );

        return result.visible;
    }


    // --------------------------------------------------
    // Selection state
    // --------------------------------------------------

    function calculateSelection(node) {

        let total = 0;
        let selectedCount = 0;

        if (
            node.relativePath &&
            !node.ignored
        ) {

            total++;

            if (
                selected.has(
                    node.relativePath
                )
            ) {
                selectedCount++;
            }
        }

        for (
            const child of getChildren(node)
        ) {

            const childState =
                calculateSelection(child);

            total += childState.total;

            selectedCount +=
                childState.selected;
        }

        const result = {
            total,
            selected: selectedCount
        };

        selectionCache.set(
            node.relativePath,
            result
        );

        return result;
    }


    // --------------------------------------------------
    // Render
    // --------------------------------------------------

    function renderTree() {

        matchCache.clear();
        selectionCache.clear();

        calculateMatches(root);
        calculateSelection(root);

        treeElement.innerHTML = "";

        const rootElement =
            renderNode(
                root,
                true
            );

        treeElement.appendChild(
            rootElement
        );

        updateCount();
    }


    function renderNode(
        node,
        isRoot = false
    ) {

        const wrapper =
            document.createElement("div");

        wrapper.className = "node";

        const match =
            matchCache.get(
                node.relativePath
            );

        if (
            searchQuery &&
            !match.visible
        ) {
            wrapper.classList.add(
                "hidden"
            );
        }


        // ------------------------------------------
        // Row
        // ------------------------------------------

        const row =
            document.createElement("div");

        row.className =
            "node-row";


        // ------------------------------------------
        // Branch / expand button
        // ------------------------------------------

        const branch =
            document.createElement("span");

        branch.className =
            "branch";


        const children =
            getChildren(node);

        const isFolder =
            node.kind === "directory";

        if (
            isFolder &&
            children.length > 0
        ) {

            const toggle =
                document.createElement("button");

            toggle.className =
                "branch-button";

            const isExpanded =
                isRoot ||
                expanded.has(
                    node.relativePath
                ) ||
                (
                    searchQuery &&
                    match.descendant
                );

            toggle.textContent =
                isExpanded
                    ? "▼"
                    : "▶";

            toggle.title =
                isExpanded
                    ? "Collapse"
                    : "Expand";

            toggle.addEventListener(
                "click",
                () => {

                    if (
                        expanded.has(
                            node.relativePath
                        )
                    ) {

                        expanded.delete(
                            node.relativePath
                        );

                    } else {

                        expanded.add(
                            node.relativePath
                        );
                    }

                    renderTree();
                }
            );

            branch.appendChild(
                toggle
            );

        } else {

            branch.textContent =
                "";
        }

        row.appendChild(
            branch
        );


        // ------------------------------------------
        // Checkbox
        // ------------------------------------------

        const checkbox =
            document.createElement("input");

        checkbox.type =
            "checkbox";

        checkbox.className =
            "tree-checkbox";

        checkbox.disabled =
            isRoot ||
            Boolean(node.ignored);

        const state =
            selectionCache.get(
                node.relativePath
            );

        if (
            !isRoot &&
            !node.ignored &&
            state
        ) {

            checkbox.checked =
                state.total > 0 &&
                state.selected ===
                    state.total;

            checkbox.indeterminate =
                state.selected > 0 &&
                state.selected <
                    state.total;
        }

        checkbox.addEventListener(
            "change",
            () => {

                setBranch(
                    node,
                    checkbox.checked
                );

                renderTree();
            }
        );

        row.appendChild(
            checkbox
        );


        // ------------------------------------------
        // Icon
        // ------------------------------------------

        const icon =
            document.createElement("span");

        icon.className =
            "icon";

        icon.textContent =
            isFolder
                ? "📁"
                : "📄";

        row.appendChild(
            icon
        );


        // ------------------------------------------
        // Name
        // ------------------------------------------

        const name =
            document.createElement("span");

        name.className =
            "name";

        if (isFolder) {
            name.classList.add(
                "folder-name"
            );
        }

        name.textContent =
            node.name +
            (isFolder ? "/" : "");

        row.appendChild(
            name
        );


        // ------------------------------------------
        // Ignored styling
        // ------------------------------------------

        if (node.ignored) {

            row.classList.add(
                "ignored"
            );
        }


        // ------------------------------------------
        // Rename
        // ------------------------------------------

        if (!isRoot) {

            const actions =
                document.createElement("div");

            actions.className =
                "actions";

            const rename =
                document.createElement("button");

            rename.className =
                "rename";

            rename.textContent =
                "✎";

            rename.title =
                "Rename";

            rename.addEventListener(
                "click",
                () => {

                    vscode.postMessage({
                        command: "rename",
                        relativePath:
                            node.relativePath
                    });
                }
            );

            actions.appendChild(
                rename
            );

            row.appendChild(
                actions
            );
        }


        wrapper.appendChild(
            row
        );


        // ------------------------------------------
        // Children
        // ------------------------------------------

        if (
            isFolder &&
            children.length > 0
        ) {

            const childrenContainer =
                document.createElement("div");

            childrenContainer.className =
                "children";

            const isExpanded =
                isRoot ||
                expanded.has(
                    node.relativePath
                ) ||
                (
                    searchQuery &&
                    match.descendant
                );

            if (!isExpanded) {

                childrenContainer.classList.add(
                    "hidden"
                );
            }

            for (
                const child of children
            ) {

                childrenContainer.appendChild(
                    renderNode(child)
                );
            }

            wrapper.appendChild(
                childrenContainer
            );
        }

        return wrapper;
    }


    // --------------------------------------------------
    // Selected file count
    // --------------------------------------------------

    function countSelectedFiles(node) {

        let count = 0;

        if (
            node.kind === "file" &&
            selected.has(
                node.relativePath
            )
        ) {
            count++;
        }

        for (
            const child of getChildren(node)
        ) {
            count +=
                countSelectedFiles(child);
        }

        return count;
    }


    function updateCount() {

        const count =
            countSelectedFiles(root);

        countElement.textContent =
            count === 1
                ? "1 file selected"
                : count +
                  " files selected";
    }


    // --------------------------------------------------
    // Search
    // --------------------------------------------------

    searchElement.addEventListener(
        "input",
        () => {

            searchQuery =
                searchElement.value
                    .trim()
                    .toLowerCase();

            renderTree();
        }
    );


    // --------------------------------------------------
    // Select all
    // --------------------------------------------------

    document
        .getElementById("selectAll")
        .addEventListener(
            "click",
            () => {

                selected.clear();

                collectAll(root);

                renderTree();
            }
        );


    // --------------------------------------------------
    // Clear
    // --------------------------------------------------

    document
        .getElementById("clear")
        .addEventListener(
            "click",
            () => {

                selected.clear();

                renderTree();
            }
        );


    // --------------------------------------------------
    // Generate
    // --------------------------------------------------

    document
        .getElementById("generate")
        .addEventListener(
            "click",
            () => {

                if (
                    selected.size === 0
                ) {

                    previewElement
                        .classList
                        .add("hidden");

                    return;
                }

                vscode.postMessage({
                    command:
                        "generateTree",

                    selected:
                        Array.from(selected)
                });
            }
        );


    // --------------------------------------------------
    // Copy preview
    // --------------------------------------------------

    document
        .getElementById("copyPreview")
        .addEventListener(
            "click",
            () => {

                vscode.postMessage({
                    command:
                        "copyPreview",

                    tree:
                        previewTextElement
                            .textContent
                });
            }
        );


    // --------------------------------------------------
    // Messages from extension
    // --------------------------------------------------

    window.addEventListener(
        "message",
        event => {

            const message =
                event.data;

            switch (
                message.command
            ) {

                case "previewTree":

                    previewTextElement
                        .textContent =
                            message.tree;

                    previewElement
                        .classList
                        .remove("hidden");

                    break;


                case "setRoot":

                    root =
                        message.root;

                    selected.clear();

                    expanded.clear();

                    expanded.add("");

                    collectAll(root);

                    renderTree();

                    break;
            }
        }
    );


    // --------------------------------------------------
    // Initial state
    // --------------------------------------------------

    expanded.add("");

    collectAll(root);

    renderTree();

</script>

</body>
</html>`;
    }
}

function getNonce(): string {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let result = "";

    for (let i = 0; i < 32; i++) {
        result +=
            chars.charAt(
                Math.floor(
                    Math.random() *
                    chars.length
                )
            );
    }

    return result;
}