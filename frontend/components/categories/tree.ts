import type { Category, CategoryTreeNode, TreeColumn } from "@/types/pages/categories"

export function filterCategories(categories: Category[], searchTerm: string): Category[] {
  const normalizedSearch = searchTerm.trim().toLowerCase()

  if (!normalizedSearch) {
    return categories
  }

  return categories.filter((category) => {
    const haystack = [
      category.название,
      category.описание,
      category.родительская_категория_название,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return haystack.includes(normalizedSearch)
  })
}

export function buildCategoryTree(categories: Category[]): {
  roots: CategoryTreeNode[]
  nodeMap: Map<number, CategoryTreeNode>
} {
  const nodeMap = new Map<number, CategoryTreeNode>()

  categories.forEach((category) => {
    nodeMap.set(category.id, {
      ...category,
      children: [],
      depth: 0,
    })
  })

  const roots: CategoryTreeNode[] = []

  nodeMap.forEach((node) => {
    if (node.родительская_категория_id && nodeMap.has(node.родительская_категория_id)) {
      const parent = nodeMap.get(node.родительская_категория_id)!
      parent.children.push(node)
      return
    }

    roots.push(node)
  })

  const assignDepth = (nodes: CategoryTreeNode[], depth: number) => {
    nodes.forEach((node) => {
      node.depth = depth
      assignDepth(node.children, depth + 1)
    })
  }

  assignDepth(roots, 0)

  return { roots, nodeMap }
}

export function buildSelectedPath(categories: Category[], selectedCategoryId: number | null): number[] {
  if (!selectedCategoryId) {
    return []
  }

  const pathIds: number[] = []
  let current = categories.find((category) => category.id === selectedCategoryId) || null

  while (current) {
    pathIds.unshift(current.id)
    current = current.родительская_категория_id
      ? categories.find((category) => category.id === current!.родительская_категория_id) || null
      : null
  }

  return pathIds
}

export function buildActivePath(
  selectedPathIds: number[],
  nodeMap: Map<number, CategoryTreeNode>
): CategoryTreeNode[] {
  return selectedPathIds
    .map((categoryId) => nodeMap.get(categoryId) || null)
    .filter((node): node is CategoryTreeNode => Boolean(node))
}

export function buildTreeColumns(
  treeRoots: CategoryTreeNode[],
  activePath: CategoryTreeNode[]
): TreeColumn[] {
  const columns: TreeColumn[] = []
  let currentNodes = treeRoots
  let parentId: number | null = null
  let level = 0

  while (currentNodes.length > 0) {
    columns.push({
      parentId,
      level,
      nodes: currentNodes,
    })

    const expandedForLevel = activePath[level]
    const selectedForLevel = expandedForLevel && currentNodes.some((node) => node.id === expandedForLevel.id)
      ? expandedForLevel
      : null

    if (!selectedForLevel || selectedForLevel.children.length === 0) {
      break
    }

    parentId = selectedForLevel.id
    currentNodes = selectedForLevel.children
    level += 1
  }

  return columns
}
