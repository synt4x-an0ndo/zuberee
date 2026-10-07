"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import notify from "@/components/notify";

export default function CategoryForm({ initial, id }) {
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [form, setForm] = useState({
        name: "",
        slug: "",
        description: "",
        ...(initial || {}),
    });

    useEffect(() => {
        if (initial) setForm((current) => ({ ...current, ...initial }));
    }, [initial]);

    const validate = () => {
        const nextErrors = {};
        if (!form.name.trim()) nextErrors.name = "Category name is required";
        if (form.name.length > 100) nextErrors.name = "Category name must be less than 100 characters";
        if (!form.slug.trim()) nextErrors.slug = "Category slug is required";
        else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
            nextErrors.slug = "Use lowercase letters, numbers, and hyphens only";
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

    const submit = async (event) => {
        event.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                slug: form.slug.trim(),
                description: form.description.trim(),
            };
            if (id) {
                await api.put(`api/categories/${id}`, payload);
                notify.success("Category updated successfully");
            } else {
                await api.post("api/categories", payload);
                notify.success("Category created successfully");
            }
            window.location.href = "/dashboard/category";
        } catch (error) {
            notify.error(error?.message || "Failed to save category");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="row justify-content-center">
            <div className="col-lg-8">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="mb-0 fw-bold">{id ? "Edit Category" : "Add Category"}</h4>
                    <Link href="/dashboard/category" className="btn btn-sm btn-outline-secondary">
                        Back to Categories
                    </Link>
                </div>
                <div className="card border-0 shadow-sm">
                    <div className="card-body p-4">
                        <form onSubmit={submit}>
                            <div className="mb-3">
                                <label className="form-label fw-semibold">
                                    Category Name <span className="text-danger">*</span>
                                </label>
                                <input
                                    className={`form-control ${errors.name ? "is-invalid" : ""}`}
                                    value={form.name}
                                    maxLength={100}
                                    onChange={(event) => set("name", event.target.value)}
                                    required
                                />
                                {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                            </div>
                            <div className="mb-3">
                                <label className="form-label fw-semibold">
                                    Category Slug <span className="text-danger">*</span>
                                </label>
                                <input
                                    className={`form-control ${errors.slug ? "is-invalid" : ""}`}
                                    value={form.slug}
                                    onChange={(event) => set("slug", event.target.value)}
                                    required
                                />
                                {errors.slug && <div className="invalid-feedback">{errors.slug}</div>}
                            </div>
                            <div className="mb-3">
                                <label className="form-label fw-semibold">Description</label>
                                <textarea
                                    className="form-control"
                                    rows={4}
                                    value={form.description}
                                    onChange={(event) => set("description", event.target.value)}
                                />
                            </div>
                            <div className="d-flex gap-2">
                                <button className="btn btn-grad px-4 fw-semibold" disabled={saving}>
                                    {saving ? "Saving..." : id ? "Update Category" : "Create Category"}
                                </button>
                                <Link href="/dashboard/category" className="btn btn-outline-secondary px-4">
                                    Cancel
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
