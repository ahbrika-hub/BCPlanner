"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListTodo, Plus } from "lucide-react";

import { can } from "@/lib/permissions";
import { useSession } from "@/components/providers/session-provider";
import {
  searchTasksAction,
  getTaskCreateDataAction,
  type PaletteTaskResult,
  type TaskCreateData,
} from "@/lib/actions/palette";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NewTaskDialogLazy } from "@/components/tasks/new-task-dialog-lazy";

/**
 * App-wide ⌘K / Ctrl-K command palette. Two modes, both reusing existing code:
 *  - "Search tasks" queries the EXISTING full-text search (searchTasksAction →
 *    listTasks) and navigates via the soft router so the @modal task intercept
 *    still fires.
 *  - "Create task" opens the EXISTING create-task dialog (gated on tasks.create);
 *    the form is not reimplemented.
 */
export function CommandPalette() {
  const router = useRouter();
  const { permissions } = useSession();
  const canCreate = can("tasks.create", permissions);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaletteTaskResult[]>([]);
  const [searching, startSearch] = useTransition();

  // Create-task dialog, launched from the palette with data fetched on demand.
  const [createData, setCreateData] = useState<TaskCreateData | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [loadingCreate, startCreate] = useTransition();

  const seq = useRef(0);
  // Track open without re-subscribing the global key listener; synced via effect
  // so the keydown handler always sees the latest value.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const changeOpen = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults([]);
    }
  }, []);

  // Server-driven search (cmdk filtering is disabled). A sequence guard keeps
  // the latest response from being overwritten by a slower earlier one. Driven
  // from the input handler (not an effect) to avoid cascading renders.
  const changeQuery = useCallback(
    (value: string) => {
      setQuery(value);
      const term = value.trim();
      const current = ++seq.current;
      if (!term) {
        setResults([]);
        return;
      }
      startSearch(async () => {
        const res = await searchTasksAction(term);
        if (current === seq.current) setResults(res);
      });
    },
    [startSearch],
  );

  // Global ⌘K / Ctrl-K toggle (event handler — not a render-time setState).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        changeOpen(!openRef.current);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [changeOpen]);

  const goToTask = useCallback(
    (id: string) => {
      changeOpen(false);
      router.push(`/tasks/${id}`);
    },
    [router, changeOpen],
  );

  const openCreate = useCallback(() => {
    changeOpen(false);
    startCreate(async () => {
      const data = await getTaskCreateDataAction();
      if (data) {
        setCreateData(data);
        setCreateOpen(true);
      }
    });
  }, [changeOpen]);

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={changeOpen}
        shouldFilter={false}
        title="Command palette"
        description="Search tasks or create a task"
      >
        <CommandInput
          placeholder="Search tasks…"
          value={query}
          onValueChange={changeQuery}
        />
        <CommandList>
          <CommandEmpty>
            {searching
              ? "Searching…"
              : query.trim()
                ? "No matching tasks."
                : "Type to search tasks."}
          </CommandEmpty>

          {results.length > 0 && (
            <CommandGroup heading="Tasks">
              {results.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`task-${t.id}`}
                  onSelect={() => goToTask(t.id)}
                >
                  <ListTodo />
                  <span className="truncate">{t.title}</span>
                  {t.task_no && (
                    <span className="text-muted-foreground ml-auto font-mono text-xs">
                      {t.task_no}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {canCreate && (
            <CommandGroup heading="Actions">
              <CommandItem
                value="create-task"
                disabled={loadingCreate}
                onSelect={openCreate}
              >
                <Plus />
                Create task
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      {createData && (
        <NewTaskDialogLazy
          {...createData}
          open={createOpen}
          onOpenChange={setCreateOpen}
          showTrigger={false}
        />
      )}
    </>
  );
}
