export function serializeCategory(category) {
    return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        parent_id: category.parentId,
        home_category: category.homeCategory,
        priority: category.priority,
        size_guide_type: category.sizeGuideType,
        track_inventory: category.trackInventory,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
    };
}

export function serializeAdminCategory(category) {
    return {
        ...serializeCategory(category),
        parent: category.parent
            ? {
                id: category.parent.id,
                name: category.parent.name,
                slug: category.parent.slug,
            }
            : null,
    };
}

export function buildCategoryTree(categories) {
    const nodes = categories.map((category) => ({
        ...serializeCategory(category),
        all_children: [],
    }));
    const byId = new Map(nodes.map((category) => [category.id, category]));
    const roots = [];

    nodes.forEach((category) => {
        const parent = category.parent_id ? byId.get(category.parent_id) : null;
        if (parent) parent.all_children.push(category);
        else roots.push(category);
    });

    const sortTree = (items) => {
        items.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
        items.forEach((item) => sortTree(item.all_children));
        return items;
    };

    return sortTree(roots);
}