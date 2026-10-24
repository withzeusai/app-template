// Browser page translation (Chrome, Edge, Safari) replaces the text nodes
// React rendered. When React later removes or moves one of those nodes, the
// DOM throws NotFoundError and the whole app unmounts. These guards keep the
// page working when a node is no longer where React left it: a removal is
// skipped, and an insertion before a moved node appends instead, so the new
// node still shows. See https://github.com/facebook/react/issues/11538.
export function guardDomAgainstTranslation() {
  if (typeof Node !== "function") return;

  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T) {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child) as T;
  };

  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    node: T,
    child: Node | null,
  ) {
    const anchor = child && child.parentNode !== this ? null : child;
    return insertBefore.call(this, node, anchor) as T;
  };
}
