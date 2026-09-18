import { ProjectNode } from "../types";

function shouldInclude(
    node: ProjectNode,
    selected: Set<string>
): boolean {
    // Directly selected
    if (selected.has(node.relativePath)) {
        return true;
    }

    // Include a parent folder when one of its children is selected.
    if (node.children) {
        return node.children.some(child =>
            shouldInclude(child, selected)
        );
    }

    return false;
}

function renderNode(
    node: ProjectNode,
    prefix: string,
    isLast: boolean,
    selected: Set<string>,
    lines: string[]
): void {
    const connector = isLast ? "└── " : "├── ";

    lines.push(
        `${prefix}${connector}${node.name}${node.kind === "directory" ? "/" : ""}`
    );

    if (!node.children || node.children.length === 0) {
        return;
    }

    const visibleChildren = node.children.filter(child =>
        shouldInclude(child, selected)
    );

    const childPrefix = prefix + (isLast ? "    " : "│   ");

    visibleChildren.forEach((child, index) => {
        const childIsLast = index === visibleChildren.length - 1;

        renderNode(
            child,
            childPrefix,
            childIsLast,
            selected,
            lines
        );
    });
}

export function formatMarkdownTree(
    root: ProjectNode,
    selected: Set<string>
): string {
    const lines: string[] = [];

    // Root
    lines.push(`${root.name}/`);

    if (!root.children || root.children.length === 0) {
        return lines.join("\n");
    }

    const visibleChildren = root.children.filter(child =>
        shouldInclude(child, selected)
    );

    visibleChildren.forEach((child, index) => {
        const isLast = index === visibleChildren.length - 1;

        renderNode(
            child,
            "",
            isLast,
            selected,
            lines
        );
    });

    return lines.join("\n");
}