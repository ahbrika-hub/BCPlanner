import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "./types";

export type ProjectTemplateRow = Tables["project_templates"]["Row"];
export type ProjectTemplateTaskRow = Tables["project_template_tasks"]["Row"];

export type ProjectTemplateWithTasks = ProjectTemplateRow & {
  tasks: ProjectTemplateTaskRow[];
};

const SELECT = `*, tasks:project_template_tasks(*)`;

function sortTasks(t: ProjectTemplateWithTasks): ProjectTemplateWithTasks {
  return { ...t, tasks: [...t.tasks].sort((a, b) => a.position - b.position) };
}

/** All templates with their task defs (RLS: projects.read), active first. */
export async function listProjectTemplates(): Promise<
  ProjectTemplateWithTasks[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_templates")
    .select(SELECT)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ProjectTemplateWithTasks[]).map(sortTasks);
}

/** Active templates with task defs, for the "create project from template" picker. */
export async function listActiveProjectTemplates(): Promise<
  ProjectTemplateWithTasks[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_templates")
    .select(SELECT)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ProjectTemplateWithTasks[]).map(sortTasks);
}

/** One template with its task defs (RLS-scoped), or null. */
export async function getProjectTemplate(
  id: string,
): Promise<ProjectTemplateWithTasks | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_templates")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? sortTasks(data as unknown as ProjectTemplateWithTasks) : null;
}

export async function createProjectTemplate(
  input: Tables["project_templates"]["Insert"],
): Promise<ProjectTemplateRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_templates")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProjectTemplate(
  id: string,
  patch: Tables["project_templates"]["Update"],
): Promise<ProjectTemplateRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_templates")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteProjectTemplate(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_templates")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Replace a template's task defs: delete existing children, insert the new set. */
export async function setTemplateTasks(
  templateId: string,
  defs: Omit<Tables["project_template_tasks"]["Insert"], "template_id">[],
): Promise<void> {
  const supabase = await createClient();
  const { error: delErr } = await supabase
    .from("project_template_tasks")
    .delete()
    .eq("template_id", templateId);
  if (delErr) throw new Error(delErr.message);
  if (defs.length === 0) return;
  const rows = defs.map((d, i) => ({
    ...d,
    template_id: templateId,
    position: i,
  }));
  const { error: insErr } = await supabase
    .from("project_template_tasks")
    .insert(rows);
  if (insErr) throw new Error(insErr.message);
}
